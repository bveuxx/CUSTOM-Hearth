import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type HearthPlugin from "./main";
import { FILE_TYPE_GROUPS } from "./filetypes";
import { BackgroundKind } from "./types";
import { exportLayout, importLayout } from "./layout";

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
				(Object.keys(BACKGROUND_LABELS) as BackgroundKind[]).forEach((k) => {
					d.addOption(k, BACKGROUND_LABELS[k]);
				});
				d.setValue(s.backgroundKind).onChange((v) => {
					s.backgroundKind = v as BackgroundKind;
					void this.save();
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

		new Setting(containerEl)
			.setName("Mobile mode (search only)")
			.setDesc(
				"On phones and tablets, hide the dashboard and show only the search " +
					"field. No effect on desktop.",
			)
			.addToggle((t) =>
				t.setValue(s.mobileSearchOnly).onChange(async (v) => {
					s.mobileSearchOnly = v;
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
			.setName("Compact spacing")
			.setDesc("Tighten card padding and top margin to enlarge the usable area.")
			.addToggle((t) =>
				t.setValue(s.compact).onChange(async (v) => {
					s.compact = v;
					await this.save();
				}),
			);

		new Setting(containerEl)
			.setName("Grid columns")
			.setDesc("Default column count. Each dashboard can override it from its own settings.")
			.addSlider((sl) =>
				sl
					.setLimits(4, 16, 1)
					.setValue(s.gridColumns)
					.onChange(async (v) => {
						s.gridColumns = v;
						await this.save();
					}),
			);

		new Setting(containerEl)
			.setName("Row height")
			.setDesc("Default row height in pixels (lower = finer card sizing). Each dashboard can override it.")
			.addSlider((sl) =>
				sl
					.setLimits(32, 160, 4)
					.setValue(s.rowHeight)
					.onChange(async (v) => {
						s.rowHeight = v;
						await this.save();
					}),
			);

		new Setting(containerEl)
			.setName("Cards")
			.setDesc(
				"Add and configure cards on the dashboard itself: open the home view, " +
					"hit Arrange, then use Add card and each card's settings button.",
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
}
