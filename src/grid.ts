import { Component } from "obsidian";
import type { HomeView } from "./view";
import { DashboardCard, effectiveRowHeight } from "./types";

/** Grid metrics — kept in sync with styles.css via inline CSS variables. */
export const ROW_HEIGHT = 92;
export const GRID_GAP = 16;
export const MIN_W = 2;
export const MIN_H = 1;

/** Assign coordinates to any cards missing them (e.g. settings saved by an
 * older version). Simple left-to-right shelf packing by current order. */
export function ensureLayout(cards: DashboardCard[], columns: number): boolean {
	let changed = false;
	// Track the lowest free row per column.
	const colBottom = new Array(columns).fill(0);

	for (const card of cards) {
		const placed =
			typeof card.x === "number" && card.x >= 0 &&
			typeof card.y === "number" && card.y >= 0;
		if (placed) {
			// Respect existing placement but keep the column map up to date.
			const w = clamp(card.w, MIN_W, columns);
			for (let c = card.x; c < Math.min(card.x + w, columns); c++) {
				colBottom[c] = Math.max(colBottom[c], card.y + card.h);
			}
			continue;
		}
		const w = clamp(card.w || MIN_W, MIN_W, columns);
		const h = Math.max(card.h || MIN_H, MIN_H);
		const { x, y } = findSlot(colBottom, columns, w);
		card.x = x;
		card.y = y;
		card.w = w;
		card.h = h;
		for (let c = x; c < x + w; c++) colBottom[c] = y + h;
		changed = true;
	}
	return changed;
}

function findSlot(colBottom: number[], columns: number, w: number): { x: number; y: number } {
	let best = { x: 0, y: Number.MAX_SAFE_INTEGER };
	for (let x = 0; x + w <= columns; x++) {
		let y = 0;
		for (let c = x; c < x + w; c++) y = Math.max(y, colBottom[c]);
		if (y < best.y) best = { x, y };
	}
	if (best.y === Number.MAX_SAFE_INTEGER) best = { x: 0, y: 0 };
	return best;
}

export function applyCardPosition(el: HTMLElement, card: DashboardCard, columns: number): void {
	const w = clamp(card.w, MIN_W, columns);
	const x = clamp(card.x, 0, columns - w);
	el.style.gridColumn = `${x + 1} / span ${w}`;
	el.style.gridRow = `${card.y + 1} / span ${Math.max(card.h, MIN_H)}`;
}

function clamp(n: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, n));
}

/** Shared layout state passed to the drag engine so it can push neighbouring
 * cards out of the way while one is being dragged or resized. */
export interface GridLayout {
	cards: DashboardCard[];
	elements: Map<DashboardCard, HTMLElement>;
	columns: number;
}

interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

function overlaps(a: Rect, b: Rect): boolean {
	return (
		a.x < b.x + b.w &&
		a.x + a.w > b.x &&
		a.y < b.y + b.h &&
		a.y + a.h > b.y
	);
}

/**
 * Resolve overlaps by pushing colliding cards downward, cascading the push so
 * chains of cards shift together. The `active` card stays put — everything
 * yields to it. Other cards start from `origins` each pass so they spring back
 * to where they were once the active card no longer overlaps them.
 */
function resolveCollisions(
	layout: GridLayout,
	active: DashboardCard,
	origins: Map<DashboardCard, Rect>,
): void {
	for (const card of layout.cards) {
		if (card === active) continue;
		const origin = origins.get(card);
		if (origin) {
			card.x = origin.x;
			card.y = origin.y;
		}
	}

	// Breadth-first cascade: whenever a card overlaps a settled one, drop it
	// just below and re-check anything it now overlaps.
	const queue: DashboardCard[] = [active];
	let guard = layout.cards.length * layout.cards.length + 1;
	while (queue.length && guard-- > 0) {
		const cur = queue.shift()!;
		for (const other of layout.cards) {
			if (other === cur || other === active) continue;
			if (overlaps(cur, other)) {
				other.y = cur.y + Math.max(cur.h, MIN_H);
				queue.push(other);
			}
		}
	}
}

/** Pull every card up as far as it will go without overlapping another, in
 * reading order. Keeps the board tidy after a drag settles. */
