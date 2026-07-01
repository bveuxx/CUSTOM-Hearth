import {
	getAllTags,
	Platform,
	prepareFuzzySearch,
	setIcon,
	TAbstractFile,
	TFile,
	TFolder,
} from "obsidian";
import type { HomeView } from "./view";
import {
	FILE_TYPE_GROUPS,
	FileTypeGroup,
	groupForFile,
	iconForFile,
} from "./filetypes";

interface SearchHit {
	file: TAbstractFile;
	score: number;
	/** Set when this hit matched via a tag or frontmatter property, not its
	 * name/path — shown instead of the folder path so it's obvious why it's
	 * in the results, and picks the result's icon. */
	badge?: { icon: string; label: string };
}

/** Property keys are matched as plain identifiers (letters/digits/_/-)
 * followed by a colon — a shape real file names can't take (":" isn't a
 * legal filename character on Windows/macOS), so it never collides with a
 * name search. */
const PROPERTY_QUERY = /^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/;

const MAX_RESULTS = 40;

/** Stringify a frontmatter value for display/matching (arrays are handled by
 * the caller, one element at a time). */
function formatPropertyValue(v: unknown): string {
	if (v == null) return "";
	if (typeof v === "object") return JSON.stringify(v);
	return String(v);
}
/** Recently opened-via-search files, kept in the vault's local storage (never
 * in settings/data.json) so it stays out of the settings UI and layout
 * export entirely — a quiet convenience, not a feature to configure. */
const HISTORY_KEY = "hearth-search-history";
const HISTORY_MAX = 6;

/**
 * The search field + auto-detected file-type filter chips + results dropdown.
 * Searches the whole vault (Obsidian's vault index already excludes the
 * .obsidian config folder).
 */
export class SearchSection {
	private view: HomeView;
	private activeFilter: string | null = null;

	private inputEl!: HTMLInputElement;
	private resultsEl!: HTMLElement;
	/** The whole search section (bar + results + filters) — used to decide when
	 * a click counts as "outside" and should close the dropdown. */
	private rootEl: HTMLElement | null = null;
	private rows: { el: HTMLElement; open: () => void }[] = [];
	private selected = -1;

	constructor(view: HomeView) {
		this.view = view;
	}

	/** Renders the search bar (icon + input). The caller places the New-note
	 * button beside the returned bar element. */
	renderBar(parent: HTMLElement): HTMLElement {
		const bar = parent.createDiv("hearth-search-bar");
		const icon = bar.createDiv("hearth-search-icon");
		setIcon(icon, "search");

		this.inputEl = bar.createEl("input", {
			cls: "hearth-search-input",
			attr: {
				type: "text",
				placeholder: this.view.plugin.settings.searchPlaceholder || "Search the vault",
				spellcheck: "false",
			},
		});

		this.inputEl.addEventListener("input", () => this.update());
		this.inputEl.addEventListener("focus", () => this.update());
		this.inputEl.addEventListener("keydown", (e) => this.onKeyDown(e));

		return bar;
	}

	/** Renders the results dropdown (as an overlay inside `overlayParent`, which
	 * must be positioned) and the filter chip row (under `boundary`). `boundary`
	 * wraps the whole search section and is the click-outside dismissal area. */
	renderResultsAndFilters(overlayParent: HTMLElement, boundary: HTMLElement): void {
		this.rootEl = boundary;
		this.resultsEl = overlayParent.createDiv("hearth-search-results");
		this.resultsEl.hide();
		this.renderFilters(boundary);

		// Close the dropdown when clicking outside the whole search section.
		// Registered here (not in renderBar) so clicks on the filter chips —
		// which live below the bar — count as inside and don't dismiss results.
		this.view.registerDomEvent(this.view.containerEl.ownerDocument, "click", (e) => {
			if (!boundary.contains(e.target as Node)) this.hide();
		});
	}

	// ---- Filters --------------------------------------------------------

	private detectGroups(): FileTypeGroup[] {
		const present = new Set<string>();
		let hasFolders = false;
		for (const f of this.view.app.vault.getAllLoadedFiles()) {
			if (f instanceof TFolder) {
				if (f.path !== "/") hasFolders = true;
				continue;
			}
			const g = groupForFile(f);
			if (g) present.add(g.id);
		}
		const hidden = new Set(this.view.plugin.settings.hiddenFilters);
		return FILE_TYPE_GROUPS.filter((g) => {
			if (hidden.has(g.id)) return false;
			if (g.id === "folders") return hasFolders;
			return present.has(g.id);
		});
	}

