import { App, Modal, Setting } from "obsidian";
import { t } from "./i18n";
import type HearthPlugin from "./main";

/** One dated block in the changelog: a version, an optional one-line TL;DR, and
 * grouped lists of new features and fixes (either list may be empty). */
export interface ChangelogEntry {
	version: string;
	tldr?: string;
	features: string[];
	fixes: string[];
}

/**
 * The running changelog, **newest entry first**. To cut a release, prepend a
 * new entry here — older entries stay untouched, so this is a permanent,
 * accumulating log. The "What's new" dialog shows only the entries newer than
 * the version the user last saw (see {@link entriesSince}).
 *
 * Invariant: `CHANGELOG[0].version` must equal the `manifest.json` version of
 * the release being cut, so the top entry is what a freshly-updated user sees.
 *
 * The 1.7.0 entry aggregates the whole 1.6.8 beta series (everything since the
 * previous stable, 1.6.7), and the 1.8.0 entry aggregates the whole 1.7.1 beta
 * series (everything since 1.7.0). Future stable/beta releases prepend their
 * own entry.
 */
export const CHANGELOG: ChangelogEntry[] = [
	{
		version: "1.8.1.4-beta",
		tldr:
			"Mobile fix: exporting a layout or settings now saves the JSON file to " +
			"your vault's root folder, since mobile can't trigger a file download.",
		features: [],
		fixes: [
			"Mobile: Export layout / Export settings now write the JSON file to your " +
				"vault's root folder (e.g. hearth-layout.json), because mobile Obsidian " +
				"can't trigger a browser download — the button did nothing there before. " +
				"The export button shows a tooltip noting where the file lands. Desktop " +
				"still downloads the file as usual.",
		],
	},
	{
		version: "1.8.1.3-beta",
		tldr:
			"Layout and settings export/import now use JSON files directly — export " +
			"downloads a file and import opens a file picker, instead of the clipboard.",
		features: [
			"Export / import as files: the Backup buttons now save and load JSON files " +
				"directly. Export layout and Export settings download a " +
				"hearth-layout.json / hearth-settings.json file, and Import layout / " +
				"Import settings open a file picker — no more copying to and pasting from " +
				"the clipboard. The file format is unchanged, so files shared before this " +
				"release still import.",
		],
		fixes: [],
	},
	{
		version: "1.8.1.2-beta",
		tldr:
			"Back up every Hearth setting — not just the layout — as JSON, and a fix " +
			"so importing a layout no longer quietly drops newer cards and options.",
		features: [
			"Export / import settings: a new pair of buttons in Backup (Import / " +
				"export) that copy every configurable Hearth setting to the clipboard as " +
				"JSON and restore them on another vault — the full dashboard layout plus " +
				"header, background, behaviour, appearance, search filters and the " +
				"TaskNotes field mappings. It's a superset of the existing layout export " +
				"(which is unchanged), so a settings backup also imports cleanly through " +
				"Import layout. Internal bookkeeping (like the \"What's new\" state) is " +
				"left out so a shared backup can't rewind another vault.",
		],
		fixes: [
			"Import layout no longer loses parts of a layout. Dataview and Plugin-view " +
				"(leaf) cards were dropped entirely on import, and several card options — " +
				"an embed's second view and \"hide base header\", and most Tasks-card " +
				"settings (Kanban source and file, sort rules, filters, per-column sort, " +
				"custom checkbox states, convert-to-note options and more) — silently " +
				"vanished, as did per-dashboard card opacity/blur overrides. Import now " +
				"carries every field the layout holds, so a shared or synced layout " +
				"round-trips faithfully.",
		],
	},
	{
		version: "1.8.1.1-beta",
		tldr:
			"A privacy toggle to switch off Hearth's only network request, plus a " +
			"mobile fix so the search autocomplete no longer hides behind the " +
			"on-screen keyboard.",
		features: [
			"Disable external calls: a new Behaviour → Privacy & network toggle that " +
				"blocks the only outbound request Hearth makes — the calculator's " +
				"currency-rate lookup (the free, key-less, ECB-backed Frankfurter API). " +
				"With it on, currency conversions report that rates are unavailable " +
				"instead of reaching out to the internet.",
		],
		fixes: [
			"Mobile: the search autocomplete results no longer hide behind the " +
				"on-screen keyboard. The dropdown is now capped to the space actually " +
				"visible above the keyboard and re-measured as the keyboard animates, " +
				"and the scroll area is constrained the moment the field is focused " +
				"(not only when a viewport-size heuristic fires), so results stay " +
				"reachable on devices where that heuristic misfired.",
		],
	},
	{
		version: "1.8.0",
		tldr:
			"A big cards-and-appearance release aggregating the whole 1.7.1 beta " +
			"series. Two new cards: a Dataview card that renders DQL/DataviewJS " +
			"through Dataview's own renderers, and a beta Plugin view card that hosts " +
			"any plugin's (or a core) side-panel view right on the dashboard. Cards " +
			"gain frosted glass (backdrop blur) — now the default look — the settings " +
			"tab is reorganized into a category ribbon with an About tab, embed cards " +
			"can carry a second view and hide a base's header, and the Tasks card " +
			"grows a list filter and a custom multi-rule sort.",
		features: [
			"Dataview card (requires the Dataview plugin): a card that runs a Dataview " +
				"query and renders the results through Dataview's own renderers, so " +
				"tables, lists and task lists look exactly as they do in a note and " +
				"refresh live. Paste a DQL query (TABLE / LIST / TASK) or switch to " +
				"DataviewJS; links in the results are clickable, and table columns " +
				"auto-fit their content (scrolling sideways when wider than the card) " +
				"with a drag-to-resize handle on each column header that's remembered " +
				"per card. Only offered in Add card when Dataview is installed.",
			"Plugin view card (beta): a new card kind that hosts another plugin's — or " +
				"a core — registered side-panel view (calendar, outline, tag pane, " +
				"kanban…) inside a dashboard card. Pick from the views your enabled " +
				"plugins provide; the card hosts a detached workspace leaf, so it never " +
				"appears in your saved layout or disturbs other panes, cleans itself up " +
				"on redraw and dashboard close, honours card opacity/blur, and shows a " +
				"friendly prompt when the view's plugin is disabled. Some views expect a " +
				"real sidebar and may size oddly — hence beta.",
			"Card blur (frosted glass): a backdrop blur behind translucent cards, set " +
				"at every level card opacity already had — a global default (Settings → " +
				"Dashboard), a per-dashboard override, and a per-card slider in the " +
				"card's Colors section. Frosted-glass cards are now the default look for " +
				"fresh installs (card opacity 0.50, card blur 7, over a lighter " +
				"background blur); existing vaults keep their settings until a slider is " +
				"reset (↺). Merged cards blur on one shared layer, so a group of " +
				"touching cards reads as a single seamless sheet with no seam at the join.",
			"Settings, reorganized: the plugin settings tab now opens on a category " +
				"ribbon (Appearance · Search · Dashboard · Behaviour · Integrations · " +
				"Backup · About) — click one to see just that group's sections instead " +
				"of scrolling one long list — with settings regrouped under the right " +
				"heading, every setting carrying a description, and more fields carrying " +
				"a reset (↺) button. A new About tab holds links to the GitHub repo and " +
				"issue tracker, a low-key Ko-fi tip button, and the running version.",
			"Embed second view: give an embed card a second file to embed (with its own " +
				"zoom and editable options) and it grows a switcher to flip between the " +
				"two — in the header when the card has a title, or as a floating, " +
				"hover-only control when it's headerless.",
			"Hide base header: a per-card toggle (for embed cards showing a .base file) " +
				"that hides the Bases view's own toolbar so the card shows only the " +
				"results.",
			"Tasks list filter: a new Filter control opens a modal to narrow the list " +
				"by status, priority, due date or text, with quick presets (Overdue, Due " +
				"today, Due this week, High priority, No date).",
			"Custom task sort: the list sort control offers “Custom sort…”, a modal to " +
				"build an ordered list of rules (each a field + direction) applied in " +
				"sequence — the first is the primary sort and each next one breaks ties. " +
				"On a Kanban board it's the fallback for any column without its own sort.",
			"TaskNotes “complete” statuses: choose which status values count as done " +
				"(one per line), so e.g. both “done” and “canceled” are treated as " +
				"complete.",
		],
		fixes: [
			"Embed zoom now uses the CSS `zoom` property (reflow) instead of " +
				"`transform: scale()`, so a zoomed embed fits its card exactly instead of " +
				"leaving an empty strip below it or clipping its bottom.",
			"“Hide base header” hides the whole Bases header wrapper, so no empty gap is " +
				"left where the toolbar was.",
			"The Tasks card's list-mode task-count header no longer renders broken.",
			"The list-header Sort and Filter controls reveal on card hover (like the " +
				"add-task button), so the header stays uncluttered — a set filter or a " +
				"non-default sort stays visible as an indicator.",
		],
	},
	{
		version: "1.7.1.14-beta",
		tldr:
			"Seamless frosted glass. Cards that touch to form one tile no longer show " +
			"a faint seam along the join where their blur meets — a merged group now " +
			"reads as a single sheet of frosted glass.",
		features: [],
		fixes: [
			"Fixed a visible seam in the frosted-glass (card blur) effect between " +
				"connected cards. Each card used to blur the background on its own, so " +
				"the blur was clamped independently on either side of a shared edge and " +
				"left a hairline where two cards met. The blur is now drawn once on a " +
				"shared layer behind a group of touching cards, so merged cards blend " +
				"into one seamless surface while the gaps between separate cards stay " +
				"crisp.",
		],
	},
	{
		version: "1.7.1.13-beta",
		tldr:
			"Settings, reorganized. The plugin settings tab now opens on a category " +
			"ribbon (Appearance · Search · Dashboard · Behaviour · Integrations · " +
			"Backup · About) with each group tidied into its own sections, every " +
			"setting carries a description, and a new About tab holds GitHub, " +
			"Report-issue and Ko-fi links.",
		features: [
			"Settings ribbon: the plugin settings tab is now split into category tabs " +
				"pinned at the top — click one to see just that group's sections, instead " +
				"of scrolling one long list. Settings were regrouped so each lives under " +
				"the right heading (search options with the search bar, mobile mode with " +
				"behaviour, card opacity/blur under Dashboard, and so on).",
			"About tab: quick links to the GitHub repository and the issue tracker, plus " +
				"a low-key Ko-fi “Tip me” button and the running version.",
		],
		fixes: [
			"Every setting now has a description, and more fields carry a reset (↺) " +
				"button back to their default — including the logo and background value in " +
				"plugin settings and the recent-files count, query max-results, max-tasks, " +
				"web auto-refresh and card size in card settings.",
		],
	},
	{
		version: "1.7.1.12-beta",
		tldr:
			"New default look: frosted-glass cards out of the box (card opacity 0.50, " +
			"card blur 7) over a lighter background blur (2). Existing vaults keep " +
			"their current settings — reset a slider (↺) to adopt the new default.",
		features: [],
		fixes: [
			"Refreshed the default appearance: card opacity 0.50 and card blur 7 " +
				"(frosted glass on by default), and background blur softened from 6 to 2 " +
				"(background opacity unchanged at 0.35). Only affects fresh installs and " +
				"sliders reset to default — your existing values are untouched. The " +
				"global sliders for both card opacity and card blur live in " +
				"Settings → Dashboard.",
		],
	},
	{
		version: "1.7.1.11-beta",
		tldr:
			"Frosted glass: cards can now blur what's behind them. A global “Card " +
			"blur” default (Settings → Dashboard), a per-dashboard override, and a " +
			"per-card blur in each card's Colors section — all pair with card opacity.",
		features: [
			"Card blur (frosted glass): a backdrop blur behind translucent cards, at " +
				"every level that card opacity already had — a global default in " +
				"Settings, a per-dashboard override, and a per-card slider in the card's " +
				"Colors section. It shows when card opacity is below 100% and blurs only " +
				"the dashboard behind the card, leaving the card's content sharp. Off by " +
				"default, so existing boards are unchanged; only cards with blur > 0 take " +
				"on the effect.",
		],
		fixes: [],
	},
	{
		version: "1.7.1.10-beta",
		tldr:
			"Plugin view opacity, take two: the previous fix only cleared the outer " +
			"chrome, so the view's body stayed filled. Now the card's translucency " +
			"shows through the whole hosted view.",
		features: [],
		fixes: [
			"Plugin view card: the hosted view's body no longer stays opaque when the " +
				"card opacity is lowered. The base-surface background variables are now " +
				"neutralised within the card, so whichever element draws the pane " +
				"background (including side-panel views that use --background-secondary) " +
				"shows the card surface through it. Accent surfaces — hover, selection, " +
				"inputs — keep their look.",
		],
	},
	{
		version: "1.7.1.9-beta",
		tldr:
			"Plugin view cards now honour card opacity: the hosted view's own solid " +
			"background no longer fills the card, so it matches every other card's " +
			"translucent surface.",
		features: [],
		fixes: [
			"Plugin view card: cleared the hosted view's opaque leaf/content/header " +
				"backgrounds so the card's surface (and its opacity) shows through, " +
				"instead of the card always looking fully filled.",
		],
	},
	{
		version: "1.7.1.8-beta",
		tldr:
			"New “Plugin view” card (beta): host another plugin's — or a core — " +
			"side-panel view (calendar, outline, tag pane, kanban…) right on the " +
			"dashboard. Offered in Add card, with the view chosen in card settings.",
		features: [
			"Plugin view card (beta): a new card kind that embeds a registered " +
				"side-panel view inside a dashboard card. Pick from the views your " +
				"enabled plugins (and Obsidian's core panes) provide; the card hosts a " +
				"detached workspace leaf, so it never appears in your saved layout or " +
				"disturbs other panes. Some views expect a real sidebar and may size " +
				"oddly — hence beta. It cleans itself up on redraw and when the " +
				"dashboard closes, and shows a friendly prompt when the view's plugin " +
				"is disabled.",
		],
		fixes: [],
	},
	{
		version: "1.7.1.7-beta",
		tldr:
			"Embed zoom now reflows instead of just visually scaling, so a zoomed " +
			"embed no longer leaves an empty strip below it (or clips its bottom) — " +
			"most noticeable on full views like an embedded base.",
		features: [],
		fixes: [
			"Embed zoom uses the CSS `zoom` property instead of `transform: scale()`, " +
				"so the content reflows to its scaled size and the card fits it exactly. " +
				"Previously the scaled element kept its unscaled height, leaving an empty " +
				"footer under zoomed-out content and cutting off zoomed-in content.",
		],
	},
	{
		version: "1.7.1.6-beta",
		tldr:
			"Fix for “Hide base header”: it now hides the whole Bases header wrapper " +
			"so no empty strip is left where the toolbar was.",
		features: [],
		fixes: [
			"“Hide base header” no longer leaves an empty gap at the top of the card — " +
				"it hides the Bases header container (.bases-header), not just the toolbar " +
				"inside it, so the reserved space collapses and the results sit flush.",
		],
	},
	{
		version: "1.7.1.5-beta",
		tldr:
			"Embed cards that show a .base file gain a “Hide base header” option that " +
			"hides the Bases view's own toolbar (view switcher and filter/property " +
			"controls) so the card shows only the results.",
		features: [
			"Hide base header: a per-card toggle (shown for embed cards whose file — " +
				"either view — is a .base) that hides the embedded Bases view's toolbar, " +
				"leaving just the table/results on the dashboard.",
		],
		fixes: [],
	},
	{
		version: "1.7.1.4-beta",
		tldr:
			"Two additions: embed cards can carry a second view with a switcher to " +
			"flip between them, and the tasks list gains a custom multi-rule sort " +
			"(like the filter) for ordering by several fields at once.",
		features: [
			"Embed second view: give an embed card a second file to embed (with its " +
				"own zoom and editable options) and it grows a switcher to flip between " +
				"the two views. When the card has a title the switcher sits in its header; " +
				"when it's untitled (headerless) the switcher floats in the top-right " +
				"corner and reveals on hover. The chosen view refreshes live on its file's " +
				"changes just like the primary one.",
			"Custom task sort: the list sort control now offers “Custom sort…”, opening " +
				"a modal to build an ordered list of rules — each a field (due, scheduled, " +
				"priority, created, alphabetical or status) plus a direction — applied in " +
				"sequence so the first is the primary sort and each next one breaks ties. " +
				"A custom sort supersedes the single-key choice and, on a Kanban board, is " +
				"the fallback for any column without its own sort override (mirroring the " +
				"list filter).",
		],
		fixes: [],
	},
	{
		version: "1.7.1.3-beta",
		tldr:
			"Dataview card table polish: table results now auto-fit their columns to " +
			"content (and scroll sideways when wider than the card) instead of being " +
			"stretched to the card width, and you can drag a column header's edge to " +
			"set a manual width that's remembered per card.",
		features: [
			"Dataview tables: drag a column header's right edge to resize it. The first " +
				"drag freezes the auto-fitted widths into a fixed layout, and the widths " +
				"are remembered per card and re-applied whenever Dataview refreshes the " +
				"table. Change the query's columns and the manual layout resets to auto-fit.",
		],
		fixes: [
			"Dataview tables no longer stretch to fill the card width (which squashed or " +
				"inflated columns unevenly) — columns auto-fit their content and a wide " +
				"table scrolls horizontally inside the card, like a table in a note.",
		],
	},
	{
		version: "1.7.1.2-beta",
		tldr:
			"A new Dataview card. When the Dataview community plugin is installed, " +
			"the “Add card” menu gains a Dataview card that runs a Dataview query " +
			"(DQL) or DataviewJS and renders the results — tables, lists, task lists — " +
			"through Dataview's own renderers, so they look exactly as they do in a " +
			"note and refresh live as the vault changes.",
		features: [
			"Dataview card: add a card that renders a Dataview query. It's only offered " +
				"by the Add-card menu when Dataview is installed and enabled. Paste a " +
				"query (TABLE / LIST / TASK, or switch to DataviewJS) in the card's " +
				"settings and Hearth renders it with Dataview's own renderers — tables, " +
				"lists and task lists look native and update live as notes change. Links " +
				"in the results are clickable. Queries run without a “current note”, so " +
				"global queries work fully; this.file-relative queries have no file to " +
				"resolve to.",
		],
		fixes: [],
	},
	{
		version: "1.7.1.1-beta",
		tldr:
			"Tasks-card list polish. The TaskNotes source can now treat several " +
			"statuses (e.g. done and canceled) as complete, a new Filter control " +
			"narrows the list by status, priority, due date or text (with one-click " +
			"presets), and the sort and filter controls now reveal on hover like the " +
			"add-task button.",
		features: [
			"TaskNotes “complete” statuses: choose which status values count as done " +
				"(one per line in the card's settings) so, e.g., both “done” and " +
				"“canceled” are treated as complete — hidden unless “Show completed” is on. " +
				"Empty keeps the single done value from Settings → Hearth.",
			"List filter: a new Filter control (styled like Sort) opens a modal to narrow " +
				"the list by status, priority, due date or text, with quick presets " +
				"(Overdue, Due today, Due this week, High priority, No date). The control " +
				"shows active while a filter is set.",
		],
		fixes: [
			"The list-header Sort and Filter controls now reveal on card hover, like the " +
				"add-task button, so the header stays uncluttered — a set filter or a " +
				"non-default sort stays visible as an indicator.",
		],
	},
	{
		version: "1.7.0",
		tldr:
			"A major Tasks-card release. Hearth now reads and edits Kanban plugin " +
			"boards, understands the full obsidian-tasks metadata (dates, 5-level " +
			"priority, recurrence), and gives every card a quick-view popover for " +
			"editing in place. You can define custom checkbox task states, convert " +
			"cards into notes (or create them as notes outright), point the search bar " +
			"at Omnisearch, and a new “What's new” dialog surfaces release notes after " +
			"each update.",
		features: [
			"Kanban plugin boards: a Tasks card can read a Kanban board note — each " +
				"heading becomes a column and each checkbox a card. Show it as a list or a " +
				"drag-and-drop board that rewrites the note in Kanban's own format.",
			"Full obsidian-tasks metadata: start (🛫), scheduled (⏳), due (📅) and done " +
				"(✅) dates, a 5-level priority (🔺⏫🔼🔽⏬) and recurrence (🔁), shown as " +
				"compact card indicators with a right-click editor and add-card pickers — " +
				"read from Kanban cards and plain Markdown checkboxes alike.",
			"Custom checkbox task states: define your own “[symbol] Label” states for the " +
				"Markdown-checkbox source (defaults To do / In progress / Done); each becomes " +
				"a draggable board column that writes its own checkbox symbol.",
			"Quick view: clicking a checkbox task or Kanban card opens a compact popover — " +
				"metadata and description editable in place, with buttons to open the full " +
				"note or delete the task (toggle per card, on by default).",
			"Convert to note: right-click a card to turn it into its own linked note, " +
				"optionally seeded from a template ({{title}}/{{date}}/{{time}}) and with its " +
				"metadata scraped into frontmatter and its description moved into the note; " +
				"new cards can also be created as notes outright.",
			"Optional Omnisearch engine: point the search bar at the Omnisearch community " +
				"plugin when it's installed, with a graceful fall back to Hearth's built-in " +
				"vault search.",
			"Per-column sort: the sort control lives on each Kanban column so columns sort " +
				"independently; every list and board also gets an always-visible sort " +
				"(Smart / Due / Priority / Created / Alphabetical, reversible) that persists.",
			"Board editing niceties: mark any column a “done” column (cards auto-complete " +
				"when dropped there), rename a column by double-clicking its title, cards " +
				"render clickable [[wikilinks]] and Markdown links, carry a plain-text " +
				"description, and can be deleted from the right-click menu.",
			"Editable converted cards: a card linked to a note keeps showing its dates & " +
				"priority (read back from frontmatter) and its metadata and description can be " +
				"edited straight from the quick view.",
			"Scroll-mode boards grow while you drag a card down, so you can drop past the " +
				"current bottom without fighting the scroll.",
			"A “What's new” dialog surfaces release notes after an update, backed by a " +
				"continuous, accumulating changelog that shows only what changed since the " +
				"version you last saw (never on a fresh install).",
		],
		fixes: [
			"All five priorities now use distinct colours, so highest/lowest read apart " +
				"from high/low.",
			"The repeat picker is a deterministic dropdown + interval (no free text), and a " +
				"recurrence and fixed dates are mutually exclusive; a recurring card is " +
				"anchored by its scheduled date.",
			"Recurring checkbox / Kanban tasks complete per-occurrence like TaskNotes: " +
				"checking stamps today's ✅ and rolls to the next occurrence instead of " +
				"retiring the task.",
			"Scraping a card's metadata to frontmatter no longer hides its dates & priority " +
				"on the board.",
			"Empty checkboxes (“- [ ]” with no text) are ignored, the done-column toggle " +
				"stays hover-only, and “show completed” lists completed tasks below the open " +
				"ones instead of crowding them out.",
		],
	},
];

