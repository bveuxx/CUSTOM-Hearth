import { App, Modal, Notice, Setting } from "obsidian";
import { CommandPickerModal, FilePickerModal } from "./pickers";
import { CardKind, ClockConfig, DashboardCard, LinkItem, TasksConfig } from "./types";
import { confirmAction } from "./ui";
import { t } from "./i18n";

export interface CardSettingsOptions {
	/** The global favorites list (shared by all favorites cards). */
	favorites: string[];
	/** Whether this card is currently pinned to all dashboards. */
	isPinned: boolean;
	/** Pin/unpin this card across all dashboards. */
	setPinned: (pinned: boolean) => void;
	/** Persist the current settings (no view rebuild). */
	save: () => void;
	/** Rebuild the dashboard view to reflect content/layout changes. */
	rerender: () => void;
	/** Remove this card from the dashboard. */
	remove: () => void;
	/** Other dashboards this card can be copied to (id + name). */
	otherDashboards: { id: string; name: string }[];
	/** Copy this card onto the end of another dashboard. */
	copyToDashboard: (targetId: string) => void;
}

/**
 * The single place to configure a card — opened from the card itself in arrange
 * mode. Covers kind, title, kind-specific content, colors and size so nothing
 * has to be hunted for in the plugin settings tab.
 */
export class CardSettingsModal extends Modal {
	private card: DashboardCard;
	private opts: CardSettingsOptions;

	constructor(app: App, card: DashboardCard, opts: CardSettingsOptions) {
		super(app);
		this.card = card;
		this.opts = opts;
	}

	onOpen(): void {
		this.titleEl.setText(t().editors.title);
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		const card = this.card;

		new Setting(contentEl).setName(t().editors.type).addDropdown((d) => {
			(Object.keys(t().editors.kinds) as CardKind[]).forEach((k) => {
				d.addOption(k, t().editors.kinds[k]);
			});
			d.setValue(card.kind).onChange((v) => {
				card.kind = v as CardKind;
				this.opts.save();
				this.render();
			});
		});

		new Setting(contentEl).setName(t().editors.cardTitle).addText((txt) =>
			txt.setPlaceholder(t().editors.cardTitlePlaceholder).setValue(card.title ?? "").onChange((v) => {
				card.title = v;
				this.opts.save();
			}),
		);

		this.contentSection(contentEl);
		this.colorsSection(contentEl);
		this.sizeSection(contentEl);
		this.pinSection(contentEl);
		this.copySection(contentEl);

		new Setting(contentEl)
			.addButton((b) => {
				b.setButtonText(t().editors.removeCard).onClick(() => {
					confirmAction(this.app, {
						title: t().editors.removeCardTitle,
						message: t().editors.removeCardMessage(this.card.title?.trim() || t().editors.thisCard),
						confirmText: t().editors.removeCardConfirm,
						onConfirm: () => {
							this.opts.remove();
							this.close();
						},
					});
				});
				b.buttonEl.addClass("hearth-danger-btn");
			})
			.addButton((b) =>
				b
					.setButtonText(t().editors.done)
					.setCta()
					.onClick(() => this.close()),
			);
	}

