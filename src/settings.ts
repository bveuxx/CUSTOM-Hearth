import { App, PluginSettingTab, Setting } from "obsidian";
import type HearthPlugin from "./main";
import { FILE_TYPE_GROUPS } from "./filetypes";
import { BackgroundKind, CardKind, DashboardCard } from "./types";

const CARD_KIND_LABELS: Record<CardKind, string> = {
	embed: "Embed (note / image / base)",
	bookmarks: "Bookmarks",
	favorites: "Favorites",
	text: "Text / jot-down",
};

const BACKGROUND_LABELS: Record<BackgroundKind, string> = {
	none: "None",
	color: "Solid color",
	image: "Vault image",
	url: "Image URL",
};

export class HomeSettingTab extends PluginSettingTab {
	plugin: HearthPlugin;

	constructor(app: App, plugin: HearthPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private async save(): Promise<void> {
		await this.plugin.saveSettings();
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.fileDatalist(containerEl);

		this.appearanceSection(containerEl);
		this.backgroundSection(containerEl);
		this.behaviourSection(containerEl);
		this.filtersSection(containerEl);
		this.dashboardSection(containerEl);
		this.favoritesSection(containerEl);
	}

	/** A shared <datalist> of vault files used by file-path inputs. */
	private fileDatalist(containerEl: HTMLElement): void {
		const datalist = containerEl.createEl("datalist", {
			attr: { id: "hearth-file-list" },
		});
		for (const file of this.app.vault.getFiles()) {
			datalist.createEl("option", { attr: { value: file.path } });
		}
	}

	// ---- Appearance -----------------------------------------------------

	private appearanceSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Appearance").setHeading();
		const s = this.plugin.settings;

		new Setting(containerEl)
			.setName("Show title")
			.setDesc("Display the big title/logo at the top.")
			.addToggle((t) =>
				t.setValue(s.showTitle).onChange(async (v) => {
					s.showTitle = v;
					await this.save();
				}),
			);

		new Setting(containerEl)
			.setName("Title")
			.addText((t) =>
				t.setValue(s.title).onChange(async (v) => {
					s.title = v;
					await this.save();
				}),
			);

		new Setting(containerEl)
			.setName("Logo")
			.setDesc("An emoji or short text shown next to the title.")
			.addText((t) =>
				t.setValue(s.logo).onChange(async (v) => {
					s.logo = v;
					await this.save();
				}),
			);

		new Setting(containerEl)
			.setName("Search placeholder")
			.addText((t) =>
				t.setValue(s.searchPlaceholder).onChange(async (v) => {
					s.searchPlaceholder = v;
					await this.save();
				}),
			);

		new Setting(containerEl)
			.setName("Show “New note” button")
			.addToggle((t) =>
				t.setValue(s.showNewNoteButton).onChange(async (v) => {
					s.showNewNoteButton = v;
					await this.save();
				}),
			);

		new Setting(containerEl)
			.setName("Content width")
			.setDesc("Maximum width of the home content, in pixels.")
			.addSlider((sl) =>
				sl
					.setLimits(700, 1600, 20)
					.setValue(s.maxWidth)
					.setDynamicTooltip()
					.onChange(async (v) => {
						s.maxWidth = v;
						await this.save();
					}),
			);
	}

	// ---- Background -----------------------------------------------------

	private backgroundSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Background").setHeading();
		const s = this.plugin.settings;

		new Setting(containerEl)
			.setName("Background type")
			.addDropdown((d) => {
				(Object.keys(BACKGROUND_LABELS) as BackgroundKind[]).forEach((k) =>
					d.addOption(k, BACKGROUND_LABELS[k]),
				);
				d.setValue(s.backgroundKind).onChange(async (v) => {
					s.backgroundKind = v as BackgroundKind;
					await this.save();
					this.display();
				});
			});

