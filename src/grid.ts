import { Component } from "obsidian";
import type { HomeView } from "./view";
import { DashboardCard } from "./types";

/** Seed metrics used to convert legacy grid layouts (and freshly packed cards)
 * into free-form coordinates. Once converted, the live layout is continuous. */
export const ROW_HEIGHT = 92;
export const GRID_GAP = 16;
export const MIN_W = 2;
export const MIN_H = 1;

/** Minimum card footprint on the free-form board, in pixels. */
export const MIN_W_PX = 120;
export const MIN_H_PX = 56;

/** How close (px) an edge/centre must come to a guide before it snaps. */
const SNAP_THRESHOLD = 8;

/** Assign coordinates to any cards missing them (e.g. settings saved by an
 * older version, or freshly added cards that carry x/y = -1). Simple
 * left-to-right shelf packing by current order — this only seeds the free-form
 * coordinates derived in ensureFreeform. */
export function ensureLayout(cards: DashboardCard[], columns: number): boolean {
	let changed = false;
	// Track the lowest free row per column.
	const colBottom: number[] = new Array<number>(columns).fill(0);

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

/** Derive free-form coordinates (fractional horizontal, pixel vertical) from the
 * legacy grid units for any card that hasn't got them yet. Runs once per card;
 * afterwards the drag engine owns fx/fy/fw/fh directly. */
export function ensureFreeform(
	cards: DashboardCard[],
	columns: number,
	rowHeight: number,
	gap: number,
	boardWidth: number,
): boolean {
	let changed = false;
	// Reconstruct the old CSS grid (repeat(columns, 1fr) with `gap`) at a
	// representative board width so migrated cards keep their familiar spacing.
	const colW = Math.max(1, (boardWidth - (columns - 1) * gap) / columns);
	for (const card of cards) {
		if (
			typeof card.fx === "number" &&
			typeof card.fy === "number" &&
			typeof card.fw === "number" &&
			typeof card.fh === "number"
		) {
			continue;
		}
		const w = clamp(card.w || MIN_W, MIN_W, columns);
		const h = Math.max(card.h || MIN_H, MIN_H);
		const x = clamp(card.x < 0 ? 0 : card.x, 0, columns - w);
		const y = Math.max(0, card.y < 0 ? 0 : card.y);
		const leftPx = x * (colW + gap);
		const widthPx = w * colW + (w - 1) * gap;
		card.fx = clamp(leftPx / boardWidth, 0, 1);
		card.fw = clamp(widthPx / boardWidth, 0.02, 1);
		card.fy = y * (rowHeight + gap);
		card.fh = h * rowHeight + (h - 1) * gap;
		changed = true;
	}
	return changed;
}

/** Position a card on the free-form board. Horizontal uses percentages so the
 * board reflows with the pane; vertical uses pixels. */
export function applyCardPosition(el: HTMLElement, card: DashboardCard): void {
	const fx = clamp(card.fx ?? 0, 0, 1);
	const fw = clamp(card.fw ?? 0.25, 0.02, 1);
	el.style.left = `${clamp(fx, 0, 1 - fw) * 100}%`;
	el.style.width = `${fw * 100}%`;
	el.style.top = `${Math.max(0, card.fy ?? 0)}px`;
	el.style.height = `${Math.max(MIN_H_PX, card.fh ?? MIN_H_PX)}px`;
}

/** Total pixel height the board needs to show every card. */
export function layoutHeight(cards: DashboardCard[]): number {
	let bottom = 0;
	for (const card of cards) {
		bottom = Math.max(bottom, (card.fy ?? 0) + (card.fh ?? 0));
	}
	return bottom;
}

function clamp(n: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, n));
}

/** Shared layout state passed to the drag engine. */
export interface GridLayout {
	cards: DashboardCard[];
	elements: Map<DashboardCard, HTMLElement>;
}

