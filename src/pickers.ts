import { App, Command, FuzzySuggestModal, Modal, Setting, TFile } from "obsidian";
import { t } from "./i18n";
import { TaskMeta } from "./types";

/**
 * A fuzzy file picker used to choose (or swap) the file embedded by a card
 * directly from the dashboard. Lists every file in the vault.
 */
export class FilePickerModal extends FuzzySuggestModal<TFile> {
	private onChoose: (file: TFile) => void;
	private filter?: (file: TFile) => boolean;

	constructor(
		app: App,
		onChoose: (file: TFile) => void,
		placeholder?: string,
		filter?: (file: TFile) => boolean,
	) {
		super(app);
		this.onChoose = onChoose;
		this.filter = filter;
		this.setPlaceholder(placeholder ?? t().pickers.fileToEmbed);
	}

	getItems(): TFile[] {
		const files = this.app.vault.getFiles();
		return this.filter ? files.filter(this.filter) : files;
	}

	getItemText(file: TFile): string {
		return file.path;
	}

	onChooseItem(file: TFile): void {
		this.onChoose(file);
	}
}

/**
 * A fuzzy picker over every registered command, used to add command tiles to a
 * "commands" card from the dashboard.
 */
export class CommandPickerModal extends FuzzySuggestModal<Command> {
	private onChoose: (command: Command) => void;

	constructor(app: App, onChoose: (command: Command) => void) {
		super(app);
		this.onChoose = onChoose;
		this.setPlaceholder(t().pickers.command);
	}

	getItems(): Command[] {
		return this.app.commands.listCommands();
	}

	getItemText(command: Command): string {
		return command.name;
	}

	onChooseItem(command: Command): void {
		this.onChoose(command);
	}
}

/**
 * A modal to edit a Kanban card's Tasks-plugin metadata: priority, recurrence,
 * and start/scheduled/due dates. Pre-filled from the card's current values;
 * submitting reports the full {@link TaskMeta} (blank fields clear the marker).
 */
export class TaskMetadataModal extends Modal {
	private meta: TaskMeta;
	private onSubmit: (meta: TaskMeta) => void;

	constructor(app: App, meta: TaskMeta, onSubmit: (meta: TaskMeta) => void) {
		super(app);
		this.meta = { ...meta };
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: t().cards.tasks.editMetadata });

		new Setting(contentEl).setName(t().cards.tasks.priority).addDropdown((d) => {
			d.addOption("", t().cards.tasks.priorityNone);
			d.addOption("highest", t().cards.tasks.priorityHighest);
			d.addOption("high", t().cards.tasks.priorityHigh);
			d.addOption("medium", t().cards.tasks.priorityMedium);
			d.addOption("low", t().cards.tasks.priorityLow);
			d.addOption("lowest", t().cards.tasks.priorityLowest);
			d.setValue(this.meta.priority).onChange((v) => (this.meta.priority = v));
		});

		const dateSetting = (name: string, key: "start" | "scheduled" | "due") =>
			new Setting(contentEl).setName(name).addText((txt) => {
				txt.inputEl.type = "date";
				txt.setValue(this.meta[key]).onChange((v) => (this.meta[key] = v));
			});
		dateSetting(t().cards.tasks.startDate, "start");
		dateSetting(t().cards.tasks.scheduledDate, "scheduled");
		dateSetting(t().cards.tasks.dueDate, "due");

		new Setting(contentEl).setName(t().cards.tasks.recurrenceLabel).addText((txt) => {
			txt
				.setPlaceholder(t().cards.tasks.recurrencePlaceholder)
				.setValue(this.meta.recurrence)
				.onChange((v) => (this.meta.recurrence = v));
		});

		new Setting(contentEl)
			.addButton((b) =>
				b
					.setButtonText(t().cards.tasks.save)
					.setCta()
					.onClick(() => {
						this.onSubmit({
							priority: this.meta.priority,
							recurrence: this.meta.recurrence.trim(),
							start: this.meta.start.trim(),
							scheduled: this.meta.scheduled.trim(),
							due: this.meta.due.trim(),
						});
						this.close();
					}),
			)
			.addButton((b) => b.setButtonText(t().cards.tasks.cancel).onClick(() => this.close()));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
