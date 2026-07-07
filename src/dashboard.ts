import { Component, debounce, Menu, setIcon, TAbstractFile } from "obsidian";
import { confirmAction } from "./ui";
import type { HomeView } from "./view";
import { renderCardBody, watchedCardPath } from "./cards";
import { CARD_TEMPLATES, cardFromTemplate } from "./templates";
import { CardSettingsModal } from "./editors";
import {
	activeCards,
	cloneCard,
	DashboardCard,
	effectiveCardOpacity,
	effectiveColumns,
	effectiveFitToPage,
	effectiveMaxWidth,
	effectiveRowHeight,
	removeCard,
	renderCards,
	setCardPinned,
} from "./types";
import {
	applyCardPosition,
	applyEdgeMerging,
	clampCardToBoard,
	enableDragResize,
	ensureFreeform,
	ensureLayout,
	GridLayout,
	GRID_GAP,
	layoutHeight,
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
	const cards = renderCards(s);
	const columns = effectiveColumns(s);
	const rowHeight = effectiveRowHeight(s);

	// Seed placement for new/older cards on the reference grid, then convert to
	// the continuous free-form coordinates the board actually renders with.
	const seeded = ensureLayout(cards, columns);
	const freed = ensureFreeform(
		cards,
		columns,
		rowHeight || ROW_HEIGHT,
		GRID_GAP,
		effectiveMaxWidth(s),
	);
	if (seeded || freed) void view.plugin.saveData(s);

	renderToolbar(view, container);

	const grid = container.createDiv("hearth-grid");
	grid.toggleClass("is-arranging", view.arrangeMode);
	// Board-level default; per-card overrides are set in the render loop below.
	grid.style.setProperty("--card-opacity", String(effectiveCardOpacity(s)));
	const fit = effectiveFitToPage(s);
	// In fit-to-page mode the board is locked to one screen, so leave the
	// min-height to CSS (which clips the overflow). Otherwise grow the board
	// to fit its cards.
	if (!fit) grid.style.minHeight = `${layoutHeight(cards) + GRID_GAP}px`;

	// An empty board is left blank — no placeholder text or icon. The Arrange
	// toolbar (with "Add card") is still available above.
	if (cards.length === 0) return;

	const commit = () => void view.plugin.saveData(s);

	// Shared layout state for the drag engine (magnetic alignment to siblings).
	const gridLayout: GridLayout = {
		cards,
		elements: new Map(),
	};

	for (const card of cards) {
		const el = grid.createDiv("hearth-card");
		gridLayout.elements.set(card, el);
		applyCardPosition(el, card);

		if (card.pinned) el.addClass("is-pinned");
		if (card.kind === "links" || card.kind === "commands") {
			el.addClass("is-tile-card");
		}
		if (card.accent) {
			el.style.setProperty("--card-accent", card.accent);
			el.addClass("has-accent");
		}
		if (card.background) el.style.setProperty("--card-bg", card.background);
		if (card.cardOpacity != null) {
			el.style.setProperty("--card-opacity", String(card.cardOpacity));
		}

		const head = el.createDiv("hearth-card-head");
		if (view.arrangeMode) {
			renderCardControls(view, card, head, commit);
		} else {
			head.toggleClass("is-untitled", !(card.title ?? "").trim());
			head.createDiv({ cls: "hearth-card-title", text: card.title ?? "" });
		}

		const body = el.createDiv("hearth-card-body");
		if (card.background) body.addClass("has-bg");
		mountCardBody(view, card, body, component);

		if (view.arrangeMode) {
			enableDragResize(view, el, grid, card, gridLayout, component, commit);
		}
	}

	// Sharpen touching corners between neighbouring cards so adjacent cards
	// read as one merged tile. Recomputed after every drag/resize commit and
	// on viewport resize (handled below) since card positions reflow.
	applyEdgeMerging(grid);

	// Recompute edge merging whenever the board reflows (pane resize, zoom,
	// dashboard switch) — fractional widths shift which edges touch.
	const remerge = () => applyEdgeMerging(grid);
	component.registerDomEvent(window, "resize", debounce(remerge, 120, true));

	// In fit-to-page mode, recover any card that's stuck outside the visible
	// board (e.g. from a layout import, a pane resize, or a glitched drag) by
	// clamping it back in and persisting.
	//
	// This must run against the board's FINAL laid-out height. Doing it
	// synchronously during render (as before) measured the pane before the
	// workspace had finished restoring — right after a PC start, plugin update
	// or full sync — so cards were clamped to a too-small height and their
	// upward-shifted positions were saved, nudging the whole board up. Instead,
	// observe the grid's real size and only clamp once it has settled: a
	// ResizeObserver fires with the final size after layout (and again on
	// genuine resizes), and the debounce coalesces the startup size thrash so
	// we never act on a transient measurement. A zero height means "not laid
	// out yet" — skip it so stored positions are never corrupted.
	if (fit) {
		const recoverFit = debounce(() => {
			if (!grid.isConnected) return;
			const boardH = grid.clientHeight;
			if (boardH <= 0) return;
			let recovered = false;
			for (const card of cards) {
				if (clampCardToBoard(card, boardH)) {
					recovered = true;
					const el = gridLayout.elements.get(card);
					if (el) applyCardPosition(el, card);
				}
			}
			if (recovered) {
				applyEdgeMerging(grid);
				void view.plugin.saveData(s);
			}
		}, 250, false);
		const observer = new ResizeObserver(() => recoverFit());
		observer.observe(grid);
		component.register(() => observer.disconnect());
	}
}

