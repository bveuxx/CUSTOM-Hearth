import {
	Component,
	debounce,
	getAllTags,
	MarkdownRenderer,
	MarkdownView,
	moment as createMoment,
	Notice,
	setIcon,
	TFile,
	TFolder,
} from "obsidian";
import type { HomeView } from "./view";
import type { BookmarkItem } from "./obsidian-ext";
import { ClockConfig, CommandItem, DashboardCard, LinkItem, TasksConfig } from "./types";
import { EXCALIDRAW_PLUGIN_ID, iconForFile, isExcalidraw } from "./filetypes";
import { QueryHit, runQuery, searchFileContents } from "./query";
import { makeClickable } from "./ui";

/**
 * moment is bundled with Obsidian, not a direct dependency, so it's imported
 * from "obsidian" rather than the "moment" package. Some toolchains resolve
 * that export's type as `any` (no @types/moment in scope), which would make
 * every call/member-access on it "unsafe" — asserting it to this minimal,
 * explicitly-typed surface (the only bits of the Moment API this file uses)
 * keeps every use provably non-`any` regardless of the toolchain.
 */
interface Moment {
	format(fmt?: string): string;
	clone(): Moment;
	startOf(unit: string): Moment;
	endOf(unit: string): Moment;
	subtract(amount: number, unit: string): Moment;
	add(amount: number, unit: string): Moment;
	day(): number;
	day(value: number): Moment;
	date(): number;
	month(): number;
	diff(other: Moment, unit?: string): number;
}
interface MomentFn {
	(input?: Date): Moment;
	localeData(): { firstDayOfWeek(): number };
}
const moment: MomentFn = createMoment as unknown as MomentFn;

/** Community plugin id for TaskNotes (used by "tasks" cards in TaskNotes mode). */
const TASKNOTES_PLUGIN_ID = "tasknotes";

/** Render a card's body based on its kind. */
export function renderCardBody(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	switch (card.kind) {
		case "embed":
			renderEmbed(view, card, body, component);
			break;
		case "daily":
			renderDaily(view, card, body, component);
			break;
		case "web":
			renderWeb(card, body, component);
			break;
		case "bookmarks":
			renderBookmarks(view, body);
			break;
		case "favorites":
			renderFavorites(view, body);
			break;
		case "text":
			renderText(view, card, body, component);
			break;
		case "recent":
			renderRecent(view, card, body);
			break;
		case "links":
			renderLinks(view, card, body);
			break;
		case "commands":
			renderCommands(view, card, body);
			break;
		case "clock":
			renderClock(view, card, body, component);
			break;
		case "tasks":
			renderTasks(view, card, body);
			break;
		case "calendar":
			renderCalendar(view, card, body);
			break;
		case "stats":
			renderStats(view, body);
			break;
		case "search":
			renderSavedSearch(view, card, body);
			break;
		case "heatmap":
			renderHeatmap(view, card, body);
			break;
	}
}

// ---- Saved search --------------------------------------------------------

/** A card that runs a saved query (same syntax as the top search bar) and lists
 * the matching files, refreshed on every render. */
function renderSavedSearch(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const cfg = card.savedSearch ?? {};
	const query = (cfg.query ?? "").trim();
	if (!query) {
		emptyState(body, "search", "Set a query in card settings");
		return;
	}
	const limit = cfg.count && cfg.count > 0 ? cfg.count : 12;
	const list = body.createDiv("hearth-list");

	const render = (hits: QueryHit[]) => {
		list.empty();
		if (hits.length === 0) {
			emptyState(list, "search-x", "No matches");
			return;
		}
		for (const hit of hits.slice(0, limit)) {
			const row = list.createDiv("hearth-list-item");
			setIcon(row.createDiv("hearth-list-icon"), hit.badge?.icon ?? iconForFile(hit.file));
			const name = hit.file instanceof TFile ? hit.file.basename : hit.file.name;
			row.createDiv({ cls: "hearth-list-label", text: name });
			if (hit.badge) row.createDiv({ cls: "hearth-task-status", text: hit.badge.label });
			const open = () => {
				if (hit.file instanceof TFile) void view.app.workspace.getLeaf(true).openFile(hit.file);
			};
			row.addEventListener("click", open);
			makeClickable(row, open, name);
		}
	};

	const hits = runQuery(view.app, query, { limit });
	render(hits);
	// Append full-text body matches when enabled (self-guards to name queries).
	if (view.plugin.settings.searchContents) {
		const exclude = new Set(hits.map((h) => h.file.path));
		void searchFileContents(view.app, query, { exclude, limit }).then((extra) => {
			if (extra.length) render([...hits, ...extra]);
		});
	}
}

function emptyState(body: HTMLElement, icon: string, text: string): void {
	const empty = body.createDiv("hearth-card-empty");
	setIcon(empty.createDiv("hearth-card-empty-icon"), icon);
	empty.createDiv({ cls: "hearth-card-empty-text", text });
}

// ---- Embed (note / image / base / ...) ---------------------------------

function renderEmbed(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const target = card.target?.trim();
	if (!target) {
		emptyState(body, "file-plus", "Pick a file to embed in settings");
		return;
	}
	const file = view.app.vault.getAbstractFileByPath(target);
	if (!(file instanceof TFile)) {
		emptyState(body, "file-x", `Not found: ${target}`);
		return;
	}

	// Bases (.base) embeds depend on the core Bases plugin being enabled.
	if (file.extension.toLowerCase() === "base") {
		const bases = view.app.internalPlugins.getPluginById("bases");
		if (!bases?.enabled) {
			emptyState(body, "database", "Enable the core Bases plugin to embed .base files");
			return;
		}
	}

	// Canvas embeds depend on the core Canvas plugin being enabled.
	if (file.extension.toLowerCase() === "canvas") {
		const canvas = view.app.internalPlugins.getPluginById("canvas");
		if (!canvas?.enabled) {
			emptyState(body, "layout-dashboard", "Enable the core Canvas plugin to embed canvases");
			return;
		}
	}

	// Excalidraw drawings render through the community Excalidraw plugin.
	if (isExcalidraw(file)) {
		if (!view.app.plugins.enabledPlugins.has(EXCALIDRAW_PLUGIN_ID)) {
			emptyState(body, "pen-tool", "Install the Excalidraw plugin to embed drawings");
			return;
		}
	}

	const ext = file.extension.toLowerCase();
	const isMarkdown = ext === "md" || ext === "markdown";
	const excalidraw = isExcalidraw(file);

	// Editable Markdown notes are edited in place rather than rendered read-only.
	if (card.editable && isMarkdown && !excalidraw) {
		renderEditableEmbed(view, file, body, component);
		return;
	}

	const host = body.createDiv("hearth-embed markdown-rendered");
	// Optional zoom: scale the rendered content and widen it inversely so it
	// still fills the card width before scaling (the body handles overflow).
	const scale = card.scale && card.scale > 0 ? card.scale : 1;
	if (scale !== 1) {
		host.addClass("is-scaled");
		host.style.setProperty("--hearth-embed-scale", String(scale));
	}

	if (isMarkdown && !excalidraw) {
		// Render the note's actual content so all Markdown (headings, lists,
		// callouts, links…) shows. A bare ![[embed]] only renders a placeholder
		// outside a real Markdown view, which looks empty on the dashboard.
		void renderMarkdownFile(view, file, host, component);
	} else {
		// Images, canvas, .base and Excalidraw go through Obsidian's own
		// transclusion embed, which handles those file types uniformly.
		void MarkdownRenderer.render(view.app, `![[${target}]]`, host, target, component);

		// Canvas and Excalidraw embeds are natively interactive (pan/zoom, and
		// their own in-place edit toggle) — let them fill the card edge-to-edge
		// instead of sitting in a small box inside a scrolling body, so their
		// own pan gestures don't fight the card's scrollbar.
		if (ext === "canvas" || excalidraw) {
			host.addClass("hearth-embed-live");
			body.addClass("hearth-card-body-live");
		}
	}
}

/** Strip a leading YAML frontmatter block so it isn't rendered as body content. */
function stripFrontmatter(text: string): string {
	const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(text);
	return match ? text.slice(match[0].length) : text;
}

/** Render a Markdown file's real content (not a transclusion placeholder). */
async function renderMarkdownFile(
	view: HomeView,
	file: TFile,
	host: HTMLElement,
	component: Component,
): Promise<void> {
	const raw = await view.app.vault.cachedRead(file);
	await MarkdownRenderer.render(view.app, stripFrontmatter(raw), host, file.path, component);
}

/**
 * "Live mode" editable embed: shows the note rendered as Markdown and swaps to a
 * raw editor on double-click (Obsidian doesn't expose a true Live Preview editor
 * for arbitrary containers). Saves back to the vault and stays in sync with
 * external edits without ever interrupting typing.
 */
