/**
 * English base locale — the source of truth for every user-facing string in
 * Hearth. All other locales are typed against `typeof en` (see
 * `src/locales/index.ts`), so this file defines the complete set of keys a
 * translation must provide.
 *
 * Conventions:
 *  - Plain UI strings are string literals.
 *  - Strings that interpolate values are functions, so each locale controls
 *    word order and pluralization itself.
 *  - Only live UI "chrome" is translated here. User-editable seed data (the
 *    default dashboard title, starter card titles, default mobile-button
 *    labels) stays in `types.ts`/`templates.ts` as English defaults, since it
 *    is persisted to the vault the moment a dashboard is created.
 */
export const en = {
	// ---- Commands (command palette) & ribbon ---------------------------
	commands: {
		openHome: "Open home dashboard",
		newNote: "Create new note (default location)",
		newDrawing: "Create new Excalidraw drawing",
		recordVoice: "Start/stop voice recording",
		openDailyNote: "Open today's daily note",
		switchDashboard: (n: number) => `Switch to dashboard ${n}`,
		nextDashboard: "Next dashboard",
		previousDashboard: "Previous dashboard",
	},
	ribbon: {
		openHome: "Open Hearth home",
	},

	// ---- Notices (transient toasts) ------------------------------------
	notices: {
		couldNotCreateNote: "Hearth: could not create a new note.",
		enableExcalidraw: "Hearth: enable the Excalidraw plugin to create drawings.",
		excalidrawCommandMissing: 'Hearth: couldn\'t find Excalidraw\'s "new drawing" command.',
		enableAudioRecorder: "Hearth: enable the core Audio recorder plugin.",
		couldNotRecordVoice: "Hearth: couldn't start voice recording.",
		enableDailyNotes: "Hearth: enable the core Daily notes plugin.",
		couldNotOpenDaily: "Hearth: couldn't open today's daily note.",
		commandNotFound: (id: string) => `Hearth: command not found: ${id}`,
		couldNotCreateNoteForDay: (day: string) => `Hearth: couldn't create a note for ${day}.`,
		taskNotesCreateFailed: "Hearth: couldn't run TaskNotes: Create new task.",
		taskChangedOnDisk: "Hearth: that task changed on disk — refreshed.",
		couldNotUpdateTaskStatus: "Hearth: couldn't update the task status.",
		couldNotCompleteRecurring: "Hearth: couldn't mark the recurring task instance complete.",
		couldNotUndoRecurring: "Hearth: couldn't undo the recurring task completion.",
		layoutCopied: "Hearth: layout copied to clipboard.",
		clipboardUnavailable: "Hearth: couldn't access the clipboard.",
		pasteLayoutFirst: "Hearth: paste a layout to import first.",
		layoutImported: "Hearth: layout imported.",
		layoutImportError: (error: string) => `Hearth: ${error}`,
		cardCopied: "Card copied to the dashboard.",
	},

	// ---- The home view -------------------------------------------------
	view: {
		displayName: "Home",
	},

	// ---- Header / search bar -------------------------------------------
	header: {
		newNote: "New note",
		newNoteAria: "Create new note",
		searchOnline: "Search online",
		searchOnlineAria: "Search the web for the current query",
	},
	search: {
		placeholder: "Search the vault",
		noMatches: "No matches",
		noMatchingCommands: "No matching commands",
	},

	// ---- Shared confirm dialog -----------------------------------------
	confirm: {
		confirm: "Confirm",
		cancel: "Cancel",
	},

	// ---- File pickers --------------------------------------------------
	pickers: {
		fileToEmbed: "Pick a file to embed…",
		command: "Pick a command…",
		noteToFavorite: "Pick a note to favorite…",
	},

	// ---- Dashboard toolbar & card controls -----------------------------
	dashboard: {
		addCard: "Add card",
		addCardAria: "Add a card to the dashboard",
		showTitles: "Show titles",
		hideTitles: "Hide titles",
		showCardHeaders: "Show card headers",
		hideCardHeaders: "Hide card headers",
		doneArranging: "Done arranging",
		finishArranging: "Finish arranging cards",
		moveResize: "Move & resize cards",
		cardSettings: "Card settings",
		removeCard: "Remove card",
		removeCardTitle: "Remove card?",
		removeCardMessage: (name: string) => `Remove "${name}" from the dashboard?`,
		removeCardConfirm: "Remove",
		thisCard: "this card",
	},

	// ---- Dashboard switcher & per-dashboard settings -------------------
	dashboards: {
		newDashboard: "New dashboard",
		defaultName: (n: number) => `Dashboard ${n}`,
		copySuffix: (name: string) => `${name} copy`,
		fallbackName: "Dashboard",
		menu: {
			settings: "Dashboard settings…",
			duplicate: "Duplicate",
			delete: "Delete",
		},
		deleteTitle: "Delete dashboard?",
		deleteMessage: (name: string, count: number) =>
			`Delete "${name}" and its ${count} card(s)? This can't be undone.`,
		deleteConfirm: "Delete",
		modal: {
			title: "Dashboard settings",
			name: "Name",
			switcherIcon: "Switcher icon",
			switcherIconDesc: "An emoji or short text shown on the switcher button. Empty = number.",
			switcherLucide: "Switcher Lucide icon",
			switcherLucideDesc:
				"A Lucide icon id (e.g. “home”, “star”, “layout-dashboard”). Takes precedence over the emoji above.",
			lucidePlaceholder: "home",
			contentWidth: "Content width",
			fitToPage: "Fit to page",
			fitToPageDesc: "Override scrolling for this board.",
			fitDefault: (state: string) => `Use global default (${state})`,
			fitStateFit: "fit",
			fitStateScroll: "scroll",
			fitOptionFit: "Fit to one page",
			fitOptionScroll: "Allow scrolling",
			cardOpacity: "Card opacity",
			done: "Done",
			overriding: "Overriding the global default.",
			usingGlobal: (value: number | string) => `Using global default (${value}).`,
			background: "Background",
			backgroundDesc: "Override the global background for this dashboard.",
			backgroundValue: "Background value",
			opacity: "Opacity",
			blur: "Blur",
		},
		backgroundOptions: {
			default: "Use global default",
			none: "None",
			hdefault: "Hearth default",
			color: "Solid color",
			image: "Vault image",
			url: "Image URL",
		},
		backgroundValueDesc: {
			color: "A CSS color, e.g. #1e1e2e.",
			image: "A vault image path, e.g. Attachments/bg.png.",
			url: "A direct image URL.",
		},
	},

	// ---- Plugin settings tab -------------------------------------------
	settings: {
		/** Shared across every slider/section control. */
		resetSlider: "Reset to default",
		collapseSection: "Collapse section",
		expandSection: "Expand section",
		appearance: {
			heading: "Appearance",
			showTitle: "Show title",
			showTitleDesc: "Display the big title/logo at the top.",
			title: "Title",
			logo: "Logo",
			logoDesc:
				"An emoji or short text shown next to the title. Leave empty for the Hearth crystal icon.",
			searchPlaceholder: "Search placeholder",
			searchContents: "Search note contents",
			searchContentsDesc:
				"Also match text inside note bodies, not just names, tags and " +
				"properties. Body matches appear after name matches with a snippet.",
			showNewNoteButton: "Show “New note” button",
			newNoteButtonMode: "New-note button",
			newNoteButtonModeDesc:
				"Split the button into “Search online” + “New note”, or show just one of them.",
			newNoteButtonModeSplit: "Split: Search online + New note",
			newNoteButtonModeNewNote: "New note only",
			newNoteButtonModeSearchOnline: "Search online only",
			contentWidth: "Content width",
			contentWidthDesc: "Maximum width of the home content, in pixels.",
		},
		background: {
			heading: "Background",
			type: "Background type",
			value: "Background value",
			valueColorDesc: "A CSS color, e.g. #1e1e2e or rgb(30,30,46).",
			valueImageDesc: "A vault image path, e.g. Attachments/bg.png.",
			valueUrlDesc: "A direct image URL.",
			opacity: "Opacity",
			blur: "Blur",
			blurDesc: "Background blur in pixels.",
			labels: {
				default: "Hearth default",
				none: "None",
				color: "Solid color",
				image: "Vault image",
				url: "Image URL",
			},
		},
		behaviour: {
			heading: "Behaviour",
			openOnStartup: "Open on startup",
			openOnStartupDesc: "Open the home view when the vault loads.",
			replaceNewTabs: "Replace new tabs",
			replaceNewTabsDesc: "Show the home view instead of an empty new tab.",
			mobileSearchOnly: "Mobile mode (search only)",
			mobileSearchOnlyDesc:
				"On phones and tablets, hide the dashboard and show only the search " +
				"field. No effect on desktop.",
		},
		mobileActions: {
			heading: "Mobile action bar",
			headingDesc:
				"In Mobile mode (search only), this row of buttons replaces the " +
				"“New note” button beside the search bar, appearing under the " +
				"search field and filters instead. Any button can be pointed at " +
				"any command.",
			showActionBar: "Show action bar",
			labelPlaceholder: "Label",
			iconPlaceholder: "Icon",
			commandTooltip: (id: string) => `Command: ${id}`,
			pickCommand: "Pick a command",
			moveUp: "Move up",
			moveDown: "Move down",
			removeButton: "Remove button",
			addButton: "Add button",
			resetDefaults: "Reset to defaults",
		},
		tasks: {
			heading: "Tasks / TaskNotes",
			headingDesc:
				"Field names read by Tasks cards in TaskNotes mode. TaskNotes has no " +
				"stable API for other plugins, so this reads its frontmatter directly " +
				"— match these to whatever TaskNotes' own settings have them mapped to " +
				"(the defaults below are TaskNotes' own defaults).",
			statusField: "Status field",
			dueField: "Due date field",
			priorityField: "Priority field",
			priorityFieldDesc: "Frontmatter field read for a task's priority indicator.",
			doneValue: "“Done” status value",
		},
		filters: {
			heading: "Search filters",
			headingDesc:
				"Filters are auto-detected from the file types in your vault. Hide any you don't want.",
		},
		dashboard: {
			heading: "Dashboard",
			fitToPage: "Fit to page",
			fitToPageDesc: "Keep the dashboard to one screen instead of allowing scroll.",
			compact: "Compact spacing",
			compactDesc: "Tighten card padding and top margin to enlarge the usable area.",
			cardOpacity: "Card opacity",
			cardOpacityDesc:
				"Transparent card backgrounds so the dashboard background shows through.",
			cards: "Cards",
			cardsDesc:
				"Add and configure cards on the dashboard itself: open the home view, " +
				"hit Arrange, then use Add card and each card's settings button.",
		},
		layout: {
			heading: "Import / export layout",
			headingDesc: "Back up or share your dashboard (cards, grid, favorites) as JSON.",
			export: "Export layout",
			exportDesc: "Copy the current dashboard layout to the clipboard.",
			copyJson: "Copy JSON",
			import: "Import layout",
			importDesc:
				"Paste a previously exported layout, then Import. This replaces your current dashboards.",
			importPlaceholder: '{ "hearthLayout": 2, "dashboards": [ … ] }',
			importButton: "Import",
			importTitle: "Import layout?",
			importMessage:
				"This replaces your current dashboards, pinned cards and layout settings. This can't be undone.",
		},
	},

	// ---- Card settings editor ------------------------------------------
	editors: {
		title: "Card settings",
		type: "Type",
		cardTitle: "Title",
		cardTitlePlaceholder: "Title",
		removeCard: "Remove card",
		removeCardTitle: "Remove card?",
		removeCardMessage: (name: string) => `Remove "${name}" from the dashboard?`,
		removeCardConfirm: "Remove",
		thisCard: "this card",
		done: "Done",
		kinds: {
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
			tasks: "Tasks",
			calendar: "Mini calendar",
			stats: "Vault statistics",
			search: "Query",
			heatmap: "Activity heatmap",
		},
		linkTypes: {
			note: "Note",
			url: "URL",
			command: "Command",
		},
		embed: {
			file: "File to embed",
			fileDesc: "A note, image, canvas or .base file in your vault.",
			filePlaceholder: "File path to embed",
			pickFile: "Pick a file",
			zoom: "Zoom",
			zoomDesc: "Scale the embedded content. Applies when you close this dialog.",
			editable: "Editable",
			editableDesc: "Edit the embedded note's text in place (Markdown notes only).",
		},
		daily: {
			editable: "Editable",
			editableDesc: "Edit today's note in place instead of read-only. Saves to the vault.",
			openButton: "Open button",
			openButtonDesc: "Show a button to open today's note in the editor.",
			info: "Daily notes",
			infoDesc:
				"Today's note is resolved from the core Daily notes plugin's date format and folder. The card updates live as you edit.",
		},
		web: {
			url: "URL",
			urlPlaceholder: "https://example.com",
			trusted: "Trusted site",
			trustedDesc:
				"Allow the page same-origin access (cookies, storage). Only enable " +
				"for sites you trust — it relaxes the iframe sandbox.",
			autoRefresh: "Auto-refresh",
			autoRefreshDesc: "Re-render this card every N seconds to pick up changes. 0 = off.",
			refreshIntervalAria: "Refresh interval in seconds",
		},
		recent: {
			count: "Number of files",
		},
		calendar: {
			weekNumbers: "Week numbers",
			weekNumbersDesc: "Show an ISO week-number column down the left edge.",
			heatmap: "Heatmap",
			heatmapDesc: "Tint each day by note activity that day.",
			heatmapCounts: "Heatmap counts",
		},
		heatmap: {
			metric: "Metric",
			weeks: "Weeks",
			weeksDesc: "How many weeks of history to show.",
		},
		metricOptions: {
			modified: "Notes edited",
			created: "Notes created",
		},
		savedSearch: {
			query: "Query",
			queryDesc:
				"Same syntax as the search bar: plain text for names/bodies, #tag for " +
				"tags, or key:value for a frontmatter property.",
			queryPlaceholder: "#project or status:active or meeting notes",
			display: "Display",
			displayList: "List",
			displayTiles: "Tiles",
			maxResults: "Max results",
		},
		links: {
			heading: "Links",
			autoShift: "Auto-shift tiles (beta)",
			autoShiftDesc:
				"When on, tiles shove each other aside as one is dragged (like phone " +
				"widgets). Off by default — tiles are pure free-form and may overlap.",
			labelPlaceholder: "Label",
			iconPlaceholder: "Icon",
			pickCommand: "Pick command…",
			targetUrl: "Target (URL)",
			targetNote: "Target (note path)",
			moveUp: "Move up",
			moveDown: "Move down",
			removeLink: "Remove link",
			addLink: "Add link",
		},
		commands: {
			autoShift: "Auto-shift tiles (beta)",
			autoShiftDesc:
				"When on, tiles shove each other aside as one is dragged (like phone " +
				"widgets). Off by default — tiles are pure free-form and may overlap.",
			buttonSize: "Button size",
			buttonSizeDesc:
				"Default size of the command tiles. Resize an individual tile by " +
				"dragging its bottom-right corner, or set a per-tile size below.",
			heading: "Commands",
			iconOptionalPlaceholder: "Icon (optional)",
			sizePlaceholder: "Size",
			tileSizeAria: "Tile size in pixels (optional)",
			moveUp: "Move up",
			moveDown: "Move down",
			removeCommand: "Remove command",
			addCommand: "Add command",
		},
		tasks: {
			source: "Source",
			sourceDesc:
				"Markdown checkboxes work anywhere. TaskNotes reads that plugin's " +
				"task notes via frontmatter (field names configurable in Settings → " +
				"Hearth, since TaskNotes has no API for other plugins to query it).",
			sourceCheckbox: "Markdown checkboxes",
			sourceTaskNotes: "TaskNotes plugin",
			layout: "Layout",
			layoutDesc:
				"List, or a Kanban board grouped by status. On the board, drag cards " +
				"between columns, drag column headers to reorder, and use a column's " +
				"eye icon to hide it.",
			layoutList: "List",
			layoutKanban: "Kanban board",
			kanbanColumns: "Kanban columns",
			kanbanHidden: (columns: string) => `Hidden: ${columns}`,
			kanbanCustomOrder: "Custom column order is set.",
			showAll: "Show all",
			resetColumns: "Reset column order & visibility",
			showCompleted: "Show completed",
			showCompletedKanbanDesc: "Completed tasks always appear in the Done column on a Kanban board.",
			maxTasks: "Max tasks shown",
			maxTasksDesc: "Sorted by due date (overdue/soonest first), then by file.",
			folders: "Folders",
			scope: "Scope",
			scopeAll: "Whole vault",
			scopeWhitelist: "Only these folders",
			scopeBlacklist: "Everywhere except these folders",
			foldersDesc: "One folder path per line.",
		},
		favorites: {
			heading: "Favorites",
			headingDesc: "Notes shown by every favorites card.",
			moveUp: "Move up",
			moveDown: "Move down",
			remove: "Remove",
			addFavorite: "Add favorite",
		},
		clock: {
			style: "Style",
			styleDigital: "Digital",
			styleAnalog: "Analog",
			hour24: "24-hour time",
			showSeconds: "Show seconds",
			showGreeting: "Show greeting",
			playful: "Playful greetings",
			playfulDesc: "Cheeky, randomised greetings instead of the plain ones.",
			greetingOverride: "Greeting override",
			greetingOverrideDesc: "Leave empty for the automatic greeting.",
			date: "Date",
			dateFull: "Weekday, day month",
			dateLong: "Weekday, day month year",
			dateShort: "Short (locale)",
			dateIso: "ISO (2026-06-29)",
			dateWeekday: "Weekday only",
			dateCustom: "Custom format…",
			dateNone: "Hidden",
			customFormat: "Custom date format",
			customFormatDesc: "A moment.js format, e.g. ddd D MMM or YYYY/MM/DD.",
			customFormatPlaceholder: "ddd D MMM",
		},
		colors: {
			heading: "Colors",
			headingDesc: "Accent and background tint for this card.",
			clearAccent: "Clear accent",
			clearBackground: "Clear background",
			cardOpacity: "Card opacity",
			cardOpacityDesc: "Transparent card surface (overrides the dashboard default).",
			useDashboardDefault: "Use dashboard default",
		},
		size: {
			heading: "Size",
			headingDesc:
				"Width (% of the board) and height (pixels). Or just drag any edge or corner of the card.",
			widthAria: "Width in percent of the board",
			heightAria: "Height in pixels",
		},
		pin: {
			heading: "Pin to all dashboards",
			headingDesc:
				"Show this card on every dashboard, sharing one definition and position.",
		},
		copy: {
			heading: "Copy to dashboard",
			headingDesc: "Add a duplicate of this card to the end of another dashboard.",
			copy: "Copy",
			copyTooltip: "Copy this card to the selected dashboard",
		},
	},

	// ---- Card bodies (rendered content) --------------------------------
	cards: {
		empty: {
			searchNoQuery: "Set a query in card settings",
			searchNoMatches: "No matches",
			embedPickFile: "Pick a file to embed in settings",
			embedEnableBases: "Enable the core Bases plugin to embed .base files",
			embedEnableCanvas: "Enable the core Canvas plugin to embed canvases",
			embedInstallExcalidraw: "Install the Excalidraw plugin to embed drawings",
			dailyEnable: "Enable the core Daily notes plugin",
			webNoUrl: "Set a web URL in settings",
			bookmarksEnable: "Enable the core Bookmarks plugin",
			bookmarksEmpty: "No bookmarks yet",
			favoritesEmpty: "Add favorites in settings",
			recentEmpty: "No recent files",
			linksEmpty: "Add links in settings",
			commandsEmpty: "Add commands in card settings",
			tasksEnable: "Enable the TaskNotes plugin, or switch source to checkboxes",
			tasksEmpty: "No open tasks",
		},
		embed: {
			editHint: "Double-click to edit",
			emptyNotePlaceholder: "Empty note…",
			emptyNoteHint: "Empty note — double-click to edit",
		},
		text: {
			placeholder: "Jot something down…",
		},
		daily: {
			createToday: "Create today's note",
			openToday: "Open today's note",
			noNoteYet: "No note for today yet",
		},
		heatmap: {
			less: "Less",
			more: "More",
		},
		calendar: {
			previousMonth: "Previous month",
			nextMonth: "Next month",
			backToToday: "Back to today",
			dayEdited: (date: string, count: number) => `${date}: ${count} edited`,
			dayMetric: (date: string, count: number, metric: string) => `${date}: ${count} ${metric}`,
		},
		stats: {
			notes: "Notes",
			attachments: "Attachments",
			folders: "Folders",
			tags: "Tags",
			dayStreak: "Day streak",
		},
		web: {
			openInBrowser: "Open in browser",
			mayRefuse: "This site may refuse to be embedded.",
		},
		bookmarks: {
			untitled: "Untitled",
		},
		tasks: {
			createNewTask: "Create new task",
			toDo: "To do",
			done: "Done",
			noStatus: "No status",
			hideColumn: (label: string) => `Hide "${label}" column`,
			markOccurrence: "Mark today's occurrence complete",
			recurring: "Recurring",
		},
	},

	// ---- Relative dates (tasks card) -----------------------------------
	dates: {
		today: "Today",
		tomorrow: "Tomorrow",
		yesterday: "Yesterday",
		daysAgo: (n: number) => `${n} days ago`,
		nextWeekday: (weekday: string) => `Next ${weekday}`,
		lastWeekday: (weekday: string) => `Last ${weekday}`,
	},

	// ---- Recurrence rule labels (tasks card) ---------------------------
	recurrence: {
		repeats: "Repeats",
		units: {
			day: "day",
			week: "week",
			month: "month",
			year: "year",
		},
		everyOne: (unit: string) => `Repeats every ${unit}`,
		everyMany: (count: number, unit: string) => `Repeats every ${count} ${unit}s`,
	},

	// ---- Clock greetings -----------------------------------------------
	clock: {
		greetingMorning: "Good morning",
		greetingAfternoon: "Good afternoon",
		greetingEvening: "Good evening",
		// One array per time-of-day bucket (see greetingBucket in cards.ts):
		// late night, early morning, morning, afternoon, evening, late evening.
		playfulGreetings: [
			[
				"Late night session?",
				"Burning the midnight oil?",
				"The vault never sleeps, huh?",
				"You should probably be asleep.",
			],
			[
				"Working this early already?",
				"Up with the sun, are we?",
				"Coffee first, surely?",
				"Bold of you to be up.",
			],
			[
				"Morning. Let's pretend we're productive.",
				"The notes missed you.",
				"Back at it.",
				"Another day, another vault.",
			],
			[
				"Afternoon grind.",
				"Still going?",
				"Post-lunch productivity — ambitious.",
				"Halfway there, probably.",
			],
			[
				"You again?",
				"Evening. Wrapping up, or just starting?",
				"One more note, then?",
				"The day's winding down. You aren't.",
			],
			[
				"Late again?",
				"The day's over, the ideas aren't.",
				"Shouldn't you be resting?",
				"Burning the candle at both ends.",
			],
		] as string[][],
	},

	// ---- Card templates (Add card menu) --------------------------------
	templates: {
		note: "Embedded note",
		image: "Embedded image",
		base: "Embedded base",
		excalidraw: "Excalidraw drawing",
		canvas: "Embedded canvas",
		daily: "Daily note (today)",
		web: "Web page (iframe)",
		bookmarks: "Bookmarks",
		favorites: "Favorites",
		recent: "Recent files",
		links: "Links / launchpad",
		commands: "Commands",
		clock: "Clock & greeting",
		tasks: "Tasks",
		calendar: "Mini calendar",
		stats: "Vault statistics",
		search: "Query",
		heatmap: "Activity heatmap",
		text: "Text / jot-down",
	},

	// ---- File-type filter labels ---------------------------------------
	fileTypes: {
		folders: "Folders",
		markdown: "Notes",
		excalidraw: "Excalidraw",
		canvas: "Canvas",
		bases: "Bases",
		images: "Images",
		videos: "Videos",
		audio: "Audio",
		pdf: "PDF",
		documents: "Documents",
		spreadsheets: "Sheets",
		presentations: "Slides",
		threeD: "3D",
		other: "Other",
	},

	// ---- Layout import errors ------------------------------------------
	layout: {
		invalidJson: "That isn't valid JSON.",
		notAnObject: "Layout must be a JSON object.",
		noValidDashboards: "Layout contained no valid dashboards.",
		noValidCards: "Layout contained no valid cards.",
		notAHearthLayout: 'Not a Hearth layout — no "dashboards" or "cards" array found.',
	},
};
