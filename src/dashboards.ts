import { Menu, Modal, Setting, setIcon } from "obsidian";
import type { HomeView } from "./view";
import { BackgroundConfig, BackgroundKind, Dashboard, newDashboardId } from "./types";

/**
 * The top-left dashboard switcher: a button per dashboard (its emoji/icon or its
 * 1-based number) plus a "+" to add one. Clicking switches to it; right-clicking
 * opens a menu to edit its settings or delete it.
 */
export function renderDashboardSwitcher(view: HomeView, container: HTMLElement): void {
	const s = view.plugin.settings;
	const bar = container.createDiv("hearth-dash-switcher");

	s.dashboards.forEach((d, i) => {
		const icon = d.icon?.trim();
		const btn = bar.createEl("button", {
			cls: "hearth-dash-btn",
			text: icon || String(i + 1),
		});
		btn.toggleClass("is-active", d.id === s.activeDashboardId);
		btn.setAttribute("aria-label", d.name);
		btn.setAttribute("title", d.name);
		btn.addEventListener("click", () => view.plugin.setActiveDashboard(d.id));
		btn.addEventListener("contextmenu", (e) => {
			e.preventDefault();
			showDashboardMenu(view, d, e);
		});
	});

	const add = bar.createEl("button", {
		cls: "hearth-dash-btn hearth-dash-add",
		attr: { "aria-label": "New dashboard" },
	});
	setIcon(add, "plus");
	add.addEventListener("click", () => {
		const dash: Dashboard = {
			id: newDashboardId(),
			name: `Dashboard ${s.dashboards.length + 1}`,
			cards: [],
		};
		s.dashboards.push(dash);
		s.activeDashboardId = dash.id;
		void view.plugin.saveData(s);
		view.render();
	});
}

/** Context menu for a single dashboard button: settings and delete. */
function showDashboardMenu(view: HomeView, dash: Dashboard, evt: MouseEvent): void {
	const s = view.plugin.settings;
	const menu = new Menu();

	menu.addItem((item) =>
		item
			.setTitle("Dashboard settings…")
			.setIcon("settings-2")
			.onClick(() => new DashboardSettingsModal(view, dash).open()),
	);

	menu.addItem((item) =>
		item
			.setTitle("Delete")
			.setIcon("trash-2")
			// Always keep at least one dashboard around.
			.setDisabled(s.dashboards.length <= 1)
			.onClick(() => {
				const i = s.dashboards.findIndex((d) => d.id === dash.id);
				if (i >= 0) s.dashboards.splice(i, 1);
				if (s.activeDashboardId === dash.id) {
					s.activeDashboardId = s.dashboards[0].id;
				}
				void view.plugin.saveData(s);
				view.render();
			}),
	);

	menu.showAtMouseEvent(evt);
}

const BACKGROUND_OPTIONS: Record<string, string> = {
	default: "Use global default",
	none: "None",
	color: "Solid color",
	image: "Vault image",
	url: "Image URL",
};

/** Per-dashboard settings: name, switcher icon, and optional overrides for grid
 * columns, row height and background. Overrides fall back to the global
 * settings when left off. */
class DashboardSettingsModal extends Modal {
	private view: HomeView;
	private dash: Dashboard;

	constructor(view: HomeView, dash: Dashboard) {
		super(view.app);
		this.view = view;
		this.dash = dash;
	}

	onOpen(): void {
		this.titleEl.setText("Dashboard settings");
		this.render();
	}

	/** Persist and refresh the live view without closing the modal. */
	private commit(): void {
		void this.view.plugin.saveData(this.view.plugin.settings);
		this.view.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		const dash = this.dash;
		const s = this.view.plugin.settings;

		new Setting(contentEl).setName("Name").addText((t) =>
			t.setValue(dash.name).onChange((v) => {
				dash.name = v || "Dashboard";
				this.commit();
			}),
		);

		new Setting(contentEl)
			.setName("Switcher icon")
			.setDesc("An emoji or short text shown on the switcher button. Empty = number.")
			.addText((t) =>
				t.setValue(dash.icon ?? "").onChange((v) => {
					dash.icon = v.trim() || undefined;
					this.commit();
				}),
			);

		this.overrideSlider(
			contentEl,
			"Grid columns",
			dash.gridColumns,
			s.gridColumns,
			4,
			16,
			1,
			(v) => {
				dash.gridColumns = v;
				this.commit();
			},
		);

		this.overrideSlider(
			contentEl,
			"Row height",
			dash.rowHeight,
			s.rowHeight,
			32,
			160,
			4,
			(v) => {
				dash.rowHeight = v;
				this.commit();
			},
		);

		this.backgroundSection(contentEl);

		new Setting(contentEl).addButton((b) =>
			b.setButtonText("Done").setCta().onClick(() => this.close()),
		);
	}

	/** A labelled override: a toggle that, when on, reveals a slider. Off clears
	 * the override (passing undefined) so the global default applies. */
	private overrideSlider(
		containerEl: HTMLElement,
		name: string,
		current: number | undefined,
		fallback: number,
		min: number,
		max: number,
		step: number,
		set: (value: number | undefined) => void,
	): void {
		const overriding = typeof current === "number";
		const row = new Setting(containerEl)
			.setName(name)
			.setDesc(overriding ? "Overriding the global default." : `Using global default (${fallback}).`)
			.addToggle((t) =>
				t.setValue(overriding).onChange((v) => {
					set(v ? fallback : undefined);
					this.render();
				}),
			);
		if (overriding) {
			row.addSlider((sl) =>
				sl
					.setLimits(min, max, step)
					.setValue(current)
					.onChange((v) => set(v)),
			);
		}
	}

	private backgroundSection(containerEl: HTMLElement): void {
		const dash = this.dash;
		const bg = dash.background;

		new Setting(containerEl)
			.setName("Background")
			.setDesc("Override the global background for this dashboard.")
			.addDropdown((d) => {
				Object.entries(BACKGROUND_OPTIONS).forEach(([k, label]) => {
					d.addOption(k, label);
				});
				d.setValue(bg ? bg.kind : "default").onChange((v) => {
					if (v === "default") {
						dash.background = undefined;
					} else {
						dash.background = {
							kind: v as BackgroundKind,
							value: bg?.value ?? "",
							opacity: bg?.opacity ?? 0.15,
							blur: bg?.blur ?? 0,
						};
					}
					this.commit();
					this.render();
				});
			});

		if (!bg || bg.kind === "none") return;

		const desc =
			bg.kind === "color"
				? "A CSS color, e.g. #1e1e2e."
				: bg.kind === "image"
					? "A vault image path, e.g. Attachments/bg.png."
					: "A direct image URL.";
		new Setting(containerEl)
			.setName("Background value")
			.setDesc(desc)
			.addText((t) =>
				t.setValue(bg.value).onChange((v) => {
					bg.value = v;
					this.commit();
				}),
			);

		this.bgNumber(containerEl, "Opacity", bg, "opacity", 0, 1, 0.05);
		this.bgNumber(containerEl, "Blur", bg, "blur", 0, 40, 1);
	}

	private bgNumber(
		containerEl: HTMLElement,
		name: string,
		bg: BackgroundConfig,
		key: "opacity" | "blur",
		min: number,
		max: number,
		step: number,
	): void {
		new Setting(containerEl).setName(name).addSlider((sl) =>
			sl
				.setLimits(min, max, step)
				.setValue(bg[key])
				.onChange((v) => {
					bg[key] = v;
					this.commit();
				}),
		);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
