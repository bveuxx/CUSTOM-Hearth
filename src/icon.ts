/**
 * Hearth's brand mark. The image lives in assets/icon.png and is inlined as a
 * data URI by esbuild (see the dataurl loader in esbuild.config.mjs), then
 * wrapped in an <image> element so it can be registered with addIcon and used
 * as the ribbon/tab icon and the header logo.
 *
 * The content is sized to Obsidian's 0 0 100 100 icon viewBox.
 */
import iconUrl from "../assets/icon.png";

export const HEARTH_ICON_ID = "hearth-crystal";

export const HEARTH_ICON_SVG = `<image href="${iconUrl}" x="0" y="0" width="100" height="100" preserveAspectRatio="xMidYMid meet"/>`;