function renderEditableEmbed(
	view: HomeView,
	file: TFile,
	body: HTMLElement,
	component: Component,
): void {
	const wrap = body.createDiv("hearth-jot");
	const preview = wrap.createDiv("hearth-embed markdown-rendered hearth-jot-preview");
	preview.setAttribute("title", "Double-click to edit");
	const area = wrap.createEl("textarea", {
		cls: "hearth-text hearth-embed-edit hearth-jot-edit",
		attr: { placeholder: "Empty note…" },
	});
	area.hide();

	// `saving` guards against reacting to our own writes; `editing` tracks whether
	// the raw editor is open.
	let saving = false;
	let editing = false;
	let previewChild: Component | null = null;

	const renderPreview = () => {
		if (previewChild) component.removeChild(previewChild);
		previewChild = new Component();
		component.addChild(previewChild);
		preview.empty();
		void view.app.vault.cachedRead(file).then((raw) => {
			const md = stripFrontmatter(raw);
			if (!md.trim()) {
				preview.addClass("is-empty");
				preview.setText("Empty note — double-click to edit");
				return;
			}
			preview.removeClass("is-empty");
			void MarkdownRenderer.render(view.app, md, preview, file.path, previewChild!);
		});
	};

	const flush = () => {
		const current = view.app.vault.getAbstractFileByPath(file.path);
		if (current instanceof TFile) {
			saving = true;
			void view.app.vault.modify(current, area.value).finally(() => {
				saving = false;
			});
		}
	};

	const enterEdit = () => {
		void view.app.vault.read(file).then((content) => {
			area.value = content;
			editing = true;
			preview.hide();
			area.show();
			area.focus();
		});
	};
	const leaveEdit = () => {
		flush();
		editing = false;
		area.hide();
		preview.show();
		renderPreview();
	};

	// Double-click (not single) so links in the preview stay clickable.
	preview.addEventListener("dblclick", enterEdit);
	area.addEventListener("input", debounce(flush, 500, true));
	area.addEventListener("blur", leaveEdit);

	// Reflect external edits when we aren't the one writing: re-render the preview,
	// or (if editing but not focused) refresh the buffer without yanking the cursor.
	component.registerEvent(
		view.app.vault.on("modify", (changed) => {
			if (changed.path !== file.path || saving) return;
			if (editing) {
				if (area.ownerDocument.activeElement !== area) {
					void view.app.vault.read(file).then((content) => {
						area.value = content;
					});
				}
			} else {
				renderPreview();
			}
		}),
	);

	renderPreview();
}

// ---- Daily note (today) -------------------------------------------------

interface DailyNotesOptions {
	/** moment.js date format, e.g. "YYYY-MM-DD". */
	format?: string;
	/** Folder daily notes live in. */
	folder?: string;
	/** Vault path of the template applied to new daily notes. */
	template?: string;
}

/** The core Daily notes plugin's options, or null if it's disabled. Shared by
 * every card that resolves a daily-note path (daily, calendar, stats). */
function dailyNotesOptions(view: HomeView): DailyNotesOptions | null {
	const plugin = view.app.internalPlugins.getPluginById("daily-notes");
	if (!plugin?.enabled) return null;
	return (plugin.instance as { options?: DailyNotesOptions } | undefined)?.options ?? {};
}

/** Resolve the daily-note path for an arbitrary date from the core Daily
 * notes plugin settings. */
function dailyNotePath(date: Moment, options: DailyNotesOptions): string {
	const format = (options.format || "").trim() || "YYYY-MM-DD";
	const folder = (options.folder || "").trim().replace(/^\/+|\/+$/g, "");
	return `${folder ? `${folder}/` : ""}${date.format(format)}.md`;
}

function todaysDailyNotePath(options: DailyNotesOptions): string {
	return dailyNotePath(moment(), options);
}

/**
 * Embed today's daily note, resolved fresh on every render so the card always
 * tracks the current day. Falls back to a "create today's note" prompt when the
 * note doesn't exist yet, and respects the per-card editable toggle.
 */
function renderDaily(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const options = dailyNotesOptions(view);
	if (!options) {
		emptyState(body, "calendar", "Enable the core Daily notes plugin");
		return;
	}

	const path = todaysDailyNotePath(options);
	const file = view.app.vault.getAbstractFileByPath(path);

	if (!(file instanceof TFile)) {
		const empty = body.createDiv("hearth-card-empty");
		setIcon(empty.createDiv("hearth-card-empty-icon"), "calendar-plus");
		empty.createDiv({ cls: "hearth-card-empty-text", text: "No note for today yet" });
		const create = empty.createEl("button", {
			cls: "hearth-daily-create",
			text: "Create today's note",
		});
		create.addEventListener("click", () => {
			// The core "Open today's daily note" command creates it from the
			// configured template and opens it.
			if (!view.app.commands.executeCommandById("daily-notes")) {
				new Notice("Hearth: couldn't open today's daily note.");
			}
		});
		return;
	}

	// Optional button to open today's note in the editor (hideable).
	if (card.showOpenButton !== false) {
		const actions = body.createDiv("hearth-card-actions-overlay");
		const open = actions.createEl("button", {
			cls: "hearth-open-btn",
			attr: { "aria-label": "Open today's note" },
		});
		setIcon(open, "square-pen");
		open.addEventListener("click", () => {
			void view.app.workspace.getLeaf(true).openFile(file);
		});
	}

	if (card.editable) {
		renderEditableEmbed(view, file, body, component);
		return;
	}

	const host = body.createDiv("hearth-embed markdown-rendered");
	void renderMarkdownFile(view, file, host, component);
}

/** The vault path an embed/daily card currently tracks, used to refresh the card
 * live when that file changes. Returns null when there's nothing to watch. */
export function watchedCardPath(view: HomeView, card: DashboardCard): string | null {
	if (card.kind === "embed") return card.target?.trim() || null;
	if (card.kind === "daily") {
		const options = dailyNotesOptions(view);
		if (!options) return null;
		return todaysDailyNotePath(options);
	}
	return null;
}

// ---- Mini calendar -------------------------------------------------------

/** A month grid resolved against the core Daily notes plugin's format/folder:
 * dots mark days with an existing note, clicking one opens it, clicking
 * today when it doesn't exist yet safely falls back to the core "Open
 * today's daily note" command (template-aware). Other empty days are left
 * alone rather than guessing at template handling for arbitrary dates. */
function renderCalendar(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const options = dailyNotesOptions(view);
	if (!options) {
		emptyState(body, "calendar-days", "Enable the core Daily notes plugin");
		return;
	}

	const cfg = card.calendar ?? {};
	const wrap = body.createDiv("hearth-calendar");
	// Activity counts are only needed for the heatmap tint.
	const activity = cfg.heatmap ? activityByDay(view.app, cfg.heatmapMetric ?? "modified") : null;
	let cursor: Moment = moment().startOf("month");

	const draw = () => {
		wrap.empty();
		renderCalendarHead(wrap, cursor, {
			onPrev: () => {
				cursor = cursor.clone().subtract(1, "month");
				draw();
			},
			onNext: () => {
				cursor = cursor.clone().add(1, "month");
				draw();
			},
			onToday: () => {
				cursor = moment().startOf("month");
				draw();
			},
		});
		renderCalendarGrid(view, wrap, cursor, options, cfg, activity);
	};
	draw();
}

function renderCalendarHead(
	wrap: HTMLElement,
	cursor: Moment,
	handlers: { onPrev: () => void; onNext: () => void; onToday: () => void },
): void {
	const head = wrap.createDiv("hearth-calendar-head");
	const prev = head.createEl("button", { cls: "hearth-calendar-nav", attr: { "aria-label": "Previous month" } });
	setIcon(prev, "chevron-left");
	prev.addEventListener("click", handlers.onPrev);

	const label = head.createDiv({ cls: "hearth-calendar-label", text: cursor.format("MMMM YYYY") });
	label.setAttribute("title", "Back to today");
	label.addEventListener("click", handlers.onToday);

	const next = head.createEl("button", { cls: "hearth-calendar-nav", attr: { "aria-label": "Next month" } });
	setIcon(next, "chevron-right");
	next.addEventListener("click", handlers.onNext);
}

