import { App, Modal, Setting } from "obsidian";
import { CommandPickerModal, FilePickerModal } from "./pickers";
import { CardKind, ClockConfig, DashboardCard, LinkItem } from "./types";

const CARD_KIND_LABELS: Record<CardKind, string> = {
	embed: "Embed (note / image / base)",
	daily: "Daily note (today)",
	web: "Web page (iframe)",
	bookmarks: "Bookmarks",
	favorites: "Favorites",
	text: "Text / jot-down",
	recent: "Recent files",
	links: "Links / launchpad",
	commands: "Commands",
	clock: "Clock & greeting",
};

const LINK_TYPE_LABELS: Record<LinkItem["type"], string> = {
	note: "Note",
	url: "URL",
	command: "Command",
};

export interface CardSettingsOptions {
	/** Number of grid columns, used to clamp the card width. */
	gridColumns: number;
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
		this.titleEl.setText("Card settings");
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		const card = this.card;

		new Setting(contentEl).setName("Type").addDropdown((d) => {
			(Object.keys(CARD_KIND_LABELS) as CardKind[]).forEach((k) => {
				d.addOption(k, CARD_KIND_LABELS[k]);
			});
			d.setValue(card.kind).onChange((v) => {
				card.kind = v as CardKind;
				this.opts.save();
				this.render();
			});
		});

		new Setting(contentEl).setName("Title").addText((t) =>
			t.setPlaceholder("Title").setValue(card.title ?? "").onChange((v) => {
				card.title = v;
				this.opts.save();
			}),
		);

		this.contentSection(contentEl);
		this.colorsSection(contentEl);
		this.sizeSection(contentEl);
		this.pinSection(contentEl);

