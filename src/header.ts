import { setIcon } from "obsidian";
import type { HomeView } from "./view";
import { SearchSection } from "./search";
import { HEARTH_ICON_ID } from "./icon";

/** Renders the title/logo, the search bar with the New-note button, and the
 * auto-detected filter row. */
export function renderHeader(view: HomeView, container: HTMLElement): void {
	const s = view.plugin.settings;

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

	const searchRow = container.createDiv("hearth-search");
	const bar = search.renderBar(searchRow);

	if (s.showNewNoteButton) {
		const btn = searchRow.createEl("button", {
			cls: "hearth-newnote",
			attr: { "aria-label": "Create new note" },
		});
		setIcon(btn.createSpan("hearth-newnote-icon"), "plus");
		btn.createSpan({ cls: "hearth-newnote-label", text: "New note" });
		btn.addEventListener("click", () => view.plugin.createNewNote());
		// Keep the New-note button aligned with the search bar width-wise.
		void bar;
	}

	// Results dropdown + filter chips render under the search row.
	search.renderResultsAndFilters(container);
}
