import { addIcon, Plugin, TFile, TFolder, WorkspaceLeaf, Notice } from "obsidian";
import { HomeView, VIEW_TYPE_HOME } from "./view";
import { DEFAULT_SETTINGS, HomeSettings } from "./types";
import { HomeSettingTab } from "./settings";
import { HEARTH_ICON_ID, HEARTH_ICON_SVG } from "./icon";

export default class HearthPlugin extends Plugin {
	settings: HomeSettings;

	async onload() {
		await this.loadSettings();

		// Register the Hearth crystal so it can be used as the ribbon, tab and
		// header icon.
		addIcon(HEARTH_ICON_ID, HEARTH_ICON_SVG);

		this.registerView(VIEW_TYPE_HOME, (leaf) => new HomeView(leaf, this));

		this.addRibbonIcon(HEARTH_ICON_ID, "Open Hearth home", () => this.activateView());

		this.addCommand({
			id: "open-home",
			name: "Open home dashboard",
			callback: () => this.activateView(),
		});

		this.addCommand({
			id: "new-note",
			name: "Create new note (default location)",
			callback: () => this.createNewNote(),
		});

		this.addSettingTab(new HomeSettingTab(this.app, this));

		// Replace freshly-opened empty tabs with the home view.
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => this.maybeReplaceNewTab(leaf)),
		);

		this.app.workspace.onLayoutReady(() => {
			if (this.settings.openOnStartup) this.activateView();
		});
	}

	onunload() {
		// Views are detached automatically by Obsidian on plugin unload.
	}

	private maybeReplaceNewTab(leaf: WorkspaceLeaf | null) {
		if (!leaf || !this.settings.replaceNewTabs) return;
		if (leaf.getViewState().type !== "empty") return;
		leaf.setViewState({ type: VIEW_TYPE_HOME });
	}

	async activateView() {
		const { workspace } = this.app;

		const existing = workspace.getLeavesOfType(VIEW_TYPE_HOME);
		if (existing.length > 0) {
			workspace.revealLeaf(existing[0]);
			return;
		}

		const leaf = workspace.getLeaf(true);
		await leaf.setViewState({ type: VIEW_TYPE_HOME, active: true });
		workspace.revealLeaf(leaf);
	}

	/** Create a new note in the user's configured default location and open it. */
	async createNewNote() {
		try {
			const parent = this.app.fileManager.getNewFileParent("");
			const file = await this.app.fileManager.createNewMarkdownFile(
				parent instanceof TFolder ? parent : this.app.vault.getRoot(),
				"Untitled",
			);
			const leaf = this.app.workspace.getLeaf(true);
			await leaf.openFile(file);
		} catch (err) {
			// Fall back to the core command if the internal API shape changes.
			if (!this.app.commands.executeCommandById("file-explorer:new-file")) {
				new Notice("Hearth: could not create a new note.");
				console.error("Hearth new note error", err);
			}
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.refreshViews();
	}

	refreshViews() {
		this.app.workspace.getLeavesOfType(VIEW_TYPE_HOME).forEach((leaf) => {
			const view = leaf.view;
			if (view instanceof HomeView) view.render();
		});
	}
}
