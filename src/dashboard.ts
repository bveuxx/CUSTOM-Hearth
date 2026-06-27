import { Component, setIcon } from "obsidian";
import type { HomeView } from "./view";
import { renderCardBody } from "./cards";
import {
	applyCardPosition,
	enableDragResize,
	ensureLayout,
	GRID_GAP,
	ROW_HEIGHT,
} from "./grid";

/** Renders the dashboard toolbar and the positioned grid of cards. In arrange
 * mode cards can be moved and resized on a snap-to-grid layout. */
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
			text: "No cards yet — add some in settings",
		});
		return;
	}

	const commit = () => void view.plugin.saveData(s);

	for (const card of s.cards) {
		const el = grid.createDiv("hearth-card");
		applyCardPosition(el, card, s.gridColumns);

		if (card.accent) {
			el.style.setProperty("--card-accent", card.accent);
			el.addClass("has-accent");
		}
		if (card.background) el.style.setProperty("--card-bg", card.background);

		const head = el.createDiv("hearth-card-head");
		head.createDiv({ cls: "hearth-card-title", text: card.title ?? "" });

		const body = el.createDiv("hearth-card-body");
		if (card.background) body.addClass("has-bg");
		renderCardBody(view, card, body, component);

		if (view.arrangeMode) {
			enableDragResize(view, el, grid, card, s.gridColumns, component, commit);
		}
	}
}

function renderToolbar(view: HomeView, container: HTMLElement): void {
	const bar = container.createDiv("hearth-toolbar");

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
