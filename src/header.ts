import { Component, Platform, setIcon } from "obsidian";
import type { HomeView } from "./view";
import { SearchSection } from "./search";
import { HEARTH_ICON_ID } from "./icon";

/** Renders the title/logo, the search bar with the New-note button, and the
 * auto-detected filter row. In Mobile mode, the New-note button is left out
 * here — it moves into the mobile action bar rendered below (see
 * mobileactions.ts), along with the rest of that customizable button row. */
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
		const btn = searchWrap.createEl("button", {
			cls: "hearth-newnote",
			attr: { "aria-label": "Create new note" },
		});
		setIcon(btn.createSpan("hearth-newnote-icon"), "plus");
		btn.createSpan({ cls: "hearth-newnote-label", text: "New note" });
		btn.addEventListener("click", () => {
			void view.plugin.createNewNote();
		});
		void bar;
	}

	search.renderResultsAndFilters(searchCol, searchCol, component);
}
