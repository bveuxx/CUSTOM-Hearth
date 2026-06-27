import { setIcon } from "obsidian";
import type { HomeView } from "./view";
import { SearchSection } from "./search";

/** Renders the title/logo, the search bar with the New-note button, and the
 * auto-detected filter row. */
export function renderHeader(view: HomeView, container: HTMLElement): void {
	const s = view.plugin.settings;

	if (s.showTitle) {
		const titleRow = container.createDiv("hearth-title");
		titleRow.createSpan({ cls: "hearth-title-text", text: s.title });
		if (s.logo) titleRow.createSpan({ cls: "hearth-logo", text: s.logo });
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
