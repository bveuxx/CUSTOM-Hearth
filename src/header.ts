import { Component, Platform, setIcon } from "obsidian";
import type { HomeView } from "./view";
import { SearchSection } from "./search";
import { HEARTH_ICON_ID } from "./icon";
import { t } from "./i18n";

/** The search engine used by the “Search online” half of the split pill.
 * DuckDuckGo's GET endpoint works without an API key and is privacy-friendly. */
const WEB_SEARCH_URL = "https://duckduckgo.com/?q=";

/** Renders the title/logo, the search bar with the New-note button, and the
 * auto-detected filter row. In Mobile mode, the New-note button is left out
 * here — it moves into the mobile action bar rendered below (see
 * mobileactions.ts), along with the rest of that customizable button row.
 *
 * The button beside the search bar has three modes (configurable in Settings →
 * Appearance → “New-note button”):
 *   - "split": a single joined pill split into “Search online” + “New note”
 *   - "newNote": just the New-note half
 *   - "searchOnline": just the Search-online half */
export function renderHeader(view: HomeView, container: HTMLElement, component: Component): void {
	const s = view.plugin.settings;
	const mobileOnly = Platform.isMobile && s.mobileSearchOnly;

	if (s.showTitle) {
		const titleRow = container.createDiv("hearth-title");
		const logo = s.logo.trim();
		// A custom emoji/text logo is shown verbatim; otherwise fall back to the
		// Hearth crystal icon as the brand mark.
		if (logo === "") {
			const logoEl = titleRow.createSpan({ cls: "hearth-logo hearth-logo-icon" });
			setIcon(logoEl, HEARTH_ICON_ID);
		} else {
			titleRow.createSpan({ cls: "hearth-logo", text: logo });
		}
		titleRow.createSpan({ cls: "hearth-title-text", text: s.title });
	}

	const search = new SearchSection(view);

	// Layout:
	//   searchWrap (flex row, align-items: flex-start)
	//     ├─ searchCol (flex:1) — the bar's width
	//     │     ├─ searchRow (the bar + (nothing else))
	//     │     └─ filter chips + results dropdown (matching the bar's width)
	//     └─ New-note button (beside the bar, top-aligned, flush)
	// The button is a sibling of the column (not inside the bar's row) so the
	// filters span only the bar's width; the button sits flush beside the bar,
	// not pushed down among the filter chips.
	const searchWrap = container.createDiv("hearth-search-wrap");
	const searchCol = searchWrap.createDiv("hearth-search-col");
	const searchRow = searchCol.createDiv("hearth-search");
	const bar = search.renderBar(searchRow);

	if (s.showNewNoteButton && !mobileOnly) {
		renderNewNotePill(searchWrap, bar, view, s.newNoteButtonMode);
	}

	search.renderResultsAndFilters(searchCol, searchCol, component);
}

/** Render the pill beside the search bar according to `mode`. */
function renderNewNotePill(
	wrap: HTMLElement,
	bar: HTMLElement,
	view: HomeView,
	mode: "split" | "newNote" | "searchOnline",
): void {
	if (mode === "newNote") {
		wrap.append(createNewNoteButton(view));
		return;
	}
	if (mode === "searchOnline") {
		wrap.append(createSearchOnlineButton(bar));
		return;
	}

	// Split mode: two joined halves styled as one pill.
	const pill = wrap.createEl("div", { cls: "hearth-newnote-pill" });
	pill.append(createSearchOnlineButton(bar, true));
	pill.append(createNewNoteButton(view, true));
}

/** Read the current query out of the search bar's input element. */
function getSearchQuery(bar: HTMLElement): string {
	return bar.querySelector<HTMLInputElement>(".hearth-search-input")?.value.trim() ?? "";
}

/** Open a web search for the current query (or the engine's home page when
 * empty) in the user's default browser. */
function searchOnline(bar: HTMLElement): void {
	const q = getSearchQuery(bar);
	const url = q ? WEB_SEARCH_URL + encodeURIComponent(q) : WEB_SEARCH_URL.replace("?q=", "");
	try {
		window.open(url, "_blank");
	} catch {
		// Pop-up blocked or unavailable — fall back to Obsidian's window opener.
		window.open(url, "_blank", "noopener");
	}
}

/** The New-note half of the pill. `joined` controls whether it shares the
 * pill's joined look (no outer rounding on the inner edge) or stands alone. */
function createNewNoteButton(view: HomeView, joined = false): HTMLElement {
	const btn = document.createElement("button");
	btn.className = "hearth-newnote" + (joined ? " hearth-newnote-joined" : "");
	btn.setAttribute("aria-label", t().header.newNoteAria);
	setIcon(btn.createSpan("hearth-newnote-icon"), "plus");
	btn.createSpan({ cls: "hearth-newnote-label", text: t().header.newNote });
	btn.addEventListener("click", () => {
		void view.plugin.createNewNote();
	});
	return btn;
}

/** The Search-online half of the pill. */
function createSearchOnlineButton(bar: HTMLElement, joined = false): HTMLElement {
	const btn = document.createElement("button");
	btn.className = "hearth-newnote hearth-newnote-search" + (joined ? " hearth-newnote-joined" : "");
	btn.setAttribute("aria-label", t().header.searchOnlineAria);
	setIcon(btn.createSpan("hearth-newnote-icon"), "globe");
	btn.createSpan({ cls: "hearth-newnote-label", text: t().header.searchOnline });
	btn.addEventListener("click", () => searchOnline(bar));
	return btn;
}
