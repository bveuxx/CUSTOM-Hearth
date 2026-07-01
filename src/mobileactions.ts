import { setIcon } from "obsidian";
import type { HomeView } from "./view";

/**
 * The mobile action bar: a customizable row of buttons (New note, New
 * drawing, Record voice, Open daily note by default) shown under the search
 * bar and filters in Mobile mode, pinned to the bottom quarter of the screen.
 * Each button runs any Obsidian command, configurable in settings.
 */
export function renderMobileActionBar(view: HomeView, parent: HTMLElement): void {
	const buttons = view.plugin.settings.mobileActionButtons;
	if (buttons.length === 0) return;

	const bar = parent.createDiv("hearth-mobile-actions");
	for (const btn of buttons) {
		const el = bar.createEl("button", {
			cls: "hearth-mobile-action",
			attr: { "aria-label": btn.label || btn.commandId },
		});
		setIcon(el.createSpan("hearth-mobile-action-icon"), btn.icon || "circle");
		el.createSpan({ cls: "hearth-mobile-action-label", text: btn.label });
		el.addEventListener("click", () => view.plugin.runCommandOrNotice(btn.commandId));
	}
}