/**
 * Entries strictly newer than {@link seen}, in newest-first order. Uses each
 * entry's position in {@link CHANGELOG} (which is hand-ordered newest-first)
 * rather than parsing the 4-part `x.y.z.n-beta` version scheme. If the seen
 * version isn't in the log (a much older build, or none recorded), the whole
 * log is returned so nothing is silently withheld.
 */
export function entriesSince(seen: string): ChangelogEntry[] {
	const idx = CHANGELOG.findIndex((e) => e.version === seen);
	return idx === -1 ? CHANGELOG.slice() : CHANGELOG.slice(0, idx);
}

/**
 * The "What's new" dialog: one block per release (newest first), each a TL;DR
 * followed by grouped lists of new features and fixes. Purely informational.
 */
export class WhatsNewModal extends Modal {
	private entries: ChangelogEntry[];

	constructor(app: App, entries: ChangelogEntry[]) {
		super(app);
		this.entries = entries;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("hearth-whatsnew-modal");
		this.titleEl.setText(t().whatsNew.title);

		contentEl.createEl("p", {
			cls: "hearth-whatsnew-intro",
			text: t().whatsNew.intro,
		});

		for (const entry of this.entries) this.renderEntry(entry);

		contentEl.createEl("p", {
			cls: "hearth-whatsnew-footer",
			text: t().whatsNew.footer,
		});

		new Setting(contentEl).addButton((b) =>
			b
				.setButtonText(t().whatsNew.close)
				.setCta()
				.onClick(() => this.close()),
		);
	}

