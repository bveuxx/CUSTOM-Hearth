import {
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
}

const MAX_RESULTS = 40;

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
			this.hide();
			return;
		}
		this.renderResults(this.search(query));
	}

	private search(query: string): SearchHit[] {
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
			setIcon(row.createDiv("hearth-result-icon"), iconForFile(hit.file));

			const text = row.createDiv("hearth-result-text");
			const name =
				hit.file instanceof TFile ? hit.file.basename : hit.file.name;
			text.createDiv("hearth-result-name").setText(name || "/");
			const parentPath = hit.file.parent?.path;
			if (parentPath && parentPath !== "/") {
				text.createDiv("hearth-result-path").setText(parentPath);
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
