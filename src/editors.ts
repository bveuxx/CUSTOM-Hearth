import { App, Modal, Setting } from "obsidian";
import { FilePickerModal } from "./pickers";
import { DashboardCard, LinkItem } from "./types";

const LINK_TYPE_LABELS: Record<LinkItem["type"], string> = {
	note: "Note",
	url: "URL",
	command: "Command",
};

/** Edit a web card's URL directly from the dashboard. */
export class WebUrlModal extends Modal {
	private value: string;
	private onSubmit: (url: string) => void;

	constructor(app: App, current: string, onSubmit: (url: string) => void) {
		super(app);
		this.value = current;
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		this.titleEl.setText("Web page URL");
		new Setting(this.contentEl).setName("URL").addText((t) => {
			t.setPlaceholder("https://example.com")
				.setValue(this.value)
				.onChange((v) => (this.value = v));
			t.inputEl.addClass("hearth-url-input");
			t.inputEl.addEventListener("keydown", (e) => {
				if (e.key === "Enter") this.submit();
			});
		});

		new Setting(this.contentEl).addButton((b) =>
			b
				.setButtonText("Save")
				.setCta()
				.onClick(() => this.submit()),
		);
	}

	private submit(): void {
		this.onSubmit(this.value.trim());
		this.close();
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** Add, edit and remove launchpad tiles of a links card from the dashboard. */
export class LinksEditorModal extends Modal {
	private card: DashboardCard;
	private commit: () => void;
	private rerender: () => void;

	constructor(app: App, card: DashboardCard, commit: () => void, rerender: () => void) {
		super(app);
		this.card = card;
		this.commit = commit;
		this.rerender = rerender;
	}

	onOpen(): void {
		this.titleEl.setText("Edit links");
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		const links = (this.card.links ??= []);

		links.forEach((link, index) => {
			const row = new Setting(contentEl).setClass("hearth-link-setting");
			row.addText((t) =>
				t.setPlaceholder("Label").setValue(link.label).onChange((v) => {
					link.label = v;
					this.commit();
				}),
			);
			row.addText((t) =>
				t.setPlaceholder("Icon").setValue(link.icon).onChange((v) => {
					link.icon = v;
					this.commit();
				}),
			);
			row.addDropdown((d) => {
				(Object.keys(LINK_TYPE_LABELS) as LinkItem["type"][]).forEach((k) =>
					d.addOption(k, LINK_TYPE_LABELS[k]),
				);
				d.setValue(link.type).onChange((v) => {
					link.type = v as LinkItem["type"];
					this.commit();
					this.render();
				});
			});
			row.addText((t) => {
				t.setPlaceholder("Target (path / URL / command id)")
					.setValue(link.target)
					.onChange((v) => {
						link.target = v;
						this.commit();
					});
				if (link.type === "note")
					t.inputEl.setAttribute("list", "hearth-file-list");
			});
			row.addExtraButton((b) =>
				b
					.setIcon("trash-2")
					.setTooltip("Remove link")
					.onClick(() => {
						links.splice(index, 1);
						this.commit();
						this.render();
					}),
			);
		});

		new Setting(contentEl).addButton((b) =>
			b.setButtonText("Add link").onClick(() => {
				links.push({
					id: `link-${Date.now().toString(36)}`,
					label: "",
					icon: "link",
					target: "",
					type: "note",
				});
				this.commit();
				this.render();
			}),
		);
	}

	onClose(): void {
		this.contentEl.empty();
		this.rerender();
	}
}

/** Curate the favorite note paths shown by favorites cards, from the board. */
export class FavoritesEditorModal extends Modal {
	private favorites: string[];
	private commit: () => void;
	private rerender: () => void;

	constructor(app: App, favorites: string[], commit: () => void, rerender: () => void) {
		super(app);
		this.favorites = favorites;
		this.commit = commit;
		this.rerender = rerender;
	}

	onOpen(): void {
		this.titleEl.setText("Edit favorites");
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();

		this.favorites.forEach((path, index) => {
			new Setting(contentEl).setName(path).addExtraButton((b) =>
				b
					.setIcon("trash-2")
					.setTooltip("Remove")
					.onClick(() => {
						this.favorites.splice(index, 1);
						this.commit();
						this.render();
					}),
			);
		});

		new Setting(contentEl).addButton((b) =>
			b
				.setButtonText("Add favorite")
				.setCta()
				.onClick(() => {
					new FilePickerModal(
						this.app,
						(file) => {
							if (!this.favorites.includes(file.path)) {
								this.favorites.push(file.path);
								this.commit();
								this.render();
							}
						},
						"Pick a note to favorite…",
					).open();
				}),
		);
	}

	onClose(): void {
		this.contentEl.empty();
		this.rerender();
	}
}