		if (s.backgroundKind !== "none") {
			const desc =
				s.backgroundKind === "color"
					? "A CSS color, e.g. #1e1e2e or rgb(30,30,46)."
					: s.backgroundKind === "image"
						? "A vault image path, e.g. Attachments/bg.png."
						: "A direct image URL.";
			const setting = new Setting(containerEl)
				.setName("Background value")
				.setDesc(desc)
				.addText((t) =>
					t.setValue(s.backgroundValue).onChange(async (v) => {
						s.backgroundValue = v;
						await this.save();
					}),
				);
			if (s.backgroundKind === "image") {
				setting.controlEl
					.querySelector("input")
					?.setAttribute("list", "hearth-file-list");
			}

			new Setting(containerEl)
				.setName("Opacity")
				.addSlider((sl) =>
					sl
						.setLimits(0, 1, 0.05)
						.setValue(s.backgroundOpacity)
						.setDynamicTooltip()
						.onChange(async (v) => {
							s.backgroundOpacity = v;
							await this.save();
						}),
				);

			new Setting(containerEl)
				.setName("Blur")
				.setDesc("Background blur in pixels.")
				.addSlider((sl) =>
					sl
						.setLimits(0, 40, 1)
						.setValue(s.backgroundBlur)
						.setDynamicTooltip()
						.onChange(async (v) => {
							s.backgroundBlur = v;
							await this.save();
						}),
				);
		}
	}

	// ---- Behaviour ------------------------------------------------------

	private behaviourSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Behaviour").setHeading();
		const s = this.plugin.settings;

		new Setting(containerEl)
			.setName("Open on startup")
			.setDesc("Open the home view when the vault loads.")
			.addToggle((t) =>
				t.setValue(s.openOnStartup).onChange(async (v) => {
					s.openOnStartup = v;
					await this.save();
				}),
			);

		new Setting(containerEl)
			.setName("Replace new tabs")
			.setDesc("Show the home view instead of an empty new tab.")
			.addToggle((t) =>
				t.setValue(s.replaceNewTabs).onChange(async (v) => {
					s.replaceNewTabs = v;
					await this.save();
				}),
			);
	}

	// ---- Filters --------------------------------------------------------

	private filtersSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Search filters")
			.setDesc("Filters are auto-detected from the file types in your vault. Hide any you don't want.")
			.setHeading();
		const s = this.plugin.settings;
		const hidden = new Set(s.hiddenFilters);

		for (const group of FILE_TYPE_GROUPS) {
			new Setting(containerEl)
				.setName(group.label)
				.addToggle((t) =>
					t.setValue(!hidden.has(group.id)).onChange(async (v) => {
						if (v) hidden.delete(group.id);
						else hidden.add(group.id);
						s.hiddenFilters = Array.from(hidden);
						await this.save();
					}),
				);
		}
	}

	// ---- Dashboard / cards ---------------------------------------------

	private dashboardSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Dashboard").setHeading();
		const s = this.plugin.settings;

		new Setting(containerEl)
			.setName("Fit to page")
			.setDesc("Keep the dashboard to one screen instead of allowing scroll.")
			.addToggle((t) =>
				t.setValue(s.fitToPage).onChange(async (v) => {
					s.fitToPage = v;
					await this.save();
				}),
			);

		new Setting(containerEl)
			.setName("Grid columns")
			.addSlider((sl) =>
				sl
					.setLimits(4, 16, 1)
					.setValue(s.gridColumns)
					.setDynamicTooltip()
					.onChange(async (v) => {
						s.gridColumns = v;
						await this.save();
					}),
			);

		s.cards.forEach((card, index) => this.cardRow(containerEl, card, index));

		new Setting(containerEl).addButton((b) =>
			b
				.setButtonText("Add card")
				.setCta()
				.onClick(async () => {
					s.cards.push({
						id: `card-${Date.now().toString(36)}`,
						kind: "text",
						title: "New card",
						w: 4,
						h: 2,
					});
					await this.save();
					this.display();
				}),
		);
	}

	private cardRow(containerEl: HTMLElement, card: DashboardCard, index: number): void {
		const s = this.plugin.settings;

		const setting = new Setting(containerEl)
			.setClass("hearth-card-setting")
			.setName(`Card ${index + 1}`);

		setting.addDropdown((d) => {
			(Object.keys(CARD_KIND_LABELS) as CardKind[]).forEach((k) =>
				d.addOption(k, CARD_KIND_LABELS[k]),
			);
			d.setValue(card.kind).onChange(async (v) => {
				card.kind = v as CardKind;
				await this.save();
				this.display();
			});
		});

		setting.addText((t) =>
			t
				.setPlaceholder("Title")
				.setValue(card.title ?? "")
				.onChange(async (v) => {
					card.title = v;
					await this.save();
				}),
		);

		if (card.kind === "embed") {
			setting.addText((t) => {
				t.setPlaceholder("File path to embed")
					.setValue(card.target ?? "")
					.onChange(async (v) => {
						card.target = v;
						await this.save();
					});
				t.inputEl.setAttribute("list", "hearth-file-list");
			});
		}

		setting.addExtraButton((b) =>
			b
				.setIcon("move-up")
				.setTooltip("Move up")
				.onClick(async () => {
					if (index === 0) return;
					[s.cards[index - 1], s.cards[index]] = [s.cards[index], s.cards[index - 1]];
					await this.save();
					this.display();
				}),
		);

		setting.addExtraButton((b) =>
			b
				.setIcon("trash-2")
				.setTooltip("Remove")
				.onClick(async () => {
					s.cards.splice(index, 1);
					await this.save();
					this.display();
				}),
		);
	}

	// ---- Favorites ------------------------------------------------------

	private favoritesSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Favorites")
			.setDesc("Notes shown by “Favorites” cards.")
			.setHeading();
		const s = this.plugin.settings;

		s.favorites.forEach((path, index) => {
			new Setting(containerEl)
				.setName(path)
				.addExtraButton((b) =>
					b
						.setIcon("trash-2")
						.setTooltip("Remove")
						.onClick(async () => {
							s.favorites.splice(index, 1);
							await this.save();
							this.display();
						}),
				);
		});

		let pending = "";
		new Setting(containerEl)
			.setName("Add favorite")
			.addText((t) => {
				t.setPlaceholder("File path").onChange((v) => (pending = v));
				t.inputEl.setAttribute("list", "hearth-file-list");
			})
			.addButton((b) =>
				b.setButtonText("Add").onClick(async () => {
					const path = pending.trim();
					if (!path || s.favorites.includes(path)) return;
					s.favorites.push(path);
					await this.save();
					this.display();
				}),
			);
	}
}