function renderCalendarGrid(
	view: HomeView,
	wrap: HTMLElement,
	cursor: Moment,
	options: DailyNotesOptions,
	cfg: NonNullable<DashboardCard["calendar"]>,
	activity: Map<string, number> | null,
): void {
	const grid = wrap.createDiv("hearth-calendar-grid");
	const startOfWeek = moment.localeData().firstDayOfWeek();
	const weekNumbers = cfg.showWeekNumbers === true;
	if (weekNumbers) {
		// One extra leading column for the week number.
		grid.style.gridTemplateColumns = "minmax(0, 0.6fr) repeat(7, minmax(0, 1fr))";
		grid.createDiv({ cls: "hearth-calendar-dow hearth-calendar-wk", text: "wk" });
	}

	for (let i = 0; i < 7; i++) {
		const dow = (startOfWeek + i) % 7;
		grid.createDiv({ cls: "hearth-calendar-dow", text: moment().day(dow).format("dd") });
	}

	const monthStart = cursor.clone().startOf("month");
	const monthEnd = cursor.clone().endOf("month");
	const gridStart = monthStart.clone().subtract((monthStart.day() - startOfWeek + 7) % 7, "days");
	const totalCells = Math.ceil((monthEnd.diff(gridStart, "days") + 1) / 7) * 7;

	// Highest edit count in the visible range, so the heatmap tint is relative.
	let peak = 1;
	if (activity) {
		for (let i = 0; i < totalCells; i++) {
			const key = gridStart.clone().add(i, "days").format("YYYY-MM-DD");
			peak = Math.max(peak, activity.get(key) ?? 0);
		}
	}

	const today: string = moment().format("YYYY-MM-DD");
	for (let i = 0; i < totalCells; i++) {
		const day = gridStart.clone().add(i, "days");
		if (weekNumbers && i % 7 === 0) {
			grid.createDiv({ cls: "hearth-calendar-wk", text: day.format("W") });
		}
		const path = dailyNotePath(day, options);
		const file = view.app.vault.getAbstractFileByPath(path);
		const isToday = day.format("YYYY-MM-DD") === today;

		const cell = grid.createDiv("hearth-calendar-day");
		cell.toggleClass("is-outside", day.month() !== cursor.month());
		cell.toggleClass("is-today", isToday);
		cell.toggleClass("has-note", file instanceof TFile);
		if (activity) {
			const count = activity.get(day.format("YYYY-MM-DD")) ?? 0;
			cell.style.setProperty("--heat", count > 0 ? String(heatLevel(count, peak)) : "0");
			cell.toggleClass("has-heat", count > 0);
			cell.setAttribute("aria-label", `${day.format("MMM D")}: ${count} edited`);
		}
		cell.createDiv({ cls: "hearth-calendar-daynum", text: String(day.date()) });
		if (file instanceof TFile) cell.createDiv("hearth-calendar-dot");

		const activate = () => {
			if (file instanceof TFile) {
				void view.app.workspace.getLeaf(true).openFile(file);
			} else if (isToday) {
				if (!view.app.commands.executeCommandById("daily-notes")) {
					new Notice("Hearth: couldn't open today's daily note.");
				}
			} else {
				// Offer to create the missing daily note for that day.
				void createDailyNoteAt(view, day, options).then((created) => {
					if (created) void view.app.workspace.getLeaf(true).openFile(created);
					else new Notice(`Hearth: couldn't create a note for ${day.format("MMM D, YYYY")}.`);
				});
			}
		};
		cell.addEventListener("click", activate);
		makeClickable(cell, activate, day.format("MMMM D, YYYY"));
	}
}

/** Bucket an edit count into a 1–4 heat level relative to the range peak. */
function heatLevel(count: number, peak: number): number {
	if (count <= 0) return 0;
	return Math.min(4, Math.ceil((count / peak) * 4));
}

/** Create a daily note for `day` at the plugin's configured path (making any
 * missing parent folders), returning the file or null on failure. Applies the
 * core Daily notes template (with the usual {{date}}/{{time}}/{{title}}
 * substitutions) so a note made here matches Obsidian's own defaults. */
async function createDailyNoteAt(
	view: HomeView,
	day: Moment,
	options: DailyNotesOptions,
): Promise<TFile | null> {
	const path = dailyNotePath(day, options);
	const existing = view.app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) return existing;
	const folder = path.split("/").slice(0, -1).join("/");
	if (folder && !view.app.vault.getAbstractFileByPath(folder)) {
		try {
			await view.app.vault.createFolder(folder);
		} catch {
			// Folder may have been created concurrently — ignore and try the file.
		}
	}
	const format = (options.format || "").trim() || "YYYY-MM-DD";
	let content = "";
	const templatePath = (options.template || "").trim();
	if (templatePath) {
		const tpl =
			view.app.vault.getAbstractFileByPath(templatePath) ??
			view.app.vault.getAbstractFileByPath(`${templatePath}.md`);
		if (tpl instanceof TFile) {
			try {
				content = applyDailyTemplate(await view.app.vault.read(tpl), day, format);
			} catch {
				content = "";
			}
		}
	}
	try {
		return await view.app.vault.create(path, content);
	} catch {
		return null;
	}
}

/** Substitute the daily-note template variables Obsidian's core plugin supports
 * for an arbitrary date: {{date}}, {{time}}, {{title}} and their {{date:FMT}}/
 * {{time:FMT}} formatted variants. */
function applyDailyTemplate(raw: string, day: Moment, format: string): string {
	return raw
		.replace(/\{\{\s*date\s*:\s*([^}]+?)\s*\}\}/gi, (_m, f: string) => day.format(f))
		.replace(/\{\{\s*time\s*:\s*([^}]+?)\s*\}\}/gi, (_m, f: string) => day.format(f))
		.replace(/\{\{\s*date\s*\}\}/gi, day.format(format))
		.replace(/\{\{\s*time\s*\}\}/gi, day.format("HH:mm"))
		.replace(/\{\{\s*title\s*\}\}/gi, day.format(format));
}

/** Count files edited (or created) per calendar day, keyed by YYYY-MM-DD. Read
 * entirely from the in-memory file stats — no file reads. Shared by the
 * calendar heatmap tint and the activity-heatmap card. */
function activityByDay(app: HomeView["app"], metric: "modified" | "created"): Map<string, number> {
	const counts = new Map<string, number>();
	for (const file of app.vault.getMarkdownFiles()) {
		const ts = metric === "created" ? file.stat.ctime : file.stat.mtime;
		const key: string = moment(new Date(ts)).format("YYYY-MM-DD");
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}
	return counts;
}

// ---- Vault statistics -----------------------------------------------------

/** Cheap vault stats — everything here comes from the already-loaded vault
 * index and metadata cache, never a file read, so it's fast even on large
 * vaults. */
function renderStats(view: HomeView, body: HTMLElement): void {
	const vault = view.app.vault;
	let notes = 0;
	let attachments = 0;
	let folders = 0;
	for (const f of vault.getAllLoadedFiles()) {
		if (f instanceof TFolder) {
			if (f.path !== "/") folders++;
		} else if (f instanceof TFile) {
			if (f.extension.toLowerCase() === "md") notes++;
			else attachments++;
		}
	}

	const tags = new Set<string>();
	for (const file of vault.getMarkdownFiles()) {
		const cache = view.app.metadataCache.getFileCache(file);
		if (!cache) continue;
		for (const t of getAllTags(cache) ?? []) tags.add(t.toLowerCase());
	}

	const grid = body.createDiv("hearth-stats");
	addStat(grid, "file-text", notes, "Notes");
	addStat(grid, "paperclip", attachments, "Attachments");
	addStat(grid, "folder", folders, "Folders");
	addStat(grid, "tag", tags.size, "Tags");

	const streak = dailyNoteStreak(view);
	if (streak !== null) addStat(grid, "flame", streak, "Day streak");
}

function addStat(grid: HTMLElement, icon: string, value: number, label: string): void {
	const cell = grid.createDiv("hearth-stat");
	setIcon(cell.createDiv("hearth-stat-icon"), icon);
	cell.createDiv({ cls: "hearth-stat-value", text: String(value) });
	cell.createDiv({ cls: "hearth-stat-label", text: label });
}

/** Consecutive days with an existing daily note, counting back from today —
 * or from yesterday if today's isn't written yet, so an otherwise-unbroken
 * streak doesn't read as zero just because the day isn't over. */
function dailyNoteStreak(view: HomeView): number | null {
	const options = dailyNotesOptions(view);
	if (!options) return null;

	let day: Moment = moment();
	if (!(view.app.vault.getAbstractFileByPath(dailyNotePath(day, options)) instanceof TFile)) {
		day = day.clone().subtract(1, "day");
	}

	let streak = 0;
	while (view.app.vault.getAbstractFileByPath(dailyNotePath(day, options)) instanceof TFile) {
		streak++;
		day = day.clone().subtract(1, "day");
		if (streak > 3650) break;
	}
	return streak;
}

// ---- Activity heatmap (GitHub-style) ------------------------------------

