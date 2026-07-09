import { App, Notice, PluginSettingTab, setIcon, Setting, SliderComponent, TextComponent } from "obsidian";
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

/** Keys of HomeSettings whose default lives in DEFAULT_SETTINGS as a string and
 * would be awkward to reconstruct by hand (frontmatter field names, the search
 * placeholder, the title) — used to reset text-backed settings to their factory
 * value. */
type StringSettingKey =
	| "title"
	| "searchPlaceholder"
	| "taskNotesStatusField"
	| "taskNotesDueField"
	| "taskNotesPriorityField"
	| "taskNotesDoneValue";

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
		// is remembered across sessions in localStorage. Ordered by concern:
		// look & feel, then search, then behaviour/mobile, then the dashboard
		// and its cards, and finally layout backup/restore.
		this.section(
			containerEl,
			t().settings.appearance.heading,
			t().settings.appearance.headingDesc,
			(body) => this.appearanceSection(body),
		);
		this.section(
			containerEl,
			t().settings.background.heading,
			t().settings.background.headingDesc,
			(body) => this.backgroundSection(body),
		);
		this.section(
			containerEl,
			t().settings.filters.heading,
			t().settings.filters.headingDesc,
			(body) => this.filtersSection(body),
		);
		this.section(
			containerEl,
			t().settings.behaviour.heading,
			t().settings.behaviour.headingDesc,
			(body) => this.behaviourSection(body),
		);
		this.section(
			containerEl,
			t().settings.mobileActions.heading,
			t().settings.mobileActions.headingDesc,
			(body) => this.mobileActionsSection(body),
		);
		this.section(
			containerEl,
			t().settings.dashboard.heading,
			t().settings.dashboard.headingDesc,
			(body) => this.dashboardSection(body),
		);
		this.section(
			containerEl,
			t().settings.tasks.heading,
			t().settings.tasks.headingDesc,
			(body) => this.tasksSection(body),
		);
		this.section(
			containerEl,
			t().settings.layout.heading,
			t().settings.layout.headingDesc,
			(body) => this.layoutSection(body),
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

		// Persist the collapsed state per-section and per-vault via Obsidian's
		// vault-scoped local storage.
		const key = `hearth-section-${title}`;
		let collapsed = this.app.loadLocalStorage(key) === "1";
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
			this.app.saveLocalStorage(key, collapsed ? "1" : null);
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
	 * the factory default from DEFAULT_SETTINGS. The current value is surfaced by
	 * the slider's own dynamic tooltip (see the sliders below). */
	private addSliderReset(
		setting: Setting,
		sl: SliderComponent,
		key: NumericSettingKey,
	): void {
		setting.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().settings.resetSlider)
				.onClick(async () => {
					const def = DEFAULT_SETTINGS[key];
					(this.plugin.settings as unknown as Record<string, number>)[key] = def;
					sl.setValue(def);
					await this.save();
				}),
		);
	}

	/** Add a reset (rotate-ccw) extra button to a text Setting that restores the
	 * factory default from DEFAULT_SETTINGS. Used for fields whose default string
	 * would be troublesome to reconstruct if overwritten. */
	private addTextReset(
		setting: Setting,
		txt: TextComponent,
		key: StringSettingKey,
	): void {
		setting.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().settings.resetField)
				.onClick(async () => {
					const def = DEFAULT_SETTINGS[key];
					(this.plugin.settings as unknown as Record<string, string>)[key] = def;
					txt.setValue(def);
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

		const title = new Setting(containerEl)
			.setName(t().settings.appearance.title);
		title.addText((txt) => {
			txt.setValue(s.title).onChange(async (v) => {
				s.title = v;
				await this.save();
			});
			this.addTextReset(title, txt, "title");
		});

		new Setting(containerEl)
			.setName(t().settings.appearance.logo)
			.setDesc(t().settings.appearance.logoDesc)
			.addText((t) =>
				t.setValue(s.logo).onChange(async (v) => {
					s.logo = v;
					await this.save();
				}),
			);

		const searchPlaceholder = new Setting(containerEl)
			.setName(t().settings.appearance.searchPlaceholder);
		searchPlaceholder.addText((txt) => {
			txt.setValue(s.searchPlaceholder).onChange(async (v) => {
				s.searchPlaceholder = v;
				await this.save();
			});
			this.addTextReset(searchPlaceholder, txt, "searchPlaceholder");
		});

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
				d.addOption("newNote", t().settings.appearance.newNoteButtonModeNewNote)
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
				.setDynamicTooltip()
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
					.setDynamicTooltip()
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
					.setDynamicTooltip()
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
			// A button can run a command, open a note/file, or open a URL — pick the
			// kind here, then the target control below swaps to match (a command
			// picker vs. a free-text path/URL field), exactly like a launchpad tile.
			row.addDropdown((d) => {
				(Object.keys(t().editors.linkTypes) as Array<"note" | "url" | "command">).forEach((k) => {
					d.addOption(k, t().editors.linkTypes[k]);
				});
				d.setValue(btn.type ?? "command").onChange((v) => {
					btn.type = v as MobileActionButton["type"];
					// Target semantics differ per type, so clear a stale target when
					// switching kinds.
					btn.target = "";
					btn.commandId = undefined;
					void this.save();
					this.display();
				});
			});
			const currentTarget = btn.target ?? btn.commandId ?? "";
			if ((btn.type ?? "command") === "command") {
				// Show a proper button labelled with the picked command (or a
				// prompt when none is set yet) instead of a tiny icon, so which
				// command a button runs — and how to change it — is always visible.
				row.addButton((b) => {
					const current = currentTarget
						? this.app.commands.listCommands().find((c) => c.id === currentTarget)
						: undefined;
					b.setButtonText(current ? current.name : t().settings.mobileActions.pickCommand);
					b.setTooltip(currentTarget ? t().settings.mobileActions.commandTooltip(currentTarget) : t().settings.mobileActions.pickCommand);
					b.onClick(() => {
						new CommandPickerModal(this.app, (command) => {
							btn.type = "command";
							btn.target = command.id;
							btn.commandId = undefined;
							if (!btn.label.trim()) btn.label = command.name;
							void this.save();
							this.display();
						}).open();
					});
				});
			} else {
				row.addText((txt) =>
					txt
						.setPlaceholder(
							btn.type === "url" ? t().editors.links.targetUrl : t().editors.links.targetNote,
						)
						.setValue(currentTarget)
						.onChange(async (v) => {
							btn.target = v;
							btn.commandId = undefined;
							await this.save();
						}),
				);
			}
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
				b.setButtonText(t().settings.mobileActions.addButton).onClick(async () => {
					// Add an empty button first; the row's type dropdown and target
					// control then let the user choose what it does — no forced
					// command pick up front.
					buttons.push({
						id: `action-${Date.now().toString(36)}`,
						label: "",
						icon: "circle",
						type: "command",
						target: "",
					});
					await this.save();
					this.display();
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

		const statusField = new Setting(containerEl)
			.setName(t().settings.tasks.statusField);
		statusField.addText((txt) => {
			txt.setValue(s.taskNotesStatusField).onChange(async (v) => {
				s.taskNotesStatusField = v;
				await this.save();
			});
			this.addTextReset(statusField, txt, "taskNotesStatusField");
		});

		const dueField = new Setting(containerEl)
			.setName(t().settings.tasks.dueField);
		dueField.addText((txt) => {
			txt.setValue(s.taskNotesDueField).onChange(async (v) => {
				s.taskNotesDueField = v;
				await this.save();
			});
			this.addTextReset(dueField, txt, "taskNotesDueField");
		});

		const priorityField = new Setting(containerEl)
			.setName(t().settings.tasks.priorityField)
			.setDesc(t().settings.tasks.priorityFieldDesc);
		priorityField.addText((txt) => {
			txt.setValue(s.taskNotesPriorityField).onChange(async (v) => {
				s.taskNotesPriorityField = v;
				await this.save();
			});
			this.addTextReset(priorityField, txt, "taskNotesPriorityField");
		});

		const doneValue = new Setting(containerEl)
			.setName(t().settings.tasks.doneValue);
		doneValue.addText((txt) => {
			txt.setValue(s.taskNotesDoneValue).onChange(async (v) => {
				s.taskNotesDoneValue = v;
				await this.save();
			});
			this.addTextReset(doneValue, txt, "taskNotesDoneValue");
		});
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
				.setDynamicTooltip()
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