	/** Kind-specific content controls. */
	private contentSection(containerEl: HTMLElement): void {
		const card = this.card;

		switch (card.kind) {
			case "embed": {
				const setting = new Setting(containerEl)
					.setName(t().editors.embed.file)
					.setDesc(t().editors.embed.fileDesc);
				setting.addText((txt) =>
					txt
						.setPlaceholder(t().editors.embed.filePlaceholder)
						.setValue(card.target ?? "")
						.onChange((v) => {
							card.target = v;
							this.opts.save();
						}),
				);
				setting.addExtraButton((b) =>
					b
						.setIcon("file-symlink")
						.setTooltip(t().editors.embed.pickFile)
						.onClick(() => {
							new FilePickerModal(this.app, (file) => {
								card.target = file.path;
								this.opts.save();
								this.render();
							}).open();
						}),
				);
			new Setting(containerEl)
				.setName(t().editors.embed.zoom)
				.setDesc(t().editors.embed.zoomDesc)
				.addSlider((s) => {
					s.setLimits(50, 200, 10)
						.setValue(Math.round((card.scale ?? 1) * 100))
						.setDynamicTooltip()
						.onChange((v) => {
							card.scale = v === 100 ? undefined : v / 100;
							this.opts.save();
						});
				})
				.addExtraButton((b) =>
					b
						.setIcon("rotate-ccw")
						.setTooltip(t().settings.resetSlider)
						.onClick(() => {
							card.scale = undefined;
							this.opts.save();
							this.render();
						}),
				);
				new Setting(containerEl)
					.setName(t().editors.embed.editable)
					.setDesc(t().editors.embed.editableDesc)
					.addToggle((t) =>
						t.setValue(card.editable ?? false).onChange((v) => {
							card.editable = v || undefined;
							this.opts.save();
						}),
					);
				break;
			}
			case "daily":
				new Setting(containerEl)
					.setName(t().editors.daily.editable)
					.setDesc(t().editors.daily.editableDesc)
					.addToggle((t) =>
						t.setValue(card.editable ?? false).onChange((v) => {
							card.editable = v || undefined;
							this.opts.save();
						}),
					);
				new Setting(containerEl)
					.setName(t().editors.daily.openButton)
					.setDesc(t().editors.daily.openButtonDesc)
					.addToggle((t) =>
						t.setValue(card.showOpenButton !== false).onChange((v) => {
							card.showOpenButton = v ? undefined : false;
							this.opts.save();
						}),
					);
				new Setting(containerEl)
					.setName(t().editors.daily.info)
					.setDesc(t().editors.daily.infoDesc);
				break;
			case "web":
				new Setting(containerEl).setName(t().editors.web.url).addText((txt) =>
					txt
						.setPlaceholder(t().editors.web.urlPlaceholder)
						.setValue(card.url ?? "")
						.onChange((v) => {
							card.url = v;
							this.opts.save();
						}),
				);
				new Setting(containerEl)
					.setName(t().editors.web.trusted)
					.setDesc(t().editors.web.trustedDesc)
					.addToggle((t) =>
						t.setValue(card.sandboxTrusted ?? false).onChange((v) => {
							card.sandboxTrusted = v || undefined;
							this.opts.save();
						}),
					);
				this.refreshSetting(containerEl);
				break;
			case "recent":
				new Setting(containerEl)
					.setName(t().editors.recent.count)
					.addText((t) => {
						t.setValue(String(card.count ?? 8)).onChange((v) => {
							const n = parseInt(v, 10);
							card.count = Number.isNaN(n) ? undefined : n;
							this.opts.save();
						});
						t.inputEl.type = "number";
						t.inputEl.addClass("hearth-count-input");
					});
				break;
			case "links":
				this.linksEditor(containerEl);
				break;
			case "commands":
				this.commandsEditor(containerEl);
				break;
			case "favorites":
				this.favoritesEditor(containerEl);
				break;
			case "clock":
				this.clockEditor(containerEl);
				break;
			case "tasks":
				this.tasksEditor(containerEl);
				break;
			case "search":
				this.savedSearchEditor(containerEl);
				break;
			case "calendar":
				this.calendarEditor(containerEl);
				break;
			case "heatmap":
				this.heatmapEditor(containerEl);
				break;
		}
	}

	private calendarEditor(containerEl: HTMLElement): void {
		const cfg = (this.card.calendar ??= {});
		new Setting(containerEl)
			.setName(t().editors.calendar.weekNumbers)
			.setDesc(t().editors.calendar.weekNumbersDesc)
			.addToggle((t) =>
				t.setValue(cfg.showWeekNumbers ?? false).onChange((v) => {
					cfg.showWeekNumbers = v || undefined;
					this.opts.save();
				}),
			);
		new Setting(containerEl)
			.setName(t().editors.calendar.heatmap)
			.setDesc(t().editors.calendar.heatmapDesc)
			.addToggle((t) =>
				t.setValue(cfg.heatmap ?? false).onChange((v) => {
					cfg.heatmap = v || undefined;
					this.opts.save();
					this.render();
				}),
			);
		if (cfg.heatmap) {
			new Setting(containerEl).setName(t().editors.calendar.heatmapCounts).addDropdown((d) => {
				d.addOption("modified", t().editors.metricOptions.modified);
				d.addOption("created", t().editors.metricOptions.created);
				d.setValue(cfg.heatmapMetric ?? "modified").onChange((v) => {
					cfg.heatmapMetric = v as NonNullable<typeof cfg.heatmapMetric>;
					this.opts.save();
				});
			});
		}
	}

