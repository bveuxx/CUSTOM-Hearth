import { App, TFile } from "obsidian";
import { groupForFile } from "./filetypes";
import { QueryFilter, QueryHit } from "./query";

/** The community-plugin id Omnisearch registers itself under. */
export const OMNISEARCH_PLUGIN_ID = "omnisearch";

/** A single result from Omnisearch's public search API. Only the fields Hearth
 * uses are declared; Omnisearch returns a few more. */
interface OmnisearchResult {
	score: number;
	path: string;
	basename: string;
	/** The words that matched, lower-cased. */
	foundWords: string[];
	/** A short body snippet around the best match (may contain <mark> markup,
	 * which Hearth strips — it renders its own highlighting). */
	excerpt: string;
}

/** The slice of Omnisearch's public API Hearth calls. Exposed by the plugin at
 * `app.plugins.plugins.omnisearch.api` once Omnisearch is enabled. */
interface OmnisearchApi {
	search(query: string): Promise<OmnisearchResult[]>;
}

/** Reach Omnisearch's public API, or null when the plugin isn't installed,
 * isn't enabled, or is too old to expose one. */
export function getOmnisearchApi(app: App): OmnisearchApi | null {
	const plugin = app.plugins.plugins[OMNISEARCH_PLUGIN_ID] as
		| { api?: unknown }
		| undefined;
	const api = plugin?.api;
	if (api && typeof (api as OmnisearchApi).search === "function") {
		return api as OmnisearchApi;
	}
	return null;
}

/** Whether Omnisearch is enabled and its search API is reachable right now. */
export function isOmnisearchAvailable(app: App): boolean {
	return getOmnisearchApi(app) !== null;
}

/** Strip Omnisearch's `<mark>` markup out of an excerpt so it renders as plain
 * text (Hearth does its own highlighting) and collapse whitespace to one line. */
function cleanExcerpt(excerpt: string): string {
	return excerpt.replace(/<\/?mark>/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Run a vault search through Omnisearch and adapt its results to Hearth's
 * {@link QueryHit} shape. Resolves to an empty list when Omnisearch is
 * unavailable so the caller can fall back to the built-in engine.
 *
 * The active file-type filter (and folder/file toggles) is applied to the
 * returned notes so the filter chips keep working; Omnisearch only indexes
 * notes, so folder-only filters yield nothing.
 */
export async function searchWithOmnisearch(
	app: App,
	query: string,
	opts: { filter: QueryFilter; limit: number },
): Promise<QueryHit[]> {
	const api = getOmnisearchApi(app);
	if (!api) return [];

	let results: OmnisearchResult[];
	try {
		results = await api.search(query);
	} catch {
		return [];
	}

	const { filter } = opts;
	const hits: QueryHit[] = [];
	for (const result of results) {
		if (!filter.includeFiles) break;
		const file = app.vault.getAbstractFileByPath(result.path);
		if (!(file instanceof TFile)) continue;
		if (filter.groupId && groupForFile(file)?.id !== filter.groupId) continue;
		const excerpt = cleanExcerpt(result.excerpt);
		hits.push({
			file,
			score: result.score,
			matches: matchRanges(file.basename, result.foundWords),
			badge: excerpt ? { icon: "file-search", label: excerpt } : undefined,
		});
		if (hits.length >= opts.limit) break;
	}
	return hits;
}

/** Character ranges in `name` covering any of Omnisearch's matched words, so the
 * built-in result row can highlight the note title the same way name search
 * does. Returns undefined when nothing in the name matched. */
function matchRanges(name: string, foundWords: string[]): [number, number][] | undefined {
	const lower = name.toLowerCase();
	const ranges: [number, number][] = [];
	for (const word of foundWords) {
		const w = word.toLowerCase();
		if (!w) continue;
		let from = 0;
		for (;;) {
			const idx = lower.indexOf(w, from);
			if (idx < 0) break;
			ranges.push([idx, idx + w.length]);
			from = idx + w.length;
		}
	}
	if (ranges.length === 0) return undefined;
	// Sort and merge overlaps so <mark> spans never cross.
	ranges.sort((a, b) => a[0] - b[0]);
	const merged: [number, number][] = [ranges[0]];
	for (const [start, end] of ranges.slice(1)) {
		const last = merged[merged.length - 1];
		if (start <= last[1]) last[1] = Math.max(last[1], end);
		else merged.push([start, end]);
	}
	return merged;
}