/** A contribution-style grid: one square per day for the last N weeks, tinted
 * by how many notes were edited (or created) that day. */
function renderHeatmap(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const cfg = card.heatmap ?? {};
	const metric = cfg.metric ?? "modified";
	const weeks = cfg.weeks && cfg.weeks > 0 ? Math.min(cfg.weeks, 53) : 26;
	const activity = activityByDay(view.app, metric);
	const options = dailyNotesOptions(view);

	const wrap = body.createDiv("hearth-heatmap");
	const startOfWeek = moment.localeData().firstDayOfWeek();
	const today = moment().startOf("day");
	const todayKey: string = today.format("YYYY-MM-DD");
	// Start `weeks - 1` weeks back, aligned to the start of that week, so the
	// last column is the current (partial) week.
	let start = today.clone().subtract((weeks - 1) * 7, "days");
	start = start.clone().subtract((start.day() - startOfWeek + 7) % 7, "days");

	// Relative peak over the visible, non-future days.
	let peak = 1;
	for (let i = 0; i < weeks * 7; i++) {
		const key = start.clone().add(i, "days").format("YYYY-MM-DD");
		if (key <= todayKey) peak = Math.max(peak, activity.get(key) ?? 0);
	}

	const grid = wrap.createDiv("hearth-heatmap-grid");
	grid.style.gridTemplateColumns = `repeat(${weeks}, 1fr)`;
	// Column-major fill (top-to-bottom, then next week): 7 rows, auto-flow column.
	for (let w = 0; w < weeks; w++) {
		for (let r = 0; r < 7; r++) {
			const day = start.clone().add(w * 7 + r, "days");
			const key: string = day.format("YYYY-MM-DD");
			const cellEl = grid.createDiv("hearth-heatmap-cell");
			if (key > todayKey) {
				cellEl.addClass("is-empty");
				continue;
			}
			const count = activity.get(key) ?? 0;
			cellEl.style.setProperty("--heat", String(heatLevel(count, peak)));
			cellEl.toggleClass("has-heat", count > 0);
			cellEl.setAttribute("aria-label", `${day.format("MMM D, YYYY")}: ${count} ${metric}`);
			cellEl.setAttribute("title", `${day.format("MMM D, YYYY")} · ${count} ${metric}`);
			if (options) {
				const activate = () => {
					void createDailyNoteAt(view, day, options).then((f) => {
						if (f) void view.app.workspace.getLeaf(true).openFile(f);
					});
				};
				cellEl.addEventListener("click", activate);
				makeClickable(cellEl, activate, day.format("MMMM D, YYYY"));
			}
		}
	}

	// A small Less→More legend.
	const legend = wrap.createDiv("hearth-heatmap-legend");
	legend.createSpan({ cls: "hearth-heatmap-legend-label", text: "Less" });
	for (let l = 0; l <= 4; l++) {
		const sq = legend.createDiv("hearth-heatmap-cell");
		sq.style.setProperty("--heat", String(l));
		if (l > 0) sq.addClass("has-heat");
	}
	legend.createSpan({ cls: "hearth-heatmap-legend-label", text: "More" });
}

// ---- Web / iframe embed -------------------------------------------------

function renderWeb(card: DashboardCard, body: HTMLElement, component: Component): void {
	const url = card.url?.trim();
	if (!url) {
		emptyState(body, "globe", "Set a web URL in settings");
		return;
	}
	// Only allow http(s) URLs into the iframe.
	if (!/^https?:\/\//i.test(url)) {
		emptyState(body, "globe", "URL must start with http:// or https://");
		return;
	}

	body.addClass("hearth-web-body");
	const frame = body.createEl("iframe", { cls: "hearth-web" });
	frame.setAttribute("src", url);
	frame.setAttribute("loading", "lazy");
	frame.setAttribute("referrerpolicy", "no-referrer");
	// Sandbox keeps embedded pages from reaching into the app while still
	// letting normal sites run their scripts. `allow-same-origin` together with
	// `allow-scripts` is the well-known combination that can let framed content
	// escape the sandbox, so it's opt-in per card ("trusted") rather than the
	// default — most sites render fine without it.
	const tokens = ["allow-scripts", "allow-popups", "allow-forms"];
	if (card.sandboxTrusted) tokens.push("allow-same-origin");
	frame.setAttribute("sandbox", tokens.join(" "));

	// A small always-available "open in browser" button, plus a fallback shown
	// if the frame never loads (e.g. the site refuses framing via
	// X-Frame-Options / CSP, which can't be detected reliably cross-origin).
	const openExternally = () => window.open(url, "_blank");
	const ext = body.createEl("button", {
		cls: "hearth-web-external",
		attr: { "aria-label": "Open in browser" },
	});
	setIcon(ext, "external-link");
	ext.addEventListener("click", openExternally);

	let loaded = false;
	frame.addEventListener("load", () => {
		loaded = true;
		body.removeClass("hearth-web-blocked");
		// A slow but successful load can arrive after the fallback showed — clear it.
		body.querySelector(".hearth-web-fallback")?.remove();
	});
	const timer = window.setTimeout(() => {
		if (loaded) return;
		body.addClass("hearth-web-blocked");
		const fallback = body.createDiv("hearth-web-fallback");
		setIcon(fallback.createDiv("hearth-card-empty-icon"), "globe");
		fallback.createDiv({
			cls: "hearth-card-empty-text",
			text: "This site may refuse to be embedded.",
		});
		const open = fallback.createEl("button", { cls: "hearth-daily-create", text: "Open in browser" });
		open.addEventListener("click", openExternally);
	}, 4000);
	component.register(() => window.clearTimeout(timer));
}

// ---- Bookmarks (Obsidian core) -----------------------------------------

function flattenBookmarks(items: BookmarkItem[], out: BookmarkItem[]): void {
	for (const item of items) {
		if (item.type === "group" && item.items) {
			flattenBookmarks(item.items, out);
		} else {
			out.push(item);
		}
	}
}

function renderBookmarks(view: HomeView, body: HTMLElement): void {
	const plugin = view.app.internalPlugins.getPluginById("bookmarks");
	const instance = plugin?.instance as
		| { getBookmarks?: () => BookmarkItem[] }
		| undefined;

	if (!plugin?.enabled || !instance?.getBookmarks) {
		emptyState(body, "bookmark", "Enable the core Bookmarks plugin");
		return;
	}

	const items: BookmarkItem[] = [];
	flattenBookmarks(instance.getBookmarks() ?? [], items);

	if (items.length === 0) {
		emptyState(body, "bookmark", "No bookmarks yet");
		return;
	}

	const list = body.createDiv("hearth-list");
	for (const item of items) {
		const label =
			item.title ||
			item.path ||
			item.url ||
			item.query ||
			"Untitled";
		const row = list.createDiv("hearth-list-item");
		const iconEl = row.createDiv("hearth-list-icon");
		if (item.type === "url" && item.url) {
			renderFavicon(iconEl, item.url);
		} else {
			const icon =
				item.type === "folder" ? "folder" :
				item.type === "search" ? "search" : "file-text";
			setIcon(iconEl, icon);
		}
		row.createDiv({ cls: "hearth-list-label", text: label });
		const open = () => openBookmark(view, item);
		row.addEventListener("click", open);
		makeClickable(row, open, label);
	}
}

/** Show a site favicon for a URL bookmark, falling back to the globe icon if the
 * URL can't be parsed or the favicon fails to load (e.g. offline). */
function renderFavicon(iconEl: HTMLElement, url: string): void {
	let host: string;
	try {
		host = new URL(url).hostname;
	} catch {
		setIcon(iconEl, "globe");
		return;
	}
	const img = iconEl.createEl("img", { cls: "hearth-favicon" });
	img.setAttribute("loading", "lazy");
	img.setAttribute("referrerpolicy", "no-referrer");
	img.addEventListener("error", () => {
		img.remove();
		setIcon(iconEl, "globe");
	});
	img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}

function openBookmark(view: HomeView, item: BookmarkItem): void {
	if (item.type === "url" && item.url) {
		window.open(item.url, "_blank");
		return;
	}
	if (item.path) {
		const file = view.app.vault.getAbstractFileByPath(item.path);
		if (file instanceof TFile) void view.app.workspace.getLeaf(true).openFile(file);
	}
}

// ---- Favorites (curated note cards) ------------------------------------

