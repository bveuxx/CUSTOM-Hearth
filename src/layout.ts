import {
	BackgroundConfig,
	BackgroundKind,
	CalendarConfig,
	CardKind,
	ClockConfig,
	CommandItem,
	Dashboard,
	DashboardCard,
	HeatmapConfig,
	HomeSettings,
	LinkItem,
	newDashboardId,
	SavedSearchConfig,
	TasksConfig,
	activeDashboard,
} from "./types";

/** Current dashboard-layout export schema version. v2 carries every dashboard
 * (with per-board overrides and backgrounds) plus pinned cards and globals;
 * v1 (a single `cards` array) is still imported for backward compatibility. */
export const LAYOUT_SCHEMA = 2;

/** The portable subset of settings that describes the whole dashboard setup. */
export interface LayoutExport {
	hearthLayout: number;
	dashboards: Dashboard[];
	activeDashboardId: string;
	pinnedCards: DashboardCard[];
	gridColumns: number;
	rowHeight: number;
	fitToPage: boolean;
	maxWidth: number;
	favorites: string[];
}

/** Value ranges enforced on import so a malformed/hostile layout can't set
 * values the settings UI could never produce. Mirror the sliders in settings. */
const RANGE = {
	gridColumns: { min: 4, max: 16 },
	rowHeight: { min: 32, max: 160 },
	maxWidth: { min: 700, max: 1600 },
	cardW: { min: 1, max: 16 },
	cardH: { min: 1, max: 60 },
};

const CARD_KINDS: CardKind[] = [
	"embed",
	"daily",
	"web",
	"bookmarks",
	"favorites",
	"text",
	"recent",
	"links",
	"commands",
	"clock",
	"tasks",
	"calendar",
	"stats",
	"search",
	"heatmap",
];

/** Serialize the whole dashboard setup to a pretty JSON string. */
export function exportLayout(s: HomeSettings): string {
	const data: LayoutExport = {
		hearthLayout: LAYOUT_SCHEMA,
		dashboards: s.dashboards,
		activeDashboardId: s.activeDashboardId,
		pinnedCards: s.pinnedCards,
		gridColumns: s.gridColumns,
		rowHeight: s.rowHeight,
		fitToPage: s.fitToPage,
		maxWidth: s.maxWidth,
		favorites: s.favorites,
	};
	return JSON.stringify(data, null, 2);
}

function num(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function clampNum(value: unknown, min: number, max: number, fallback: number): number {
	return Math.max(min, Math.min(max, Math.round(num(value, fallback))));
}

function str(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function sanitizeLink(raw: unknown): LinkItem | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const type = r.type === "url" || r.type === "command" ? r.type : "note";
	const link: LinkItem = {
		id: str(r.id) ?? `link-${Math.random().toString(36).slice(2)}`,
		label: str(r.label) ?? "",
		icon: str(r.icon) ?? "link",
		target: str(r.target) ?? "",
		type,
	};
	if (typeof r.size === "number") link.size = r.size;
	return link;
}

function sanitizeCard(raw: unknown, index: number): DashboardCard | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const kind = CARD_KINDS.includes(r.kind as CardKind) ? (r.kind as CardKind) : null;
	if (!kind) return null;

	const card: DashboardCard = {
		id: str(r.id) ?? `card-${Date.now().toString(36)}-${index}`,
		kind,
		x: num(r.x, -1),
		y: num(r.y, -1),
		w: clampNum(r.w, RANGE.cardW.min, RANGE.cardW.max, 4),
		h: clampNum(r.h, RANGE.cardH.min, RANGE.cardH.max, 2),
	};

	const title = str(r.title);
	if (title !== undefined) card.title = title;
	const target = str(r.target);
	if (target !== undefined) card.target = target;
	const url = str(r.url);
	if (url !== undefined) card.url = url;
	const text = str(r.text);
	if (text !== undefined) card.text = text;
	const accent = str(r.accent);
	if (accent !== undefined) card.accent = accent;
	const background = str(r.background);
	if (background !== undefined) card.background = background;
	if (typeof r.count === "number") card.count = r.count;
	if (typeof r.scale === "number") card.scale = r.scale;
	if (typeof r.refreshSec === "number") card.refreshSec = r.refreshSec;
	if (typeof r.editable === "boolean") card.editable = r.editable;
	if (typeof r.tileSize === "number") card.tileSize = r.tileSize;
	if (typeof r.showOpenButton === "boolean") card.showOpenButton = r.showOpenButton;
	if (typeof r.sandboxTrusted === "boolean") card.sandboxTrusted = r.sandboxTrusted;
	if (typeof r.pinned === "boolean") card.pinned = r.pinned;
	if (Array.isArray(r.links)) {
		card.links = r.links.map(sanitizeLink).filter((l): l is LinkItem => l !== null);
	}
	if (Array.isArray(r.commands)) {
		card.commands = r.commands
			.map(sanitizeCommand)
			.filter((c): c is CommandItem => c !== null);
	}
	if (r.clock && typeof r.clock === "object") {
		card.clock = sanitizeClock(r.clock as Record<string, unknown>);
	}
	if (r.tasks && typeof r.tasks === "object") {
		card.tasks = sanitizeTasks(r.tasks as Record<string, unknown>);
	}
	if (r.calendar && typeof r.calendar === "object") {
		card.calendar = sanitizeCalendar(r.calendar as Record<string, unknown>);
	}
	if (r.savedSearch && typeof r.savedSearch === "object") {
		card.savedSearch = sanitizeSavedSearch(r.savedSearch as Record<string, unknown>);
	}
	if (r.heatmap && typeof r.heatmap === "object") {
		card.heatmap = sanitizeHeatmap(r.heatmap as Record<string, unknown>);
	}

	return card;
}

