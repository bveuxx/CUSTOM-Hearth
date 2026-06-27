import { Component } from "obsidian";
import type { HomeView } from "./view";
import { DashboardCard } from "./types";

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
 * mode. Snaps to grid cells and persists on release.
 */
export function enableDragResize(
	view: HomeView,
	cardEl: HTMLElement,
	gridEl: HTMLElement,
	card: DashboardCard,
	columns: number,
	component: Component,
	onCommit: () => void,
): void {
	const overlay = cardEl.createDiv("hearth-card-overlay");
	const handle = cardEl.createDiv("hearth-resize-handle");

	let ctx: DragContext | null = null;

	const cellStep = () => {
		const totalGap = GRID_GAP * (columns - 1);
		const cellW = (gridEl.clientWidth - totalGap) / columns;
		return { cellW, stepX: cellW + GRID_GAP, stepY: ROW_HEIGHT + GRID_GAP };
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
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
		cardEl.addClass(mode === "move" ? "is-moving" : "is-resizing");
	};

	const move = (e: PointerEvent) => {
		if (!ctx || e.pointerId !== ctx.pointerId) return;
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
		applyCardPosition(cardEl, card, columns);
	};

	const end = (e: PointerEvent) => {
		if (!ctx || e.pointerId !== ctx.pointerId) return;
		cardEl.removeClass("is-moving");
		cardEl.removeClass("is-resizing");
		ctx = null;
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
