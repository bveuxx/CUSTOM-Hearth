import { App, FuzzySuggestModal, TFile } from "obsidian";

/**
 * A fuzzy file picker used to choose (or swap) the file embedded by a card
 * directly from the dashboard. Lists every file in the vault.
 */
export class FilePickerModal extends FuzzySuggestModal<TFile> {
	private onChoose: (file: TFile) => void;

	constructor(app: App, onChoose: (file: TFile) => void, placeholder?: string) {
		super(app);
		this.onChoose = onChoose;
		this.setPlaceholder(placeholder ?? "Pick a file to embed…");
	}

	getItems(): TFile[] {
		return this.app.vault.getFiles();
	}

	getItemText(file: TFile): string {
		return file.path;
	}

	onChooseItem(file: TFile): void {
		this.onChoose(file);
	}
}