	private renderEntry(entry: ChangelogEntry): void {
		const wrap = this.contentEl.createDiv({ cls: "hearth-whatsnew-entry" });
		wrap.createEl("h3", { cls: "hearth-whatsnew-version", text: entry.version });

		if (entry.tldr) {
			const tldr = wrap.createDiv({ cls: "hearth-whatsnew-tldr" });
			tldr.createEl("h4", { text: t().whatsNew.tldr });
			tldr.createEl("p", { text: entry.tldr });
		}

		this.section(wrap, t().whatsNew.features, entry.features);
		this.section(wrap, t().whatsNew.fixes, entry.fixes);
	}

	private section(parent: HTMLElement, heading: string, items: string[]): void {
		if (items.length === 0) return;
		const sec = parent.createDiv({ cls: "hearth-whatsnew-section" });
		sec.createEl("h4", { text: heading });
		const list = sec.createEl("ul");
		for (const item of items) list.createEl("li", { text: item });
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/**
 * Show the "What's new" dialog once per version bump, listing only the entries
 * newer than the version the user last saw. A genuinely fresh install is seeded
 * silently so first-time users aren't greeted by a changelog. Any other version
 * change — including an existing vault upgrading into the first build that ships
 * this feature, where {@link HomeSettings.lastSeenVersion} is still empty — pops
 * the dialog and records the new version so it won't show again until the next
 * update.
 */
export async function maybeShowWhatsNew(plugin: HearthPlugin): Promise<void> {
	const current = plugin.manifest.version;
	const seen = plugin.settings.lastSeenVersion;

	if (seen === current) return;

	const entries = entriesSince(seen);
	plugin.settings.lastSeenVersion = current;
	await plugin.saveData(plugin.settings);

	// First-ever run: record the version but don't greet a brand-new user with a
	// changelog for a build they never ran the predecessor of.
	if (plugin.isFirstRun || entries.length === 0) return;
	new WhatsNewModal(plugin.app, entries).open();
}
