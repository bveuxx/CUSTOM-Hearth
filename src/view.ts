import { Component, ItemView, Platform, WorkspaceLeaf } from "obsidian";
import type HearthPlugin from "./main";
import { renderHeader } from "./header";
import { renderDashboard } from "./dashboard";
import { renderDashboardSwitcher } from "./dashboards";
import { applyBackground } from "./background";
import { HEARTH_ICON_ID } from "./icon";

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
		return HEARTH_ICON_ID;
	}

	async onOpen(): Promise<void> {
		this.render();
		this.trackViewport();
	}

	/**
	 * On mobile the on-screen keyboard overlays the window without resizing the
	 * leaf, so the lower UI ends up hidden behind it. Track the real visible area
	 * (visualViewport) and, while the keyboard is up, cap the scroll area to it
	 * and allow scrolling so everything stays reachable. Cleaned up on close.
	 */
	private trackViewport(): void {
		const vv = window.visualViewport;
		if (!vv || !Platform.isMobile) return;

		const update = () => {
			const top = this.contentEl.getBoundingClientRect().top;
			const visibleBottom = vv.offsetTop + vv.height;
			this.contentEl.style.setProperty(
				"--hearth-vh",
				`${Math.max(0, Math.round(visibleBottom - top))}px`,
			);
			// Keyboard up when the visual viewport is meaningfully shorter than
			// the layout viewport.
			this.contentEl.toggleClass(
				"hearth-kbd-open",
				vv.height < window.innerHeight - 120,
			);
		};

		vv.addEventListener("resize", update);
		vv.addEventListener("scroll", update);
		this.register(() => {
			vv.removeEventListener("resize", update);
			vv.removeEventListener("scroll", update);
		});
		update();
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
		root.toggleClass("hearth-compact", this.plugin.settings.compact);

		// Mobile-only mode: on a phone/tablet, collapse to just the search field.
		const mobileOnly = Platform.isMobile && this.plugin.settings.mobileSearchOnly;
		root.toggleClass("hearth-mobile-only", mobileOnly);

		applyBackground(this, root);

		const scroll = root.createDiv("hearth-scroll");
		scroll.toggleClass("hearth-fit", this.plugin.settings.fitToPage);

		const inner = scroll.createDiv("hearth-inner");
		inner.style.maxWidth = `${this.plugin.settings.maxWidth}px`;

		if (!mobileOnly) renderDashboardSwitcher(this, inner);

		const header = inner.createDiv("hearth-header");
		renderHeader(this, header);

		if (!mobileOnly) {
			const dashboard = inner.createDiv("hearth-dashboard");
			renderDashboard(this, dashboard, child);
		}
	}
}