	private renderFilters(parent: HTMLElement): void {
		const groups = this.detectGroups();
		if (groups.length === 0) return;

		const row = parent.createDiv("hearth-filters");
		for (const group of groups) {
			const chip = row.createDiv("hearth-filter");
			chip.toggleClass("is-active", this.activeFilter === group.id);
			setIcon(chip.createDiv("hearth-filter-icon"), group.icon);
			chip.setAttribute("aria-label", group.label);
			chip.addEventListener("click", () => {
				this.activeFilter = this.activeFilter === group.id ? null : group.id;
				parent
					.querySelectorAll(".hearth-filter")
					.forEach((c) => c.removeClass("is-active"));
				chip.toggleClass("is-active", this.activeFilter === group.id);
				this.update();
				// On desktop, refocus the field for quick typing; on mobile this
				// would pop the on-screen keyboard and cover the results, so skip.
				if (!Platform.isMobile) this.inputEl.focus();
			});
		}
	}

	// ---- Searching ------------------------------------------------------

	private update(): void {
		const query = this.inputEl.value.trim();
		if (!query && !this.activeFilter) {
			this.renderHistory();
			return;
		}
		this.renderResults(this.search(query));
	}

	/** With nothing typed, quietly offer recently opened files instead of an
	 * empty dropdown — reuses the exact same result row so it looks like an
	 * ordinary result, not a distinct "history" feature. */
	private renderHistory(): void {
		const files = this.getHistory()
			.map((p) => this.view.app.vault.getAbstractFileByPath(p))
			.filter((f): f is TFile => f instanceof TFile);
		if (files.length === 0) {
			this.hide();
			return;
		}
		this.renderResults(files.map((file) => ({ file, score: 0 })));
	}

	private getHistory(): string[] {
		const raw = this.view.app.loadLocalStorage(HISTORY_KEY);
		return Array.isArray(raw) ? raw.filter((p): p is string => typeof p === "string") : [];
	}

	private pushHistory(path: string): void {
		const next = [path, ...this.getHistory().filter((p) => p !== path)].slice(0, HISTORY_MAX);
		this.view.app.saveLocalStorage(HISTORY_KEY, next);
	}

	private search(query: string): SearchHit[] {
		// A leading "#" switches to tag search, and "key:value" switches to
		// frontmatter property search — both deliberately distinct modes (not
		// silently mixed into name search) so it's always clear what matched.
		if (query.startsWith("#")) return this.searchByTag(query.slice(1));
		const propertyQuery = PROPERTY_QUERY.exec(query);
		if (propertyQuery) return this.searchByProperty(propertyQuery[1], propertyQuery[2]);

		const filter = this.activeFilter;
		const includeFolders = !filter || filter === "folders";
		const includeFiles = filter !== "folders";

		const candidates: TAbstractFile[] = [];
		for (const f of this.view.app.vault.getAllLoadedFiles()) {
			if (f instanceof TFolder) {
				if (includeFolders && f.path !== "/") candidates.push(f);
				continue;
			}
			if (!includeFiles) continue;
			if (filter && filter !== "folders") {
				if (groupForFile(f)?.id !== filter) continue;
			}
			candidates.push(f);
		}

		if (!query) {
			return candidates
				.sort((a, b) => a.name.localeCompare(b.name))
				.slice(0, MAX_RESULTS)
				.map((file) => ({ file, score: 0 }));
		}

		const fuzzy = prepareFuzzySearch(query);
		const hits: SearchHit[] = [];
		for (const file of candidates) {
			const match = fuzzy(file.name) ?? fuzzy(file.path);
			if (match) hits.push({ file, score: match.score });
		}
		hits.sort((a, b) => b.score - a.score);
		return hits.slice(0, MAX_RESULTS);
	}

	/** Tag search (query has had its leading "#" stripped). Matches vault tags
	 * themselves, not file names — an empty query after "#" browses every
	 * tagged file. Ignores the file-type filter chips, which don't apply to
	 * tags across file types. */
	private searchByTag(raw: string): SearchHit[] {
		const q = raw.trim().toLowerCase();
		const hits: SearchHit[] = [];
		for (const file of this.view.app.vault.getMarkdownFiles()) {
			const cache = this.view.app.metadataCache.getFileCache(file);
			if (!cache) continue;
			const tags = getAllTags(cache);
			if (!tags || tags.length === 0) continue;
			const matched = q ? tags.find((t) => t.slice(1).toLowerCase().includes(q)) : tags[0];
			if (matched) hits.push({ file, score: 0, badge: { icon: "tag", label: matched } });
		}
		hits.sort((a, b) => a.file.name.localeCompare(b.file.name));
		return hits.slice(0, MAX_RESULTS);
	}

