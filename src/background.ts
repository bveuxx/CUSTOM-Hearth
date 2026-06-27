import { TFile } from "obsidian";
import type { HomeView } from "./view";

/**
 * Apply the optional, customizable background as a separate layer behind the
 * content so opacity/blur don't affect the foreground.
 */
export function applyBackground(view: HomeView, root: HTMLElement): void {
	const s = view.plugin.settings;
	if (s.backgroundKind === "none" || !s.backgroundValue) return;

	const layer = root.createDiv("hearth-bg");
	layer.style.opacity = String(s.backgroundOpacity);
	if (s.backgroundBlur > 0) layer.style.filter = `blur(${s.backgroundBlur}px)`;

	if (s.backgroundKind === "color") {
		layer.style.background = s.backgroundValue;
		return;
	}

	let url: string | null = null;
	if (s.backgroundKind === "url") {
		url = s.backgroundValue;
	} else if (s.backgroundKind === "image") {
		const file = view.app.vault.getAbstractFileByPath(s.backgroundValue);
		if (file instanceof TFile) url = view.app.vault.getResourcePath(file);
	}

	if (url) {
		// Escape characters that would break out of the CSS url("...") literal.
		const safe = url.replace(/["\\]/g, "\\$&");
		layer.style.backgroundImage = `url("${safe}")`;
		layer.style.backgroundSize = "cover";
		layer.style.backgroundPosition = "center";
	}
}
