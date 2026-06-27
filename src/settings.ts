import { App, Menu, Notice, PluginSettingTab, Setting } from "obsidian";
import type HearthPlugin from "./main";
import { FILE_TYPE_GROUPS } from "./filetypes";
import { BackgroundKind, CardKind, DashboardCard, LinkItem } from "./types";
import { CARD_TEMPLATES, cardFromTemplate } from "./templates";
import { exportLayout, importLayout } from "./layout";

const CARD_KIND_LABELS: Record<CardKind, string> = {
	embed: "Embed (note / image / base)",
	web: "Web page (iframe)",
	bookmarks: "Bookmarks",
	favorites: "Favorites",
	text: "Text / jot-down",
	recent: "Recent files",
	links: "Links / launchpad",
	clock: "Clock & greeting",
};

const LINK_TYPE_LABELS: Record<LinkItem["type"], string> = {
	note: "Note",
	url: "URL",
	command: "Command",
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
		this.layoutSection(containerEl);
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
			.setDesc("An emoji or short text shown next to the title. Leave empty for the Hearth crystal icon.")
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

		new Setting(containerEl)
			.setName("Add a card")
			.setDesc("Pick a card from the library.")
			.addButton((b) =>
				b
					.setButtonText("Add card")
					.setCta()
					.onClick((evt) => {
						const menu = new Menu();
						for (const template of CARD_TEMPLATES) {
							menu.addItem((item) =>
								item
									.setTitle(template.name)
									.setIcon(template.icon)
									.onClick(async () => {
										s.cards.push(cardFromTemplate(template));
										await this.save();
										this.display();
									}),
							);
						}
						menu.showAtMouseEvent(evt as MouseEvent);
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

		if (card.kind === "web") {
			setting.addText((t) =>
				t
					.setPlaceholder("https://example.com")
					.setValue(card.url ?? "")
					.onChange(async (v) => {
						card.url = v;
						await this.save();
					}),
			);
		}

		if (card.kind === "recent") {
			setting.addText((t) => {
				t.setPlaceholder("Count")
					.setValue(String(card.count ?? 8))
					.onChange(async (v) => {
						const n = parseInt(v, 10);
						card.count = Number.isNaN(n) ? undefined : n;
						await this.save();
					});
				t.inputEl.type = "number";
				t.inputEl.addClass("hearth-count-input");
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

		this.colorsRow(containerEl, card);

		if (card.kind === "links") this.linksEditor(containerEl, card);
	}

	private colorsRow(containerEl: HTMLElement, card: DashboardCard): void {
		const row = new Setting(containerEl)
			.setClass("hearth-color-setting")
			.setName("Colors")
			.setDesc("Accent and background tint for this card.");

		row.addColorPicker((c) =>
			c.setValue(card.accent ?? "#7c5cff").onChange(async (v) => {
				card.accent = v;
				await this.save();
			}),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip("Clear accent")
				.onClick(async () => {
					card.accent = undefined;
					await this.save();
					this.display();
				}),
		);

		row.addColorPicker((c) =>
			c.setValue(card.background ?? "#000000").onChange(async (v) => {
				card.background = v;
				await this.save();
			}),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip("Clear background")
				.onClick(async () => {
					card.background = undefined;
					await this.save();
					this.display();
				}),
		);
	}

	private linksEditor(containerEl: HTMLElement, card: DashboardCard): void {
		const links = (card.links ??= []);

		links.forEach((link, index) => {
			const row = new Setting(containerEl).setClass("hearth-link-setting");
			row.addText((t) =>
				t.setPlaceholder("Label").setValue(link.label).onChange(async (v) => {
					link.label = v;
					await this.save();
				}),
			);
			row.addText((t) =>
				t.setPlaceholder("Icon").setValue(link.icon).onChange(async (v) => {
					link.icon = v;
					await this.save();
				}),
			);
			row.addDropdown((d) => {
				(Object.keys(LINK_TYPE_LABELS) as LinkItem["type"][]).forEach((k) =>
					d.addOption(k, LINK_TYPE_LABELS[k]),
				);
				d.setValue(link.type).onChange(async (v) => {
					link.type = v as LinkItem["type"];
					await this.save();
					this.display();
				});
			});
			row.addText((t) => {
				t.setPlaceholder("Target (path / URL / command id)")
					.setValue(link.target)
					.onChange(async (v) => {
						link.target = v;
						await this.save();
					});
				if (link.type === "note") t.inputEl.setAttribute("list", "hearth-file-list");
			});
			row.addExtraButton((b) =>
				b
					.setIcon("trash-2")
					.setTooltip("Remove link")
					.onClick(async () => {
						links.splice(index, 1);
						await this.save();
						this.display();
					}),
			);
		});

		new Setting(containerEl).addButton((b) =>
			b.setButtonText("Add link").onClick(async () => {
				links.push({
					id: `link-${Date.now().toString(36)}`,
					label: "",
					icon: "link",
					target: "",
					type: "note",
				});
				await this.save();
				this.display();
			}),
		);
	}

	// ---- Layout import / export ----------------------------------------

	private layoutSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Import / export layout")
			.setDesc("Back up or share your dashboard (cards, grid, favorites) as JSON.")
			.setHeading();
		const s = this.plugin.settings;

		new Setting(containerEl)
			.setName("Export layout")
			.setDesc("Copy the current dashboard layout to the clipboard.")
			.addButton((b) =>
				b
					.setButtonText("Copy JSON")
					.onClick(async () => {
						try {
							await navigator.clipboard.writeText(exportLayout(s));
							new Notice("Hearth: layout copied to clipboard.");
						} catch {
							new Notice("Hearth: couldn't access the clipboard.");
						}
					}),
			);

		let pending = "";
		new Setting(containerEl)
			.setName("Import layout")
			.setDesc("Paste a previously exported layout, then Import. This replaces your current cards.")
			.addTextArea((t) => {
				t.setPlaceholder('{ "hearthLayout": 1, "cards": [ … ] }').onChange(
					(v) => (pending = v),
				);
				t.inputEl.rows = 4;
				t.inputEl.addClass("hearth-import-input");
			})
			.addButton((b) =>
				b
					.setButtonText("Import")
					.setWarning()
					.onClick(async () => {
						if (!pending.trim()) {
							new Notice("Hearth: paste a layout to import first.");
							return;
						}
						const error = importLayout(s, pending);
						if (error) {
							new Notice(`Hearth: ${error}`);
							return;
						}
						await this.save();
						this.display();
						new Notice("Hearth: layout imported.");
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
