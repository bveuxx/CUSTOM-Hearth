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

	// Layout: the New-note button sits beside a search column. The search column
	// holds the bar (full width of the column), the filter chips (matching the
	// bar's width exactly), and the results dropdown (overlaying from the
	// column). The column is flex:1 so the bar keeps its full width; the button
	// takes only what it needs. Click-outside dismissal is bound to the column,
	// so clicking the title, the New-note button, or anywhere off the field
	// closes the dropdown.
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
