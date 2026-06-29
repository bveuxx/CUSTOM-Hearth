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
import { ClockConfig, CommandItem, DashboardCard, LinkItem } from "./types";
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
		const plugin = view.app.internalPlugins.getPluginById("daily-notes");
		if (!plugin?.enabled) return null;
		const options =
			(plugin.instance as { options?: DailyNotesOptions } | undefined)?.options ?? {};
		return todaysDailyNotePath(options);
	}
	return null;
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