/** Render a card's body. Each (re)draw renders under a fresh child component so
 * markdown/iframe embeds are torn down and rebuilt cleanly without leaking the
 * previous render.
 *
 * Liveness is per kind:
 * - web cards keep the optional polling refresh (refreshSec);
 * - embed/daily cards redraw from vault events. A create/delete/rename of the
 *   tracked file always redraws (it flips between the content and the
 *   "missing file" state); for content edits (modify) read-only cards redraw
 *   while editable cards sync their textarea in place so the cursor is kept. */
function mountCardBody(
	view: HomeView,
	card: DashboardCard,
	body: HTMLElement,
	parent: Component,
): void {
	let child: Component | null = null;
	const draw = () => {
		if (child) parent.removeChild(child);
		child = new Component();
		parent.addChild(child);
		body.empty();
		renderCardBody(view, card, body, child);
	};
	draw();

	if (card.kind === "web") {
		const every = card.refreshSec && card.refreshSec > 0 ? card.refreshSec : 0;
		// registerInterval ties the timer to the view's render lifecycle, so it
		// is cleared on the next full rebuild (and on view close).
		if (every) parent.registerInterval(window.setInterval(draw, every * 1000));
		return;
	}

	if (card.kind === "embed" || card.kind === "daily") {
		// Editable cards sync content edits in their textarea, so don't redraw on
		// modify (it would drop the cursor) — but still redraw on existence changes.
		watchCardFile(view, card, parent, draw, !card.editable);
		return;
	}

	// Data-driven cards derive their content from the vault as a whole (tasks,
	// counts, daily-note existence, query matches, edit timestamps), so redraw
	// them — debounced — whenever the vault or its metadata changes.
	if (LIVE_KINDS.has(card.kind)) {
		const redraw = debounce(draw, 400, true);
		const { vault, metadataCache } = view.app;
		parent.registerEvent(vault.on("create", () => redraw()));
		parent.registerEvent(vault.on("delete", () => redraw()));
		parent.registerEvent(vault.on("rename", () => redraw()));
		parent.registerEvent(vault.on("modify", () => redraw()));
		parent.registerEvent(metadataCache.on("changed", () => redraw()));
	}
}

/** Card kinds whose content is derived from the whole vault and should refresh
 * live on vault/metadata changes. */
const LIVE_KINDS = new Set<DashboardCard["kind"]>(["tasks", "stats", "calendar", "search", "heatmap"]);

/** Redraw an embed/daily card's body when the file it tracks changes on disk.
 * create/delete/rename always redraw; modify only when `redrawOnModify`. */
function watchCardFile(
	view: HomeView,
	card: DashboardCard,
	parent: Component,
	draw: () => void,
	redrawOnModify: boolean,
): void {
	// Coalesce bursts of writes (e.g. an editor autosaving) into one redraw.
	const redraw = debounce(draw, 150, true);
	const affects = (file: TAbstractFile, oldPath?: string): boolean => {
		const path = watchedCardPath(view, card);
		return path != null && (file.path === path || oldPath === path);
	};
	const { vault } = view.app;
	if (redrawOnModify) {
		parent.registerEvent(vault.on("modify", (file) => {
			if (affects(file)) redraw();
		}));
	}
	parent.registerEvent(vault.on("create", (file) => {
		if (affects(file)) redraw();
	}));
	parent.registerEvent(vault.on("delete", (file) => {
		if (affects(file)) redraw();
	}));
	parent.registerEvent(vault.on("rename", (file, oldPath) => {
		if (affects(file, oldPath)) redraw();
	}));
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
		confirmAction(view.app, {
			title: "Remove card?",
			message: `Remove "${card.title?.trim() || "this card"}" from the dashboard?`,
			confirmText: "Remove",
			onConfirm: () => {
				removeCard(view.plugin.settings, card);
				persistAndRender(view);
			},
		});
	});
}

/** Open the full settings editor for a single card, driven entirely from the
 * board so nothing has to be configured in the plugin settings tab. */
function openCardSettings(view: HomeView, card: DashboardCard): void {
	const s = view.plugin.settings;
	new CardSettingsModal(view.app, card, {
		favorites: s.favorites,
		isPinned: s.pinnedCards.includes(card),
		setPinned: (pinned) => setCardPinned(s, card, pinned),
		save: () => void view.plugin.saveData(s),
		rerender: () => view.render(),
		remove: () => {
			removeCard(s, card);
			persistAndRender(view);
		},
		otherDashboards: s.dashboards
			.filter((d) => d.id !== s.activeDashboardId)
			.map((d) => ({ id: d.id, name: d.name })),
		copyToDashboard: (targetId) => {
			const target = s.dashboards.find((d) => d.id === targetId);
			if (!target) return;
			target.cards.push(cloneCard(card));
			void view.plugin.saveData(s);
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
			menu.showAtMouseEvent(evt);
		});

		// Toggle the per-card headers (title input + actions) off so each
		// card's full body is visible while arranging. Only available while
		// arranging; the headers come back automatically when arranging ends.
		const hideHdr = bar.createEl("button", { cls: "hearth-tool-btn" });
		hideHdr.toggleClass("is-active", view.hideHeaderInArrange);
		setIcon(
			hideHdr.createSpan("hearth-tool-icon"),
			view.hideHeaderInArrange ? "eye-off" : "eye",
		);
		hideHdr.createSpan({
			cls: "hearth-tool-label",
			text: view.hideHeaderInArrange ? "Show titles" : "Hide titles",
		});
		hideHdr.setAttribute(
			"aria-label",
			view.hideHeaderInArrange ? "Show card headers" : "Hide card headers",
		);
		hideHdr.addEventListener("click", () => {
			view.hideHeaderInArrange = !view.hideHeaderInArrange;
			view.render();
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