function renderFavorites(view: HomeView, body: HTMLElement): void {
	const paths = view.plugin.settings.favorites;
	if (!paths.length) {
		emptyState(body, "star", "Add favorites in settings");
		return;
	}

	const grid = body.createDiv("hearth-favorites");
	for (const path of paths) {
		const file = view.app.vault.getAbstractFileByPath(path);
		const card = grid.createDiv("hearth-fav-card");
		if (file instanceof TFile) {
			setIcon(card.createDiv("hearth-fav-icon"), iconForFile(file));
			card.createDiv({ cls: "hearth-fav-name", text: file.basename });
			const open = () => void view.app.workspace.getLeaf(true).openFile(file);
			card.addEventListener("click", open);
			makeClickable(card, open, file.basename);
		} else {
			card.addClass("is-missing");
			setIcon(card.createDiv("hearth-fav-icon"), "file-x");
			card.createDiv({ cls: "hearth-fav-name", text: path });
		}
	}
}

// ---- Text / jot-down ----------------------------------------------------

function renderText(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const wrap = body.createDiv("hearth-jot");
	const preview = wrap.createDiv("hearth-jot-preview markdown-rendered");
	preview.setAttribute("title", "Double-click to edit");
	const area = wrap.createEl("textarea", {
		cls: "hearth-text hearth-jot-edit",
		attr: { placeholder: "Jot something down…" },
	});
	area.hide();

	const placeholder = "Jot something down…";
	const renderPreview = () => {
		preview.empty();
		const text = card.text ?? "";
		if (!text.trim()) {
			preview.addClass("is-empty");
			preview.setText(placeholder);
			return;
		}
		preview.removeClass("is-empty");
		// Render the jotted text as Markdown so headings, lists, checkboxes and
		// links all show, just like a note.
		void MarkdownRenderer.render(view.app, text, preview, "", component);
	};

	const enterEdit = () => {
		area.value = card.text ?? "";
		preview.hide();
		area.show();
		area.focus();
	};
	const leaveEdit = () => {
		area.hide();
		preview.show();
		renderPreview();
	};

	// Double-click (not single) so links in the preview stay clickable.
	preview.addEventListener("dblclick", enterEdit);

	const save = debounce(
		() => {
			card.text = area.value;
			void view.plugin.saveData(view.plugin.settings);
		},
		500,
		true,
	);
	area.addEventListener("input", save);
	area.addEventListener("blur", () => {
		card.text = area.value;
		void view.plugin.saveData(view.plugin.settings);
		leaveEdit();
	});

	renderPreview();
}

// ---- Recent files -------------------------------------------------------

function renderRecent(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const count = card.count && card.count > 0 ? card.count : 8;
	const files = view.app.workspace
		.getLastOpenFiles()
		.map((p) => view.app.vault.getAbstractFileByPath(p))
		.filter((f): f is TFile => f instanceof TFile)
		.slice(0, count);

	if (files.length === 0) {
		emptyState(body, "history", "No recent files");
		return;
	}

	const list = body.createDiv("hearth-list");
	for (const file of files) {
		const row = list.createDiv("hearth-list-item");
		setIcon(row.createDiv("hearth-list-icon"), iconForFile(file));
		row.createDiv({ cls: "hearth-list-label", text: file.basename });
		const open = () => void view.app.workspace.getLeaf(true).openFile(file);
		row.addEventListener("click", open);
		makeClickable(row, open, file.basename);
	}
}

// ---- Links / launchpad --------------------------------------------------

function renderLinks(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const links = card.links ?? [];
	if (links.length === 0) {
		emptyState(body, "layout-grid", "Add links in settings");
		return;
	}

	const grid = body.createDiv("hearth-links hearth-tiles-sized");
	const baseTile = card.tileSize && card.tileSize > 0 ? card.tileSize : 90;
	grid.style.setProperty("--hearth-tile", `${baseTile}px`);
	for (const link of links) {
		const tile = grid.createDiv("hearth-link-tile");
		applyTileSize(tile, link.size, baseTile);
		setIcon(tile.createDiv("hearth-link-icon"), link.icon || "link");
		tile.createDiv({ cls: "hearth-link-label", text: link.label || link.target });
		const open = () => openLink(view, link);
		tile.addEventListener("click", open);
		makeClickable(tile, open, link.label || link.target);

		// Drag the corner handle to resize this individual tile.
		makeTileResizable(view, tile, baseTile, () => link.size, (v) => {
			link.size = v;
		});
	}
}

/** Apply a per-tile pixel size: sets the tile's own --hearth-tile and, when
 * larger than the base, makes it span proportionally more grid columns. */
function applyTileSize(tile: HTMLElement, size: number | undefined, baseTile: number): void {
	if (size && size > 0) {
		tile.style.setProperty("--hearth-tile", `${size}px`);
		const span = Math.max(1, Math.round(size / baseTile));
		if (span > 1) tile.style.gridColumn = `span ${span}`;
	}
}

/** Attach a drag-to-resize corner handle to a tile. `get`/`set` read and write
 * the stored per-tile size (undefined = fall back to the card's base size). */
function makeTileResizable(
	view: HomeView,
	tile: HTMLElement,
	baseTile: number,
	get: () => number | undefined,
	set: (size: number | undefined) => void,
): void {
	const handle = tile.createDiv("hearth-tile-resize");
	handle.setAttribute("aria-hidden", "true");
	let resizing = false;
	let startPx = 0;
	let startX = 0;
	let startY = 0;
	handle.addEventListener("click", (e) => e.stopPropagation());
	handle.addEventListener("pointerdown", (e) => {
		e.preventDefault();
		e.stopPropagation();
		resizing = true;
		startPx = get() && get()! > 0 ? get()! : baseTile;
		startX = e.clientX;
		startY = e.clientY;
		handle.setPointerCapture(e.pointerId);
	});
	handle.addEventListener("pointermove", (e) => {
		if (!resizing) return;
		const delta = Math.max(e.clientX - startX, e.clientY - startY);
		const size = Math.max(50, Math.min(360, Math.round((startPx + delta) / 5) * 5));
		set(size === baseTile ? undefined : size);
		tile.style.setProperty("--hearth-tile", `${size}px`);
		const span = Math.max(1, Math.round(size / baseTile));
		tile.style.gridColumn = span > 1 ? `span ${span}` : "";
	});
	const endResize = (e: PointerEvent) => {
		if (!resizing) return;
		resizing = false;
		try {
			handle.releasePointerCapture(e.pointerId);
		} catch {
			// pointer already released
		}
		void view.plugin.saveData(view.plugin.settings);
	};
	handle.addEventListener("pointerup", endResize);
	handle.addEventListener("pointercancel", endResize);
}

function openLink(view: HomeView, link: LinkItem): void {
	switch (link.type) {
		case "url":
			if (link.target) window.open(link.target, "_blank");
			break;
		case "command":
			if (link.target) view.app.commands.executeCommandById(link.target);
			break;
		case "note": {
			const file = view.app.vault.getAbstractFileByPath(link.target);
			if (file instanceof TFile) void view.app.workspace.getLeaf(true).openFile(file);
			else if (link.target) void view.app.workspace.openLinkText(link.target, "", true);
			break;
		}
	}
}

// ---- Commands / command palette tiles -----------------------------------

function renderCommands(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const commands = card.commands ?? [];
	if (commands.length === 0) {
		emptyState(body, "terminal", "Add commands in card settings");
		return;
	}

	const grid = body.createDiv("hearth-links hearth-tiles-sized");
	const baseTile = card.tileSize && card.tileSize > 0 ? card.tileSize : 90;
	grid.style.setProperty("--hearth-tile", `${baseTile}px`);
	for (const cmd of commands) {
		const tile = grid.createDiv("hearth-link-tile");
		// A per-tile size overrides the card default: it drives the tile's own
		// height/icon (via --hearth-tile) and, when larger than the base, makes
		// the tile span proportionally more grid columns so it's wider too.
		applyTileSize(tile, cmd.size, baseTile);
		setIcon(tile.createDiv("hearth-link-icon"), cmd.icon || "terminal-square");
		tile.createDiv({ cls: "hearth-link-label", text: cmd.name || cmd.id });
		const run = () => runCommand(view, cmd);
		tile.addEventListener("click", run);
		makeClickable(tile, run, cmd.name || cmd.id);

		// Drag the corner handle to resize this individual tile.
		makeTileResizable(view, tile, baseTile, () => cmd.size, (v) => {
			cmd.size = v;
		});
	}
}

function runCommand(view: HomeView, cmd: CommandItem): void {
	if (cmd.id) view.app.commands.executeCommandById(cmd.id);
}

// ---- Tasks ---------------------------------------------------------------

interface TaskHit {
	file: TFile;
	/** Line index for checkbox tasks; -1 for TaskNotes tasks (whole-file, no
	 * single line to jump to or toggle in place). */
	line: number;
	text: string;
	done: boolean;
	due: string | null;
	/** Raw TaskNotes status value, shown as a badge instead of a checkbox
	 * since it may not be a simple open/done binary. */
	status?: string;
	/** Raw TaskNotes priority value (e.g. high/normal/low), shown as an
	 * indicator dot + label. */
	priority?: string;
}