function sanitizeCommand(raw: unknown): CommandItem | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const id = str(r.id);
	if (!id) return null;
	const cmd: CommandItem = { id, name: str(r.name) ?? id, icon: str(r.icon) };
	if (typeof r.size === "number") cmd.size = r.size;
	return cmd;
}

function sanitizeClock(r: Record<string, unknown>): ClockConfig {
	const clock: ClockConfig = {};
	if (r.mode === "digital" || r.mode === "analog") clock.mode = r.mode;
	if (typeof r.use24Hour === "boolean") clock.use24Hour = r.use24Hour;
	if (typeof r.showSeconds === "boolean") clock.showSeconds = r.showSeconds;
	if (typeof r.showGreeting === "boolean") clock.showGreeting = r.showGreeting;
	if (typeof r.playfulGreetings === "boolean") clock.playfulGreetings = r.playfulGreetings;
	const greeting = str(r.greetingText);
	if (greeting !== undefined) clock.greetingText = greeting;
	const dateFormat = str(r.dateFormat);
	if (dateFormat !== undefined) clock.dateFormat = dateFormat;
	const modes = ["full", "long", "short", "iso", "weekday", "custom", "none"];
	if (typeof r.dateMode === "string" && modes.includes(r.dateMode)) {
		clock.dateMode = r.dateMode as NonNullable<ClockConfig["dateMode"]>;
	}
	return clock;
}

function sanitizeTasks(r: Record<string, unknown>): TasksConfig {
	const cfg: TasksConfig = {};
	if (r.source === "checkbox" || r.source === "tasknotes") cfg.source = r.source;
	if (r.folderScope === "all" || r.folderScope === "whitelist" || r.folderScope === "blacklist") {
		cfg.folderScope = r.folderScope;
	}
	if (Array.isArray(r.folders)) {
		cfg.folders = r.folders.filter((f): f is string => typeof f === "string");
	}
	if (typeof r.showCompleted === "boolean") cfg.showCompleted = r.showCompleted;
	if (typeof r.count === "number") cfg.count = r.count;
	if (r.layout === "list" || r.layout === "kanban") cfg.layout = r.layout;
	if (Array.isArray(r.kanbanOrder)) {
		cfg.kanbanOrder = r.kanbanOrder.filter((k): k is string => typeof k === "string");
	}
	if (Array.isArray(r.kanbanHidden)) {
		cfg.kanbanHidden = r.kanbanHidden.filter((k): k is string => typeof k === "string");
	}
	return cfg;
}

function sanitizeCalendar(r: Record<string, unknown>): CalendarConfig {
	const cfg: CalendarConfig = {};
	if (typeof r.showWeekNumbers === "boolean") cfg.showWeekNumbers = r.showWeekNumbers;
	if (typeof r.heatmap === "boolean") cfg.heatmap = r.heatmap;
	if (r.heatmapMetric === "modified" || r.heatmapMetric === "created") {
		cfg.heatmapMetric = r.heatmapMetric;
	}
	return cfg;
}

function sanitizeSavedSearch(r: Record<string, unknown>): SavedSearchConfig {
	const cfg: SavedSearchConfig = {};
	const query = str(r.query);
	if (query !== undefined) cfg.query = query;
	if (typeof r.count === "number") cfg.count = r.count;
	return cfg;
}

function sanitizeHeatmap(r: Record<string, unknown>): HeatmapConfig {
	const cfg: HeatmapConfig = {};
	if (r.metric === "modified" || r.metric === "created") cfg.metric = r.metric;
	if (typeof r.weeks === "number") cfg.weeks = r.weeks;
	return cfg;
}

