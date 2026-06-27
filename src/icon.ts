/**
 * Hearth's brand mark — a faceted purple Obsidian-style crystal, authored as
 * an SVG so it ships inside the bundle (no separate image asset needed) and can
 * be used both as the ribbon/tab icon (via addIcon) and as the header logo.
 *
 * The content is sized to Obsidian's 0 0 100 100 icon viewBox.
 */
export const HEARTH_ICON_ID = "hearth-crystal";

export const HEARTH_ICON_SVG = `
<defs>
	<linearGradient id="hearthLight" x1="0" y1="0" x2="1" y2="1">
		<stop offset="0" stop-color="#d8ccf9"/>
		<stop offset="1" stop-color="#b6a1f1"/>
	</linearGradient>
	<linearGradient id="hearthMid" x1="0" y1="0" x2="1" y2="1">
		<stop offset="0" stop-color="#9c7ef2"/>
		<stop offset="1" stop-color="#7c5cff"/>
	</linearGradient>
	<linearGradient id="hearthMidDark" x1="0" y1="0" x2="1" y2="1">
		<stop offset="0" stop-color="#7c5cff"/>
		<stop offset="1" stop-color="#5e44c8"/>
	</linearGradient>
	<linearGradient id="hearthDark" x1="0" y1="0" x2="1" y2="1">
		<stop offset="0" stop-color="#6a4fcf"/>
		<stop offset="1" stop-color="#4a329f"/>
	</linearGradient>
</defs>
<path d="M32 8 L44 40 L48 52 L14 50 Z" fill="url(#hearthLight)"/>
<path d="M32 8 L56 12 L86 50 L48 52 L44 40 Z" fill="url(#hearthMid)"/>
<path d="M14 50 L48 52 L40 88 Z" fill="url(#hearthDark)"/>
<path d="M48 52 L86 50 L60 92 L40 88 Z" fill="url(#hearthMidDark)"/>
`;
