import { App, Modal, Setting } from "obsidian";

/**
 * Make a non-button element behave like a button for keyboard and screen-reader
 * users: it gets a role, becomes focusable, and activates on Enter/Space in
 * addition to the click handler the caller wires up separately.
 */
export function makeClickable(el: HTMLElement, onActivate: () => void, label?: string): void {
	el.setAttribute("role", "button");
	el.setAttribute("tabindex", "0");
	if (label) el.setAttribute("aria-label", label);
	el.addEventListener("keydown", (e: KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			onActivate();
		}
	});
}

/** A minimal yes/no confirmation dialog used before destructive actions. */
export class ConfirmModal extends Modal {
	private message: string;
	private confirmText: string;
	private onConfirm: () => void;

	constructor(
		app: App,
		opts: { title: string; message: string; confirmText?: string; onConfirm: () => void },
	) {
		super(app);
		this.titleEl.setText(opts.title);
		this.message = opts.message;
		this.confirmText = opts.confirmText ?? "Confirm";
		this.onConfirm = opts.onConfirm;
	}

	onOpen(): void {
		this.contentEl.createEl("p", { text: this.message });
		new Setting(this.contentEl)
			.addButton((b) => b.setButtonText("Cancel").onClick(() => this.close()))
			.addButton((b) => {
				b.setButtonText(this.confirmText)
					.setWarning()
					.onClick(() => {
						this.close();
						this.onConfirm();
					});
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** Convenience: open a confirm dialog. */
export function confirmAction(
	app: App,
	opts: { title: string; message: string; confirmText?: string; onConfirm: () => void },
): void {
	new ConfirmModal(app, opts).open();
}
