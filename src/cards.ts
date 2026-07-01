import {
	Component,
	debounce,
	getAllTags,
	MarkdownRenderer,
	MarkdownView,
	moment,
	Notice,
	setIcon,
	TFile,
	TFolder,
} from "obsidian";
import type { Moment } from "moment";
import type { HomeView } from "./view";
import type { BookmarkItem } from "./obsidian-ext";
import { ClockConfig, CommandItem, DashboardCard, LinkItem, TasksConfig } from "./types";
import { EXCALIDRAW_PLUGIN_ID, iconForFile, isExcalidraw } from "./filetypes";

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
			renderWeb(card, body);
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
			renderCalendar(view, body);
			break;
		case "stats":
			renderStats(view, body);
			break;
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
function renderCalendar(view: HomeView, body: HTMLElement): void {
	const options = dailyNotesOptions(view);
	if (!options) {
		emptyState(body, "calendar-days", "Enable the core Daily notes plugin");
		return;
	}

	const wrap = body.createDiv("hearth-calendar");
	let cursor = moment().startOf("month");

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
		renderCalendarGrid(view, wrap, cursor, options);
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
): void {
	const grid = wrap.createDiv("hearth-calendar-grid");
	const startOfWeek = moment.localeData().firstDayOfWeek();

	for (let i = 0; i < 7; i++) {
		const dow = (startOfWeek + i) % 7;
		grid.createDiv({ cls: "hearth-calendar-dow", text: moment().day(dow).format("dd") });
	}

	const monthStart = cursor.clone().startOf("month");
	const monthEnd = cursor.clone().endOf("month");
	const gridStart = monthStart.clone().subtract((monthStart.day() - startOfWeek + 7) % 7, "days");
	const totalCells = Math.ceil((monthEnd.diff(gridStart, "days") + 1) / 7) * 7;

	const today = moment().format("YYYY-MM-DD");
	for (let i = 0; i < totalCells; i++) {
		const day = gridStart.clone().add(i, "days");
		const path = dailyNotePath(day, options);
		const file = view.app.vault.getAbstractFileByPath(path);
		const isToday = day.format("YYYY-MM-DD") === today;

		const cell = grid.createDiv("hearth-calendar-day");
		cell.toggleClass("is-outside", day.month() !== cursor.month());
		cell.toggleClass("is-today", isToday);
		cell.toggleClass("has-note", file instanceof TFile);
		cell.createDiv({ cls: "hearth-calendar-daynum", text: String(day.date()) });
		if (file instanceof TFile) cell.createDiv("hearth-calendar-dot");

		cell.addEventListener("click", () => {
			if (file instanceof TFile) {
				void view.app.workspace.getLeaf(true).openFile(file);
			} else if (isToday) {
				if (!view.app.commands.executeCommandById("daily-notes")) {
					new Notice("Hearth: couldn't open today's daily note.");
				}
			} else {
				new Notice(`Hearth: no daily note for ${day.format("MMM D, YYYY")} yet.`);
			}
		});
	}
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

	let day = moment();
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

// ---- Web / iframe embed -------------------------------------------------

function renderWeb(card: DashboardCard, body: HTMLElement): void {
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
	// letting normal sites run their scripts.
	frame.setAttribute(
		"sandbox",
		"allow-scripts allow-same-origin allow-popups allow-forms",
	);
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
		row.addEventListener("click", () => openBookmark(view, item));
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
			card.addEventListener("click", () => {
				void view.app.workspace.getLeaf(true).openFile(file);
			});
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
		row.addEventListener("click", () => {
			void view.app.workspace.getLeaf(true).openFile(file);
		});
	}
}

// ---- Links / launchpad --------------------------------------------------