function sanitizeBackground(raw: unknown): BackgroundConfig | undefined {
	if (!raw || typeof raw !== "object") return undefined;
	const r = raw as Record<string, unknown>;
	const kinds: BackgroundKind[] = ["none", "color", "image", "url"];
	if (!kinds.includes(r.kind as BackgroundKind)) return undefined;
	return {
		kind: r.kind as BackgroundKind,
		value: str(r.value) ?? "",
		opacity: Math.max(0, Math.min(1, num(r.opacity, 0.15))),
		blur: Math.max(0, Math.min(40, num(r.blur, 0))),
	};
}

function sanitizeDashboard(raw: unknown, s: HomeSettings, index: number): Dashboard | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const cards = Array.isArray(r.cards)
		? r.cards.map((c, i) => sanitizeCard(c, i)).filter((c): c is DashboardCard => c !== null)
		: [];
	const dash: Dashboard = {
		id: str(r.id) ?? newDashboardId(),
		name: str(r.name) ?? `Dashboard ${index + 1}`,
		cards,
	};
	const icon = str(r.icon);
	if (icon !== undefined && icon.trim()) dash.icon = icon;
	if (typeof r.gridColumns === "number") {
		dash.gridColumns = clampNum(r.gridColumns, RANGE.gridColumns.min, RANGE.gridColumns.max, s.gridColumns);
	}
	if (typeof r.rowHeight === "number") {
		dash.rowHeight = clampNum(r.rowHeight, RANGE.rowHeight.min, RANGE.rowHeight.max, s.rowHeight);
	}
	if (typeof r.fitToPage === "boolean") dash.fitToPage = r.fitToPage;
	if (typeof r.maxWidth === "number") {
		dash.maxWidth = clampNum(r.maxWidth, RANGE.maxWidth.min, RANGE.maxWidth.max, s.maxWidth);
	}
	const bg = sanitizeBackground(r.background);
	if (bg) dash.background = bg;
	return dash;
}

/**
 * Parse and sanitize an exported layout, applying it onto the given settings.
 * Returns an error message on failure, or null on success. Supports both the
 * v2 multi-dashboard format and the legacy v1 single-`cards` format.
 */
export function importLayout(s: HomeSettings, json: string): string | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return "That isn't valid JSON.";
	}
	if (!parsed || typeof parsed !== "object") {
		return "Layout must be a JSON object.";
	}
	const data = parsed as Record<string, unknown>;

	// v2: a full multi-dashboard layout.
	if (Array.isArray(data.dashboards)) {
		const dashboards = data.dashboards
			.map((d, i) => sanitizeDashboard(d, s, i))
			.filter((d): d is Dashboard => d !== null);
		if (dashboards.length === 0) return "Layout contained no valid dashboards.";
		s.dashboards = dashboards;
		if (Array.isArray(data.pinnedCards)) {
			s.pinnedCards = data.pinnedCards
				.map((c, i) => sanitizeCard(c, i))
				.filter((c): c is DashboardCard => c !== null);
		}
		const activeId = str(data.activeDashboardId);
		s.activeDashboardId =
			activeId && dashboards.some((d) => d.id === activeId) ? activeId : dashboards[0].id;
		applyGlobals(s, data);
		return null;
	}

	// v1 (legacy): a single active-board `cards` array.
	if (Array.isArray(data.cards)) {
		const cards = data.cards
			.map((c, i) => sanitizeCard(c, i))
			.filter((c): c is DashboardCard => c !== null);
		if (cards.length === 0) return "Layout contained no valid cards.";
		activeDashboard(s).cards = cards;
		applyGlobals(s, data);
		return null;
	}

	return "Not a Hearth layout — no \"dashboards\" or \"cards\" array found.";
}

/** Apply the global (non-per-board) settings carried by a layout, clamped. */
function applyGlobals(s: HomeSettings, data: Record<string, unknown>): void {
	s.gridColumns = clampNum(data.gridColumns, RANGE.gridColumns.min, RANGE.gridColumns.max, s.gridColumns);
	if (typeof data.rowHeight === "number") {
		s.rowHeight = clampNum(data.rowHeight, RANGE.rowHeight.min, RANGE.rowHeight.max, s.rowHeight);
	}
	s.maxWidth = clampNum(data.maxWidth, RANGE.maxWidth.min, RANGE.maxWidth.max, s.maxWidth);
	if (typeof data.fitToPage === "boolean") s.fitToPage = data.fitToPage;
	if (Array.isArray(data.favorites)) {
		s.favorites = data.favorites.filter((p): p is string => typeof p === "string");
	}
}