interface DragContext {
	pointerId: number;
	startClientX: number;
	startClientY: number;
	startLeft: number;
	startTop: number;
	startWidth: number;
	startHeight: number;
	boardWidth: number;
	mode: "move" | "resize";
	// Candidate snap lines (px, board-relative) collected from siblings + board.
	xTargets: number[];
	yTargets: number[];
}

/** Collect the vertical (x) and horizontal (y) guide positions a dragged card
 * can snap to: the board's own edges/centre plus every other card's edges,
 * centres and a one-gap offset for tidy adjacency. */
function collectTargets(
	layout: GridLayout,
	active: DashboardCard,
	boardWidth: number,
): { xTargets: number[]; yTargets: number[] } {
	const xs = new Set<number>([0, boardWidth / 2, boardWidth]);
	const ys = new Set<number>([0]);
	for (const card of layout.cards) {
		if (card === active) continue;
		const left = (card.fx ?? 0) * boardWidth;
		const width = (card.fw ?? 0) * boardWidth;
		const top = card.fy ?? 0;
		const height = card.fh ?? 0;
		xs.add(left);
		xs.add(left + width / 2);
		xs.add(left + width);
		xs.add(left - GRID_GAP);
		xs.add(left + width + GRID_GAP);
		ys.add(top);
		ys.add(top + height / 2);
		ys.add(top + height);
		ys.add(top - GRID_GAP);
		ys.add(top + height + GRID_GAP);
	}
	return { xTargets: [...xs], yTargets: [...ys] };
}

/** Find the smallest snap adjustment for a set of moving edges against the
 * candidate guide lines. Returns the delta to apply and the guide that won. */
function bestSnap(
	edges: number[],
	targets: number[],
): { delta: number; guide: number } | null {
	let best: { delta: number; guide: number } | null = null;
	for (const edge of edges) {
		for (const target of targets) {
			const diff = target - edge;
			if (Math.abs(diff) <= SNAP_THRESHOLD) {
				if (!best || Math.abs(diff) < Math.abs(best.delta)) {
					best = { delta: diff, guide: target };
				}
			}
		}
	}
	return best;
}