	private heatmapEditor(containerEl: HTMLElement): void {
		const cfg = (this.card.heatmap ??= {});
		new Setting(containerEl).setName(t().editors.heatmap.metric).addDropdown((d) => {
			d.addOption("modified", t().editors.metricOptions.modified);
			d.addOption("created", t().editors.metricOptions.created);
			d.setValue(cfg.metric ?? "modified").onChange((v) => {
				cfg.metric = v as NonNullable<typeof cfg.metric>;
				this.opts.save();
			});
		});
		const weeks = new Setting(containerEl)
			.setName(t().editors.heatmap.weeks)
			.setDesc(t().editors.heatmap.weeksDesc);
		weeks.addSlider((s) => {
			s.setLimits(8, 53, 1)
				.setValue(cfg.weeks ?? 26)
				.setDynamicTooltip()
				.onChange((v) => {
					cfg.weeks = v === 26 ? undefined : v;
					this.opts.save();
				});
		});
		weeks.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().settings.resetSlider)
				.onClick(() => {
					cfg.weeks = undefined;
					this.opts.save();
					this.render();
				}),
		);
	}

	private savedSearchEditor(containerEl: HTMLElement): void {
		const cfg = (this.card.savedSearch ??= {});
		new Setting(containerEl)
			.setName(t().editors.savedSearch.query)
			.setDesc(t().editors.savedSearch.queryDesc)
			.addText((txt) =>
				txt
					.setPlaceholder(t().editors.savedSearch.queryPlaceholder)
					.setValue(cfg.query ?? "")
					.onChange((v) => {
						cfg.query = v;
						this.opts.save();
					}),
			);
		new Setting(containerEl).setName(t().editors.savedSearch.display).addDropdown((d) => {
			d.addOption("list", t().editors.savedSearch.displayList);
			d.addOption("tiles", t().editors.savedSearch.displayTiles);
			d.setValue(cfg.view ?? "list").onChange((v) => {
				cfg.view = v === "list" ? undefined : (v as "tiles");
				this.opts.save();
				this.opts.rerender();
			});
		});
		new Setting(containerEl)
			.setName(t().editors.savedSearch.maxResults)
			.addText((t) => {
				t.setValue(String(cfg.count ?? 12)).onChange((v) => {
					const n = parseInt(v, 10);
					cfg.count = Number.isNaN(n) || n <= 0 ? undefined : n;
					this.opts.save();
				});
				t.inputEl.type = "number";
				t.inputEl.addClass("hearth-count-input");
			});
	}

	/** Move an item within a list, then persist and re-render the editor. */
	private moveItem<T>(arr: T[], from: number, to: number): void {
		if (to < 0 || to >= arr.length) return;
		const [item] = arr.splice(from, 1);
		arr.splice(to, 0, item);
		this.opts.save();
		this.render();
	}

	/** Auto-refresh interval (seconds) for web cards. 0 = off. (Embed and daily
	 * cards update live from vault events and don't need this.) */
	private refreshSetting(containerEl: HTMLElement): void {
		const card = this.card;
		new Setting(containerEl)
			.setName(t().editors.web.autoRefresh)
			.setDesc(t().editors.web.autoRefreshDesc)
			.addText((txt) => {
				txt.setValue(String(card.refreshSec ?? 0)).onChange((v) => {
					const n = parseInt(v, 10);
					card.refreshSec = Number.isNaN(n) || n <= 0 ? undefined : n;
					this.opts.save();
				});
				txt.inputEl.type = "number";
				txt.inputEl.addClass("hearth-count-input");
				txt.inputEl.setAttribute("aria-label", t().editors.web.refreshIntervalAria);
			});
	}

	private linksEditor(containerEl: HTMLElement): void {
		new Setting(containerEl).setName(t().editors.links.heading).setHeading();
		const card = this.card;
		const links = (card.links ??= []);

		new Setting(containerEl)
			.setName(t().editors.links.autoShift)
			.setDesc(t().editors.links.autoShiftDesc)
			.addToggle((t) =>
				t.setValue(card.tileAutoFlow ?? false).onChange((v) => {
					card.tileAutoFlow = v;
					this.opts.save();
				}),
			);

		links.forEach((link, index) => {
			const row = new Setting(containerEl).setClass("hearth-link-setting");
			row.addText((txt) =>
				txt.setPlaceholder(t().editors.links.labelPlaceholder).setValue(link.label).onChange((v) => {
					link.label = v;
					this.opts.save();
				}),
			);
			row.addText((txt) =>
				txt.setPlaceholder(t().editors.links.iconPlaceholder).setValue(link.icon).onChange((v) => {
					link.icon = v;
					this.opts.save();
				}),
			);
			row.addDropdown((d) => {
				(Object.keys(t().editors.linkTypes) as LinkItem["type"][]).forEach((k) => {
					d.addOption(k, t().editors.linkTypes[k]);
				});
				d.setValue(link.type).onChange((v) => {
					link.type = v as LinkItem["type"];
					this.opts.save();
					// The target control differs by type (a command picker vs. a
					// free-text path/URL field), so rebuild the editor to swap it.
					this.render();
				});
			});
			if (link.type === "command") {
				// Commands are addressed by an opaque id (e.g. "editor:toggle-bold")
				// that users can't be expected to know, so offer a fuzzy picker over
				// the registered commands instead of a raw text field. This mirrors
				// how the "commands" card adds tiles and is what makes command links
				// actually fire.
				row.addButton((b) => {
					const current = link.target
						? this.app.commands.listCommands().find((c) => c.id === link.target)
						: undefined;
					b.setButtonText(current ? current.name : t().editors.links.pickCommand);
					b.onClick(() => {
						new CommandPickerModal(this.app, (command) => {
							link.target = command.id;
							// Prefill an empty label with the command name so the tile
							// isn't blank; leave a user-set label untouched.
							if (!link.label) link.label = command.name;
							// Adopt the command's own icon if the link is still on the
							// default; a user-chosen icon is left alone.
							if ((!link.icon || link.icon === "link") && command.icon) {
								link.icon = command.icon;
							}
							this.opts.save();
							this.render();
						}).open();
					});
				});
			} else {
				row.addText((txt) =>
					txt
						.setPlaceholder(
							link.type === "url" ? t().editors.links.targetUrl : t().editors.links.targetNote,
						)
						.setValue(link.target)
						.onChange((v) => {
							link.target = v;
							this.opts.save();
						}),
				);
			}
			row.addExtraButton((b) =>
				b
					.setIcon("chevron-up")
					.setTooltip(t().editors.links.moveUp)
					.setDisabled(index === 0)
					.onClick(() => this.moveItem(links, index, index - 1)),
			);
			row.addExtraButton((b) =>
				b
					.setIcon("chevron-down")
					.setTooltip(t().editors.links.moveDown)
					.setDisabled(index === links.length - 1)
					.onClick(() => this.moveItem(links, index, index + 1)),
			);
			row.addExtraButton((b) =>
				b
					.setIcon("trash-2")
					.setTooltip(t().editors.links.removeLink)
					.onClick(() => {
						links.splice(index, 1);
						this.opts.save();
						this.render();
					}),
			);
		});

		new Setting(containerEl).addButton((b) =>
			b.setButtonText(t().editors.links.addLink).onClick(() => {
				links.push({
					id: `link-${Date.now().toString(36)}`,
					label: "",
					icon: "link",
					target: "",
					type: "note",
				});
				this.opts.save();
				this.render();
			}),
		);
	}

	private commandsEditor(containerEl: HTMLElement): void {
		const card = this.card;
		new Setting(containerEl)
			.setName(t().editors.commands.autoShift)
			.setDesc(t().editors.commands.autoShiftDesc)
			.addToggle((t) =>
				t.setValue(card.tileAutoFlow ?? false).onChange((v) => {
					card.tileAutoFlow = v;
					this.opts.save();
				}),
			);
		const buttonSize = new Setting(containerEl)
			.setName(t().editors.commands.buttonSize)
			.setDesc(t().editors.commands.buttonSizeDesc);
		buttonSize.addSlider((s) => {
			s.setLimits(60, 180, 10)
				.setValue(card.tileSize ?? 90)
				.setDynamicTooltip()
				.onChange((v) => {
					card.tileSize = v === 90 ? undefined : v;
					this.opts.save();
				});
		});
		buttonSize.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().settings.resetSlider)
				.onClick(() => {
					card.tileSize = undefined;
					this.opts.save();
					this.render();
				}),
		);

		new Setting(containerEl).setName(t().editors.commands.heading).setHeading();
		const commands = (this.card.commands ??= []);

		commands.forEach((cmd, index) => {
			const row = new Setting(containerEl)
				.setClass("hearth-link-setting")
				.setName(cmd.name || cmd.id);
			row.addText((txt) =>
				txt
					.setPlaceholder(t().editors.commands.iconOptionalPlaceholder)
					.setValue(cmd.icon ?? "")
					.onChange((v) => {
						cmd.icon = v || undefined;
						this.opts.save();
					}),
			);
			row.addText((txt) => {
				txt.setPlaceholder(t().editors.commands.sizePlaceholder)
					.setValue(cmd.size ? String(cmd.size) : "")
					.onChange((v) => {
						const n = parseInt(v, 10);
						cmd.size = Number.isNaN(n) || n <= 0 ? undefined : n;
						this.opts.save();
					});
				txt.inputEl.type = "number";
				txt.inputEl.addClass("hearth-count-input");
				txt.inputEl.setAttribute("aria-label", t().editors.commands.tileSizeAria);
			});
			row.addExtraButton((b) =>
				b
					.setIcon("chevron-up")
					.setTooltip(t().editors.commands.moveUp)
					.setDisabled(index === 0)
					.onClick(() => this.moveItem(commands, index, index - 1)),
			);
			row.addExtraButton((b) =>
				b
					.setIcon("chevron-down")
					.setTooltip(t().editors.commands.moveDown)
					.setDisabled(index === commands.length - 1)
					.onClick(() => this.moveItem(commands, index, index + 1)),
			);
			row.addExtraButton((b) =>
				b
					.setIcon("trash-2")
					.setTooltip(t().editors.commands.removeCommand)
					.onClick(() => {
						commands.splice(index, 1);
						this.opts.save();
						this.render();
					}),
			);
		});

		new Setting(containerEl).addButton((b) =>
			b.setButtonText(t().editors.commands.addCommand).onClick(() => {
				new CommandPickerModal(this.app, (command) => {
					commands.push({ id: command.id, name: command.name, icon: command.icon });
					this.opts.save();
					this.render();
				}).open();
			}),
		);
	}

	private tasksEditor(containerEl: HTMLElement): void {
		const cfg = (this.card.tasks ??= {});

		new Setting(containerEl)
			.setName(t().editors.tasks.source)
			.setDesc(t().editors.tasks.sourceDesc)
			.addDropdown((d) => {
				d.addOption("checkbox", t().editors.tasks.sourceCheckbox);
				d.addOption("tasknotes", t().editors.tasks.sourceTaskNotes);
				d.setValue(cfg.source ?? "checkbox").onChange((v) => {
					cfg.source = v as TasksConfig["source"];
					this.opts.save();
				});
			});

		new Setting(containerEl)
			.setName(t().editors.tasks.layout)
			.setDesc(t().editors.tasks.layoutDesc)
			.addDropdown((d) => {
				d.addOption("list", t().editors.tasks.layoutList);
				d.addOption("kanban", t().editors.tasks.layoutKanban);
				d.setValue(cfg.layout ?? "list").onChange((v) => {
					cfg.layout = v === "kanban" ? "kanban" : undefined;
					this.opts.save();
					this.render();
				});
			});

		if (cfg.layout === "kanban" && (cfg.kanbanHidden?.length || cfg.kanbanOrder?.length)) {
			const reset = new Setting(containerEl)
				.setName(t().editors.tasks.kanbanColumns)
				.setDesc(
					cfg.kanbanHidden?.length
						? t().editors.tasks.kanbanHidden(cfg.kanbanHidden.join(", "))
						: t().editors.tasks.kanbanCustomOrder,
				);
			if (cfg.kanbanHidden?.length) {
				reset.addButton((b) =>
					b.setButtonText(t().editors.tasks.showAll).onClick(() => {
						cfg.kanbanHidden = undefined;
						this.opts.save();
						this.render();
					}),
				);
			}
			reset.addExtraButton((b) =>
				b
					.setIcon("rotate-ccw")
					.setTooltip(t().editors.tasks.resetColumns)
					.onClick(() => {
						cfg.kanbanHidden = undefined;
						cfg.kanbanOrder = undefined;
						this.opts.save();
						this.render();
					}),
			);
		}

		new Setting(containerEl)
			.setName(t().editors.tasks.showCompleted)
			.setDesc(
				cfg.layout === "kanban"
					? t().editors.tasks.showCompletedKanbanDesc
					: "",
			)
			.addToggle((t) =>
				t.setValue(cfg.showCompleted ?? false).onChange((v) => {
					cfg.showCompleted = v || undefined;
					this.opts.save();
				}),
			);

		new Setting(containerEl)
			.setName(t().editors.tasks.maxTasks)
			.setDesc(t().editors.tasks.maxTasksDesc)
			.addText((t) => {
				t.setValue(String(cfg.count ?? 10)).onChange((v) => {
					const n = parseInt(v, 10);
					cfg.count = Number.isNaN(n) || n <= 0 ? undefined : n;
					this.opts.save();
				});
				t.inputEl.type = "number";
				t.inputEl.addClass("hearth-count-input");
			});

		new Setting(containerEl).setName(t().editors.tasks.folders).setHeading();
		new Setting(containerEl).setName(t().editors.tasks.scope).addDropdown((d) => {
			d.addOption("all", t().editors.tasks.scopeAll);
			d.addOption("whitelist", t().editors.tasks.scopeWhitelist);
			d.addOption("blacklist", t().editors.tasks.scopeBlacklist);
			d.setValue(cfg.folderScope ?? "all").onChange((v) => {
				cfg.folderScope = v as TasksConfig["folderScope"];
				this.opts.save();
				this.render();
			});
		});

		if ((cfg.folderScope ?? "all") !== "all") {
			new Setting(containerEl)
				.setDesc(t().editors.tasks.foldersDesc)
				.addTextArea((t) => {
					t.setValue((cfg.folders ?? []).join("\n")).onChange((v) => {
						cfg.folders = v
							.split("\n")
							.map((s) => s.trim())
							.filter(Boolean);
						this.opts.save();
					});
					t.inputEl.rows = 3;
				});
		}
	}

	private favoritesEditor(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(t().editors.favorites.heading)
			.setDesc(t().editors.favorites.headingDesc)
			.setHeading();
		const favorites = this.opts.favorites;

		favorites.forEach((path, index) => {
			new Setting(containerEl)
				.setName(path)
				.addExtraButton((b) =>
					b
						.setIcon("chevron-up")
						.setTooltip(t().editors.favorites.moveUp)
						.setDisabled(index === 0)
						.onClick(() => this.moveItem(favorites, index, index - 1)),
				)
				.addExtraButton((b) =>
					b
						.setIcon("chevron-down")
						.setTooltip(t().editors.favorites.moveDown)
						.setDisabled(index === favorites.length - 1)
						.onClick(() => this.moveItem(favorites, index, index + 1)),
				)
				.addExtraButton((b) =>
					b
						.setIcon("trash-2")
						.setTooltip(t().editors.favorites.remove)
						.onClick(() => {
							favorites.splice(index, 1);
							this.opts.save();
							this.render();
						}),
				);
		});

		new Setting(containerEl).addButton((b) =>
			b.setButtonText(t().editors.favorites.addFavorite).onClick(() => {
				new FilePickerModal(
					this.app,
					(file) => {
						if (!favorites.includes(file.path)) {
							favorites.push(file.path);
							this.opts.save();
							this.render();
						}
					},
					t().pickers.noteToFavorite,
				).open();
			}),
		);
	}

	private clockEditor(containerEl: HTMLElement): void {
		const cfg = (this.card.clock ??= {});

		new Setting(containerEl).setName(t().editors.clock.style).addDropdown((d) => {
			d.addOption("digital", t().editors.clock.styleDigital);
			d.addOption("analog", t().editors.clock.styleAnalog);
			d.setValue(cfg.mode ?? "digital").onChange((v) => {
				cfg.mode = v as NonNullable<ClockConfig["mode"]>;
				this.opts.save();
				this.render();
			});
		});

		if (cfg.mode !== "analog") {
			new Setting(containerEl).setName(t().editors.clock.hour24).addToggle((t) =>
				t.setValue(cfg.use24Hour ?? false).onChange((v) => {
					cfg.use24Hour = v;
					this.opts.save();
				}),
			);
		}
		new Setting(containerEl).setName(t().editors.clock.showSeconds).addToggle((t) =>
			t.setValue(cfg.showSeconds ?? false).onChange((v) => {
				cfg.showSeconds = v;
				this.opts.save();
			}),
		);
		new Setting(containerEl).setName(t().editors.clock.showGreeting).addToggle((t) =>
			t.setValue(cfg.showGreeting !== false).onChange((v) => {
				cfg.showGreeting = v;
				this.opts.save();
			}),
		);
		new Setting(containerEl)
			.setName(t().editors.clock.playful)
			.setDesc(t().editors.clock.playfulDesc)
			.addToggle((t) =>
				t.setValue(cfg.playfulGreetings ?? false).onChange((v) => {
					cfg.playfulGreetings = v || undefined;
					this.opts.save();
				}),
			);
		new Setting(containerEl)
			.setName(t().editors.clock.greetingOverride)
			.setDesc(t().editors.clock.greetingOverrideDesc)
			.addText((t) =>
				t.setValue(cfg.greetingText ?? "").onChange((v) => {
					cfg.greetingText = v;
					this.opts.save();
				}),
			);
		new Setting(containerEl).setName(t().editors.clock.date).addDropdown((d) => {
			d.addOption("full", t().editors.clock.dateFull);
			d.addOption("long", t().editors.clock.dateLong);
			d.addOption("short", t().editors.clock.dateShort);
			d.addOption("iso", t().editors.clock.dateIso);
			d.addOption("weekday", t().editors.clock.dateWeekday);
			d.addOption("custom", t().editors.clock.dateCustom);
			d.addOption("none", t().editors.clock.dateNone);
			d.setValue(cfg.dateMode ?? "full").onChange((v) => {
				cfg.dateMode = v as NonNullable<ClockConfig["dateMode"]>;
				this.opts.save();
				this.render();
			});
		});
		if (cfg.dateMode === "custom") {
			new Setting(containerEl)
				.setName(t().editors.clock.customFormat)
				.setDesc(t().editors.clock.customFormatDesc)
				.addText((txt) =>
					txt.setPlaceholder(t().editors.clock.customFormatPlaceholder).setValue(cfg.dateFormat ?? "").onChange((v) => {
						cfg.dateFormat = v;
						this.opts.save();
					}),
				);
		}
	}

	private colorsSection(containerEl: HTMLElement): void {
		const card = this.card;
		const row = new Setting(containerEl)
			.setName(t().editors.colors.heading)
			.setDesc(t().editors.colors.headingDesc);

		row.addColorPicker((c) =>
			c.setValue(card.accent ?? "#7c5cff").onChange((v) => {
				card.accent = v;
				this.opts.save();
			}),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().editors.colors.clearAccent)
				.onClick(() => {
					card.accent = undefined;
					this.opts.save();
					this.render();
				}),
		);
		row.addColorPicker((c) =>
			c.setValue(card.background ?? "#000000").onChange((v) => {
				card.background = v;
				this.opts.save();
			}),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().editors.colors.clearBackground)
				.onClick(() => {
					card.background = undefined;
					this.opts.save();
					this.render();
				}),
		);

		const opacityRow = new Setting(containerEl)
			.setName(t().editors.colors.cardOpacity)
			.setDesc(t().editors.colors.cardOpacityDesc);
		opacityRow.addSlider((sl) =>
			sl
				.setLimits(0, 1, 0.05)
				.setValue(card.cardOpacity ?? 1)
				.setDynamicTooltip()
				.onChange((v) => {
					card.cardOpacity = v;
					this.opts.save();
					this.opts.rerender();
				}),
		);
		opacityRow.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip(t().editors.colors.useDashboardDefault)
				.onClick(() => {
					card.cardOpacity = undefined;
					this.opts.save();
					this.opts.rerender();
					this.render();
				}),
		);
	}

	private sizeSection(containerEl: HTMLElement): void {
		const card = this.card;
		const row = new Setting(containerEl)
			.setName(t().editors.size.heading)
			.setDesc(t().editors.size.headingDesc);

		row.addText((txt) => {
			txt.setValue(String(Math.round((card.fw ?? 0.25) * 100))).onChange((v) => {
				const n = parseInt(v, 10);
				if (Number.isNaN(n)) return;
				const fw = Math.max(2, Math.min(n, 100)) / 100;
				card.fw = fw;
				// Keep the card inside the board when it grows past the right edge.
				card.fx = Math.max(0, Math.min(card.fx ?? 0, 1 - fw));
				this.opts.save();
			});
			txt.inputEl.type = "number";
			txt.inputEl.addClass("hearth-count-input");
			txt.inputEl.setAttribute("aria-label", t().editors.size.widthAria);
		});
		row.addText((txt) => {
			txt.setValue(String(Math.round(card.fh ?? 184))).onChange((v) => {
				const n = parseInt(v, 10);
				if (Number.isNaN(n)) return;
				card.fh = Math.max(56, n);
				this.opts.save();
			});
			txt.inputEl.type = "number";
			txt.inputEl.addClass("hearth-count-input");
			txt.inputEl.setAttribute("aria-label", t().editors.size.heightAria);
		});
	}

	/** Pin/unpin this card so it appears on every dashboard. */
	private pinSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName(t().editors.pin.heading)
			.setDesc(t().editors.pin.headingDesc)
			.addToggle((t) =>
				t.setValue(this.opts.isPinned).onChange((v) => {
					this.opts.setPinned(v);
					this.opts.isPinned = v;
					this.opts.save();
				}),
			);
	}

	/** Copy this card (with its current content and settings) onto the end of
	 * another dashboard. The original stays in place. */
	private copySection(containerEl: HTMLElement): void {
		const targets = this.opts.otherDashboards;
		if (targets.length === 0) return;
		const row = new Setting(containerEl)
			.setName(t().editors.copy.heading)
			.setDesc(t().editors.copy.headingDesc);
		let dropdown: { getValue(): string } | null = null;
		row.addDropdown((d) => {
			for (const t of targets) d.addOption(t.id, t.name);
			dropdown = d;
		});
		row.addButton((b) =>
			b
				.setButtonText(t().editors.copy.copy)
				.setTooltip(t().editors.copy.copyTooltip)
				.onClick(() => {
					const id = dropdown?.getValue();
					if (!id) return;
					this.opts.copyToDashboard(id);
					new Notice(t().notices.cardCopied);
				}),
		);
	}

	onClose(): void {
		this.contentEl.empty();
		this.opts.rerender();
	}
}
