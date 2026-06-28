import { Component, Menu, setIcon } from "obsidian";
import type { HomeView } from "./view";
import { renderCardBody } from "./cards";
import { CARD_TEMPLATES, cardFromTemplate } from "./templates";
import { FilePickerModal } from "./pickers";
import { WebUrlModal, LinksEditorModal, FavoritesEditorModal } from "./editors";
import { DashboardCard } from "./types";
import {
	applyCardPosition,
	enableDragResize,
	ensureLayout,
	GridLayout,
	GRID_GAP,
	ROW_HEIGHT,
} from "./grid";

/** Renders the dashboard toolbar and the positioned grid of cards. In arrange
 * mode cards can be moved, resized, added, removed and re-targeted on the
 * snap-to-grid layout. */
export function renderDashboard(
	view: HomeView,
	container: HTMLElement,
	component: Component,
): void {
	const s = view.plugin.settings;

	// Persist any coordinates we had to backfill for older cards.
	if (ensureLayout(s.cards, s.gridColumns)) void view.plugin.saveData(s);

	renderToolbar(view, container);

	const grid = container.createDiv("hearth-grid");
	grid.toggleClass("is-arranging", view.arrangeMode);
	grid.style.setProperty("--hearth-cols", String(s.gridColumns));
	grid.style.setProperty("--hearth-row-h", `${ROW_HEIGHT}px`);
	grid.style.setProperty("--hearth-gap", `${GRID_GAP}px`);

	if (s.cards.length === 0) {
		const empty = grid.createDiv("hearth-grid-empty");
		setIcon(empty.createDiv("hearth-card-empty-icon"), "layout-grid");
		empty.createDiv({
			cls: "hearth-card-empty-text",
			text: view.arrangeMode
				? "No cards yet — use “Add card” above"
				: "No cards yet — hit Arrange, then Add card",
		});
		return;
	}

	const commit = () => void view.plugin.saveData(s);

	// Shared layout state lets the drag engine push neighbouring cards aside.
	const gridLayout: GridLayout = {
		cards: s.cards,
		elements: new Map(),
		columns: s.gridColumns,
	};

	for (const card of s.cards) {
		const el = grid.createDiv("hearth-card");
		gridLayout.elements.set(card, el);
		applyCardPosition(el, card, s.gridColumns);

		if (card.accent) {
			el.style.setProperty("--card-accent", card.accent);
			el.addClass("has-accent");
		}
		if (card.background) el.style.setProperty("--card-bg", card.background);

		const head = el.createDiv("hearth-card-head");
		if (view.arrangeMode) {
			renderCardControls(view, card, head, commit);
		} else {
			head.createDiv({ cls: "hearth-card-title", text: card.title ?? "" });
		}

		const body = el.createDiv("hearth-card-body");
		if (card.background) body.addClass("has-bg");
		renderCardBody(view, card, body, component);

		if (view.arrangeMode) {
			enableDragResize(view, el, grid, card, gridLayout, component, commit);
		}
	}
}

/** Save the current settings and rebuild the view (used after structural
 * changes like adding, removing or re-targeting a card). */
function persistAndRender(view: HomeView): void {
	void view.plugin.saveData(view.plugin.settings);
	view.render();
}

/** The editable card header shown in arrange mode: an inline title field plus
 * actions to swap the embedded file and remove the card. */
