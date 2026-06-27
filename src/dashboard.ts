import { Component, setIcon } from "obsidian";
import type { HomeView } from "./view";
import { renderCardBody } from "./cards";

/** Renders the grid of dashboard cards. Drag & resize arrive in a later
 * iteration; for now cards flow into a responsive CSS grid using their
 * stored width/height (in column units). */
export function renderDashboard(
	view: HomeView,
	container: HTMLElement,
	component: Component,
): void {
	const s = view.plugin.settings;
	const cards = s.cards;

	const grid = container.createDiv("hearth-grid");
	grid.style.setProperty("--hearth-cols", String(s.gridColumns));

	if (cards.length === 0) {
		const empty = grid.createDiv("hearth-grid-empty");
		setIcon(empty.createDiv("hearth-card-empty-icon"), "layout-grid");
		empty.createDiv({
			cls: "hearth-card-empty-text",
			text: "No cards yet — add some in settings",
		});
		return;
	}

	for (const card of cards) {
		const el = grid.createDiv("hearth-card");
		el.style.setProperty("--card-w", String(card.w));
		el.style.setProperty("--card-h", String(card.h));

		const head = el.createDiv("hearth-card-head");
		head.createDiv({ cls: "hearth-card-title", text: card.title ?? "" });

		const body = el.createDiv("hearth-card-body");
		renderCardBody(view, card, body, component);
	}
}
