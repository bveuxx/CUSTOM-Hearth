import { App, Notice, PluginSettingTab, setIcon, Setting, SliderComponent } from "obsidian";
import type HearthPlugin from "./main";
import { FILE_TYPE_GROUPS, fileTypeLabel } from "./filetypes";
import { CommandPickerModal } from "./pickers";
import { BackgroundKind, DEFAULT_SETTINGS, defaultMobileActionButtons, MobileActionButton } from "./types";
import { exportLayout, importLayout } from "./layout";
import { confirmAction } from "./ui";
import { t } from "./i18n";

/** Keys of HomeSettings whose default lives in DEFAULT_SETTINGS as a number —
 * used to reset slider-backed settings back to their factory value. */
type NumericSettingKey =
	| "maxWidth"
	| "backgroundOpacity"
	| "backgroundBlur"
	| "cardOpacity";

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

		// Each section is wrapped in a foldable container whose collapsed state
		// is remembered across sessions in localStorage.
		this.section(containerEl, t().settings.appearance.heading, (body) =>
			this.appearanceSection(body),
		);
		this.section(containerEl, t().settings.background.heading, (body) =>
			this.backgroundSection(body),
		);
		this.section(containerEl, t().settings.behaviour.heading, (body) =>
			this.behaviourSection(body),
		);
		this.section(
			containerEl,
			t().settings.mobileActions.heading,
			t().settings.mobileActions.headingDesc,
			(body) => this.mobileActionsSection(body),
		);
		this.section(
			containerEl,
			t().settings.tasks.heading,
			t().settings.tasks.headingDesc,
			(body) => this.tasksSection(body),
		);
		this.section(
			containerEl,
			t().settings.filters.heading,
			t().settings.filters.headingDesc,
			(body) => this.filtersSection(body),
		);
		this.section(containerEl, t().settings.dashboard.heading, (body) =>
			this.dashboardSection(body),
		);
		this.section(containerEl, t().settings.layout.heading, t().settings.layout.headingDesc, (body) =>
			this.layoutSection(body),
		);
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

	// ---- Foldable section wrapper --------------------------------------

	/** Wrap a section in a collapsible block. The heading toggles visibility of
	 * the body; the collapsed state is persisted per-section in localStorage so
	 * long settings panels can be tamed and stay tamed. */
	private section(
		containerEl: HTMLElement,
		title: string,
		desc: string | undefined,
		render: (body: HTMLElement) => void,
	): void;
	private section(
		containerEl: HTMLElement,
		title: string,
		render: (body: HTMLElement) => void,
	): void;
	private section(
		containerEl: HTMLElement,
		title: string,
		descOrRender: string | undefined | ((body: HTMLElement) => void),
		maybeRender?: (body: HTMLElement) => void,
	): void {
		const desc = typeof descOrRender === "string" ? descOrRender : undefined;
		const render = typeof descOrRender === "function" ? descOrRender : maybeRender!;

		const wrap = containerEl.createDiv("hearth-section");
		const head = wrap.createDiv("hearth-section-head");
		head.setAttribute("role", "button");
		head.setAttribute("tabindex", "0");
		const titles = head.createDiv("hearth-section-titles");
		titles.createDiv({ cls: "hearth-section-title", text: title });
		if (desc) titles.createDiv({ cls: "hearth-section-desc", text: desc });
		const chevron = head.createDiv("hearth-section-chevron");
		setIcon(chevron, "chevron-down");

		const body = wrap.createDiv("hearth-section-body");
		render(body);

		const key = `hearth-section-${title}`;
		let collapsed = false;
		try {
			collapsed = localStorage.getItem(key) === "1";
		} catch {
			// localStorage can throw in locked-down contexts; default to open.
		}
		const apply = () => {
			wrap.toggleClass("is-collapsed", collapsed);
			body.style.display = collapsed ? "none" : "";
			chevron.toggleClass("is-rotated", collapsed);
			head.setAttribute("aria-expanded", String(!collapsed));
			head.setAttribute("aria-label", collapsed ? t().settings.expandSection : t().settings.collapseSection);
		};
		apply();
		head.addEventListener("click", () => {
			collapsed = !collapsed;
			try {
				localStorage.setItem(key, collapsed ? "1" : "0");
			} catch {
				// ignore — non-persistent folding is fine as a fallback.
			}
			apply();
		});
		head.addEventListener("keydown", (e) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				head.click();
			}
		});
	}

	// ---- Slider reset helper -------------------------------------------

	/** Add a reset (rotate-ccw) extra button to a slider Setting that restores
	 * the factory default from DEFAULT_SETTINGS. The slider keeps a dynamic
	 * tooltip showing the live value. */
	private addSliderReset(
		setting: Setting,
		sl: SliderComponent,
		key: NumericSettingKey,
	): void {
		sl.setDynamicTooltip();
		setting.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().settings.resetSlider)
				.onClick(async () => {
					const def = DEFAULT_SETTINGS[key] as number;
					(this.plugin.settings as unknown as Record<string, number>)[key] = def;
					sl.setValue(def);
					await this.save();
				}),
		);
	}

	// ---- Appearance -----------------------------------------------------

	private appearanceSection(containerEl: HTMLElement): void {
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
			.setName(t().settings.appearance.newNoteButtonMode)
			.setDesc(t().settings.appearance.newNoteButtonModeDesc)
			.addDropdown((d) => {
				d.addOption("split", t().settings.appearance.newNoteButtonModeSplit)
					.addOption("newNote", t().settings.appearance.newNoteButtonModeNewNote)
					.addOption("searchOnline", t().settings.appearance.newNoteButtonModeSearchOnline)
					.setValue(s.newNoteButtonMode)
					.onChange(async (v) => {
						s.newNoteButtonMode = v as typeof s.newNoteButtonMode;
						await this.save();
					});
			});

		const width = new Setting(containerEl)
			.setName(t().settings.appearance.contentWidth)
			.setDesc(t().settings.appearance.contentWidthDesc);
		width.addSlider((sl) => {
			sl.setLimits(700, 1600, 20)
				.setValue(s.maxWidth)
				.onChange(async (v) => {
					s.maxWidth = v;
					await this.save();
				});
			this.addSliderReset(width, sl, "maxWidth");
		});
	}

	// ---- Background -----------------------------------------------------

	private backgroundSection(containerEl: HTMLElement): void {
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
			const opacity = new Setting(containerEl)
				.setName(t().settings.background.opacity);
			opacity.addSlider((sl) => {
				sl.setLimits(0, 1, 0.05)
					.setValue(s.backgroundOpacity)
					.onChange(async (v) => {
						s.backgroundOpacity = v;
						await this.save();
					});
				this.addSliderReset(opacity, sl, "backgroundOpacity");
			});

			const blur = new Setting(containerEl)
				.setName(t().settings.background.blur)
				.setDesc(t().settings.background.blurDesc);
			blur.addSlider((sl) => {
				sl.setLimits(0, 40, 1)
					.setValue(s.backgroundBlur)
					.onChange(async (v) => {
						s.backgroundBlur = v;
						await this.save();
					});
				this.addSliderReset(blur, sl, "backgroundBlur");
			});
		}
	}

	// ---- Behaviour ------------------------------------------------------

	private behaviourSection(containerEl: HTMLElement): void {
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
					.setIcon("terminal square")
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
							icon: "terminal square",
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

		const cardOpacity = new Setting(containerEl)
			.setName(t().settings.dashboard.cardOpacity)
			.setDesc(t().settings.dashboard.cardOpacityDesc);
		cardOpacity.addSlider((sl) => {
			sl.setLimits(0, 1, 0.05)
				.setValue(s.cardOpacity)
				.onChange(async (v) => {
					s.cardOpacity = v;
					await this.save();
				});
			this.addSliderReset(cardOpacity, sl, "cardOpacity");
		});

		new Setting(containerEl)
			.setName(t().settings.dashboard.cards)
			.setDesc(t().settings.dashboard.cardsDesc);
	}

	// ---- Layout import / export ----------------------------------------

	private layoutSection(containerEl: HTMLElement): void {
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
