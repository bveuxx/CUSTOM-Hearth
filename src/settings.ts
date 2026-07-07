import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type HearthPlugin from "./main";
import { FILE_TYPE_GROUPS, fileTypeLabel } from "./filetypes";
import { CommandPickerModal } from "./pickers";
import { BackgroundKind, defaultMobileActionButtons, MobileActionButton } from "./types";
import { exportLayout, importLayout } from "./layout";
import { confirmAction } from "./ui";
import { t } from "./i18n";

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
		this.mobileActionsSection(containerEl);
		this.tasksSection(containerEl);
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
		new Setting(containerEl).setName(t().settings.appearance.heading).setHeading();
		const s = this.plugin.settings;

		new Setting(containerEl)
			.setName(t().settings.appearance.showTitle)
			.setDesc(t().settings.appearance.showTitleDesc)
			.addToggle((t) =>
				t.setValue(s.showTitle).onChange(async (v) => {
					s.showTitle = v;
					await this.save();
				}),
			);

		new Setting(containerEl)
			.setName(t().settings.appearance.title)
			.addText((t) =>
				t.setValue(s.title).onChange(async (v) => {
					s.title = v;
					await this.save();
				}),
			);

		new Setting(containerEl)
			.setName(t().settings.appearance.logo)
			.setDesc(t().settings.appearance.logoDesc)
			.addText((t) =>
				t.setValue(s.logo).onChange(async (v) => {
					s.logo = v;
					await this.save();
				}),
			);

		new Setting(containerEl)
			.setName(t().settings.appearance.searchPlaceholder)
			.addText((t) =>
				t.setValue(s.searchPlaceholder).onChange(async (v) => {
					s.searchPlaceholder = v;
					await this.save();
				}),
			);

		new Setting(containerEl)
			.setName(t().settings.appearance.searchContents)
			.setDesc(t().settings.appearance.searchContentsDesc)
			.addToggle((t) =>
				t.setValue(s.searchContents).onChange(async (v) => {
					s.searchContents = v;
					await this.save();
				}),
			);

		new Setting(containerEl)
			.setName(t().settings.appearance.showNewNoteButton)
			.addToggle((t) =>
				t.setValue(s.showNewNoteButton).onChange(async (v) => {
					s.showNewNoteButton = v;
					await this.save();
				}),
			);

		new Setting(containerEl)
			.setName(t().settings.appearance.contentWidth)
			.setDesc(t().settings.appearance.contentWidthDesc)
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
		new Setting(containerEl).setName(t().settings.background.heading).setHeading();
		const s = this.plugin.settings;

		new Setting(containerEl)
			.setName(t().settings.background.type)
			.addDropdown((d) => {
				(Object.keys(t().settings.background.labels) as BackgroundKind[]).forEach((k) => {
					d.addOption(k, t().settings.background.labels[k]);
				});
				d.setValue(s.backgroundKind).onChange((v) => {
					s.backgroundKind = v as BackgroundKind;
					void this.save();
					this.display();
				});
			});

		// "default" and "none" have no value field; the others do.
		if (s.backgroundKind !== "none" && s.backgroundKind !== "default") {
			const desc =
				s.backgroundKind === "color"
					? t().settings.background.valueColorDesc
					: s.backgroundKind === "image"
						? t().settings.background.valueImageDesc
						: t().settings.background.valueUrlDesc;
			const setting = new Setting(containerEl)
				.setName(t().settings.background.value)
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
		}

		// Opacity/blur apply to every background except "none".
		if (s.backgroundKind !== "none") {
			new Setting(containerEl)
				.setName(t().settings.background.opacity)
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
				.setName(t().settings.background.blur)
				.setDesc(t().settings.background.blurDesc)
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
		new Setting(containerEl).setName(t().settings.behaviour.heading).setHeading();
		const s = this.plugin.settings;

		new Setting(containerEl)
			.setName(t().settings.behaviour.openOnStartup)
			.setDesc(t().settings.behaviour.openOnStartupDesc)
			.addToggle((t) =>
				t.setValue(s.openOnStartup).onChange(async (v) => {
					s.openOnStartup = v;
					await this.save();
				}),
			);

		new Setting(containerEl)
			.setName(t().settings.behaviour.replaceNewTabs)
			.setDesc(t().settings.behaviour.replaceNewTabsDesc)
			.addToggle((t) =>
				t.setValue(s.replaceNewTabs).onChange(async (v) => {
					s.replaceNewTabs = v;
					await this.save();
				}),
			);

		new Setting(containerEl)
			.setName(t().settings.behaviour.mobileSearchOnly)
			.setDesc(t().settings.behaviour.mobileSearchOnlyDesc)
			.addToggle((t) =>
				t.setValue(s.mobileSearchOnly).onChange(async (v) => {
					s.mobileSearchOnly = v;
					await this.save();
				}),
			);
	}

	// ---- Mobile action bar ----------------------------------------------

	private mobileActionsSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(t().settings.mobileActions.heading)
			.setDesc(t().settings.mobileActions.headingDesc)
			.setHeading();
		const s = this.plugin.settings;

		new Setting(containerEl)
			.setName(t().settings.mobileActions.showActionBar)
			.addToggle((t) =>
				t.setValue(s.showMobileActionBar).onChange(async (v) => {
					s.showMobileActionBar = v;
					await this.save();
				}),
			);

		const buttons = s.mobileActionButtons;
		buttons.forEach((btn, index) => {
			const row = new Setting(containerEl).setClass("hearth-link-setting");
			row.addText((txt) =>
				txt.setPlaceholder(t().settings.mobileActions.labelPlaceholder).setValue(btn.label).onChange(async (v) => {
					btn.label = v;
					await this.save();
				}),
			);
			row.addText((txt) =>
				txt.setPlaceholder(t().settings.mobileActions.iconPlaceholder).setValue(btn.icon).onChange(async (v) => {
					btn.icon = v;
					await this.save();
				}),
			);
			row.addExtraButton((b) =>
				b
					.setIcon("terminal-square")
					.setTooltip(btn.commandId ? t().settings.mobileActions.commandTooltip(btn.commandId) : t().settings.mobileActions.pickCommand)
					.onClick(() => {
						new CommandPickerModal(this.app, (command) => {
							btn.commandId = command.id;
							if (!btn.label.trim()) btn.label = command.name;
							void this.save();
							this.display();
						}).open();
					}),
			);
			row.addExtraButton((b) =>
				b
					.setIcon("chevron-up")
					.setTooltip(t().settings.mobileActions.moveUp)
					.setDisabled(index === 0)
					.onClick(() => this.moveMobileAction(buttons, index, index - 1)),
			);
			row.addExtraButton((b) =>
				b
					.setIcon("chevron-down")
					.setTooltip(t().settings.mobileActions.moveDown)
					.setDisabled(index === buttons.length - 1)
					.onClick(() => this.moveMobileAction(buttons, index, index + 1)),
			);
			row.addExtraButton((b) =>
				b
					.setIcon("trash-2")
					.setTooltip(t().settings.mobileActions.removeButton)
					.onClick(async () => {
						buttons.splice(index, 1);
						await this.save();
						this.display();
					}),
			);
		});

		new Setting(containerEl)
			.addButton((b) =>
				b.setButtonText(t().settings.mobileActions.addButton).onClick(() => {
					new CommandPickerModal(this.app, (command) => {
						buttons.push({
							id: `action-${Date.now().toString(36)}`,
							label: command.name,
							icon: "terminal-square",
							commandId: command.id,
						});
						void this.save();
						this.display();
					}).open();
				}),
			)
			.addExtraButton((b) =>
				b
					.setIcon("rotate-ccw")
					.setTooltip(t().settings.mobileActions.resetDefaults)
					.onClick(async () => {
						s.mobileActionButtons = defaultMobileActionButtons();
						await this.save();
						this.display();
					}),
			);
	}

	/** Move a mobile action button within the list, then persist and redraw. */
	private moveMobileAction(arr: MobileActionButton[], from: number, to: number): void {
		if (to < 0 || to >= arr.length) return;
		const [item] = arr.splice(from, 1);
		arr.splice(to, 0, item);
		void this.save();
		this.display();
	}

	// ---- Tasks / TaskNotes ------------------------------------------------

	private tasksSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(t().settings.tasks.heading)
			.setDesc(t().settings.tasks.headingDesc)
			.setHeading();
		const s = this.plugin.settings;

		new Setting(containerEl)
			.setName(t().settings.tasks.statusField)
			.addText((t) =>
				t.setValue(s.taskNotesStatusField).onChange(async (v) => {
					s.taskNotesStatusField = v;
					await this.save();
				}),
			);

		new Setting(containerEl)
			.setName(t().settings.tasks.dueField)
			.addText((t) =>
				t.setValue(s.taskNotesDueField).onChange(async (v) => {
					s.taskNotesDueField = v;
					await this.save();
				}),
			);

		new Setting(containerEl)
			.setName(t().settings.tasks.priorityField)
			.setDesc(t().settings.tasks.priorityFieldDesc)
			.addText((t) =>
				t.setValue(s.taskNotesPriorityField).onChange(async (v) => {
					s.taskNotesPriorityField = v;
					await this.save();
				}),
			);

		new Setting(containerEl)
			.setName(t().settings.tasks.doneValue)
			.addText((t) =>
				t.setValue(s.taskNotesDoneValue).onChange(async (v) => {
					s.taskNotesDoneValue = v;
					await this.save();
				}),
			);
	}

	// ---- Filters --------------------------------------------------------

	private filtersSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(t().settings.filters.heading)
			.setDesc(t().settings.filters.headingDesc)
			.setHeading();
		const s = this.plugin.settings;
		const hidden = new Set(s.hiddenFilters);

		for (const group of FILE_TYPE_GROUPS) {
			new Setting(containerEl)
				.setName(fileTypeLabel(group))
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
		new Setting(containerEl).setName(t().settings.dashboard.heading).setHeading();
		const s = this.plugin.settings;

		new Setting(containerEl)
			.setName(t().settings.dashboard.fitToPage)
			.setDesc(t().settings.dashboard.fitToPageDesc)
			.addToggle((t) =>
				t.setValue(s.fitToPage).onChange(async (v) => {
					s.fitToPage = v;
					await this.save();
				}),
			);

		new Setting(containerEl)
			.setName(t().settings.dashboard.compact)
			.setDesc(t().settings.dashboard.compactDesc)
			.addToggle((t) =>
				t.setValue(s.compact).onChange(async (v) => {
					s.compact = v;
					await this.save();
				}),
			);

		new Setting(containerEl)
			.setName(t().settings.dashboard.cardOpacity)
			.setDesc(t().settings.dashboard.cardOpacityDesc)
			.addSlider((sl) =>
				sl
				.setLimits(0, 1, 0.05)
				.setValue(s.cardOpacity)
				.onChange(async (v) => {
					s.cardOpacity = v;
					await this.save();
				}),
			);

		new Setting(containerEl)
			.setName(t().settings.dashboard.cards)
			.setDesc(t().settings.dashboard.cardsDesc);
	}

	// ---- Layout import / export ----------------------------------------

	private layoutSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(t().settings.layout.heading)
			.setDesc(t().settings.layout.headingDesc)
			.setHeading();
		const s = this.plugin.settings;

		new Setting(containerEl)
			.setName(t().settings.layout.export)
			.setDesc(t().settings.layout.exportDesc)
			.addButton((b) =>
				b
					.setButtonText(t().settings.layout.copyJson)
					.onClick(async () => {
						try {
							await navigator.clipboard.writeText(exportLayout(s));
							new Notice(t().notices.layoutCopied);
						} catch {
							new Notice(t().notices.clipboardUnavailable);
						}
					}),
			);

		let pending = "";
		new Setting(containerEl)
			.setName(t().settings.layout.import)
			.setDesc(t().settings.layout.importDesc)
			.addTextArea((txt) => {
				txt.setPlaceholder(t().settings.layout.importPlaceholder).onChange(
					(v) => (pending = v),
				);
				txt.inputEl.rows = 4;
				txt.inputEl.addClass("hearth-import-input");
			})
			.addButton((b) => {
				b.buttonEl.addClass("hearth-danger-btn");
				b.setButtonText(t().settings.layout.importButton).onClick(() => {
					if (!pending.trim()) {
						new Notice(t().notices.pasteLayoutFirst);
						return;
					}
					confirmAction(this.app, {
						title: t().settings.layout.importTitle,
						message: t().settings.layout.importMessage,
						confirmText: t().settings.layout.importButton,
						onConfirm: () => {
							const error = importLayout(s, pending);
							if (error) {
								new Notice(t().notices.layoutImportError(error));
								return;
							}
							void this.save();
							this.display();
							new Notice(t().notices.layoutImported);
						},
					});
				});
			});
	}
}
