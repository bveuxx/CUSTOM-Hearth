import {
	activeCards,
	activeDashboard,
	CardKind,
	ClockConfig,
	CommandItem,
	DashboardCard,
	HomeSettings,
	LinkItem,
} from "./types";

/** Current dashboard-layout export schema version. */
export const LAYOUT_SCHEMA = 1;

/** The portable subset of settings that describes a dashboard layout. */
export interface LayoutExport {
	hearthLayout: number;
	cards: DashboardCard[];
	gridColumns: number;
	fitToPage: boolean;
	maxWidth: number;
	favorites: string[];
}

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
];

/** Serialize the active dashboard's layout to a pretty JSON string. */
export function exportLayout(s: HomeSettings): string {
	const data: LayoutExport = {
		hearthLayout: LAYOUT_SCHEMA,
		cards: activeCards(s),
		gridColumns: s.gridColumns,
		fitToPage: s.fitToPage,
		maxWidth: s.maxWidth,
		favorites: s.favorites,
	};
	return JSON.stringify(data, null, 2);
}

function num(value: unknown, fallback: number): number {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function sanitizeLink(raw: unknown): LinkItem | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const type = r.type === "url" || r.type === "command" ? r.type : "note";
	return {
		id: str(r.id) ?? `link-${Math.random().toString(36).slice(2)}`,
		label: str(r.label) ?? "",
		icon: str(r.icon) ?? "link",
		target: str(r.target) ?? "",
		type,
	};
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
		w: num(r.w, 4),
		h: num(r.h, 2),
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

	return card;
}

function sanitizeCommand(raw: unknown): CommandItem | null {
	if (!raw || typeof raw !== "object") return null;
	const r = raw as Record<string, unknown>;
	const id = str(r.id);
	if (!id) return null;
	return { id, name: str(r.name) ?? id, icon: str(r.icon) };
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

/**
 * Parse and sanitize an exported layout, applying it onto the given settings.
 * Returns an error message on failure, or null on success.
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
	if (!Array.isArray(data.cards)) {
		return "Not a Hearth layout — no \"cards\" array found.";
	}

	const cards = data.cards
		.map((c, i) => sanitizeCard(c, i))
		.filter((c): c is DashboardCard => c !== null);
	if (cards.length === 0) {
		return "Layout contained no valid cards.";
	}

	activeDashboard(s).cards = cards;
	s.gridColumns = Math.round(num(data.gridColumns, s.gridColumns));
	if (typeof data.fitToPage === "boolean") s.fitToPage = data.fitToPage;
	s.maxWidth = Math.round(num(data.maxWidth, s.maxWidth));
	if (Array.isArray(data.favorites)) {
		s.favorites = data.favorites.filter((p): p is string => typeof p === "string");
	}

	return null;
}
