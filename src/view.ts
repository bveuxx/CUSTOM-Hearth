import { Component, ItemView, WorkspaceLeaf } from "obsidian";
import type HearthPlugin from "./main";
import { renderHeader } from "./header";
import { renderDashboard } from "./dashboard";
import { applyBackground } from "./background";

export const VIEW_TYPE_HOME = "hearth-home-view";

export class HomeView extends ItemView {
	plugin: HearthPlugin;
	/** Whether the dashboard is in layout/arrange mode (drag & resize). */
	arrangeMode = false;
	/** Per-render child component so embeds/markdown get cleaned up on re-render. */
	private renderChild: Component | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: HearthPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return VIEW_TYPE_HOME;
	}

	getDisplayText(): string {
		return "Home";
	}

	getIcon(): string {
		return "home";
	}

	async onOpen(): Promise<void> {
		this.render();
	}

	async onClose(): Promise<void> {
		this.cleanupChild();
	}

	private cleanupChild() {
		if (this.renderChild) {
			this.removeChild(this.renderChild);
			this.renderChild = null;
		}
	}

	/** Full rebuild of the view. Cheap enough to call on any settings change. */
	render(): void {
		this.cleanupChild();
		const child = new Component();
		this.addChild(child);
		this.renderChild = child;

		const root = this.contentEl;
		root.empty();
		root.addClass("hearth-view");

		applyBackground(this, root);

		const scroll = root.createDiv("hearth-scroll");
		scroll.toggleClass("hearth-fit", this.plugin.settings.fitToPage);

		const inner = scroll.createDiv("hearth-inner");
		inner.style.maxWidth = `${this.plugin.settings.maxWidth}px`;

		const header = inner.createDiv("hearth-header");
		renderHeader(this, header);

		const dashboard = inner.createDiv("hearth-dashboard");
		renderDashboard(this, dashboard, child);
	}
}
