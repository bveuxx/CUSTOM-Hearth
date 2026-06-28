/** The kind of content a dashboard card renders. */
export type CardKind =
	| "embed"
	| "web"
	| "bookmarks"
	| "favorites"
	| "text"
	| "recent"
	| "links"
	| "clock";

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
	/** kind === "recent": how many recent files to show. */
	count?: number;
	/** kind === "clock": time/greeting/date display options. */
	clock?: ClockConfig;

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

	// ---- Appearance (layout density) ----
	/** Tighten card and top-of-page spacing to enlarge the usable area. */
	compact: boolean;

	// ---- Search filters ----
	/** Group ids the user has hidden from the auto-detected filter row. */
	hiddenFilters: string[];

	// ---- Dashboard ----
	cards: DashboardCard[];
	gridColumns: number;
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

	compact: false,

	hiddenFilters: [],

	cards: [
		{ id: "card-base", kind: "embed", title: "Embedded base", target: "", x: 0, y: 0, w: 6, h: 6 },
		{ id: "card-note", kind: "embed", title: "Embedded note", target: "", x: 6, y: 0, w: 6, h: 2 },
		{ id: "card-bookmarks", kind: "bookmarks", title: "Bookmarks", x: 6, y: 2, w: 6, h: 2 },
		{ id: "card-image", kind: "embed", title: "Embedded image", target: "", x: 6, y: 4, w: 3, h: 2 },
		{ id: "card-favorites", kind: "favorites", title: "Favorites", x: 9, y: 4, w: 3, h: 2 },
	],
	gridColumns: 12,
	favorites: [],
	fitToPage: false,

	maxWidth: 1100,
};