	/** Frontmatter property search ("key" and "value" already split on the
	 * first ":"). The key matches exactly (case-insensitive) — property names
	 * are structured identifiers, not fuzzy text — and an empty value browses
	 * every file that has the property set at all, mirroring tag search. */
	private searchByProperty(key: string, rawValue: string): SearchHit[] {
		const value = rawValue.trim().toLowerCase();
		const hits: SearchHit[] = [];
		for (const file of this.view.app.vault.getMarkdownFiles()) {
			const fm = this.view.app.metadataCache.getFileCache(file)?.frontmatter;
			if (!fm) continue;
			const actualKey = Object.keys(fm).find((k) => k.toLowerCase() === key.toLowerCase());
			if (!actualKey || fm[actualKey] == null) continue;

			const values = Array.isArray(fm[actualKey]) ? fm[actualKey] : [fm[actualKey]];
			const matched = value
				? values.find((v: unknown) => formatPropertyValue(v).toLowerCase().includes(value))
				: values[0];
			if (matched === undefined) continue;
			hits.push({ file, score: 0, badge: { icon: "list", label: `${actualKey}: ${formatPropertyValue(matched)}` } });
		}
		hits.sort((a, b) => a.file.name.localeCompare(b.file.name));
		return hits.slice(0, MAX_RESULTS);
	}

	// ---- Results rendering ---------------------------------------------

	private renderResults(hits: SearchHit[]): void {
		this.resultsEl.empty();
		this.rows = [];
		this.selected = -1;

		if (hits.length === 0) {
			this.resultsEl.createDiv("hearth-search-empty").setText("No matches");
			this.resultsEl.show();
			return;
		}

		hits.forEach((hit) => {
			const row = this.resultsEl.createDiv("hearth-result");
			setIcon(row.createDiv("hearth-result-icon"), hit.badge?.icon ?? iconForFile(hit.file));

			const text = row.createDiv("hearth-result-text");
			const name =
				hit.file instanceof TFile ? hit.file.basename : hit.file.name;
			text.createDiv("hearth-result-name").setText(name || "/");
			// Tag/property hits show what actually matched instead of the folder
			// path — the point of the badge is to make the match reason visible.
			if (hit.badge) {
				text.createDiv({ cls: "hearth-result-badge", text: hit.badge.label });
			} else {
				const parentPath = hit.file.parent?.path;
				if (parentPath && parentPath !== "/") {
					text.createDiv("hearth-result-path").setText(parentPath);
				}
			}

			const open = () => this.openFile(hit.file);
			row.addEventListener("click", open);
			this.rows.push({ el: row, open });
		});

		this.resultsEl.show();
	}

	private onKeyDown(e: KeyboardEvent): void {
		if (e.key === "Escape") {
			this.hide();
			this.inputEl.blur();
			return;
		}
		if (this.rows.length === 0) return;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			this.move(1);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			this.move(-1);
		} else if (e.key === "Enter") {
			e.preventDefault();
			const target = this.selected >= 0 ? this.selected : 0;
			this.rows[target]?.open();
		}
	}

	private move(delta: number): void {
		this.rows[this.selected]?.el.removeClass("is-selected");
		this.selected = (this.selected + delta + this.rows.length) % this.rows.length;
		const row = this.rows[this.selected]?.el;
		row?.addClass("is-selected");
		row?.scrollIntoView({ block: "nearest" });
	}

	private openFile(file: TAbstractFile): void {
		if (file instanceof TFile) {
			this.pushHistory(file.path);
			void this.view.app.workspace.getLeaf(true).openFile(file);
			this.hide();
		} else if (file instanceof TFolder) {
			// Reveal the folder in the file explorer.
			const explorer = this.view.app.internalPlugins.getPluginById("file-explorer");
			const instance = explorer?.instance as
				| { revealInFolder?: (f: TAbstractFile) => void }
				| undefined;
			instance?.revealInFolder?.(file);
			this.hide();
		}
	}

	private hide(): void {
		if (this.resultsEl) this.resultsEl.hide();
	}
}