function renderCardControls(
	view: HomeView,
	card: DashboardCard,
	head: HTMLElement,
	commit: () => void,
): void {
	head.addClass("is-editing");

	const title = head.createEl("input", {
		cls: "hearth-card-title-input",
		attr: { type: "text", placeholder: "Title", spellcheck: "false" },
	});
	title.value = card.title ?? "";
	// Don't let typing/clicking in the field start a card drag.
	title.addEventListener("pointerdown", (e) => e.stopPropagation());
	title.addEventListener("input", () => {
		card.title = title.value;
	});
	title.addEventListener("change", commit);
	title.addEventListener("blur", commit);

	const actions = head.createDiv("hearth-card-actions");

	if (card.kind === "embed") {
		const swap = actions.createEl("button", {
			cls: "hearth-card-action",
			attr: { "aria-label": "Choose file to embed" },
		});
		setIcon(swap, "file-symlink");
		swap.addEventListener("pointerdown", (e) => e.stopPropagation());
		swap.addEventListener("click", () => {
			new FilePickerModal(view.app, (file) => {
				card.target = file.path;
				persistAndRender(view);
			}).open();
		});
	}

	const configure = configureAction(view, card);
	if (configure) {
		const btn = actions.createEl("button", {
			cls: "hearth-card-action",
			attr: { "aria-label": configure.label },
		});
		setIcon(btn, "settings-2");
		btn.addEventListener("pointerdown", (e) => e.stopPropagation());
		btn.addEventListener("click", configure.open);
	}

	const remove = actions.createEl("button", {
		cls: "hearth-card-action is-danger",
		attr: { "aria-label": "Remove card" },
	});
	setIcon(remove, "trash-2");
	remove.addEventListener("pointerdown", (e) => e.stopPropagation());
	remove.addEventListener("click", () => {
		const cards = view.plugin.settings.cards;
		const i = cards.indexOf(card);
		if (i >= 0) cards.splice(i, 1);
		persistAndRender(view);
	});
}

/** For cards whose content can be edited on the board (web URL, links,
 * favorites), return a labelled action that opens the right editor. Returns
 * null for kinds that have no board-side editor. */
function configureAction(
	view: HomeView,
	card: DashboardCard,
): { label: string; open: () => void } | null {
	const save = () => void view.plugin.saveData(view.plugin.settings);
	const rerender = () => view.render();

	switch (card.kind) {
		case "web":
			return {
				label: "Set web URL",
				open: () =>
					new WebUrlModal(view.app, card.url ?? "", (url) => {
						card.url = url;
						persistAndRender(view);
					}).open(),
			};
		case "links":
			return {
				label: "Edit links",
				open: () => new LinksEditorModal(view.app, card, save, rerender).open(),
			};
		case "favorites":
			return {
				label: "Edit favorites",
				open: () =>
					new FavoritesEditorModal(
						view.app,
						view.plugin.settings.favorites,
						save,
						rerender,
					).open(),
			};
		default:
			return null;
	}
}

function renderToolbar(view: HomeView, container: HTMLElement): void {
	const bar = container.createDiv("hearth-toolbar");

	if (view.arrangeMode) {
		const add = bar.createEl("button", { cls: "hearth-tool-btn" });
		setIcon(add.createSpan("hearth-tool-icon"), "plus");
		add.createSpan({ cls: "hearth-tool-label", text: "Add card" });
		add.setAttribute("aria-label", "Add a card to the dashboard");
		add.addEventListener("click", (evt) => {
			const menu = new Menu();
			for (const template of CARD_TEMPLATES) {
				menu.addItem((item) =>
					item
						.setTitle(template.name)
						.setIcon(template.icon)
						.onClick(() => {
							view.plugin.settings.cards.push(cardFromTemplate(template));
							persistAndRender(view);
						}),
				);
			}
			menu.showAtMouseEvent(evt as MouseEvent);
		});
	}

	const arrange = bar.createEl("button", { cls: "hearth-tool-btn" });
	arrange.toggleClass("is-active", view.arrangeMode);
	setIcon(arrange.createSpan("hearth-tool-icon"), view.arrangeMode ? "check" : "move");
	arrange.createSpan({
		cls: "hearth-tool-label",
		text: view.arrangeMode ? "Done arranging" : "Arrange",
	});
	arrange.setAttribute(
		"aria-label",
		view.arrangeMode ? "Finish arranging cards" : "Move & resize cards",
	);
	arrange.addEventListener("click", () => {
		view.arrangeMode = !view.arrangeMode;
		view.render();
	});
}
