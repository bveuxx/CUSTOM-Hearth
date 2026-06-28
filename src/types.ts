/** The kind of content a dashboard card renders. */
export type CardKind =
	| "embed"
	| "web"
	| "bookmarks"
	| "favorites"
	| "text"
	| "recent"
	| "links"
	| "commands"
	| "clock";

/** A single command tile inside a "commands" card. */
export interface CommandItem {
	/** Obsidian command id, e.g. "editor:toggle-bold". */
	id: string;
	/** Display name (captured when the command was picked). */
	name: string;
	/** Optional Lucide icon id; falls back to a generic command icon. */
	icon?: string;
}

/** Per-card configuration for a "clock" card. All fields are optional; omitted
 * fields fall back to the defaults that match the original clock behaviour. */
export interface ClockConfig {
	/** Use 24-hour time instead of the locale default. */
	use24Hour?: boolean;
	/** Show seconds in the time. */
	showSeconds?: boolean;
	/** Show the greeting line (default true). */
	showGreeting?: boolean;
	/** Override the auto "Good morning/afternoon/evening" greeting. */
	greetingText?: string;
	/** How much of the date to show. Default "full". */
	dateMode?: "full" | "short" | "none";
}

/** A single tile inside a "links" (launchpad) card. */
export interface LinkItem {
	id: string;
	label: string;
	/** Lucide icon id. */
	icon: string;
	/** Vault path, URL, or command id depending on type. */
	target: string;
	type: "note" | "url" | "command";
}

export interface DashboardCard {
	id: string;
	kind: CardKind;
	/** Optional custom title shown in the card header. */
	title?: string;

	// ---- Content (per kind) ----
	/** kind === "embed": vault path of the file to embed (.md, image, .base, ...). */
	target?: string;
	/** kind === "web": the web page URL to embed in an iframe. */
	url?: string;
	/** kind === "text": the jotted-down content. */
	text?: string;
	/** kind === "links": the launchpad tiles. */
	links?: LinkItem[];
	/** kind === "commands": command-palette tiles. */
	commands?: CommandItem[];
	/** kind === "recent": how many recent files to show. */
	count?: number;
	/** kind === "clock": time/greeting/date display options. */
	clock?: ClockConfig;

	// ---- Live content ----
	/** Auto-refresh interval in seconds for live content (embed / web). 0 or
	 * omitted means the card is rendered once and never refreshed. */
	refreshSec?: number;

	/** kind === "embed": zoom factor for the embedded content (1 = 100%).
	 * Omitted means no scaling. */
	scale?: number;

	/** kind === "embed": edit the embedded note's text in place instead of
	 * rendering it read-only. Only applies to Markdown notes. */
	editable?: boolean;

	/** kind === "commands": pixel size of the command tiles (min column width).
	 * Omitted means the default tile size. */
	tileSize?: number;

	/** Show this card on every dashboard, sharing one definition and position
	 * across boards ("synced"). Stored once in settings.pinnedCards. */
	pinned?: boolean;

	// ---- Appearance ----
	/** Optional accent color (CSS color) for the card header/border. */
	accent?: string;
	/** Optional background color/tint (CSS color) for the card body. */
	background?: string;

	// ---- Layout (grid cell units) ----
	x: number;
	y: number;
	w: number;
	h: number;
}

/** Background mode for the home view. */
export type BackgroundKind = "none" | "color" | "image" | "url";

/** A self-contained background configuration (used for per-dashboard overrides
 * as well as the global default). */
export interface BackgroundConfig {
	kind: BackgroundKind;
	value: string;
	opacity: number;
	blur: number;
}

/** A named dashboard: one arrangeable board of cards. The vault can hold several
 * and switch between them from the top-left switcher. */
export interface Dashboard {
	id: string;
	name: string;
	/** Optional emoji/short text shown on the switcher button instead of its
	 * 1-based number. */
	icon?: string;
	cards: DashboardCard[];
	/** Optional overrides; when omitted the global setting is used. */
	gridColumns?: number;
	rowHeight?: number;
	background?: BackgroundConfig;
}

export interface HomeSettings {
	// ---- Header ----
	title: string;
	showTitle: boolean;
	/** Emoji or short text shown as a logo next to the title. */
	logo: string;
	searchPlaceholder: string;
	showNewNoteButton: boolean;

	// ---- Background ----
	backgroundKind: BackgroundKind;
	/** A CSS color, a vault image path, or a URL depending on backgroundKind. */
	backgroundValue: string;
	backgroundOpacity: number;
	backgroundBlur: number;

	// ---- Behaviour ----
	openOnStartup: boolean;
	replaceNewTabs: boolean;
	/** On mobile, show only the search field and hide the dashboard. Has no
	 * effect on desktop, where the full dashboard is always shown. */
	mobileSearchOnly: boolean;

	// ---- Appearance (layout density) ----
	/** Tighten card and top-of-page spacing to enlarge the usable area. */
	compact: boolean;

	// ---- Search filters ----
	/** Group ids the user has hidden from the auto-detected filter row. */
	hiddenFilters: string[];

	// ---- Dashboard ----
	/** All dashboards. Always has at least one entry after migration. */
	dashboards: Dashboard[];
	/** Id of the dashboard currently shown. */
	activeDashboardId: string;
	/** Cards pinned to every dashboard (rendered on top of each board's cards). */
	pinnedCards: DashboardCard[];
	gridColumns: number;
	/** Height of one grid row in pixels. Lower = finer vertical sizing. */
	rowHeight: number;
	/** Curated note paths shown by "favorites" cards. */
	favorites: string[];
	/** Fit the dashboard to one screen (no scroll) vs. allow scrolling. */
	fitToPage: boolean;