function renderLinks(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const links = card.links ?? [];
	if (links.length === 0) {
		emptyState(body, "layout-grid", "Add links in settings");
		return;
	}

	const grid = body.createDiv("hearth-links");
	for (const link of links) {
		const tile = grid.createDiv("hearth-link-tile");
		setIcon(tile.createDiv("hearth-link-icon"), link.icon || "link");
		tile.createDiv({ cls: "hearth-link-label", text: link.label || link.target });
		tile.addEventListener("click", () => openLink(view, link));
	}
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

	const grid = body.createDiv("hearth-links hearth-commands-grid");
	if (card.tileSize && card.tileSize > 0) {
		grid.style.setProperty("--hearth-tile", `${card.tileSize}px`);
	}
	for (const cmd of commands) {
		const tile = grid.createDiv("hearth-link-tile");
		setIcon(tile.createDiv("hearth-link-icon"), cmd.icon || "terminal-square");
		tile.createDiv({ cls: "hearth-link-label", text: cmd.name || cmd.id });
		tile.addEventListener("click", () => runCommand(view, cmd));
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
	const listEl = body.createDiv("hearth-list hearth-tasks");
	const refresh = () => void loadAndRenderTasks(view, cfg, listEl, refresh);
	refresh();
}

async function loadAndRenderTasks(
	view: HomeView,
	cfg: TasksConfig,
	listEl: HTMLElement,
	refresh: () => void,
): Promise<void> {
	listEl.empty();
	const source = cfg.source ?? "checkbox";

	let hits: TaskHit[];
	if (source === "tasknotes") {
		if (!view.app.plugins.enabledPlugins.has(TASKNOTES_PLUGIN_ID)) {
			emptyState(listEl, "list-todo", "Enable the TaskNotes plugin, or switch source to checkboxes");
			return;
		}
		hits = collectTaskNotesTasks(view, cfg);
	} else {
		hits = await collectCheckboxTasks(view, cfg);
	}

	if (!cfg.showCompleted) hits = hits.filter((h) => !h.done);

	hits.sort((a, b) => {
		if (a.due && b.due) return a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
		if (a.due) return -1;
		if (b.due) return 1;
		return a.file.path.localeCompare(b.file.path);
	});

	const limit = cfg.count && cfg.count > 0 ? cfg.count : 10;
	hits = hits.slice(0, limit);

	if (hits.length === 0) {
		emptyState(listEl, "list-todo", "No open tasks");
		return;
	}

	const today = moment().format("YYYY-MM-DD");
	for (const hit of hits) {
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
				void toggleCheckboxTask(view, hit).then(refresh);
			});
		} else if (hit.status) {
			row.createDiv({ cls: "hearth-task-status", text: hit.status });
		}

		row.createDiv({ cls: "hearth-list-label hearth-task-text", text: hit.text || hit.file.basename });
		if (hit.due) {
			const due = row.createDiv({ cls: "hearth-task-due", text: hit.due });
			due.toggleClass("is-overdue", !hit.done && hit.due < today);
		}

		row.addEventListener("click", () => void openTask(view, hit));
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
	const doneValue = (s.taskNotesDoneValue.trim() || "done").toLowerCase();

	const files = view.app.vault.getMarkdownFiles().filter((f) => inTaskScope(f.path, cfg));
	const hits: TaskHit[] = [];
	for (const file of files) {
		const fm = view.app.metadataCache.getFileCache(file)?.frontmatter;
		if (!fm || !(statusField in fm)) continue;
		const status = String(fm[statusField] ?? "");
		const due = typeof fm[dueField] === "string" ? fm[dueField] : null;
		hits.push({
			file,
			line: -1,
			text: String(fm.title ?? file.basename),
			done: status.toLowerCase() === doneValue,
			due,
			status,
		});
	}
	return hits;
}

/** Flip a checkbox task's `[ ]`/`[x]` in place. Only used for checkbox tasks —
 * TaskNotes status is left to TaskNotes' own UI since it may be a multi-step
 * workflow, not a plain open/done toggle. */
async function toggleCheckboxTask(view: HomeView, hit: TaskHit): Promise<void> {
	const content = await view.app.vault.read(hit.file);
	const lines = content.split("\n");
	const line = lines[hit.line];
	if (line == null) return;
	lines[hit.line] = hit.done
		? line.replace(/\[[xX]\]/, "[ ]")
		: line.replace(/\[ \]/, "[x]");
	await view.app.vault.modify(hit.file, lines.join("\n"));
}

async function openTask(view: HomeView, hit: TaskHit): Promise<void> {
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
		case "iso":
			return moment(now).format("YYYY-MM-DD");
		case "weekday":
			return now.toLocaleDateString(undefined, { weekday: "long" });
		case "custom":
			return custom?.trim() ? moment(now).format(custom) : "";
		case "full":
		default:
			return now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
	}
}

function svgEl(parent: Element, tag: string, attrs: Record<string, string>, cls?: string): SVGElement {
	const el = parent.ownerDocument.createElementNS("http://www.w3.org/2000/svg", tag) as SVGElement;
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
