import { Component, Menu, setIcon } from "obsidian";
import type { HomeView } from "./view";
import { renderCardBody } from "./cards";
import { CARD_TEMPLATES, cardFromTemplate } from "./templates";
import { CardSettingsModal } from "./editors";
import {
	activeCards,
	DashboardCard,
	effectiveColumns,
	effectiveRowHeight,
	removeCard,
	renderCards,
	setCardPinned,
} from "./types";
import {
	applyCardPosition,
	enableDragResize,
	ensureLayout,
	GridLayout,
	GRID_GAP,
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
	const cards = renderCards(s);
	const columns = effectiveColumns(s);

	// Persist any coordinates we had to backfill for older cards.
	if (ensureLayout(cards, columns)) void view.plugin.saveData(s);

	renderToolbar(view, container);

	const grid = container.createDiv("hearth-grid");
	grid.toggleClass("is-arranging", view.arrangeMode);
	grid.style.setProperty("--hearth-cols", String(columns));
	grid.style.setProperty("--hearth-row-h", `${effectiveRowHeight(s)}px`);
	grid.style.setProperty("--hearth-gap", `${GRID_GAP}px`);

	if (cards.length === 0) {
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
		cards,
		elements: new Map(),
		columns,
	};

	for (const card of cards) {
		const el = grid.createDiv("hearth-card");
		gridLayout.elements.set(card, el);
		applyCardPosition(el, card, columns);

		if (card.pinned) el.addClass("is-pinned");
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
		mountCardBody(view, card, body, component);

		if (view.arrangeMode) {
			enableDragResize(view, el, grid, card, gridLayout, component, commit);
		}
	}
}

/** Render a card's body, wiring up an auto-refresh interval when the card asks
 * for one. Each refresh re-renders the body under a fresh child component so
 * markdown/iframe embeds are torn down and rebuilt cleanly (picking up file
 * edits or reloading the page) without leaking the previous render. */
function mountCardBody(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	parent: Component,
): void {
	const every = card.refreshSec && card.refreshSec > 0 ? card.refreshSec : 0;
	if (!every) {
		renderCardBody(view, card, body, parent);
		return;
	}

	let child: Component | null = null;
	const draw = () => {
		if (child) parent.removeChild(child);
		child = new Component();
		parent.addChild(child);
		body.empty();
		renderCardBody(view, card, body, child);
	};
	draw();
	// registerInterval ties the timer to the view's render lifecycle, so it is
	// cleared on the next full rebuild (and on view close).
	parent.registerInterval(window.setInterval(draw, every * 1000));
}

/** Save the current settings and rebuild the view (used after structural
 * changes like adding, removing or re-targeting a card). */
function persistAndRender(view: HomeView): void {
	void view.plugin.saveData(view.plugin.settings);
	view.render();
}

/** The editable card header shown in arrange mode: an inline title field plus
 * actions to open the card's settings and to remove the card. */
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

	const settingsBtn = actions.createEl("button", {
		cls: "hearth-card-action",
		attr: { "aria-label": "Card settings" },
	});
	setIcon(settingsBtn, "settings-2");
	settingsBtn.addEventListener("pointerdown", (e) => e.stopPropagation());
	settingsBtn.addEventListener("click", () => openCardSettings(view, card));

	const remove = actions.createEl("button", {
		cls: "hearth-card-action is-danger",
		attr: { "aria-label": "Remove card" },
	});
	setIcon(remove, "trash-2");
	remove.addEventListener("pointerdown", (e) => e.stopPropagation());
	remove.addEventListener("click", () => {
		removeCard(view.plugin.settings, card);
		persistAndRender(view);
	});
}

/** Open the full settings editor for a single card, driven entirely from the
 * board so nothing has to be configured in the plugin settings tab. */
function openCardSettings(view: HomeView, card: DashboardCard): void {
	const s = view.plugin.settings;
	new CardSettingsModal(view.app, card, {
		gridColumns: effectiveColumns(s),
		favorites: s.favorites,
		isPinned: s.pinnedCards.includes(card),
		setPinned: (pinned) => setCardPinned(s, card, pinned),
		save: () => void view.plugin.saveData(s),
		rerender: () => view.render(),
		remove: () => {
			removeCard(s, card);
			persistAndRender(view);
		},
	}).open();
}

function renderToolbar(view: HomeView, container: HTMLElement): void {
	const bar = container.createDiv("hearth-toolbar");
	// At rest the bar holds only the compact Arrange toggle; flag it so CSS can
	// float it into the gap above the grid instead of reserving a whole row.
	bar.toggleClass("is-arranging", view.arrangeMode);

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
							activeCards(view.plugin.settings).push(cardFromTemplate(template));
							persistAndRender(view);
						}),
				);
			}
			menu.showAtMouseEvent(evt as MouseEvent);
		});
	}

	const arrange = bar.createEl("button", { cls: "hearth-tool-btn" });
	arrange.toggleClass("is-active", view.arrangeMode);
	// Outside arrange mode keep it as a small, unobtrusive icon button; while
	// arranging, show the labelled "Done arranging" action.
	arrange.toggleClass("is-icon", !view.arrangeMode);
	setIcon(arrange.createSpan("hearth-tool-icon"), view.arrangeMode ? "check" : "move");
	if (view.arrangeMode) {
		arrange.createSpan({ cls: "hearth-tool-label", text: "Done arranging" });
	}
	arrange.setAttribute(
		"aria-label",
		view.arrangeMode ? "Finish arranging cards" : "Move & resize cards",
	);
	arrange.addEventListener("click", () => {
		view.arrangeMode = !view.arrangeMode;
		view.render();
	});
}