	// ---- Layout ----
	maxWidth: number;
}

export const DEFAULT_SETTINGS: HomeSettings = {
	title: "Obsidian",
	showTitle: true,
	// Empty => the Hearth crystal icon is shown as the brand mark.
	logo: "",
	searchPlaceholder: "Search the vault",
	showNewNoteButton: true,

	backgroundKind: "none",
	backgroundValue: "",
	backgroundOpacity: 0.15,
	backgroundBlur: 0,

	openOnStartup: true,
	replaceNewTabs: true,
	mobileSearchOnly: false,

	compact: false,

	hiddenFilters: [],

	// Built by migration from STARTER_CARDS (fresh install) or the legacy
	// top-level `cards` array (upgrade). Left empty here so migration always runs.
	dashboards: [],
	activeDashboardId: "",
	pinnedCards: [],
	gridColumns: 12,
	rowHeight: 92,
	favorites: [],
	fitToPage: false,

	maxWidth: 1100,
};

/** The cards a brand-new vault starts with. */
function starterCards(): DashboardCard[] {
	return [
		{ id: "card-base", kind: "embed", title: "Embedded base", target: "", x: 0, y: 0, w: 6, h: 6 },
		{ id: "card-note", kind: "embed", title: "Embedded note", target: "", x: 6, y: 0, w: 6, h: 2 },
		{ id: "card-bookmarks", kind: "bookmarks", title: "Bookmarks", x: 6, y: 2, w: 6, h: 2 },
		{ id: "card-image", kind: "embed", title: "Embedded image", target: "", x: 6, y: 4, w: 3, h: 2 },
		{ id: "card-favorites", kind: "favorites", title: "Favorites", x: 9, y: 4, w: 3, h: 2 },
	];
}

/** Generate a unique dashboard id. */
export function newDashboardId(): string {
	return `dash-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4)}`;
}

/** The dashboard currently selected (falls back to the first one). */
export function activeDashboard(s: HomeSettings): Dashboard {
	return s.dashboards.find((d) => d.id === s.activeDashboardId) ?? s.dashboards[0];
}

/** Cards of the currently selected dashboard (its own cards only). */
export function activeCards(s: HomeSettings): DashboardCard[] {
	return activeDashboard(s).cards;
}

/** Cards to render on the active board: its own cards plus every pinned card. */
export function renderCards(s: HomeSettings): DashboardCard[] {
	return [...activeDashboard(s).cards, ...s.pinnedCards];
}

/** Effective grid columns for the active board (per-dashboard override or global). */
export function effectiveColumns(s: HomeSettings): number {
	return activeDashboard(s).gridColumns ?? s.gridColumns;
}

/** Effective row height for the active board (per-dashboard override or global). */
export function effectiveRowHeight(s: HomeSettings): number {
	return activeDashboard(s).rowHeight ?? s.rowHeight;
}

/** Remove a card from whichever list holds it (a board or the pinned set). */
export function removeCard(s: HomeSettings, card: DashboardCard): void {
	for (const d of s.dashboards) {
		const i = d.cards.indexOf(card);
		if (i >= 0) {
			d.cards.splice(i, 1);
			return;
		}
	}
	const p = s.pinnedCards.indexOf(card);
	if (p >= 0) s.pinnedCards.splice(p, 1);
}

/** Pin/unpin a card: move it between its board and the shared pinned set. */
export function setCardPinned(s: HomeSettings, card: DashboardCard, pinned: boolean): void {
	const alreadyPinned = s.pinnedCards.includes(card);
	if (pinned === alreadyPinned) {
		card.pinned = pinned;
		return;
	}
	if (pinned) {
		for (const d of s.dashboards) {
			const i = d.cards.indexOf(card);
			if (i >= 0) {
				d.cards.splice(i, 1);
				break;
			}
		}
		card.pinned = true;
		s.pinnedCards.push(card);
	} else {
		const i = s.pinnedCards.indexOf(card);
		if (i >= 0) s.pinnedCards.splice(i, 1);
		card.pinned = false;
		activeDashboard(s).cards.push(card);
	}
}

/** Effective background for the active board (per-dashboard override or global). */
export function effectiveBackground(s: HomeSettings): BackgroundConfig {
	return (
		activeDashboard(s).background ?? {
			kind: s.backgroundKind,
			value: s.backgroundValue,
			opacity: s.backgroundOpacity,
			blur: s.backgroundBlur,
		}
	);
}

/**
 * Bring loaded settings up to date: wrap the legacy single-board `cards` array
 * (or the starter set) into the multi-dashboard model and backfill any new
 * fields. Idempotent — safe to run on every load.
 */
export function migrateSettings(s: HomeSettings, raw: Record<string, unknown>): void {
	if (!Array.isArray(s.dashboards) || s.dashboards.length === 0) {
		const legacy = Array.isArray(raw.cards) ? (raw.cards as DashboardCard[]) : null;
		s.dashboards = [
			{ id: newDashboardId(), name: "Dashboard 1", cards: legacy ?? starterCards() },
		];
	}
	if (!s.activeDashboardId || !s.dashboards.some((d) => d.id === s.activeDashboardId)) {
		s.activeDashboardId = s.dashboards[0].id;
	}
	if (typeof s.rowHeight !== "number" || s.rowHeight <= 0) s.rowHeight = 92;
	if (!Array.isArray(s.pinnedCards)) s.pinnedCards = [];
	// Drop the obsolete single-board field so it can't shadow the dashboards.
	delete (s as unknown as { cards?: unknown }).cards;
}
