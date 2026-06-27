import {
	Component,
	debounce,
	MarkdownRenderer,
	setIcon,
	TFile,
} from "obsidian";
import type { HomeView } from "./view";
import type { BookmarkItem } from "./obsidian-ext";
import { DashboardCard, LinkItem } from "./types";
import { iconForFile } from "./filetypes";

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
		case "bookmarks":
			renderBookmarks(view, body);
			break;
		case "favorites":
			renderFavorites(view, body);
			break;
		case "text":
			renderText(view, card, body);
			break;
		case "recent":
			renderRecent(view, card, body);
			break;
		case "links":
			renderLinks(view, card, body);
			break;
		case "clock":
			renderClock(view, body, component);
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

	const host = body.createDiv("hearth-embed markdown-rendered");
	// Rendering the embed markdown lets Obsidian (and plugins like Bases) handle
	// notes, images, canvas and .base files uniformly.
	MarkdownRenderer.render(view.app, `![[${target}]]`, host, target, component);
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
		const icon =
			item.type === "url" ? "globe" :
			item.type === "folder" ? "folder" :
			item.type === "search" ? "search" : "file-text";
		setIcon(row.createDiv("hearth-list-icon"), icon);
		row.createDiv({ cls: "hearth-list-label", text: label });
		row.addEventListener("click", () => openBookmark(view, item));
	}
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

function renderText(view: HomeView, card: DashboardCard, body: HTMLElement): void {
	const area = body.createEl("textarea", {
		cls: "hearth-text",
		attr: { placeholder: "Jot something down…" },
	});
	area.value = card.text ?? "";

	const save = debounce(
		() => {
			card.text = area.value;
			void view.plugin.saveData(view.plugin.settings);
		},
		500,
		true,
	);
	area.addEventListener("input", save);
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

// ---- Clock / greeting ---------------------------------------------------

function renderClock(view: HomeView, body: HTMLElement, component: Component): void {
	const wrap = body.createDiv("hearth-clock");
	const greetingEl = wrap.createDiv("hearth-clock-greeting");
	const timeEl = wrap.createDiv("hearth-clock-time");
	const dateEl = wrap.createDiv("hearth-clock-date");

	const update = () => {
		const now = new Date();
		const hour = now.getHours();
		const greeting =
			hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
		greetingEl.setText(greeting);
		timeEl.setText(
			now.toLocaleTimeString(undefined, {
				hour: "2-digit",
				minute: "2-digit",
			}),
		);
		dateEl.setText(
			now.toLocaleDateString(undefined, {
				weekday: "long",
				day: "numeric",
				month: "long",
			}),
		);
	};

	update();
	component.registerInterval(window.setInterval(update, 1000));
}
