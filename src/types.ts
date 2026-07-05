/** The kind of content a dashboard card renders. */
export type CardKind =
	| "embed"
	| "daily"
	| "web"
	| "bookmarks"
	| "favorites"
	| "text"
	| "recent"
	| "links"
	| "commands"
	| "clock"
	| "tasks"
	| "calendar"
	| "stats"
	| "search"
	| "heatmap";

/** A single command tile inside a "commands" card. */
export interface CommandItem {
	/** Obsidian command id, e.g. "editor:toggle-bold". */
	id: string;
	/** Display name (captured when the command was picked). */
	name: string;
	/** Optional Lucide icon id; falls back to a generic command icon. */
	icon?: string;
	/** Optional per-tile pixel size, overriding the card's default tile size. */
	size?: number;
}

/** Per-card configuration for a "tasks" card. */
export interface TasksConfig {
	/** "checkbox" (default) scans plain Markdown `- [ ]` checkboxes anywhere
	 * in scope. "tasknotes" reads frontmatter from the TaskNotes community
	 * plugin's task notes instead, using the field-name mapping configured in
	 * Settings → Hearth (TaskNotes has no stable public API to query, so this
	 * reads its files the same way TaskNotes itself does: frontmatter). */
	source?: "checkbox" | "tasknotes";
	/** How `folders` is applied. "all" (default) scans the whole vault. */
	folderScope?: "all" | "whitelist" | "blacklist";
	folders?: string[];
	/** Include already-completed tasks. Default false (hide done). */
	showCompleted?: boolean;
	/** Max tasks shown, soonest/overdue due date first. Default 10. */
	count?: number;
	/** "list" (default) renders a flat list; "kanban" groups tasks into status
	 * columns that tasks can be dragged between. */
	layout?: "list" | "kanban";
	/** Kanban: explicit left-to-right order of column keys (drag to reorder).
	 * Columns not listed keep their default order after the listed ones. */
	kanbanOrder?: string[];
	/** Kanban: column keys the user has hidden. */
	kanbanHidden?: string[];
}

/** Per-card configuration for a "calendar" card. */
export interface CalendarConfig {
	/** Show an ISO week-number column down the left edge. */
	showWeekNumbers?: boolean;
	/** Tint each day by note activity that day (a heatmap). */
	heatmap?: boolean;
	/** Which timestamp the heatmap counts. Default "modified". */
	heatmapMetric?: "modified" | "created";
}

/** Per-card configuration for a "search" (saved search) card. */
export interface SavedSearchConfig {
	/** The query, using the same syntax as the top search bar (plain text,
	 * a leading "#" for tags, or "key:value" for frontmatter). */
	query?: string;
	/** Max results shown. Default 12. */
	count?: number;
}

/** Per-card configuration for a "heatmap" (activity) card. */
export interface HeatmapConfig {
	/** Which timestamp to count. Default "modified". */
	metric?: "modified" | "created";
	/** How many weeks back to show. Default 26. */
	weeks?: number;
}

/** Per-card configuration for a "clock" card. All fields are optional; omitted
 * fields fall back to the defaults that match the original clock behaviour. */
export interface ClockConfig {
	/** Digital (default) or analogue clock face. */
	mode?: "digital" | "analog";
	/** Use 24-hour time instead of the locale default. */
	use24Hour?: boolean;
	/** Show seconds in the time. */
	showSeconds?: boolean;
	/** Show the greeting line (default true). */
	showGreeting?: boolean;
	/** Override the auto greeting. */
	greetingText?: string;
	/** Use the playful, slightly cheeky greetings instead of the plain ones. */
	playfulGreetings?: boolean;
	/** How much of the date to show. Default "full". */
	dateMode?: "full" | "long" | "short" | "iso" | "weekday" | "custom" | "none";
	/** moment.js format string used when dateMode is "custom". */
	dateFormat?: string;
}

/** A single button in the mobile action bar (shown under the search bar and
 * filters in Mobile mode). `commandId` is any registered Obsidian command id
 * — Hearth's own defaults (new note, new drawing, record voice, open daily
 * note) are registered as ordinary commands too, so any button can be
 * replaced with any command from any plugin. */
export interface MobileActionButton {
	id: string;
	label: string;
	icon: string;
	commandId: string;
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
	/** Optional per-tile pixel size, overriding the card's default tile size. */
	size?: number;
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
	/** kind === "web": allow the framed page same-origin access. Off by default
	 * (the safer sandbox); enable only for sites you trust that need cookies or
	 * local storage to render. */
	sandboxTrusted?: boolean;
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
	/** kind === "tasks": source, folder scope and display options. */
	tasks?: TasksConfig;
	/** kind === "calendar": week-number and heatmap display options. */
	calendar?: CalendarConfig;
	/** kind === "search": the saved query and result count. */
	savedSearch?: SavedSearchConfig;
	/** kind === "heatmap": metric and range. */
	heatmap?: HeatmapConfig;

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

	/** kind === "daily": show a button that opens today's note in the editor.
	 * Defaults to shown; set false to hide. */
	showOpenButton?: boolean;

	/** Show this card on every dashboard, sharing one definition and position
	 * across boards ("synced"). Stored once in settings.pinnedCards. */
	pinned?: boolean;

	// ---- Appearance ----
	/** Optional accent color (CSS color) for the card header/border. */
	accent?: string;
	/** Optional background color/tint (CSS color) for the card body. */
	background?: string;