/** Whether `path` is in scope per the card's folder whitelist/blacklist. An
 * empty whitelist matches nothing; an empty blacklist excludes nothing. */
function inTaskScope(path: string, cfg: TasksConfig): boolean {
	const mode = cfg.folderScope ?? "all";
	if (mode === "all") return true;
	const folders = (cfg.folders ?? [])
		.map((f) => f.trim().replace(/\/+$/, ""))
		.filter(Boolean);
	if (folders.length === 0) return mode === "blacklist";
	const matches = folders.some((f) => path === f || path.startsWith(`${f}/`));
	return mode === "whitelist" ? matches : !matches;
}

function renderTasks(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const cfg = card.tasks ?? {};
	const container = body.createDiv("hearth-tasks-wrap");
	const refresh = () => void loadAndRenderTasks(view, cfg, container, refresh);
	refresh();
}

/** Resolve TaskNotes' "create new task" command id. Prefer a live lookup (the
 * plugin's command ids have shifted between versions) and fall back to the
 * conventional id. */
function taskNotesCreateCommandId(view: HomeView): string {
	const commands = view.app.commands.listCommands();
	const match =
		commands.find((c) => /^tasknotes[:.]/i.test(c.id) && /create.*task/i.test(c.name)) ??
		commands.find((c) => /tasknotes/i.test(c.id) && /create.*task/i.test(c.name));
	return match?.id ?? "tasknotes:create-new-task";
}

/** A small "+" button (top-right) that triggers TaskNotes' create-task command. */
function renderTaskNotesAddButton(view: HomeView, container: HTMLElement): void {
	const head = container.createDiv("hearth-tasks-head");
	const btn = head.createEl("button", {
		cls: "hearth-task-add",
		attr: { "aria-label": "Create new task", title: "Create new task" },
	});
	setIcon(btn, "plus");
	btn.addEventListener("click", (e) => {
		e.stopPropagation();
		const id = taskNotesCreateCommandId(view);
		if (!view.app.commands.executeCommandById(id)) {
			new Notice("Hearth: couldn't run TaskNotes: Create new task.");
		}
	});
}

/** Map a raw priority value to a coarse level for coloring the indicator. */
function priorityLevel(priority: string): "high" | "medium" | "low" | "other" {
	const v = priority.trim().toLowerCase();
	if (/^(high|urgent|critical|highest|p1|1|!!!|🔺|⏫)$/.test(v)) return "high";
	if (/^(medium|normal|med|moderate|p2|2|🔼)$/.test(v)) return "medium";
	if (/^(low|lowest|minor|p3|3|🔽|⏬)$/.test(v)) return "low";
	return "other";
}

/** A small colored dot + label showing a task's priority. */
function renderPriority(parent: HTMLElement, priority: string): void {
	const chip = parent.createDiv(`hearth-task-priority is-${priorityLevel(priority)}`);
	chip.createDiv("hearth-task-priority-dot");
	chip.createSpan({ cls: "hearth-task-priority-label", text: priority });
	chip.setAttribute("title", `Priority: ${priority}`);
}

function sortTasks(hits: TaskHit[]): void {
	hits.sort((a, b) => {
		if (a.due && b.due) return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
		if (a.due) return -1;
		if (b.due) return 1;
		return a.file.path.localeCompare(b.file.path);
	});
}

async function loadAndRenderTasks(
	view: HomeView,
	cfg: TasksConfig,
	container: HTMLElement,
	refresh: () => void,
): Promise<void> {
	container.empty();
	const source = cfg.source ?? "checkbox";

	let hits: TaskHit[];
	if (source === "tasknotes") {
		if (!view.app.plugins.enabledPlugins.has(TASKNOTES_PLUGIN_ID)) {
			emptyState(container, "list-todo", "Enable the TaskNotes plugin, or switch source to checkboxes");
			return;
		}
		// A quick "+" to create a new task via TaskNotes' own command.
		renderTaskNotesAddButton(view, container);
		hits = collectTaskNotesTasks(view, cfg);
	} else {
		hits = await collectCheckboxTasks(view, cfg);
	}

	sortTasks(hits);

	if (cfg.layout === "kanban") {
		renderTaskKanban(view, cfg, hits, container, refresh);
		return;
	}

	// List layout: hide completed unless asked, then cap.
	let list = cfg.showCompleted ? hits : hits.filter((h) => !h.done);
	const limit = cfg.count && cfg.count > 0 ? cfg.count : 10;
	list = list.slice(0, limit);

	if (list.length === 0) {
		emptyState(container, "list-todo", "No open tasks");
		return;
	}

	const listEl = container.createDiv("hearth-list hearth-tasks");
	const today: string = moment().format("YYYY-MM-DD");
	for (const hit of list) renderTaskRow(view, listEl, hit, today, refresh);
}

function renderTaskRow(
	view: HomeView,
	listEl: HTMLElement,
	hit: TaskHit,
	today: string,
	refresh: () => void,
): void {
	const row = listEl.createDiv("hearth-list-item hearth-task");
	row.toggleClass("is-done", hit.done);

	if (hit.line >= 0) {
		const check = row.createEl("input", {
			cls: "hearth-task-check",
			attr: { type: "checkbox" },
		});
		check.checked = hit.done;
		check.addEventListener("click", (e) => e.stopPropagation());
		check.addEventListener("change", () => {
			void toggleCheckboxTask(view, hit).then((ok) => {
				if (!ok) new Notice("Hearth: that task changed on disk — refreshed.");
				refresh();
			});
		});
	} else if (hit.status) {
		row.createDiv({ cls: "hearth-task-status", text: hit.status });
	}

	row.createDiv({ cls: "hearth-list-label hearth-task-text", text: hit.text || hit.file.basename });
	if (hit.priority) renderPriority(row, hit.priority);
	if (hit.due) {
		const due = row.createDiv({ cls: "hearth-task-due", text: hit.due });
		due.toggleClass("is-overdue", !hit.done && hit.due < today);
	}

	const open = () => void openTask(view, hit);
	row.addEventListener("click", open);
	makeClickable(row, open, hit.text || hit.file.basename);
}

/** A Kanban board: tasks grouped into status columns, draggable between them.
 * For checkbox tasks the columns are To do / Done; for TaskNotes they're the
 * distinct status values (plus the configured "done" value). Dropping a task in
 * a column writes the new state back to the file. */
