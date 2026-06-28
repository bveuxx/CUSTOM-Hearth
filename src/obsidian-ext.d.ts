import "obsidian";
import { Command, TFile, TFolder } from "obsidian";

// Minimal typings for Obsidian internals that aren't part of the public API
// but are stable and widely used by community plugins.
declare module "obsidian" {
	interface App {
		internalPlugins: {
			getPluginById(id: string): {
				instance: unknown;
				enabled: boolean;
			} | null;
		};
		commands: {
			executeCommandById(id: string): boolean;
			listCommands(): Command[];
		};
		plugins: {
			/** Ids of every enabled community plugin. */
			enabledPlugins: Set<string>;
		};
	}

	interface FileManager {
		createNewMarkdownFile(folder: TFolder, baseName?: string): Promise<TFile>;
	}
}

// Shape of an Obsidian core "Bookmarks" item we care about.
export interface BookmarkItem {
	type: "file" | "folder" | "search" | "group" | "url" | string;
	title?: string;
	path?: string;
	url?: string;
	query?: string;
	items?: BookmarkItem[];
}
