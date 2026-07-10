import { App, Modal, Setting } from "obsidian";
import { t } from "./i18n";
import type HearthPlugin from "./main";

/**
 * Release notes shown by the "What's new" dialog. This is the running summary
 * of everything that landed in the 1.6.8 beta series (on top of the last
 * stable release, 1.6.7) — the Tasks-card overhaul plus the search and board
 * refinements around it. Keep it in sync with the README "Shipped" section
 * when cutting a release.
 */
export const RELEASE_NOTES: {
	tldr: string;
	features: string[];
	fixes: string[];
} = {
	tldr:
		"A big Tasks-card release. Hearth now reads and edits Kanban plugin boards, " +
		"understands the full obsidian-tasks metadata (dates, 5-level priority, " +
		"recurrence), and gives every card a quick-view popover for editing in place. " +
		"You can define custom checkbox task states, convert cards into notes (or " +
		"create them as notes outright), and the search bar can now be powered by " +
		"Omnisearch.",
	features: [
		"Kanban plugin boards: a Tasks card can read a Kanban board note — each " +
			"heading becomes a column and each checkbox a card. Show it as a list or a " +
			"drag-and-drop board that rewrites the note in Kanban's own format.",
		"Full obsidian-tasks metadata: start (🛫), scheduled (⏳), due (📅) and done " +
			"(✅) dates, a 5-level priority (🔺⏫🔼🔽⏬) and recurrence (🔁), shown as " +
			"compact card indicators with a right-click editor and add-card pickers.",
		"Custom checkbox task states: define your own “[symbol] Label” states for the " +
			"Markdown-checkbox source (defaults To do / In progress / Done); each becomes " +
			"a draggable board column that writes its own checkbox symbol.",
		"Quick view: clicking a checkbox task or Kanban card opens a compact popover — " +
			"metadata and description editable in place, with buttons to open the full " +
			"note or delete the task (toggle per card, on by default).",
		"Convert to note: right-click a card to turn it into its own linked note, " +
			"optionally seeded from a template ({{title}}/{{date}}/{{time}}) and with its " +
			"metadata scraped into frontmatter and its description moved into the note.",
		"New tasks as notes: an optional toggle so adding a card creates it as its own " +
			"note (a link on the board) right away instead of an inline checkbox — with a " +
			"template preview in the add form.",
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
		"Scroll-mode boards now grow while you drag a card down, so you can drop past " +
			"the current bottom without fighting the scroll.",
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
};

/**
 * The "What's new" dialog: a TL;DR followed by grouped lists of new features
 * and fixes. Purely informational — it just reports {@link RELEASE_NOTES}.
 */
export class WhatsNewModal extends Modal {
	private version: string;

	constructor(app: App, version: string) {
		super(app);
		this.version = version;
	}

	onOpen(): void {
		const { contentEl, modalEl } = this;
		modalEl.addClass("hearth-whatsnew-modal");
		this.titleEl.setText(t().whatsNew.title(this.version));

		contentEl.createEl("p", {
			cls: "hearth-whatsnew-intro",
			text: t().whatsNew.intro,
		});

		const tldr = contentEl.createDiv({ cls: "hearth-whatsnew-tldr" });
		tldr.createEl("h4", { text: t().whatsNew.tldr });
		tldr.createEl("p", { text: RELEASE_NOTES.tldr });

		this.section(t().whatsNew.features, RELEASE_NOTES.features);
		this.section(t().whatsNew.fixes, RELEASE_NOTES.fixes);

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

	private section(heading: string, items: string[]): void {
		if (items.length === 0) return;
		const wrap = this.contentEl.createDiv({ cls: "hearth-whatsnew-section" });
		wrap.createEl("h4", { text: heading });
		const list = wrap.createEl("ul");
		for (const item of items) list.createEl("li", { text: item });
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/**
 * Show the "What's new" dialog once per version bump. A genuinely fresh install
 * is seeded silently so first-time users aren't greeted by a changelog. Any
 * other version change — including an existing vault upgrading into the first
 * build that ships this feature, where {@link HomeSettings.lastSeenVersion} is
 * still empty — pops the dialog and records the new version so it won't show
 * again until the next update.
 */
export async function maybeShowWhatsNew(plugin: HearthPlugin): Promise<void> {
	const current = plugin.manifest.version;
	const seen = plugin.settings.lastSeenVersion;

	if (seen === current) return;

	plugin.settings.lastSeenVersion = current;
	await plugin.saveData(plugin.settings);

	// First-ever run: record the version but don't greet a brand-new user with a
	// changelog for a build they never ran the predecessor of.
	if (plugin.isFirstRun) return;
	new WhatsNewModal(plugin.app, current).open();
}