function renderTaskKanban(
	view: HomeView,
	cfg: TasksConfig,
	hits: TaskHit[],
	container: HTMLElement,
	refresh: () => void,
): void {
	const source = cfg.source ?? "checkbox";
	const doneValue = (view.plugin.settings.taskNotesDoneValue.trim() || "done");

	// Build the ordered list of columns and assign each hit to one.
	interface Column { key: string; label: string; hits: TaskHit[] }
	const columns: Column[] = [];
	const columnFor = new Map<string, Column>();
	const ensure = (key: string, label: string): Column => {
		let col = columnFor.get(key);
		if (!col) {
			col = { key, label, hits: [] };
			columnFor.set(key, col);
			columns.push(col);
		}
		return col;
	};

	if (source === "checkbox") {
		ensure("open", "To do");
		ensure("done", "Done");
		for (const hit of hits) columnFor.get(hit.done ? "done" : "open")!.hits.push(hit);
	} else {
		// Collect the statuses actually present, then make sure a "done" column
		// exists so tasks can be completed by dragging.
		for (const hit of hits) {
			const status = (hit.status ?? "").trim() || "No status";
			ensure(status.toLowerCase(), status).hits.push(hit);
		}
		if (!columnFor.has(doneValue.toLowerCase())) ensure(doneValue.toLowerCase(), doneValue);
		// Keep the done column last.
		columns.sort((a, b) => {
			const ad = a.key === doneValue.toLowerCase() ? 1 : 0;
			const bd = b.key === doneValue.toLowerCase() ? 1 : 0;
			return ad - bd || a.label.localeCompare(b.label);
		});
	}

	// Apply the user's saved column order (unlisted keys keep their default
	// position after the listed ones, since sort is stable).
	const order = cfg.kanbanOrder;
	if (order && order.length) {
		const rank = (k: string) => {
			const i = order.indexOf(k);
			return i < 0 ? Number.MAX_SAFE_INTEGER : i;
		};
		columns.sort((a, b) => rank(a.key) - rank(b.key));
	}

	const persist = () => void view.plugin.saveData(view.plugin.settings);
	const hidden = new Set(cfg.kanbanHidden ?? []);
	const visible = columns.filter((c) => !hidden.has(c.key));

	// Reorder columns by dragging their headers; persists the full key order.
	const reorder = (fromKey: string, toKey: string) => {
		if (fromKey === toKey) return;
		const keys = columns.map((c) => c.key);
		const fi = keys.indexOf(fromKey);
		const ti = keys.indexOf(toKey);
		if (fi < 0 || ti < 0) return;
		keys.splice(ti, 0, keys.splice(fi, 1)[0]);
		cfg.kanbanOrder = keys;
		persist();
		refresh();
	};

	const hideColumn = (key: string) => {
		cfg.kanbanHidden = [...new Set([...(cfg.kanbanHidden ?? []), key])];
		persist();
		refresh();
	};

	const board = container.createDiv("hearth-kanban");
	const today: string = moment().format("YYYY-MM-DD");

	// Move a dragged task into a target column and persist the change.
	const moveTo = (hit: TaskHit, col: Column) => {
		if (source === "checkbox") {
			const wantDone = col.key === "done";
			if (hit.done === wantDone) return;
			void setCheckboxState(view, hit, wantDone).then((ok) => {
				if (!ok) new Notice("Hearth: that task changed on disk — refreshed.");
				refresh();
			});
		} else {
			const value = col.label === "No status" ? "" : col.label;
			void setTaskNotesStatus(view, hit, value).then(refresh);
		}
	};

	for (const col of visible) {
		const colEl = board.createDiv("hearth-kanban-col");
		const head = colEl.createDiv("hearth-kanban-col-head");
		head.createSpan({ cls: "hearth-kanban-col-title", text: col.label });
		head.createSpan({ cls: "hearth-kanban-col-count", text: String(col.hits.length) });
		const hideBtn = head.createEl("button", {
			cls: "hearth-kanban-col-hide",
			attr: { "aria-label": `Hide "${col.label}" column` },
		});
		setIcon(hideBtn, "eye-off");
		hideBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			hideColumn(col.key);
		});

		// Drag the header to reorder columns (distinct from dragging task cards).
		head.setAttribute("draggable", "true");
		head.addEventListener("dragstart", (e) => {
			e.dataTransfer?.setData("application/hearth-col", col.key);
			colEl.addClass("is-dragging");
		});
		head.addEventListener("dragend", () => colEl.removeClass("is-dragging"));
		head.addEventListener("dragover", (e) => {
			if (e.dataTransfer?.types.includes("application/hearth-col")) {
				e.preventDefault();
				colEl.addClass("is-col-drop-target");
			}
		});
		head.addEventListener("dragleave", () => colEl.removeClass("is-col-drop-target"));
		head.addEventListener("drop", (e) => {
			const fromKey = e.dataTransfer?.getData("application/hearth-col");
			colEl.removeClass("is-col-drop-target");
			if (fromKey) {
				e.preventDefault();
				e.stopPropagation();
				reorder(fromKey, col.key);
			}
		});

		const colBody = colEl.createDiv("hearth-kanban-col-body");
		colBody.addEventListener("dragover", (e) => {
			// Only task-card drags target the column body (not header reorders).
			if (e.dataTransfer?.types.includes("application/hearth-col")) return;
			e.preventDefault();
			colBody.addClass("is-drop-target");
		});
		colBody.addEventListener("dragleave", () => colBody.removeClass("is-drop-target"));
		colBody.addEventListener("drop", (e) => {
			colBody.removeClass("is-drop-target");
			const raw = e.dataTransfer?.getData("text/plain") ?? "";
			if (!raw) return; // header reorder, handled on the header
			e.preventDefault();
			const idx = parseInt(raw, 10);
			const hit = Number.isNaN(idx) ? null : hits[idx];
			if (hit) moveTo(hit, col);
		});

		for (const hit of col.hits) {
			const idx = hits.indexOf(hit);
			const cardEl = colBody.createDiv("hearth-kanban-card");
			cardEl.toggleClass("is-done", hit.done);
			cardEl.setAttribute("draggable", "true");
			cardEl.addEventListener("dragstart", (e) => {
				e.dataTransfer?.setData("text/plain", String(idx));
				cardEl.addClass("is-dragging");
			});
			cardEl.addEventListener("dragend", () => cardEl.removeClass("is-dragging"));
			cardEl.createDiv({ cls: "hearth-kanban-card-text", text: hit.text || hit.file.basename });
			const meta = cardEl.createDiv("hearth-kanban-card-meta");
			if (hit.priority) renderPriority(meta, hit.priority);
			if (hit.due) {
				const due = meta.createDiv({ cls: "hearth-task-due", text: hit.due });
				due.toggleClass("is-overdue", !hit.done && hit.due < today);
			}
			const open = () => void openTask(view, hit);
			cardEl.addEventListener("click", open);
			makeClickable(cardEl, open, hit.text || hit.file.basename);
		}
	}
}

/** Scan plain Markdown `- [ ]`/`- [x]` checkboxes in every in-scope note. A
 * trailing 📅 YYYY-MM-DD (the Tasks-plugin emoji convention) is read as the
 * due date when present. */
async function collectCheckboxTasks(view: HomeView, cfg: TasksConfig): Promise<TaskHit[]> {
	const files = view.app.vault.getMarkdownFiles().filter((f) => inTaskScope(f.path, cfg));
	const hits: TaskHit[] = [];
	for (const file of files) {
		const content = await view.app.vault.cachedRead(file);
		const lines = content.split("\n");
		lines.forEach((line, i) => {
			const match = /^\s*[-*+]\s\[([ xX])\]\s*(.*)$/.exec(line);
			if (!match) return;
			const text = match[2].trim();
			const dueMatch = /📅\s*(\d{4}-\d{2}-\d{2})/.exec(text);
			hits.push({
				file,
				line: i,
				text,
				done: match[1].toLowerCase() === "x",
				due: dueMatch ? dueMatch[1] : null,
			});
		});
	}
	return hits;
}

/** Read TaskNotes task notes directly via frontmatter (see TasksConfig.source
 * doc for why: no stable public API, and field names are user-remappable).
 * Only files that actually have the configured status field are treated as
 * tasks, so unrelated notes with a `due` or `priority` property aren't
 * mistaken for one. */
function collectTaskNotesTasks(view: HomeView, cfg: TasksConfig): TaskHit[] {
	const s = view.plugin.settings;
	const statusField = s.taskNotesStatusField.trim() || "status";
	const dueField = s.taskNotesDueField.trim() || "due";
	const priorityField = s.taskNotesPriorityField.trim() || "priority";
	const doneValue = (s.taskNotesDoneValue.trim() || "done").toLowerCase();

	const files = view.app.vault.getMarkdownFiles().filter((f) => inTaskScope(f.path, cfg));
	const hits: TaskHit[] = [];
	for (const file of files) {
		const fm = view.app.metadataCache.getFileCache(file)?.frontmatter;
		if (!fm || !(statusField in fm)) continue;
		const status = String(fm[statusField] ?? "");
		const due: string | null = typeof fm[dueField] === "string" ? String(fm[dueField]) : null;
		const priorityRaw = fm[priorityField];
		const priority = priorityRaw == null || priorityRaw === "" ? undefined : String(priorityRaw);
		hits.push({
			file,
			line: -1,
			text: String(fm.title ?? file.basename),
			done: status.toLowerCase() === doneValue,
			due,
			status,
			priority,
		});
	}
	return hits;
}

/** The checkbox marker at the start of a list item, capturing the state char so
 * only that bracket is flipped (never a stray "[x]" elsewhere in the text). */
const CHECKBOX_MARKER = /^(\s*[-*+]\s\[)([ xX])(\])/;

/** Flip a checkbox task's `[ ]`/`[x]` in place. Only used for checkbox tasks —
 * TaskNotes status is left to TaskNotes' own UI since it may be a multi-step
 * workflow, not a plain open/done toggle. Re-validates the stored line against
 * the current file (which may have changed since render) and bails with a
 * refresh rather than flipping the wrong line. */
function toggleCheckboxTask(view: HomeView, hit: TaskHit): Promise<boolean> {
	return setCheckboxState(view, hit, !hit.done);
}

/** Set a checkbox task to an explicit done state in place. Re-validates the
 * stored line against the current file (which may have changed since render)
 * and only touches the leading marker, so a stale index or a "[x]" elsewhere
 * in the text can't corrupt the file. Returns false when the line no longer
 * matches (the caller should refresh). */