export function compactLayout(cards: DashboardCard[], columns: number): boolean {
	const ordered = [...cards].sort((a, b) => a.y - b.y || a.x - b.x);
	const placed: Rect[] = [];
	let changed = false;

	for (const card of ordered) {
		const w = clamp(card.w, MIN_W, columns);
		const h = Math.max(card.h, MIN_H);
		const x = clamp(card.x, 0, columns - w);
		let y = card.y;
		// Slide up while the cell above is clear.
		while (y > 0 && !placed.some((p) => overlaps({ x, y: y - 1, w, h }, p))) {
			y--;
		}
		if (x !== card.x || y !== card.y) {
			card.x = x;
			card.y = y;
			changed = true;
		}
		placed.push({ x, y, w, h });
	}
	return changed;
}

function applyAll(layout: GridLayout): void {
	for (const card of layout.cards) {
		const el = layout.elements.get(card);
		if (el) applyCardPosition(el, card, layout.columns);
	}
}

interface DragContext {
	pointerId: number;
	startClientX: number;
	startClientY: number;
	startX: number;
	startY: number;
	startW: number;
	startH: number;
	cellW: number;
	mode: "move" | "resize";
}

/**
 * Make a card draggable (move) and resizable while the dashboard is in arrange
 * mode. Snaps to grid cells, pushes neighbouring cards out of the way to avoid
 * overlaps, and persists on release.
 */
export function enableDragResize(
	view: HomeView,
	cardEl: HTMLElement,
	gridEl: HTMLElement,
	card: DashboardCard,
	layout: GridLayout,
	component: Component,
	onCommit: () => void,
): void {
	const columns = layout.columns;
	const rowHeight = effectiveRowHeight(view.plugin.settings) || ROW_HEIGHT;
	const overlay = cardEl.createDiv("hearth-card-overlay");
	const handle = cardEl.createDiv("hearth-resize-handle");

	let ctx: DragContext | null = null;
	// Where every card sat when the drag started, so neighbours can spring back.
	let origins: Map<DashboardCard, Rect> | null = null;

	const cellStep = () => {
		const totalGap = GRID_GAP * (columns - 1);
		const cellW = (gridEl.clientWidth - totalGap) / columns;
		return { cellW, stepX: cellW + GRID_GAP, stepY: rowHeight + GRID_GAP };
	};

	const begin = (e: PointerEvent, mode: "move" | "resize") => {
		e.preventDefault();
		e.stopPropagation();
		const { cellW } = cellStep();
		ctx = {
			pointerId: e.pointerId,
			startClientX: e.clientX,
			startClientY: e.clientY,
			startX: card.x,
			startY: card.y,
			startW: card.w,
			startH: card.h,
			cellW,
			mode,
		};
		origins = new Map();
		for (const c of layout.cards) {
			origins.set(c, { x: c.x, y: c.y, w: c.w, h: c.h });
		}
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
		cardEl.addClass(mode === "move" ? "is-moving" : "is-resizing");
	};

	const move = (e: PointerEvent) => {
		if (!ctx || !origins || e.pointerId !== ctx.pointerId) return;
		const { stepX, stepY } = cellStep();
		const dCol = Math.round((e.clientX - ctx.startClientX) / stepX);
		const dRow = Math.round((e.clientY - ctx.startClientY) / stepY);

		if (ctx.mode === "move") {
			const w = clamp(card.w, MIN_W, columns);
			card.x = clamp(ctx.startX + dCol, 0, columns - w);
			card.y = Math.max(0, ctx.startY + dRow);
		} else {
			card.w = clamp(ctx.startW + dCol, MIN_W, columns - card.x);
			card.h = Math.max(MIN_H, ctx.startH + dRow);
		}
		resolveCollisions(layout, card, origins);
		applyAll(layout);
	};

	const end = (e: PointerEvent) => {
		if (!ctx || e.pointerId !== ctx.pointerId) return;
		cardEl.removeClass("is-moving");
		cardEl.removeClass("is-resizing");
		ctx = null;
		origins = null;
		// Tidy up: pull cards back up into any gaps the drag opened.
		compactLayout(layout.cards, columns);
		applyAll(layout);
		onCommit();
	};

	component.registerDomEvent(overlay, "pointerdown", (e) => begin(e, "move"));
	component.registerDomEvent(handle, "pointerdown", (e) => begin(e, "resize"));
	component.registerDomEvent(overlay, "pointermove", move);
	component.registerDomEvent(handle, "pointermove", move);
	component.registerDomEvent(overlay, "pointerup", end);
	component.registerDomEvent(handle, "pointerup", end);
	component.registerDomEvent(overlay, "pointercancel", end);
	component.registerDomEvent(handle, "pointercancel", end);
}