		new Setting(contentEl)
			.addButton((b) => {
				b.setButtonText("Remove card").onClick(() => {
					this.opts.remove();
					this.close();
				});
				b.buttonEl.addClass("hearth-danger-btn");
			})
			.addButton((b) =>
				b
					.setButtonText("Done")
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
					.setName("File to embed")
					.setDesc("A note, image, canvas or .base file in your vault.");
				setting.addText((t) =>
					t
						.setPlaceholder("File path to embed")
						.setValue(card.target ?? "")
						.onChange((v) => {
							card.target = v;
							this.opts.save();
						}),
				);
				setting.addExtraButton((b) =>
					b
						.setIcon("file-symlink")
						.setTooltip("Pick a file")
						.onClick(() => {
							new FilePickerModal(this.app, (file) => {
								card.target = file.path;
								this.opts.save();
								this.render();
							}).open();
						}),
				);
				new Setting(containerEl)
					.setName("Zoom")
					.setDesc("Scale the embedded content. Applies when you close this dialog.")
					.addSlider((s) =>
						s
							.setLimits(50, 200, 10)
							.setValue(Math.round((card.scale ?? 1) * 100))
							.onChange((v) => {
								card.scale = v === 100 ? undefined : v / 100;
								this.opts.save();
							}),
					);
				new Setting(containerEl)
					.setName("Editable")
					.setDesc("Edit the embedded note's text in place (Markdown notes only).")
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
					.setName("Editable")
					.setDesc("Edit today's note in place instead of read-only. Saves to the vault.")
					.addToggle((t) =>
						t.setValue(card.editable ?? false).onChange((v) => {
							card.editable = v || undefined;
							this.opts.save();
						}),
					);
				new Setting(containerEl)
					.setName("Open button")
					.setDesc("Show a button to open today's note in the editor.")
					.addToggle((t) =>
						t.setValue(card.showOpenButton !== false).onChange((v) => {
							card.showOpenButton = v ? undefined : false;
							this.opts.save();
						}),
					);
				new Setting(containerEl)
					.setName("Daily notes")
					.setDesc("Today's note is resolved from the core Daily notes plugin's date format and folder. The card updates live as you edit.");
				break;
			case "web":
				new Setting(containerEl).setName("URL").addText((t) =>
					t
						.setPlaceholder("https://example.com")
						.setValue(card.url ?? "")
						.onChange((v) => {
							card.url = v;
							this.opts.save();
						}),
				);
				this.refreshSetting(containerEl);
				break;
			case "recent":
				new Setting(containerEl)
					.setName("Number of files")
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
		}
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
			.setName("Auto-refresh")
			.setDesc("Re-render this card every N seconds to pick up changes. 0 = off.")
			.addText((t) => {
				t.setValue(String(card.refreshSec ?? 0)).onChange((v) => {
					const n = parseInt(v, 10);
					card.refreshSec = Number.isNaN(n) || n <= 0 ? undefined : n;
					this.opts.save();
				});
				t.inputEl.type = "number";
				t.inputEl.addClass("hearth-count-input");
				t.inputEl.setAttribute("aria-label", "Refresh interval in seconds");
			});
	}

	private linksEditor(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Links").setHeading();
		const links = (this.card.links ??= []);

		links.forEach((link, index) => {
			const row = new Setting(containerEl).setClass("hearth-link-setting");
			row.addText((t) =>
				t.setPlaceholder("Label").setValue(link.label).onChange((v) => {
					link.label = v;
					this.opts.save();
				}),
			);
			row.addText((t) =>
				t.setPlaceholder("Icon").setValue(link.icon).onChange((v) => {
					link.icon = v;
					this.opts.save();
				}),
			);
			row.addDropdown((d) => {
				(Object.keys(LINK_TYPE_LABELS) as LinkItem["type"][]).forEach((k) => {
					d.addOption(k, LINK_TYPE_LABELS[k]);
				});
				d.setValue(link.type).onChange((v) => {
					link.type = v as LinkItem["type"];
					this.opts.save();
				});
			});
			row.addText((t) =>
				t
					.setPlaceholder("Target (path / URL / command id)")
					.setValue(link.target)
					.onChange((v) => {
						link.target = v;
						this.opts.save();
					}),
			);
			row.addExtraButton((b) =>
				b
					.setIcon("chevron-up")
					.setTooltip("Move up")
					.setDisabled(index === 0)
					.onClick(() => this.moveItem(links, index, index - 1)),
			);
			row.addExtraButton((b) =>
				b
					.setIcon("chevron-down")
					.setTooltip("Move down")
					.setDisabled(index === links.length - 1)
					.onClick(() => this.moveItem(links, index, index + 1)),
			);
			row.addExtraButton((b) =>
				b
					.setIcon("trash-2")
					.setTooltip("Remove link")
					.onClick(() => {
						links.splice(index, 1);
						this.opts.save();
						this.render();
					}),
			);
		});

		new Setting(containerEl).addButton((b) =>
			b.setButtonText("Add link").onClick(() => {
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
			.setName("Button size")
			.setDesc("Size of the command tiles. Applies when you close this dialog.")
			.addSlider((s) =>
				s
					.setLimits(60, 180, 10)
					.setValue(card.tileSize ?? 90)
					.onChange((v) => {
						card.tileSize = v === 90 ? undefined : v;
						this.opts.save();
					}),
			);

		new Setting(containerEl).setName("Commands").setHeading();
		const commands = (this.card.commands ??= []);

		commands.forEach((cmd, index) => {
			const row = new Setting(containerEl)
				.setClass("hearth-link-setting")
				.setName(cmd.name || cmd.id);
			row.addText((t) =>
				t
					.setPlaceholder("Icon (optional)")
					.setValue(cmd.icon ?? "")
					.onChange((v) => {
						cmd.icon = v || undefined;
						this.opts.save();
					}),
			);
			row.addExtraButton((b) =>
				b
					.setIcon("chevron-up")
					.setTooltip("Move up")
					.setDisabled(index === 0)
					.onClick(() => this.moveItem(commands, index, index - 1)),
			);
			row.addExtraButton((b) =>
				b
					.setIcon("chevron-down")
					.setTooltip("Move down")
					.setDisabled(index === commands.length - 1)
					.onClick(() => this.moveItem(commands, index, index + 1)),
			);
			row.addExtraButton((b) =>
				b
					.setIcon("trash-2")
					.setTooltip("Remove command")
					.onClick(() => {
						commands.splice(index, 1);
						this.opts.save();
						this.render();
					}),
			);
		});

		new Setting(containerEl).addButton((b) =>
			b.setButtonText("Add command").onClick(() => {
				new CommandPickerModal(this.app, (command) => {
					commands.push({ id: command.id, name: command.name, icon: command.icon });
					this.opts.save();
					this.render();
				}).open();
			}),
		);
	}

	private favoritesEditor(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Favorites")
			.setDesc("Notes shown by every favorites card.")
			.setHeading();
		const favorites = this.opts.favorites;

		favorites.forEach((path, index) => {
			new Setting(containerEl)
				.setName(path)
				.addExtraButton((b) =>
					b
						.setIcon("chevron-up")
						.setTooltip("Move up")
						.setDisabled(index === 0)
						.onClick(() => this.moveItem(favorites, index, index - 1)),
				)
				.addExtraButton((b) =>
					b
						.setIcon("chevron-down")
						.setTooltip("Move down")
						.setDisabled(index === favorites.length - 1)
						.onClick(() => this.moveItem(favorites, index, index + 1)),
				)
				.addExtraButton((b) =>
					b
						.setIcon("trash-2")
						.setTooltip("Remove")
						.onClick(() => {
							favorites.splice(index, 1);
							this.opts.save();
							this.render();
						}),
				);
		});

		new Setting(containerEl).addButton((b) =>
			b.setButtonText("Add favorite").onClick(() => {
				new FilePickerModal(
					this.app,
					(file) => {
						if (!favorites.includes(file.path)) {
							favorites.push(file.path);
							this.opts.save();
							this.render();
						}
					},
					"Pick a note to favorite…",
				).open();
			}),
		);
	}

	private clockEditor(containerEl: HTMLElement): void {
		const cfg = (this.card.clock ??= {});

		new Setting(containerEl).setName("Style").addDropdown((d) => {
			d.addOption("digital", "Digital");
			d.addOption("analog", "Analog");
			d.setValue(cfg.mode ?? "digital").onChange((v) => {
				cfg.mode = v as NonNullable<ClockConfig["mode"]>;
				this.opts.save();
				this.render();
			});
		});

		if (cfg.mode !== "analog") {
			new Setting(containerEl).setName("24-hour time").addToggle((t) =>
				t.setValue(cfg.use24Hour ?? false).onChange((v) => {
					cfg.use24Hour = v;
					this.opts.save();
				}),
			);
		}
		new Setting(containerEl).setName("Show seconds").addToggle((t) =>
			t.setValue(cfg.showSeconds ?? false).onChange((v) => {
				cfg.showSeconds = v;
				this.opts.save();
			}),
		);
		new Setting(containerEl).setName("Show greeting").addToggle((t) =>
			t.setValue(cfg.showGreeting !== false).onChange((v) => {
				cfg.showGreeting = v;
				this.opts.save();
			}),
		);
		new Setting(containerEl)
			.setName("Playful greetings")
			.setDesc("Cheeky, randomised greetings instead of the plain ones.")
			.addToggle((t) =>
				t.setValue(cfg.playfulGreetings ?? false).onChange((v) => {
					cfg.playfulGreetings = v || undefined;
					this.opts.save();
				}),
			);
		new Setting(containerEl)
			.setName("Greeting override")
			.setDesc("Leave empty for the automatic greeting.")
			.addText((t) =>
				t.setValue(cfg.greetingText ?? "").onChange((v) => {
					cfg.greetingText = v;
					this.opts.save();
				}),
			);
		new Setting(containerEl).setName("Date").addDropdown((d) => {
			d.addOption("full", "Weekday, day month");
			d.addOption("long", "Weekday, day month year");
			d.addOption("short", "Short (locale)");
			d.addOption("iso", "ISO (2026-06-29)");
			d.addOption("weekday", "Weekday only");
			d.addOption("custom", "Custom format…");
			d.addOption("none", "Hidden");
			d.setValue(cfg.dateMode ?? "full").onChange((v) => {
				cfg.dateMode = v as NonNullable<ClockConfig["dateMode"]>;
				this.opts.save();
				this.render();
			});
		});
		if (cfg.dateMode === "custom") {
			new Setting(containerEl)
				.setName("Custom date format")
				.setDesc("A moment.js format, e.g. ddd D MMM or YYYY/MM/DD.")
				.addText((t) =>
					t.setPlaceholder("ddd D MMM").setValue(cfg.dateFormat ?? "").onChange((v) => {
						cfg.dateFormat = v;
						this.opts.save();
					}),
				);
		}
	}

	private colorsSection(containerEl: HTMLElement): void {
		const card = this.card;
		const row = new Setting(containerEl)
			.setName("Colors")
			.setDesc("Accent and background tint for this card.");

		row.addColorPicker((c) =>
			c.setValue(card.accent ?? "#7c5cff").onChange((v) => {
				card.accent = v;
				this.opts.save();
			}),
		);
		row.addExtraButton((b) =>
			b
				.setIcon("rotate-ccw")
				.setTooltip("Clear accent")
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
				.setTooltip("Clear background")
				.onClick(() => {
					card.background = undefined;
					this.opts.save();
					this.render();
				}),
		);
	}

	private sizeSection(containerEl: HTMLElement): void {
		const card = this.card;
		const row = new Setting(containerEl)
			.setName("Size")
			.setDesc("Width (columns) and height (rows) on the grid.");

		row.addText((t) => {
			t.setValue(String(card.w)).onChange((v) => {
				const n = parseInt(v, 10);
				if (Number.isNaN(n)) return;
				card.w = Math.max(1, Math.min(n, this.opts.gridColumns));
				this.opts.save();
			});
			t.inputEl.type = "number";
			t.inputEl.addClass("hearth-count-input");
			t.inputEl.setAttribute("aria-label", "Width in columns");
		});
		row.addText((t) => {
			t.setValue(String(card.h)).onChange((v) => {
				const n = parseInt(v, 10);
				if (Number.isNaN(n)) return;
				card.h = Math.max(1, n);
				this.opts.save();
			});
			t.inputEl.type = "number";
			t.inputEl.addClass("hearth-count-input");
			t.inputEl.setAttribute("aria-label", "Height in rows");
		});
	}

	/** Pin/unpin this card so it appears on every dashboard. */
	private pinSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName("Pin to all dashboards")
			.setDesc("Show this card on every dashboard, sharing one definition and position.")
			.addToggle((t) =>
				t.setValue(this.opts.isPinned).onChange((v) => {
					this.opts.setPinned(v);
					this.opts.isPinned = v;
					this.opts.save();
				}),
			);
	}

	onClose(): void {
		this.contentEl.empty();
		this.opts.rerender();
	}
}
