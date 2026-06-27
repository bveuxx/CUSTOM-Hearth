/** The kind of content a dashboard card renders. */
export type CardKind = "embed" | "bookmarks" | "favorites" | "text";

export interface DashboardCard {
	id: string;
	kind: CardKind;
	/** Optional custom title shown in the card header. */
	title?: string;
	/** For kind === "embed": vault path of the file to embed (.md, image, .base, ...). */
	target?: string;
	/** For kind === "text": the jotted-down content. */
	text?: string;
	/** Grid layout (column units). Used for sizing now; full drag/resize comes later. */
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
	logo: "💎",
	searchPlaceholder: "Search the vault",
	showNewNoteButton: true,

	backgroundKind: "none",
	backgroundValue: "",
	backgroundOpacity: 0.15,
	backgroundBlur: 0,

	openOnStartup: true,
	replaceNewTabs: true,

	hiddenFilters: [],

	cards: [
		{ id: "card-base", kind: "embed", title: "Embedded base", target: "", w: 6, h: 4 },
		{ id: "card-note", kind: "embed", title: "Embedded note", target: "", w: 6, h: 2 },
		{ id: "card-bookmarks", kind: "bookmarks", title: "Bookmarks", w: 6, h: 2 },
		{ id: "card-image", kind: "embed", title: "Embedded image", target: "", w: 3, h: 2 },
		{ id: "card-favorites", kind: "favorites", title: "Favorites", w: 3, h: 2 },
	],
	gridColumns: 12,
	favorites: [],
	fitToPage: false,

	maxWidth: 1100,
};
