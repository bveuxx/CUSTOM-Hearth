import { App, Command, FuzzySuggestModal, Modal, Setting, TFile } from "obsidian";
import { t } from "./i18n";

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
 * A small modal to edit a Kanban card's Tasks-plugin metadata: a due date and a
 * priority. Pre-filled from the card's current values; submitting reports the
 * chosen due (YYYY-MM-DD or "") and priority ("high"/"medium"/"low" or "").
 */
export class TaskMetadataModal extends Modal {
	private due: string;
	private priority: string;
	private onSubmit: (due: string, priority: string) => void;

	constructor(
		app: App,
		due: string,
		priority: string,
		onSubmit: (due: string, priority: string) => void,
	) {
		super(app);
		this.due = due;
		this.priority = priority;
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: t().cards.tasks.editMetadata });

		new Setting(contentEl).setName(t().cards.tasks.dueDate).addText((txt) => {
			txt.inputEl.type = "date";
			txt.setValue(this.due).onChange((v) => (this.due = v));
		});

		new Setting(contentEl).setName(t().cards.tasks.priority).addDropdown((d) => {
			d.addOption("", t().cards.tasks.priorityNone);
			d.addOption("high", t().cards.tasks.priorityHigh);
			d.addOption("medium", t().cards.tasks.priorityMedium);
			d.addOption("low", t().cards.tasks.priorityLow);
			d.setValue(this.priority).onChange((v) => (this.priority = v));
		});

		new Setting(contentEl)
			.addButton((b) =>
				b
					.setButtonText(t().cards.tasks.save)
					.setCta()
					.onClick(() => {
						this.onSubmit(this.due.trim(), this.priority);
						this.close();
					}),
			)
			.addButton((b) => b.setButtonText(t().cards.tasks.cancel).onClick(() => this.close()));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