async function setCheckboxState(view: HomeView, hit: TaskHit, done: boolean): Promise<boolean> {
	const content = await view.app.vault.read(hit.file);
	const lines = content.split("\n");
	const line = lines[hit.line];
	const match = line != null ? CHECKBOX_MARKER.exec(line) : null;
	if (!match) return false; // line no longer a checkbox — file changed under us
	// Confirm it's still the same task, comparing text with any 📅 due date
	// stripped (dates can shift without changing the task).
	const strip = (t: string) => t.replace(/📅\s*\d{4}-\d{2}-\d{2}/, "").trim();
	if (strip(line.slice(match[0].length)) !== strip(hit.text)) return false;
	lines[hit.line] = line.replace(
		CHECKBOX_MARKER,
		(_m, pre: string, _state: string, post: string) => `${pre}${done ? "x" : " "}${post}`,
	);
	await view.app.vault.modify(hit.file, lines.join("\n"));
	return true;
}

/** Write a TaskNotes task's status frontmatter field (used by the Kanban board
 * when a card is dragged to another status column). */
async function setTaskNotesStatus(view: HomeView, hit: TaskHit, value: string): Promise<void> {
	const field = view.plugin.settings.taskNotesStatusField.trim() || "status";
	try {
		await view.app.fileManager.processFrontMatter(hit.file, (fm) => {
			fm[field] = value;
		});
	} catch {
		new Notice("Hearth: couldn't update the task status.");
	}
}

/** Best-effort: open a TaskNotes task in TaskNotes' own editor rather than the
 * raw Markdown note. TaskNotes exposes no stable public API, so this tries a
 * couple of plausible instance/api methods and returns whether one handled it;
 * the caller falls back to opening the file when it didn't. */
function openInTaskNotes(view: HomeView, file: TFile): boolean {
	const plugin = view.app.plugins.plugins[TASKNOTES_PLUGIN_ID] as
		| Record<string, unknown>
		| undefined;
	if (!plugin) return false;
	const targets: unknown[] = [plugin, plugin.api];
	for (const target of targets) {
		if (!target || typeof target !== "object") continue;
		const obj = target as Record<string, unknown>;
		for (const method of ["openTaskEditModal", "openTask"]) {
			const fn = obj[method];
			if (typeof fn === "function") {
				try {
					(fn as (f: TFile) => void).call(obj, file);
					return true;
				} catch {
					// Wrong signature or internal error — fall through to file open.
				}
			}
		}
	}
	return false;
}

async function openTask(view: HomeView, hit: TaskHit): Promise<void> {
	// TaskNotes tasks (no line) open in TaskNotes' own editor when possible.
	if (hit.line < 0 && openInTaskNotes(view, hit.file)) return;

	const leaf = view.app.workspace.getLeaf(true);
	await leaf.openFile(hit.file);
	if (hit.line >= 0 && leaf.view instanceof MarkdownView) {
		const pos = { line: hit.line, ch: 0 };
		leaf.view.editor.setCursor(pos);
		leaf.view.editor.scrollIntoView({ from: pos, to: pos }, true);
	}
}

// ---- Clock / greeting ---------------------------------------------------

/** Time-of-day buckets used to pick a fitting greeting. */
function greetingBucket(hour: number): number {
	if (hour < 5) return 0; // late night
	if (hour < 8) return 1; // early morning
	if (hour < 12) return 2; // morning
	if (hour < 17) return 3; // afternoon
	if (hour < 22) return 4; // evening
	return 5; // night
}

/** Playful, mildly cheeky greetings per bucket (opt-in). */
const PLAYFUL_GREETINGS: string[][] = [
	["Late night session?", "Burning the midnight oil?", "The vault never sleeps, huh?", "You should probably be asleep."],
	["Working this early already?", "Up with the sun, are we?", "Coffee first, surely?", "Bold of you to be up."],
	["Morning. Let's pretend we're productive.", "The notes missed you.", "Back at it.", "Another day, another vault."],
	["Afternoon grind.", "Still going?", "Post-lunch productivity — ambitious.", "Halfway there, probably."],
	["You again?", "Evening. Wrapping up, or just starting?", "One more note, then?", "The day's winding down. You aren't."],
	["Late again?", "The day's over, the ideas aren't.", "Shouldn't you be resting?", "Burning the candle at both ends."],
];

function pickGreeting(hour: number, playful: boolean): string {
	if (!playful) {
		return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
	}
	const pool = PLAYFUL_GREETINGS[greetingBucket(hour)];
	return pool[Math.floor(Math.random() * pool.length)];
}

function formatClockDate(now: Date, mode: NonNullable<ClockConfig["dateMode"]>, custom?: string): string {
	switch (mode) {
		case "short":
			return now.toLocaleDateString(undefined, { dateStyle: "short" });
		case "long":
			return now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
		case "iso": {
			const iso: string = moment(now).format("YYYY-MM-DD");
			return iso;
		}
		case "weekday":
			return now.toLocaleDateString(undefined, { weekday: "long" });
		case "custom": {
			const formatted: string = custom?.trim() ? moment(now).format(custom) : "";
			return formatted;
		}
		case "full":
		default:
			return now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
	}
}

function svgEl(parent: Element, tag: string, attrs: Record<string, string>, cls?: string): SVGElement {
	const el = parent.ownerDocument.createElementNS("http://www.w3.org/2000/svg", tag);
	for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
	if (cls) el.setAttribute("class", cls);
	parent.appendChild(el);
	return el;
}

/** Draw an analogue clock face and return a tick() to rotate its hands. */
function renderAnalogClock(wrap: HTMLElement, cfg: ClockConfig): (now: Date) => void {
	const svg = svgEl(wrap, "svg", { viewBox: "0 0 100 100" }, "hearth-analog");
	svgEl(svg, "circle", { cx: "50", cy: "50", r: "48" }, "hearth-analog-face");
	for (let i = 0; i < 12; i++) {
		const a = (i / 12) * Math.PI * 2;
		const major = i % 3 === 0;
		const r1 = major ? 38 : 42;
		svgEl(
			svg,
			"line",
			{
				x1: String(50 + Math.sin(a) * r1),
				y1: String(50 - Math.cos(a) * r1),
				x2: String(50 + Math.sin(a) * 46),
				y2: String(50 - Math.cos(a) * 46),
			},
			major ? "hearth-analog-tick-major" : "hearth-analog-tick",
		);
	}
	const hand = (cls: string, length: number) =>
		svgEl(svg, "line", { x1: "50", y1: "50", x2: "50", y2: String(50 - length) }, cls);
	const hourHand = hand("hearth-analog-hour", 26);
	const minHand = hand("hearth-analog-min", 38);
	const secHand = cfg.showSeconds ? hand("hearth-analog-sec", 42) : null;
	svgEl(svg, "circle", { cx: "50", cy: "50", r: "2.5" }, "hearth-analog-pin");

	const rotate = (el: SVGElement, deg: number) =>
		el.setAttribute("transform", `rotate(${deg} 50 50)`);

	return (now: Date) => {
		const s = now.getSeconds();
		const m = now.getMinutes();
		const h = now.getHours() % 12;
		rotate(hourHand, (h + m / 60) * 30);
		rotate(minHand, (m + s / 60) * 6);
		if (secHand) rotate(secHand, s * 6);
	};
}

function renderClock(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const cfg = card.clock ?? {};
	const showGreeting = cfg.showGreeting !== false;
	const dateMode = cfg.dateMode ?? "full";
	const analog = cfg.mode === "analog";

	const wrap = body.createDiv("hearth-clock");
	const greetingEl = showGreeting ? wrap.createDiv("hearth-clock-greeting") : null;

	// Pick the greeting once per time bucket so playful ones don't flicker.
	let bucket = -1;
	const refreshGreeting = (hour: number) => {
		if (!greetingEl) return;
		const override = cfg.greetingText?.trim();
		if (override) {
			greetingEl.setText(override);
			return;
		}
		if (greetingBucket(hour) === bucket) return;
		bucket = greetingBucket(hour);
		greetingEl.setText(pickGreeting(hour, cfg.playfulGreetings ?? false));
	};

	const tickAnalog = analog ? renderAnalogClock(wrap, cfg) : null;
	const timeEl = analog ? null : wrap.createDiv("hearth-clock-time");
	const dateEl = dateMode === "none" ? null : wrap.createDiv("hearth-clock-date");

	const timeOpts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
	if (cfg.use24Hour) timeOpts.hour12 = false;
	if (cfg.showSeconds) timeOpts.second = "2-digit";

	const update = () => {
		const now = new Date();
		refreshGreeting(now.getHours());
		if (tickAnalog) tickAnalog(now);
		if (timeEl) timeEl.setText(now.toLocaleTimeString(undefined, timeOpts));
		if (dateEl) dateEl.setText(formatClockDate(now, dateMode, cfg.dateFormat));
	};

	update();
	component.registerInterval(window.setInterval(update, 1000));
}
