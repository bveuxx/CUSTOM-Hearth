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
import { parseNaturalDate, formatRelativeDate } from "./dates";

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
	year(): number;
	diff(other: Moment, unit?: string): number;
}
interface MomentFn {
	(input?: Date | string): Moment;
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

// ---- Query (saved search) ----------------------------------------------

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
	const useTiles = (cfg.view ?? "list") === "tiles";

	const hits = runQuery(view.app, query, { limit });

	const render = (all: QueryHit[]) => {
		const list = all.slice(0, limit);
		if (list.length === 0) {
			emptyState(body, "search-x", "No matches");
			return;
		}
		body.empty();
		if (useTiles) {
			renderQueryTiles(view, body, list);
		} else {
			renderQueryList(view, body, list);
		}
	};

	render(hits);
	// Append full-text body matches when enabled (self-guards to name queries).
	if (view.plugin.settings.searchContents) {
		const exclude = new Set(hits.map((h) => h.file.path));
		void searchFileContents(view.app, query, { exclude, limit }).then((extra) => {
			if (extra.length) render([...hits, ...extra]);
		});
	}
}

function renderQueryList(view: HomeView, body: HTMLElement, list: QueryHit[]): void {
	const el = body.createDiv("hearth-list");
	for (const hit of list) {
		const row = el.createDiv("hearth-list-item");
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
}

function renderQueryTiles(view: HomeView, body: HTMLElement, list: QueryHit[]): void {
	const grid = body.createDiv("hearth-links hearth-tiles-sized");
	const baseTile = 90;
	grid.style.setProperty("--hearth-tile", `${baseTile}px`);
	for (const hit of list) {
		const tile = grid.createDiv("hearth-link-tile");
		setIcon(tile.createDiv("hearth-link-icon"), hit.badge?.icon ?? iconForFile(hit.file));
		const name = hit.file instanceof TFile ? hit.file.basename : hit.file.name;
		tile.createDiv({ cls: "hearth-link-label", text: name });
		const open = () => {
			if (hit.file instanceof TFile) void view.app.workspace.getLeaf(true).openFile(hit.file);
		};
		tile.addEventListener("click", open);
		makeClickable(tile, open, name);
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
	body.addClass("is-embed-host");
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
	body.addClass("is-jot-host");
	const preview = wrap.createDiv("hearth-embed markdown-rendered hearth-jot-preview");
	preview.setAttribute("title", "Double-click to edit");
	const area = wrap.createEl("textarea", {
		cls: "hearth-text hearth-embed-edit hearth-jot-edit",
		attr: { placeholder: "Empty note…" },
	});
	area.hide();

	// `saving` guards against reacting to our own writes; `editing` tracks whether
	// the raw editor is open; `lastSaved` is the content we last wrote so a
	// no-op leave doesn't trigger a redundant write (and modify event).
	let saving = false;
	let editing = false;
	let lastSaved: string | null = null;
	let previewChild: Component | null = null;
	// Monotonic token so overlapping renders (e.g. leaveEdit + a modify event
	// firing together) can't clobber each other. Only the latest render creates
	// a component and touches the DOM; stale in-flight renders bail out. Without
	// this, an earlier render could finish against a component that a later
	// render already unloaded, which drops async content like fenced code blocks.
	let renderToken = 0;

	const renderPreview = () => {
		const token = ++renderToken;
		if (previewChild) {
			component.removeChild(previewChild);
			previewChild = null;
		}
		void view.app.vault.cachedRead(file).then((raw) => {
			// A newer render superseded this one — leave the DOM to the winner.
			if (token !== renderToken) return;
			// The card was torn down while we were reading — don't render into a
			// detached node.
			if (!preview.isConnected) return;
			preview.empty();
			const md = stripFrontmatter(raw);
			if (!md.trim()) {
				preview.addClass("is-empty");
				preview.setText("Empty note — double-click to edit");
				return;
			}
			preview.removeClass("is-empty");
			// Render into a FRESH child node each time rather than into `preview`
			// itself. Some third-party code-block processors dedupe re-renders by
			// the block's parent element — e.g. Numerals keeps a
			// WeakMap<parentEl, source> and, on seeing the same source under the
			// same parent, removes the block instead of rendering it. Reusing
			// `preview` (we only empty() it) kept the parent identical across
			// renders, so leaving raw edit made the math block dedupe itself away
			// until an unrelated full re-render built a new preview node. A new
			// content node per render gives each block a fresh parent.
			const content = preview.createDiv("markdown-rendered");
			previewChild = new Component();
			component.addChild(previewChild);
			void MarkdownRenderer.render(view.app, md, content, file.path, previewChild);
		});
	};

	const flush = () => {
		// Nothing changed since our last write — skip it, so a bare
		// double-click-then-leave doesn't fire a self-modify event that races
		// the leaveEdit re-render.
		if (lastSaved !== null && area.value === lastSaved) return;
		const current = view.app.vault.getAbstractFileByPath(file.path);
		if (current instanceof TFile) {
			saving = true;
			lastSaved = area.value;
			void view.app.vault.modify(current, area.value).finally(() => {
				saving = false;
			});
		}
	};

	const enterEdit = () => {
		void view.app.vault.read(file).then((content) => {
			area.value = content;
			lastSaved = content;
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
						lastSaved = content;
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

	// Optional button to open today's note in the editor (hideable). Rendered
	// as a floating overlay on the card element (not the body) so it doesn't
	// affect the body's scroll/flow.
	if (card.showOpenButton !== false) {
		const cardEl = body.closest(".hearth-card");
		const overlay = (cardEl ?? body).createDiv("hearth-card-actions-overlay");
		const open = overlay.createEl("button", {
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
	body.addClass("is-embed-host");
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
		grid.addClass("has-week-numbers");
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
	body.addClass("is-jot-host");
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
	// Flag the card body so CSS can disable the card drag overlay over tiles in
	// arrange mode (tiles are self-contained widgets with their own resize).
	if (view.arrangeMode) body.addClass("hearth-tiles-arrange");
	for (const link of links) {
		const tile = grid.createDiv("hearth-link-tile");
		applyTileSize(tile, link.sizeW, link.sizeH, link.size, baseTile, link.col, link.row);
		setIcon(tile.createDiv("hearth-link-icon"), link.icon || "link");
		tile.createDiv({ cls: "hearth-link-label", text: link.label || link.target });
		const open = () => openLink(view, link);
		// In arrange mode, clicking a tile must NOT trigger its action — the
		// click is almost always the tail end of a resize/drag gesture.
		if (!view.arrangeMode) {
			tile.addEventListener("click", open);
			makeClickable(tile, open, link.label || link.target);
		}

		// Tiles can only be resized/repositioned while the dashboard is in
		// arrange mode.
		if (view.arrangeMode) {
			makeTileResizable(view, tile, baseTile, () => link.sizeW, (v) => {
				link.sizeW = v;
			}, () => link.sizeH, (v) => {
				link.sizeH = v;
			}, () => link.size, (v) => {
				link.size = v;
			});
			makeTileDraggable(view, grid, tile, links, link, card.tileAutoFlow === true);
		}
	}

	// Flag tiles obscured behind a sibling so the overlap is visible (always,
	// not just in arrange mode — a hidden tile is a problem either way).
	markOverlappingTiles(grid);
}

/** Apply a per-tile size: converts pixel width/height into grid column/row
 * spans (relative to the fine cell size). Each tile is placed on the grid
 * spanning N columns × M rows, so it can independently span multiple rows
 * without its row's height being governed by the tallest tile. When the tile
 * has an explicit free-form position (col/row), it's pinned to that grid line
 * instead of auto-flowing. */
function applyTileSize(
	tile: HTMLElement,
	sizeW: number | undefined,
	sizeH: number | undefined,
	legacySize: number | undefined,
	baseTile: number,
	col?: number,
	row?: number,
): void {
	// Migrate a legacy single `size` into independent width/height on read.
	const w = sizeW ?? legacySize;
	const h = sizeH ?? legacySize;
	// Use the fine cell size for span calculation so sizing is granular.
	const cell = TILE_CELL;
	const rowH = Math.round(TILE_CELL * 0.78);
	const cs = w && w > 0 ? Math.max(1, Math.round(w / cell)) : DEFAULT_TILE_CS;
	const rs = h && h > 0 ? Math.max(1, Math.round(h / rowH)) : DEFAULT_TILE_RS;
	tile.style.setProperty("--hearth-tile-cs", String(cs));
	tile.style.setProperty("--hearth-tile-rs", String(rs));
	applyTileIconOnly(tile, cs, rs);
	// Free-form position: pin to a grid line (1-based). When either is missing
	// the tile auto-flows into the next available cell.
	if (col != null && col > 0) tile.style.setProperty("--hearth-tile-col", String(col));
	else tile.style.removeProperty("--hearth-tile-col");
	if (row != null && row > 0) tile.style.setProperty("--hearth-tile-row", String(row));
	else tile.style.removeProperty("--hearth-tile-row");
}

/** Toggle icon-only mode when a tile is too small to show its label. Below two
 * fine rows there's no vertical room for text, and at a single column there's
 * no horizontal room; in both cases the label ellipsises away to nothing while
 * still reserving its line + gap, which pushes the icon off-centre. Dropping
 * the label (and its gap) then lets the icon sit dead-centre. */
function applyTileIconOnly(tile: HTMLElement, cs: number, rs: number): void {
	tile.toggleClass("is-icon-only", rs <= 1 || cs <= 1);
}

/** Default span for a tile with no explicit size: 2 columns × 2 rows on the
 * fine grid (≈88×68px), matching the visual size of the old 90px default. */
const DEFAULT_TILE_CS = 2;
const DEFAULT_TILE_RS = 2;

/** Fine grid (px) that tile sizes snap to, so tiles align like Android widgets. */
const TILE_GRID = 4;

/** Base cell size (px) for the tile grid. Smaller = finer granularity: a tile
 * can span more columns/rows in smaller steps, so sizing feels precise rather
 * than chunky. Half of the visual default so 2 cells ≈ one old tile. */
const TILE_CELL = 44;

/** Attach a widget-style resize handle to a tile. The handle is a clear,
 * grabbable corner grip (bottom-right) that resizes width and height together
 * on a fine grid. Fully self-contained: stops propagation so the card's drag
 * engine never interferes. */
function makeTileResizable(
	view: HomeView,
	tile: HTMLElement,
	baseTile: number,
	getW: () => number | undefined,
	setW: (size: number | undefined) => void,
	getH: () => number | undefined,
	setH: (size: number | undefined) => void,
	getLegacy: () => number | undefined,
	setLegacy: (size: number | undefined) => void,
): void {
	const handle = tile.createDiv("hearth-tile-resize");
	handle.setAttribute("aria-hidden", "true");

	const stop = (e: PointerEvent) => {
		e.preventDefault();
		e.stopPropagation();
	};

	let resizing = false;
	let startW = 0;
	let startH = 0;
	let startX = 0;
	let startY = 0;

	handle.addEventListener("pointerdown", (e) => {
		stop(e);
		resizing = true;
		// Seed from legacy `size` (which used to drive both axes) so a tile
		// resized before this split still starts from its stored footprint.
		const legacy = getLegacy();
		startW = getW() ?? legacy ?? baseTile;
		if (legacy != null && getW() == null) setW(legacy);
		startH = getH() ?? legacy ?? Math.round(baseTile * 0.78);
		if (legacy != null && getH() == null) setH(legacy);
		startX = e.clientX;
		startY = e.clientY;
		handle.setPointerCapture(e.pointerId);
		tile.addClass("is-tile-resizing");
		tile.closest(".hearth-card")?.addClass("has-tile-gesture");
	});

	handle.addEventListener("pointermove", (e) => {
		if (!resizing) return;
		e.preventDefault();
		e.stopPropagation();
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		// Snap to the fine grid so tiles stay aligned like widgets.
		const w = Math.max(TILE_CELL, Math.min(480, snap(startW + dx, TILE_GRID)));
		const h = Math.max(34, Math.min(480, snap(startH + dy, TILE_GRID)));
		setW(w === baseTile ? undefined : w);
		setH(h === Math.round(baseTile * 0.78) ? undefined : h);
		setLegacy(undefined);
		// Convert live pixel size to grid spans using the fine cell size so
		// the tile grows in small, precise steps.
		const cell = TILE_CELL;
		const rowH = Math.round(TILE_CELL * 0.78);
		const cs = Math.max(1, Math.round(w / cell));
		const rs = Math.max(1, Math.round(h / rowH));
		tile.style.setProperty("--hearth-tile-cs", String(cs));
		tile.style.setProperty("--hearth-tile-rs", String(rs));
		applyTileIconOnly(tile, cs, rs);
	});

	const end = (e: PointerEvent) => {
		if (!resizing) return;
		resizing = false;
		try {
			handle.releasePointerCapture(e.pointerId);
		} catch {
			// pointer already released
		}
		tile.removeClass("is-tile-resizing");
		tile.closest(".hearth-card")?.removeClass("has-tile-gesture");
		void view.plugin.saveData(view.plugin.settings);
	};
	handle.addEventListener("pointerup", end);
	handle.addEventListener("pointercancel", end);
}

/** Snap a value to the nearest multiple of `grid`. */
function snap(value: number, grid: number): number {
	return Math.round(value / grid) * grid;
}

/** Make a tile draggable (to reposition it within its card) in arrange mode.
 *  Uses pointer events (not HTML5 DnD) so it coexists with the resize handle
 *  and doesn't trigger the card's drag engine.
 *
 *  Two modes:
 *  - Free-form (default, `autoFlow = false`): the tile floats under the
 *    pointer and lands on the cell under it on drop. Tiles may overlap and
 *    be placed anywhere; siblings never move. Overlapping tiles are flagged
 *    with a glow (see `markOverlappingTiles`) so a hidden tile is visible.
 *  - Auto-shift (beta, `autoFlow = true`): a dashed placeholder occupies the
 *    target slot and siblings swap aside live (phone-widget style). See
 *    `makeTileAutoFlowDrag`. */
function makeTileDraggable<T extends { id: string; col?: number; row?: number }>(
	view: HomeView,
	container: HTMLElement,
	tile: HTMLElement,
	items: T[],
	item: T,
	autoFlow: boolean,
): void {
	if (autoFlow) {
		makeTileAutoFlowDrag(view, container, tile, item);
	} else {
		makeTileFreeFormDrag(view, container, tile, item);
	}
	tile.setAttribute("data-tile-id", item.id);
	// Double-click a pinned tile to clear its position and let it auto-flow.
	if (item.col != null || item.row != null) {
		tile.addEventListener("dblclick", (e) => {
			e.stopPropagation();
			delete item.col;
			delete item.row;
			void view.plugin.saveData(view.plugin.settings);
			view.render();
		});
	}
}

/** Free-form drag: the tile floats under the pointer via a transform (delta
 *  from the grab point) and lands on whatever cell the pointer is over on
 *  drop. Siblings don't move; tiles may overlap. A dashed ghost outline
 *  follows the pointer so the drop target is visible. Overlapping tiles glow
 *  so a hidden tile stays visible (an undesirable state worth flagging).
 *  Using a transform (not absolute positioning) avoids any offset/jump —
 *  the tile simply translates by the pointer delta from its grid slot. */
function makeTileFreeFormDrag<T extends { id: string; col?: number; row?: number }>(
	view: HomeView,
	container: HTMLElement,
	tile: HTMLElement,
	item: T,
): void {
	let dragging = false;
	let startX = 0;
	let startY = 0;
	let moved = false;
	let pointerId = -1;
	const DRAG_THRESHOLD = 5;
	// Dashed ghost showing the drop target cell under the pointer.
	let ghost: HTMLElement | null = null;

	tile.addEventListener("pointerdown", (e) => {
		if ((e.target as HTMLElement).closest(".hearth-tile-resize")) return;
		e.stopPropagation();
		startX = e.clientX;
		startY = e.clientY;
		dragging = true;
		moved = false;
		pointerId = e.pointerId;
		tile.setPointerCapture(e.pointerId);
	});

	tile.addEventListener("pointermove", (e) => {
		if (!dragging || e.pointerId !== pointerId) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
		e.preventDefault();
		e.stopPropagation();
		if (!moved) {
			moved = true;
			tile.addClass("is-tile-dragging");
			tile.closest(".hearth-card")?.addClass("has-tile-gesture");
			// Insert a dashed ghost outline that will follow the pointer.
			ghost = container.createDiv("hearth-tile-ghost");
			const cs = tile.style.getPropertyValue("--hearth-tile-cs") || String(DEFAULT_TILE_CS);
			const rs = tile.style.getPropertyValue("--hearth-tile-rs") || String(DEFAULT_TILE_RS);
			ghost.style.setProperty("--hearth-tile-cs", cs);
			ghost.style.setProperty("--hearth-tile-rs", rs);
		}
		// Float the tile by the pointer delta — no position/size changes, so
		// there's no offset or jump. The grid slot stays reserved.
		tile.setCssStyles({ transform: `translate(${dx}px, ${dy}px)` });
		// Move the ghost outline to the cell under the pointer.
		if (ghost) {
			const cell = pickGridCell(container, e.clientX, e.clientY, tile);
			if (cell) {
				ghost.style.setProperty("--hearth-tile-col", String(cell.col));
				ghost.style.setProperty("--hearth-tile-row", String(cell.row));
			}
		}
		// Live-flag tiles the dragged tile is covering so overlaps are visible
		// as it moves (the dragged tile is on top and ignored by the marker).
		markOverlappingTiles(container);
	});

	const end = (e: PointerEvent) => {
		if (!dragging || e.pointerId !== pointerId) return;
		dragging = false;
		const wasMoved = moved;
		moved = false;
		tile.removeClass("is-tile-dragging");
		tile.setCssStyles({});
		if (ghost) {
			ghost.remove();
			ghost = null;
		}
		tile.closest(".hearth-card")?.removeClass("has-tile-gesture");
		try {
			tile.releasePointerCapture(e.pointerId);
		} catch {
			// already released
		}
		if (!wasMoved) return;
		// Drop on the cell under the pointer (free-form; may overlap others).
		const cell = pickGridCell(container, e.clientX, e.clientY, tile);
		if (cell) {
			item.col = cell.col;
			item.row = cell.row;
		}
		void view.plugin.saveData(view.plugin.settings);
		view.render();
	};
	tile.addEventListener("pointerup", end);
	tile.addEventListener("pointercancel", end);
}

/** Auto-shift drag (beta): a dashed placeholder occupies the dragged tile's
 *  target slot and siblings swap aside live, like phone widgets. On drop,
 *  only the dragged tile's `col`/`row` is persisted; siblings revert to
 *  their stored positions (a full re-render follows), so a tile that was
 *  shoved aside comes back if its slot wasn't taken. */
function makeTileAutoFlowDrag<T extends { id: string; col?: number; row?: number }>(
	view: HomeView,
	container: HTMLElement,
	tile: HTMLElement,
	item: T,
): void {
	let dragging = false;
	let startX = 0;
	let startY = 0;
	let moved = false;
	let pointerId = -1;
	const DRAG_THRESHOLD = 5;

	// The tile's offset within the container at drag start, so we can position
	// it absolutely without a jump (delta-based movement).
	let baseLeft = 0;
	let baseTop = 0;
	let baseWidth = 0;
	let baseHeight = 0;

	let placeholder: HTMLElement | null = null;
	let placeholderPos: { col: number; row: number } | null = null;

	tile.addEventListener("pointerdown", (e) => {
		if ((e.target as HTMLElement).closest(".hearth-tile-resize")) return;
		e.stopPropagation();
		startX = e.clientX;
		startY = e.clientY;
		dragging = true;
		moved = false;
		pointerId = e.pointerId;
		tile.setPointerCapture(e.pointerId);
	});

	tile.addEventListener("pointermove", (e) => {
		if (!dragging || e.pointerId !== pointerId) return;
		const dx = e.clientX - startX;
		const dy = e.clientY - startY;
		if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
		e.preventDefault();
		e.stopPropagation();
		if (!moved) {
			moved = true;
			tile.addClass("is-tile-dragging");
			tile.closest(".hearth-card")?.addClass("has-tile-gesture");
			// Measure the tile's position relative to the container BEFORE
			// removing it from flow, so we can place it absolutely at the
			// same spot (then move by the pointer delta — no jump).
			const rect = tile.getBoundingClientRect();
			const containerRect = container.getBoundingClientRect();
			baseLeft = rect.left - containerRect.left;
			baseTop = rect.top - containerRect.top;
			baseWidth = rect.width;
			baseHeight = rect.height;
			placeholderPos = getTileCell(tile, container) ?? {
				col: item.col ?? 1,
				row: item.row ?? 1,
			};
			placeholder = container.createDiv("hearth-tile-placeholder");
			const cs = tile.style.getPropertyValue("--hearth-tile-cs") || String(DEFAULT_TILE_CS);
			const rs = tile.style.getPropertyValue("--hearth-tile-rs") || String(DEFAULT_TILE_RS);
			placeholder.style.setProperty("--hearth-tile-cs", cs);
			placeholder.style.setProperty("--hearth-tile-rs", rs);
			placeholder.style.setProperty("--hearth-tile-col", String(placeholderPos.col));
			placeholder.style.setProperty("--hearth-tile-row", String(placeholderPos.row));
			// Freeze every sibling tile to its current cell so a swap with the
			// placeholder moves exactly one tile.
			const siblings = Array.from(
				container.querySelectorAll<HTMLElement>(".hearth-link-tile"),
			);
			for (const sib of siblings) {
				if (sib === tile) continue;
				const cell = getTileCell(sib, container);
				if (cell) {
					sib.style.setProperty("--hearth-tile-col", String(cell.col));
					sib.style.setProperty("--hearth-tile-row", String(cell.row));
				}
			}
			// Take the tile out of flow and immediately pin it to its current
			// spot so it doesn't jump before the first delta is applied.
			tile.setCssStyles({
				position: "absolute",
				width: `${rect.width}px`,
				height: `${rect.height}px`,
				left: `${baseLeft}px`,
				top: `${baseTop}px`,
			});
		}
		// Move by the pointer delta from the grab point — no offset issues.
		tile.setCssStyles({
			position: "absolute",
			width: `${baseWidth}px`,
			height: `${baseHeight}px`,
			left: `${baseLeft + dx}px`,
			top: `${baseTop + dy}px`,
		});
		if (!placeholder || !placeholderPos) return;
		const other = findTileUnderPointer(container, e.clientX, e.clientY, tile);
		if (other) {
			const otherPos = getTileCell(other, container);
			if (otherPos) {
				other.style.setProperty("--hearth-tile-col", String(placeholderPos.col));
				other.style.setProperty("--hearth-tile-row", String(placeholderPos.row));
				placeholder.style.setProperty("--hearth-tile-col", String(otherPos.col));
				placeholder.style.setProperty("--hearth-tile-row", String(otherPos.row));
				placeholderPos = otherPos;
			}
		} else {
			const cell = pickGridCell(container, e.clientX, e.clientY, tile);
			if (cell) {
				placeholder.style.setProperty("--hearth-tile-col", String(cell.col));
				placeholder.style.setProperty("--hearth-tile-row", String(cell.row));
				placeholderPos = cell;
			}
		}
	});

	const end = (e: PointerEvent) => {
		if (!dragging || e.pointerId !== pointerId) return;
		dragging = false;
		const wasMoved = moved;
		moved = false;
		tile.removeClass("is-tile-dragging");
		tile.setCssStyles({});
		tile.closest(".hearth-card")?.removeClass("has-tile-gesture");
		const dropPos = placeholderPos;
		if (placeholder) {
			placeholder.remove();
			placeholder = null;
		}
		const siblings = Array.from(
			container.querySelectorAll<HTMLElement>(".hearth-link-tile"),
		);
		for (const sib of siblings) {
			if (sib === tile) continue;
			sib.style.removeProperty("--hearth-tile-col");
			sib.style.removeProperty("--hearth-tile-row");
		}
		try {
			tile.releasePointerCapture(e.pointerId);
		} catch {
			// already released
		}
		if (!wasMoved) return;
		if (dropPos) {
			item.col = dropPos.col;
			item.row = dropPos.row;
		}
		void view.plugin.saveData(view.plugin.settings);
		view.render();
	};
	tile.addEventListener("pointerup", end);
	tile.addEventListener("pointercancel", end);
}

/** Mark tiles that are obscured behind another tile in the same card, so the
 *  user can see (and fix) the undesirable overlap. A tile counts as obscured
 *  when another sibling tile's rect covers a meaningful part of it. The
 *  actively-dragged tile is skipped (it's on top, so it can't be "obscured"),
 *  but a tile it covers IS flagged. Only runs in arrange mode. */
function markOverlappingTiles(container: HTMLElement): void {
	const tiles = Array.from(container.querySelectorAll<HTMLElement>(".hearth-link-tile"));
	for (const t of tiles) t.removeClass("is-obscured");
	const rects = tiles.map((t) => ({
		t,
		r: t.getBoundingClientRect(),
		dragging: t.classList.contains("is-tile-dragging"),
	}));
	for (let i = 0; i < rects.length; i++) {
		const a = rects[i];
		if (a.dragging) continue; // the dragged tile floats on top — never obscured
		// A tile is obscured if any other tile (drawn later, i.e. on top in
		// DOM order, or the floating dragged tile) overlaps more than a sliver
		// of its area.
		for (let j = i + 1; j < rects.length; j++) {
			const b = rects[j];
			const ix = Math.max(0, Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left));
			const iy = Math.max(0, Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top));
			const overlap = ix * iy;
			const aArea = a.r.width * a.r.height;
			// Flag `a` (the lower-DOM, i.e. underneath) tile when `b` covers
			// more than 15% of it.
			if (aArea > 0 && overlap / aArea > 0.15) {
				a.t.addClass("is-obscured");
			}
		}
	}
}

/** Read a tile's current grid cell from the DOM. Prefers the inline
 *  `--hearth-tile-col/row` (set for pinned tiles), falling back to the tile's
 *  rendered position mapped onto the grid's metrics. Returns null when the
 *  metrics can't be measured reliably. */
function getTileCell(
	tile: HTMLElement,
	container: HTMLElement,
): { col: number; row: number } | null {
	const colAttr = tile.style.getPropertyValue("--hearth-tile-col");
	const rowAttr = tile.style.getPropertyValue("--hearth-tile-row");
	if (colAttr && rowAttr) {
		const col = parseInt(colAttr, 10);
		const row = parseInt(rowAttr, 10);
		if (Number.isFinite(col) && Number.isFinite(row)) return { col, row };
	}
	const rect = tile.getBoundingClientRect();
	const cRect = container.getBoundingClientRect();
	if (cRect.width <= 0) return null;
	const gap = 6;
	const columns = Math.max(1, Math.floor((cRect.width + gap) / (TILE_CELL + gap)));
	const colW = (cRect.width - (columns - 1) * gap) / columns;
	const rowH = Math.round(TILE_CELL * 0.78);
	const relX = rect.left - cRect.left;
	const relY = rect.top - cRect.top;
	const col = Math.max(1, Math.round(relX / (colW + gap)) + 1);
	const row = Math.max(1, Math.round(relY / (rowH + gap)) + 1);
	return { col, row };
}

/** Find the `.hearth-link-tile` under a pointer, excluding the dragged tile
 *  (and anything inside it, like its resize handle). The dragged tile has
 *  pointer-events: none while dragging, so elementFromPoint already skips it,
 *  but we also guard against its descendants in case a child overrides. */
function findTileUnderPointer(
	container: HTMLElement,
	clientX: number,
	clientY: number,
	except: HTMLElement,
): HTMLElement | null {
	const el = activeDocument.elementFromPoint(clientX, clientY) as HTMLElement | null;
	if (!el) return null;
	if (except.contains(el)) return null;
	const tile = el.closest<HTMLElement>(".hearth-link-tile");
	if (!tile || tile === except || !container.contains(tile)) return null;
	return tile;
}

/** Work out the (col, row) grid cell under a pointer, relative to the card's
 *  tile grid. `container` is the `.hearth-links` grid element. Returns null
 *  when the metrics can't be measured reliably. Clamps to the grid's bounds
 *  so a tile dropped near the edge lands on the last valid cell, not off-board.
 *  `tile` is the dragged element (its span is used so the drop keeps the tile
 *  fully inside the grid — the column count limits the start column). */
function pickGridCell(
	container: HTMLElement,
	clientX: number,
	clientY: number,
	tile: HTMLElement,
): { col: number; row: number } | null {
	const rect = container.getBoundingClientRect();
	if (rect.width <= 0) return null;
	const gap = 6;
	// auto-fill column count at the current card width (matches the CSS
	// `repeat(auto-fill, minmax(44px, 1fr))` grid).
	const columns = Math.max(1, Math.floor((rect.width + gap) / (TILE_CELL + gap)));
	// Actual column width (the 1fr columns expand past the 44px minimum, so
	// use the real width to map the pointer to a column line).
	const colW = (rect.width - (columns - 1) * gap) / columns;
	// The dragged tile's column span, so we keep its start within bounds.
	const cs = parseInt(
		tile.style.getPropertyValue("--hearth-tile-cs") || String(DEFAULT_TILE_CS),
		10,
	) || DEFAULT_TILE_CS;
	const rowH = Math.round(TILE_CELL * 0.78);
	// Pointer relative to the grid's content box, in cells (1-based lines).
	const relX = clientX - rect.left;
	const relY = clientY - rect.top;
	let col = Math.round(relX / (colW + gap)) + 1;
	let row = Math.round(relY / (rowH + gap)) + 1;
	col = Math.max(1, Math.min(col, Math.max(1, columns - cs + 1)));
	row = Math.max(1, row);
	return { col, row };
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
	if (view.arrangeMode) body.addClass("hearth-tiles-arrange");
	for (const cmd of commands) {
		const tile = grid.createDiv("hearth-link-tile");
		// A per-tile size overrides the card default: it drives the tile's own
		// height/icon (via --hearth-tile) and, when larger than the base, makes
		// the tile span proportionally more grid columns so it's wider too.
		applyTileSize(tile, cmd.sizeW, cmd.sizeH, cmd.size, baseTile, cmd.col, cmd.row);
		setIcon(tile.createDiv("hearth-link-icon"), cmd.icon || "terminal-square");
		tile.createDiv({ cls: "hearth-link-label", text: cmd.name || cmd.id });
		const run = () => runCommand(view, cmd);
		// In arrange mode, clicking a tile must NOT trigger its action.
		if (!view.arrangeMode) {
			tile.addEventListener("click", run);
			makeClickable(tile, run, cmd.name || cmd.id);
		}

		if (view.arrangeMode) {
			makeTileResizable(view, tile, baseTile, () => cmd.sizeW, (v) => {
				cmd.sizeW = v;
			}, () => cmd.sizeH, (v) => {
				cmd.sizeH = v;
			}, () => cmd.size, (v) => {
				cmd.size = v;
			});
			makeTileDraggable(view, grid, tile, commands, cmd, card.tileAutoFlow === true);
		}
	}

	// Flag tiles obscured behind a sibling so the overlap is visible (always,
	// not just in arrange mode — a hidden tile is a problem either way).
	markOverlappingTiles(grid);
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
	/** The original due text as written (e.g. "tomorrow"), kept so the display
	 * can show the user's natural-language wording next to the parsed date. */
	dueRaw: string | null;
	/** TaskNotes "scheduled" date (frontmatter), used as a fallback for sorting
	 * when no due date is set. */
	scheduled: string | null;
	/** File creation time (epoch ms), the final sort tiebreaker. */
	created: number;
	/** TaskNotes recurrence rule (e.g. "FREQ=WEEKLY;INTERVAL=1" or an RRULE).
	 * When present the task is recurring; shown as a ↻ badge next to the due
	 * date so the date isn't mistaken for a one-off. */
	recurrence?: string;
	/** TaskNotes complete_instances: the YYYY-MM-DD dates already completed for
	 * a recurring task. Used to mark today's instance done and to reflect an
	 * already-checked checkbox without re-completing. */
	completeInstances?: string[];
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

/** A short, human-readable label for a recurrence rule (e.g. "FREQ=WEEKLY;
 * INTERVAL=2" → "Repeats weekly"). Returns null if the rule is empty or
 * unparseable. */
function recurrenceLabel(rule: string | undefined): string | null {
	if (!rule) return null;
	const r = rule.replace(/^RRULE:/i, "");
	const freq = /FREQ=([A-Z]+)/i.exec(r)?.[1]?.toLowerCase();
	if (!freq) return "Repeats";
	const interval = parseInt(/INTERVAL=(\d+)/i.exec(r)?.[1] ?? "1", 10);
	const unit =
		freq === "daily"
			? "day"
			: freq === "weekly"
				? "week"
				: freq === "monthly"
					? "month"
					: freq === "yearly"
						? "year"
						: freq;
	const plural = interval > 1 ? `${interval} ${unit}s` : unit;
	return `Repeats every ${plural}`;
}

/** The date used for display/sorting — `due` wins, but recurring tasks use
 * `scheduled` (the next occurrence) since they have no fixed due date. */
function effectiveDate(hit: TaskHit): string | null {
	return hit.due ?? hit.scheduled ?? null;
}

/** Format a due/next-occurrence date for display as a short, human-relative
 * label ("Today", "Tomorrow", "Yesterday", "Friday", "Next Friday", "15 Jul").
 * Recurring tasks append a ↻ symbol so the date isn't mistaken for a one-off
 * and the user knows it's the next occurrence. */
function formatDueLabel(hit: TaskHit): string | null {
	const raw = hit.recurrence ? hit.due ?? hit.scheduled : hit.due;
	if (!raw) return hit.recurrence ? "↻" : null;
	const tail = hit.recurrence ? " ↻" : "";
	return `${formatRelativeDate(raw)}${tail}`;
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

/** Sort tasks by: due date → scheduled date → priority → created date.
 * Dates are compared as strings (YYYY-MM-DD sorts lexically). Priority uses
 * the coarse high/medium/low/other level. Created is the file's ctime (epoch). */
function sortTasks(hits: TaskHit[]): void {
	const rank = (p: string | undefined): number => {
		switch (priorityLevel(p ?? "")) {
			case "high":
				return 0;
			case "medium":
				return 1;
			case "low":
				return 2;
			default:
				return 3;
		}
	};
	hits.sort((a, b) => {
		// 1. Due date (earlier first; tasks without a due date sort after).
		if (a.due && b.due) return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
		if (a.due) return -1;
		if (b.due) return 1;
		// 2. Scheduled date (same logic as due).
		if (a.scheduled && b.scheduled) return a.scheduled < b.scheduled ? -1 : a.scheduled > b.scheduled ? 1 : 0;
		if (a.scheduled) return -1;
		if (b.scheduled) return 1;
		// 3. Priority (high → medium → low → other).
		const pa = rank(a.priority);
		const pb = rank(b.priority);
		if (pa !== pb) return pa - pb;
		// 4. Created date (oldest first).
		return a.created - b.created;
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
	} else if (hit.recurrence) {
		// Recurring TaskNotes tasks complete per-occurrence (complete_instances +
		// next scheduled), not by flipping status — a checkbox does that without
		// needing a status column to drag into.
		renderRecurringCheckbox(view, hit, today, row, refresh);
	} else if (hit.status) {
		row.createDiv({ cls: "hearth-task-status", text: hit.status });
	}

	row.createDiv({ cls: "hearth-list-label hearth-task-text", text: hit.text || hit.file.basename });
	if (hit.priority) renderPriority(row, hit.priority);
	const dueLabel = formatDueLabel(hit);
	if (dueLabel) {
		const due = row.createDiv({ cls: "hearth-task-due", text: dueLabel });
		const ed = effectiveDate(hit);
		due.toggleClass("is-overdue", !hit.done && !!ed && ed.slice(0, 10) < today);
		if (hit.recurrence) {
			due.addClass("is-recurring");
			due.setAttribute("title", recurrenceLabel(hit.recurrence) ?? "Recurring");
		}
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
			// Recurring TaskNotes tasks complete per-occurrence, not by status:
			// dragging one into the "done" column marks today's instance done and
			// advances its scheduled date instead of setting status=done (which
			// would wrongly retire the whole recurring task).
			if (hit.recurrence && col.key === doneValue.toLowerCase()) {
				void completeRecurringInstance(view, hit).then(refresh);
				return;
			}
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
			// Highlight the task card a dragged task would land on (the card
			// being hovered), with the same dashed outline as column drop.
			cardEl.addEventListener("dragover", (e) => {
				if (e.dataTransfer?.types.includes("application/hearth-col")) return;
				e.preventDefault();
				e.stopPropagation();
				cardEl.addClass("is-drop-target");
			});
			cardEl.addEventListener("dragleave", () => cardEl.removeClass("is-drop-target"));
			cardEl.addEventListener("drop", (e) => {
				cardEl.removeClass("is-drop-target");
				if (e.dataTransfer?.types.includes("application/hearth-col")) return;
				const raw = e.dataTransfer?.getData("text/plain") ?? "";
				if (!raw) return;
				e.preventDefault();
				e.stopPropagation();
				const fromIdx = parseInt(raw, 10);
				if (Number.isNaN(fromIdx)) return;
				const from = hits[fromIdx];
				if (!from) return;
				if (from === hit) return;
				if (from.status === hit.status) {
					// Same column: reorder within it. No fine-grained order is
					// stored (tasks sort by due), so just move to the same col.
				}
				moveTo(from, col);
			});
		// Recurring TaskNotes tasks get a per-occurrence completion checkbox
		// inline with the task text (in a row), in addition to drag: checking
		// it completes today's instance and advances scheduled without
		// retiring the task.
		const textRow = cardEl.createDiv("hearth-kanban-card-row");
		if (source !== "checkbox" && hit.recurrence) {
			renderRecurringCheckbox(view, hit, today, textRow, refresh);
		}
		textRow.createDiv({ cls: "hearth-kanban-card-text", text: hit.text || hit.file.basename });
			const meta = cardEl.createDiv("hearth-kanban-card-meta");
			if (hit.priority) renderPriority(meta, hit.priority);
			const dueLabel = formatDueLabel(hit);
			if (dueLabel) {
				const due = meta.createDiv({ cls: "hearth-task-due", text: dueLabel });
				const ed = effectiveDate(hit);
				due.toggleClass("is-overdue", !hit.done && !!ed && ed.slice(0, 10) < today);
				if (hit.recurrence) {
					due.addClass("is-recurring");
					due.setAttribute("title", recurrenceLabel(hit.recurrence) ?? "Recurring");
				}
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
			// The Tasks-plugin emoji convention: `📅 <date>` for the due date.
			// The date can be YYYY-MM-DD or any natural-language wording
			// (today, next friday, in 3 days, …) which we resolve to a date.
			const dueExpr = readEmojiField(text, "📅");
			let due: string | null = null;
			let dueRaw: string | null = null;
			if (dueExpr) {
				dueRaw = dueExpr;
				due = /^\d{4}-\d{2}-\d{2}$/.test(dueExpr) ? dueExpr : parseNaturalDate(dueExpr);
			}
		hits.push({
			file,
			line: i,
			text,
			done: match[1].toLowerCase() === "x",
			due,
			dueRaw,
			scheduled: null,
			created: file.stat.ctime,
			recurrence: undefined,
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
		const cache = view.app.metadataCache.getFileCache(file);
		const fm = cache?.frontmatter;
		if (!fm || !(statusField in fm)) continue;
		const status = String(fm[statusField] ?? "");
		const dueRawVal: unknown = fm[dueField];
		// TaskNotes stores due as YYYY-MM-DD by convention, but users may have
		// written a natural-language date — resolve either to YYYY-MM-DD and
		// keep the raw wording for display.
		let due: string | null = null;
		let dueRaw: string | null = null;
		if (typeof dueRawVal === "string" && dueRawVal.trim()) {
			const expr = dueRawVal.trim();
			dueRaw = expr;
			due = /^\d{4}-\d{2}-\d{2}$/.test(expr) ? expr : parseNaturalDate(expr);
		}
		// TaskNotes' scheduled field is conventionally "scheduled"; read it as
		// a fallback sort key when no due date is set.
		const scheduledRaw: unknown = fm["scheduled"];
		const scheduled: string | null = typeof scheduledRaw === "string" ? scheduledRaw : null;
		const priorityRaw: unknown = fm[priorityField];
		const priority = priorityRaw == null || priorityRaw === "" ? undefined : String(priorityRaw);
		// TaskNotes stores the recurrence rule in a "recurrence" frontmatter
		// field (an RRULE like "FREQ=WEEKLY;INTERVAL=1" or "RRULE:FREQ=DAILY").
		const recurrenceRaw: unknown = fm["recurrence"];
		const recurrence =
			recurrenceRaw == null || recurrenceRaw === "" ? undefined : String(recurrenceRaw);
		// TaskNotes records each completed occurrence of a recurring task as a
		// YYYY-MM-DD entry in "complete_instances". Read it so the completion
		// checkbox can reflect today's state and avoid double-completing.
		const ciRaw: unknown = fm["complete_instances"];
		const completeInstances: string[] = Array.isArray(ciRaw)
			? ciRaw.map((v) => String(v)).filter(Boolean)
			: [];
		hits.push({
			file,
			line: -1,
			text: String(fm.title ?? file.basename),
			done: status.toLowerCase() === doneValue,
			due,
			dueRaw,
			scheduled,
			created: file.stat.ctime,
			recurrence,
			completeInstances,
			status,
			priority,
		});
	}
	return hits;
}

/** Read the value of a Tasks-plugin emoji field from a checkbox line, e.g.
 * `📅 tomorrow` or `📅 2024-01-15`. Returns the trimmed value up to the next
 * known emoji marker (⏳ 🛫 🔁 ✅ ➕ ⏫ 🔼 🔽) or end of line, or null when the
 * marker isn't present. */
function readEmojiField(text: string, emoji: string): string | null {
	const idx = text.indexOf(emoji);
	if (idx < 0) return null;
	let rest = text.slice(idx + emoji.length);
	// Stop at the next emoji marker (any of the Tasks-plugin conventions).
	const next = rest.search(/[⏳🛫🔁✅➕⏫🔼🔽]/u);
	if (next >= 0) rest = rest.slice(0, next);
	const value = rest.trim();
	return value || null;
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
	const strip = (t: string) => t.replace(/📅\s*[^\n\r⏳🛫🔁✅➕⏫🔼🔽]*/u, "").trim();
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

/** Compute the next occurrence date (YYYY-MM-DD) of a TaskNotes recurrence
 * rule strictly after `fromDate` (YYYY-MM-DD). Handles the common FREQ values
 * (DAILY/WEEKLY/MONTHLY/YEARLY) with INTERVAL and BYDAY; weeks are aligned to
 * the rule's DTSTART so a "weekly on Monday, every 1 week" anchored on a
 * Monday keeps landing on Mondays. Returns null when the rule can't be parsed
 * or no occurrence is found within a sane horizon (~2 years). */
function nextOccurrence(rule: string, fromDate: string): string | null {
	if (!rule || !fromDate) return null;
	const r = rule.replace(/^RRULE:/i, "");
	const dtRaw = /DTSTART[:=](\d{8})/i.exec(r)?.[1];
	const freq = /FREQ=([A-Z]+)/i.exec(r)?.[1]?.toUpperCase();
	if (!freq) return null;
	const interval = Math.max(1, parseInt(/INTERVAL=(\d+)/i.exec(r)?.[1] ?? "1", 10) || 1);
	const bydayRaw = /BYDAY=([A-Z,]+)/i.exec(r)?.[1];
	const dtstart = dtRaw
		? moment(`${dtRaw.slice(0, 4)}-${dtRaw.slice(4, 6)}-${dtRaw.slice(6, 8)}`)
		: null;
	const from = moment(fromDate);
	const wdMap: Record<string, number> = { MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6, SU: 0 };
	const weekdays = bydayRaw
		? bydayRaw
				.split(",")
				.map((d) => wdMap[d.trim().toUpperCase()] ?? -1)
				.filter((w) => w >= 0)
		: dtstart
			? [dtstart.day()]
			: [];

	const cursor = from.clone().add(1, "day");
	const limit = 730;
	for (let i = 0; i < limit; i++) {
		const daysSince = dtstart ? cursor.diff(dtstart, "days") : 0;
		if (daysSince < 0) {
			cursor.add(1, "day");
			continue;
		}
		if (freq === "DAILY") {
			if (daysSince % interval === 0) return cursor.format("YYYY-MM-DD");
		} else if (freq === "WEEKLY") {
			if (weekdays.length === 0) {
				if (Math.floor(daysSince / 7) % interval === 0) return cursor.format("YYYY-MM-DD");
			} else if (weekdays.includes(cursor.day())) {
				if (Math.floor(daysSince / 7) % interval === 0) return cursor.format("YYYY-MM-DD");
			}
		} else if (freq === "MONTHLY") {
			if (dtstart && cursor.date() === dtstart.date()) {
				const monthsSince =
					(cursor.year() - dtstart.year()) * 12 + (cursor.month() - dtstart.month());
				if (monthsSince >= 0 && monthsSince % interval === 0)
					return cursor.format("YYYY-MM-DD");
			}
		} else if (freq === "YEARLY") {
			if (
				dtstart &&
				cursor.date() === dtstart.date() &&
				cursor.month() === dtstart.month()
			) {
				const yearsSince = cursor.year() - dtstart.year();
				if (yearsSince >= 0 && yearsSince % interval === 0)
					return cursor.format("YYYY-MM-DD");
			}
		}
		cursor.add(1, "day");
	}
	return null;
}

/** Mark today's occurrence of a recurring TaskNotes task complete the way
 * TaskNotes does: append today's YYYY-MM-DD to `complete_instances` (deduped,
 * kept sorted) and advance `scheduled` to the next occurrence derived from the
 * recurrence rule. The task's `status` is left untouched — a recurring task
 * stays open and just rolls forward to its next due date. */
async function completeRecurringInstance(view: HomeView, hit: TaskHit): Promise<void> {
	if (!hit.recurrence) return;
	const today: string = moment().format("YYYY-MM-DD");
	const next = nextOccurrence(hit.recurrence, today);
	try {
		await view.app.fileManager.processFrontMatter(hit.file, (fm) => {
			const cur = typeof fm["scheduled"] === "string" ? String(fm["scheduled"]) : null;
			const timeMatch = cur ? /T(\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)\s*$/.exec(cur) : null;
			const instances = Array.isArray(fm["complete_instances"])
				? fm["complete_instances"].map((v: unknown) => String(v))
				: [];
			if (!instances.includes(today)) {
				instances.push(today);
				instances.sort();
				fm["complete_instances"] = instances;
			}
			if (next) {
				fm["scheduled"] = timeMatch ? `${next}T${timeMatch[1]}` : next;
			}
		});
	} catch {
		new Notice("Hearth: couldn't mark the recurring task instance complete.");
	}
}

/** Undo today's completion of a recurring TaskNotes task: remove today from
 * `complete_instances` and roll `scheduled` back to today (the occurrence we
 * just un-completed). Used when the user unchecks the box to cancel a
 * mistaken completion. */
async function uncompleteRecurringInstance(view: HomeView, hit: TaskHit): Promise<void> {
	if (!hit.recurrence) return;
	const today: string = moment().format("YYYY-MM-DD");
	try {
		await view.app.fileManager.processFrontMatter(hit.file, (fm) => {
			const cur = typeof fm["scheduled"] === "string" ? String(fm["scheduled"]) : null;
			const timeMatch = cur ? /T(\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?Z?)\s*$/.exec(cur) : null;
			const instances = Array.isArray(fm["complete_instances"])
				? fm["complete_instances"].map((v: unknown) => String(v)).filter((d) => d !== today)
				: [];
			fm["complete_instances"] = instances;
			// Restore the occurrence date the checkbox represents (today),
			// keeping any time component the task already had.
			fm["scheduled"] = timeMatch ? `${today}T${timeMatch[1]}` : today;
		});
	} catch {
		new Notice("Hearth: couldn't undo the recurring task completion.");
	}
}

/** Render a small checkbox that completes today's occurrence of a recurring
 * TaskNotes task on check, and undoes it on uncheck (removes today from
 * complete_instances and rolls scheduled back to today). Pre-checked when
 * today is already in complete_instances. Stops propagation so it never
 * triggers the row/card click or drag. Rendered as the first child of `parent`
 * so it sits before the task text. */
function renderRecurringCheckbox(
	view: HomeView,
	hit: TaskHit,
	today: string,
	parent: HTMLElement,
	refresh: () => void,
): void {
	const check = parent.createEl("input", {
		cls: "hearth-task-check hearth-task-check-recurring",
		attr: { type: "checkbox", "aria-label": "Mark today's occurrence complete" },
	});
	// Move it to the very front so it leads the task text regardless of what
	// the caller appends afterwards.
	parent.insertBefore(check, parent.firstChild);
	check.checked = (hit.completeInstances ?? []).includes(today);
	const stop = (e: Event) => e.stopPropagation();
	check.addEventListener("click", stop);
	check.addEventListener("mousedown", stop);
	check.addEventListener("pointerdown", stop);
	check.addEventListener("change", () => {
		const wasChecked = (hit.completeInstances ?? []).includes(today);
		if (check.checked && !wasChecked) {
			void completeRecurringInstance(view, hit).then(refresh);
		} else if (!check.checked && wasChecked) {
			void uncompleteRecurringInstance(view, hit).then(refresh);
		} else {
			// State already matches the data — keep the checkbox in sync.
			check.checked = wasChecked;
		}
	});
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
