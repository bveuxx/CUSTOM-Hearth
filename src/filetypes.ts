import { TAbstractFile, TFile, TFolder } from "obsidian";

/**
 * A logical group of file types shown as a search filter chip.
 * Similar formats are grouped together (e.g. docx + odt under "Documents").
 */
export interface FileTypeGroup {
	id: string;
	label: string;
	/** Lucide icon id used with Obsidian's setIcon(). */
	icon: string;
	/** Lowercase extensions (without the dot). Empty array => folders. */
	extensions: string[];
}

export const FILE_TYPE_GROUPS: FileTypeGroup[] = [
	{ id: "folders", label: "Folders", icon: "folder", extensions: [] },
	{ id: "markdown", label: "Notes", icon: "file-text", extensions: ["md", "markdown"] },
	{ id: "canvas", label: "Canvas", icon: "layout-dashboard", extensions: ["canvas"] },
	{ id: "bases", label: "Bases", icon: "database", extensions: ["base"] },
	{ id: "images", label: "Images", icon: "image", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif", "ico"] },
	{ id: "videos", label: "Videos", icon: "film", extensions: ["mp4", "mkv", "webm", "mov", "avi", "ogv", "m4v"] },
	{ id: "audio", label: "Audio", icon: "music", extensions: ["mp3", "wav", "flac", "ogg", "m4a", "aac", "3gp"] },
	{ id: "pdf", label: "PDF", icon: "file-type", extensions: ["pdf"] },
	{ id: "documents", label: "Documents", icon: "file-text", extensions: ["doc", "docx", "odt", "rtf", "txt", "pages"] },
	{ id: "spreadsheets", label: "Sheets", icon: "file-spreadsheet", extensions: ["xls", "xlsx", "ods", "csv", "tsv", "numbers"] },
	{ id: "presentations", label: "Slides", icon: "presentation", extensions: ["ppt", "pptx", "odp", "key"] },
];

const EXT_TO_GROUP: Map<string, FileTypeGroup> = (() => {
	const map = new Map<string, FileTypeGroup>();
	for (const group of FILE_TYPE_GROUPS) {
		for (const ext of group.extensions) map.set(ext, group);
	}
	return map;
})();

export function groupForFile(file: TAbstractFile): FileTypeGroup | undefined {
	if (file instanceof TFolder) return FILE_TYPE_GROUPS[0];
	if (file instanceof TFile) return EXT_TO_GROUP.get(file.extension.toLowerCase());
	return undefined;
}

export function iconForFile(file: TAbstractFile): string {
	return groupForFile(file)?.icon ?? "file";
}

export function groupById(id: string): FileTypeGroup | undefined {
	return FILE_TYPE_GROUPS.find((g) => g.id === id);
}
