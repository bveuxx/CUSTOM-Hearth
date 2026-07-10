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
 * previous stable, 1.6.7). Future stable/beta releases prepend their own entry.
 */
export const CHANGELOG: ChangelogEntry[] = [
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
