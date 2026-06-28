import { addIcon, Plugin, TFolder, WorkspaceLeaf, Notice } from "obsidian";
import { HomeView, VIEW_TYPE_HOME } from "./view";
import { DEFAULT_SETTINGS, HomeSettings, migrateSettings } from "./types";
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

		this.registerDashboardCommands();

		this.addSettingTab(new HomeSettingTab(this.app, this));

		// Replace freshly-opened empty tabs with the home view.
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => this.maybeReplaceNewTab(leaf)),
		);

		this.app.workspace.onLayoutReady(() => {
			if (this.settings.openOnStartup) void this.activateView();
		});
	}

	onunload() {
		// Views are detached automatically by Obsidian on plugin unload.
	}

	private maybeReplaceNewTab(leaf: WorkspaceLeaf | null) {
		if (!leaf || !this.settings.replaceNewTabs) return;
		if (leaf.getViewState().type !== "empty") return;
		void leaf.setViewState({ type: VIEW_TYPE_HOME });
	}

	/** Switch the active dashboard and refresh any open home views. */
	setActiveDashboard(id: string) {
		if (this.settings.activeDashboardId === id) return;
		this.settings.activeDashboardId = id;
		void this.saveData(this.settings);
		this.refreshViews();
	}

	private cycleDashboard(direction: 1 | -1) {
		const dashboards = this.settings.dashboards;
		if (dashboards.length < 2) return;
		const current = dashboards.findIndex(
			(d) => d.id === this.settings.activeDashboardId,
		);
		const start = current < 0 ? 0 : current;
		const next = (start + direction + dashboards.length) % dashboards.length;
		this.setActiveDashboard(dashboards[next].id);
	}

	/**
	 * Commands to jump straight to a dashboard by position, plus next/previous.
	 * No default hotkeys are bound (Mod+number is taken by core tab switching);
	 * users can assign their own in Settings → Hotkeys.
	 */
	private registerDashboardCommands() {
		for (let i = 1; i <= 9; i++) {
			this.addCommand({
				id: `switch-dashboard-${i}`,
				name: `Switch to dashboard ${i}`,
				checkCallback: (checking) => {
					const dash = this.settings.dashboards[i - 1];
					if (!dash) return false;
					if (!checking) this.setActiveDashboard(dash.id);
					return true;
				},
			});
		}

		this.addCommand({
			id: "next-dashboard",
			name: "Next dashboard",
			callback: () => this.cycleDashboard(1),
		});
		this.addCommand({
			id: "previous-dashboard",
			name: "Previous dashboard",
			callback: () => this.cycleDashboard(-1),
		});
	}

	async activateView() {
		const { workspace } = this.app;

		const existing = workspace.getLeavesOfType(VIEW_TYPE_HOME);
		if (existing.length > 0) {
			await workspace.revealLeaf(existing[0]);
			return;
		}

		const leaf = workspace.getLeaf(true);
		await leaf.setViewState({ type: VIEW_TYPE_HOME, active: true });
		await workspace.revealLeaf(leaf);
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
		const raw = ((await this.loadData()) ?? {}) as Record<string, unknown>;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, raw);
		migrateSettings(this.settings, raw);
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