/**
 * Make a card draggable (move) and resizable while the dashboard is in arrange
 * mode. Movement is fully continuous; while dragging, edges and centres snap
 * magnetically to neighbouring cards and the board, with alignment guides shown.
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
	const overlay = cardEl.createDiv("hearth-card-overlay");
	const handle = cardEl.createDiv("hearth-resize-handle");

	let ctx: DragContext | null = null;
	let guideX: HTMLElement | null = null;
	let guideY: HTMLElement | null = null;

	const showGuide = (axis: "x" | "y", pos: number | null) => {
		if (axis === "x") {
			if (pos == null) {
				guideX?.remove();
				guideX = null;
				return;
			}
			if (!guideX) guideX = gridEl.createDiv("hearth-align-guide is-vertical");
			guideX.style.left = `${pos}px`;
		} else {
			if (pos == null) {
				guideY?.remove();
				guideY = null;
				return;
			}
			if (!guideY) guideY = gridEl.createDiv("hearth-align-guide is-horizontal");
			guideY.style.top = `${pos}px`;
		}
	};

	const begin = (e: PointerEvent, mode: "move" | "resize") => {
		e.preventDefault();
		e.stopPropagation();
		const boardWidth = gridEl.clientWidth;
		const { xTargets, yTargets } = collectTargets(layout, card, boardWidth);
		ctx = {
			pointerId: e.pointerId,
			startClientX: e.clientX,
			startClientY: e.clientY,
			startLeft: (card.fx ?? 0) * boardWidth,
			startTop: card.fy ?? 0,
			startWidth: (card.fw ?? 0) * boardWidth,
			startHeight: card.fh ?? MIN_H_PX,
			boardWidth,
			mode,
			xTargets,
			yTargets,
		};
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
		cardEl.addClass(mode === "move" ? "is-moving" : "is-resizing");
	};

	const move = (e: PointerEvent) => {
		if (!ctx || e.pointerId !== ctx.pointerId) return;
		const dx = e.clientX - ctx.startClientX;
		const dy = e.clientY - ctx.startClientY;

		if (ctx.mode === "move") {
			let left = clamp(ctx.startLeft + dx, 0, ctx.boardWidth - ctx.startWidth);
			let top = Math.max(0, ctx.startTop + dy);
			// Snap left/centre/right edges to vertical guides.
			const snapX = bestSnap(
				[left, left + ctx.startWidth / 2, left + ctx.startWidth],
				ctx.xTargets,
			);
			if (snapX) {
				left = clamp(left + snapX.delta, 0, ctx.boardWidth - ctx.startWidth);
				showGuide("x", snapX.guide);
			} else {
				showGuide("x", null);
			}
			// Snap top/middle/bottom edges to horizontal guides.
			const snapY = bestSnap(
				[top, top + ctx.startHeight / 2, top + ctx.startHeight],
				ctx.yTargets,
			);
			if (snapY) {
				top = Math.max(0, top + snapY.delta);
				showGuide("y", snapY.guide);
			} else {
				showGuide("y", null);
			}
			cardEl.style.left = `${left}px`;
			cardEl.style.width = `${ctx.startWidth}px`;
			cardEl.style.top = `${top}px`;
		} else {
			let width = Math.max(MIN_W_PX, ctx.startWidth + dx);
			let height = Math.max(MIN_H_PX, ctx.startHeight + dy);
			width = Math.min(width, ctx.boardWidth - ctx.startLeft);
			// The right edge snaps horizontally; the bottom edge snaps vertically.
			const snapX = bestSnap([ctx.startLeft + width], ctx.xTargets);
			if (snapX) {
				width = clamp(width + snapX.delta, MIN_W_PX, ctx.boardWidth - ctx.startLeft);
				showGuide("x", snapX.guide);
			} else {
				showGuide("x", null);
			}
			const snapY = bestSnap([ctx.startTop + height], ctx.yTargets);
			if (snapY) {
				height = Math.max(MIN_H_PX, height + snapY.delta);
				showGuide("y", snapY.guide);
			} else {
				showGuide("y", null);
			}
			cardEl.style.left = `${ctx.startLeft}px`;
			cardEl.style.width = `${width}px`;
			cardEl.style.top = `${ctx.startTop}px`;
			cardEl.style.height = `${height}px`;
		}
		updateBoardHeight(gridEl);
	};

	const end = (e: PointerEvent) => {
		if (!ctx || e.pointerId !== ctx.pointerId) return;
		const w = ctx.boardWidth || 1;
		// Persist the live pixel geometry back into the fractional/pixel model.
		card.fx = clamp(cardEl.offsetLeft / w, 0, 1);
		card.fw = clamp(cardEl.offsetWidth / w, MIN_W_PX / w, 1);
		card.fy = Math.max(0, cardEl.offsetTop);
		card.fh = Math.max(MIN_H_PX, cardEl.offsetHeight);
		cardEl.removeClass("is-moving");
		cardEl.removeClass("is-resizing");
		showGuide("x", null);
		showGuide("y", null);
		ctx = null;
		// Normalise back to the responsive percentage form.
		applyCardPosition(cardEl, card);
		updateBoardHeight(gridEl);
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

/** Grow the board so it always contains its lowest card (plus breathing room). */
export function updateBoardHeight(gridEl: HTMLElement): void {
	let bottom = 0;
	for (const child of Array.from(gridEl.children)) {
		const el = child as HTMLElement;
		if (!el.classList.contains("hearth-card")) continue;
		bottom = Math.max(bottom, el.offsetTop + el.offsetHeight);
	}
	gridEl.style.minHeight = `${bottom + GRID_GAP}px`;
}
