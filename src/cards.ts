import {
	Component,
	debounce,
	MarkdownRenderer,
	moment,
	Notice,
	setIcon,
	TFile,
} from "obsidian";
import type { HomeView } from "./view";
import type { BookmarkItem } from "./obsidian-ext";
import { CommandItem, DashboardCard, LinkItem } from "./types";
import { iconForFile, isExcalidraw } from "./filetypes";

/** Community plugin id for Excalidraw (used to detect drawing support). */
const EXCALIDRAW_PLUGIN_ID = "obsidian-excalidraw-plugin";

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
		renderEditableEmbed(view, file, body);
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
		MarkdownRenderer.render(view.app, `![[${target}]]`, host, target, component);
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

/** Edit an embedded Markdown note in place: load its text into a textarea and
 * write changes back to the vault (debounced). */
function renderEditableEmbed(view: HomeView, file: TFile, body: HTMLElement): void {
	const area = body.createEl("textarea", {
		cls: "hearth-text hearth-embed-edit",
		attr: { placeholder: "Empty note…" },
	});
	// Disable until the file content has loaded so we never save a blank buffer
	// over the note before its text arrives.
	area.disabled = true;
	void view.app.vault.read(file).then((content) => {
		area.value = content;
		area.disabled = false;
	});

	const save = debounce(
		() => {
			// Re-resolve the file in case it was renamed/replaced while open.
			const current = view.app.vault.getAbstractFileByPath(file.path);
			if (current instanceof TFile) void view.app.vault.modify(current, area.value);
		},
		500,
		true,
	);
	area.addEventListener("input", save);
}

// ---- Daily note (today) -------------------------------------------------

interface DailyNotesOptions {
	/** moment.js date format, e.g. "YYYY-MM-DD". */
	format?: string;
	/** Folder daily notes live in. */
	folder?: string;
}

/** Resolve today's daily-note path from the core Daily notes plugin settings. */
function todaysDailyNotePath(options: DailyNotesOptions): string {
	const format = (options.format || "").trim() || "YYYY-MM-DD";
	const folder = (options.folder || "").trim().replace(/^\/+|\/+$/g, "");
	const stamp = moment().format(format);
	return `${folder ? `${folder}/` : ""}${stamp}.md`;
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
	const plugin = view.app.internalPlugins.getPluginById("daily-notes");
	if (!plugin?.enabled) {
		emptyState(body, "calendar", "Enable the core Daily notes plugin");
		return;
	}

	const options = (plugin.instance as { options?: DailyNotesOptions } | undefined)?.options ?? {};
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

	if (card.editable) {
		renderEditableEmbed(view, file, body);
		return;
	}

	const host = body.createDiv("hearth-embed markdown-rendered");
	void renderMarkdownFile(view, file, host, component);
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
		if (file instanceof TFile) view.app.workspace.getLeaf(true).openFile(file);
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
			card.addEventListener("click", () =>
				view.app.workspace.getLeaf(true).openFile(file),
			);
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
		row.addEventListener("click", () =>
			view.app.workspace.getLeaf(true).openFile(file),
		);
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
			if (file instanceof TFile) view.app.workspace.getLeaf(true).openFile(file);
			else if (link.target) view.app.workspace.openLinkText(link.target, "", true);
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

// ---- Clock / greeting ---------------------------------------------------

function renderClock(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	component: Component,
): void {
	const cfg = card.clock ?? {};
	const showGreeting = cfg.showGreeting !== false;
	const dateMode = cfg.dateMode ?? "full";

	const wrap = body.createDiv("hearth-clock");
	const greetingEl = showGreeting ? wrap.createDiv("hearth-clock-greeting") : null;
	const timeEl = wrap.createDiv("hearth-clock-time");
	const dateEl = dateMode === "none" ? null : wrap.createDiv("hearth-clock-date");

	const timeOpts: Intl.DateTimeFormatOptions = {
		hour: "2-digit",
		minute: "2-digit",
	};
	if (cfg.use24Hour) timeOpts.hour12 = false;
	if (cfg.showSeconds) timeOpts.second = "2-digit";

	const update = () => {
		const now = new Date();
		if (greetingEl) {
			const hour = now.getHours();
			const greeting =
				cfg.greetingText?.trim() ||
				(hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening");
			greetingEl.setText(greeting);
		}
		timeEl.setText(now.toLocaleTimeString(undefined, timeOpts));
		if (dateEl) {
			dateEl.setText(
				dateMode === "short"
					? now.toLocaleDateString(undefined, { dateStyle: "short" })
					: now.toLocaleDateString(undefined, {
							weekday: "long",
							day: "numeric",
							month: "long",
						}),
			);
		}
	};

	update();
	component.registerInterval(window.setInterval(update, 1000));
}