	// ---- Layout (legacy grid cell units) ----
	// Kept as the seed for the free-form coordinates below: older layouts (and
	// freshly added cards, which are packed on a reference grid) store their
	// placement here, and it is converted to fx/fy/fw/fh once on first render.
	x: number;
	y: number;
	w: number;
	h: number;

	// ---- Layout (free-form) ----
	// The live layout is continuous, not grid-locked. Horizontal position/size
	// are fractions of the board width (0..1) so the board stays responsive when
	// the pane is resized; vertical position/size are absolute pixels. Undefined
	// until derived from the grid units above.
	fx?: number;
	fy?: number;
	fw?: number;
	fh?: number;
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
	/** Override "fit to page" for this board (undefined = use global). */
	fitToPage?: boolean;
	/** Override the content max-width (px) for this board (undefined = global). */
	maxWidth?: number;
}

export interface HomeSettings {
	// ---- Header ----
	title: string;
	showTitle: boolean;
	/** Emoji or short text shown as a logo next to the title. */
	logo: string;
	searchPlaceholder: string;
	showNewNoteButton: boolean;
	/** Also search inside note bodies (full-text), not just names/tags/properties. */
	searchContents: boolean;

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
	/** In Mobile mode, show the customizable action button row under the
	 * search bar and filters instead of the "New note" button beside search. */
	showMobileActionBar: boolean;
	/** Buttons shown in the mobile action bar. */
	mobileActionButtons: MobileActionButton[];

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

	// ---- Tasks / TaskNotes ----
	/** Frontmatter property names read by "tasks" cards in TaskNotes mode.
	 * TaskNotes has no stable API for other plugins, and its own field names
	 * are user-remappable, so these mirror its defaults and can be adjusted
	 * to match whatever the vault has them set to. */
	taskNotesStatusField: string;
	taskNotesDueField: string;
	/** Frontmatter field read for a task's priority (shown as an indicator). */
	taskNotesPriorityField: string;
	/** The status value that counts as "done". */
	taskNotesDoneValue: string;

	// ---- Layout ----
	maxWidth: number;
}

export const DEFAULT_SETTINGS: HomeSettings = {
	title: "Obsidian",
	showTitle: true,
	// Empty => the Hearth crystal icon is shown as the brand mark.
	logo: "",
	searchPlaceholder: "Search or command",
	showNewNoteButton: true,
	searchContents: true,

	backgroundKind: "none",
	backgroundValue: "",
	backgroundOpacity: 0.15,
	backgroundBlur: 0,

	openOnStartup: true,
	replaceNewTabs: true,
	mobileSearchOnly: false,
	showMobileActionBar: true,
	// Backfilled by migrateSettings so a fresh install gets the defaults below
	// and existing vaults aren't silently reset if the list is emptied.
	mobileActionButtons: [],

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

	taskNotesStatusField: "status",
	taskNotesDueField: "due",
	taskNotesPriorityField: "priority",
	taskNotesDoneValue: "done",

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

/** The mobile action bar's default buttons. Each `commandId` is a command
 * Hearth registers itself, so replacing one via the command picker works
 * exactly like swapping in any other plugin's command. */
export function defaultMobileActionButtons(): MobileActionButton[] {
	return [
		{ id: "action-new-note", label: "New note", icon: "plus", commandId: "hearth:new-note" },
		{ id: "action-new-drawing", label: "New drawing", icon: "pen-tool", commandId: "hearth:new-drawing" },
		{ id: "action-record-voice", label: "Record voice", icon: "mic", commandId: "hearth:record-voice" },
		{ id: "action-daily-note", label: "Daily note", icon: "calendar", commandId: "hearth:open-daily-note" },
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

/** Effective "fit to page" for the active board (per-dashboard override or global). */
export function effectiveFitToPage(s: HomeSettings): boolean {
	return activeDashboard(s).fitToPage ?? s.fitToPage;
}

/** Effective content max-width for the active board (per-dashboard override or global). */
export function effectiveMaxWidth(s: HomeSettings): number {
	return activeDashboard(s).maxWidth ?? s.maxWidth;
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
 * Recursively backfill any keys missing from `target` using `defaults`, for
 * plain objects only (arrays and primitives are left as loaded). A top-level
 * Object.assign only backfills top-level keys; this also fills nested config
 * objects (backgrounds, clocks…) added in newer versions, so loaded settings
 * are never missing a nested default that the code assumes is present.
 */
export function fillMissingDefaults(
	target: Record<string, unknown>,
	defaults: Record<string, unknown>,
): void {
	for (const [key, dv] of Object.entries(defaults)) {
		const tv = target[key];
		if (tv === undefined) {
			target[key] = Array.isArray(dv) ? [...dv] : isPlainObject(dv) ? { ...dv } : dv;
		} else if (isPlainObject(dv) && isPlainObject(tv)) {
			fillMissingDefaults(tv, dv);
		}
	}
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
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
	// Seed the default buttons only if the field was never persisted, so an
	// intentionally emptied list (all buttons removed) isn't reset on reload.
	if (!Array.isArray(raw.mobileActionButtons)) {
		s.mobileActionButtons = defaultMobileActionButtons();
	}
	// Drop the obsolete single-board field so it can't shadow the dashboards.
	delete (s as unknown as { cards?: unknown }).cards;
}
