import { App, Command, FuzzySuggestModal, TFile } from "obsidian";
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
