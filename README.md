# Hearth

![assets/banner.png](assets/banner.png)

A beautiful, customizable **home screen for Obsidian** — search, dashboard, and
launcher in one. Hearth gives your vault a welcoming front page: a big search
field, quick file-type filters, a new-note button, and a grid of cards that
embed notes, images, bases, bookmarks and quick text.

> Status: **v0.9** — the top section and a fully arrangeable card dashboard
> (drag, resize, collision-aware packing, on-board card management, templates,
> per-card colors, web embeds, live auto-refreshing, zoomable and editable
> embeds, Excalidraw and canvas cards, multiple switchable dashboards with
> per-board overrides, pinned cards, a search-only mobile mode, layout
> import/export) are in. See [Roadmap](#roadmap) for what's next.

## Screenshots

![Dashboard](assets/dashboardfull.png)


![Simple](assets/dashboardsimple.png)


![Empty](assets/dashboardwall.png)


![Switch](assets/dashboardswitch.png)


<img src="assets/mobiledashboard.png" alt="Mobile mode" width="280" />

## Features

### Top section
- **Customizable title / logo** — set any title text and an emoji/short logo.
- **Vault search** — fuzzy search across your whole vault (the `.obsidian`
  config folder is ignored automatically). Keyboard friendly: `↑`/`↓` to move,
  `Enter` to open, `Esc` to dismiss.
- **Auto-detected filters** — file-type filter chips are generated from what
  actually lives in your vault, grouped sensibly (Notes, Images, Videos,
  Sheets, Slides, Documents, Folders, Canvas, Bases…), each with a fitting
  icon. Hide any you don't want in settings.
- **New note button** — creates a note in your configured default location.
- **Optional background** — solid color, a vault image, or an image URL, with
  opacity and blur controls.

### Dashboard cards
- **Embed** — embed a note (`.md`), image, canvas, or `.base` file. Rendered
  through Obsidian's own renderer, so anything Obsidian (or the Bases plugin)
  can embed, a card can show. Each embed has a **zoom** control to scale its
  content up or down to fit the card. Markdown notes can be made **editable** —
  shown rendered and switching to a raw editor on double-click, saving straight
  back to the vault.
- **Excalidraw & canvas cards** — dedicated templates for embedding an
  Excalidraw drawing or a `.canvas` file, with a friendly prompt when the
  required plugin isn't enabled.
- **Daily note** — always shows *today's* daily note (resolved from the core
  Daily notes plugin's date format and folder), with a one-click prompt to
  create it when it doesn't exist yet and a hideable button to open it in the
  editor. Optionally editable in place.
- **Web page** — embed any `http(s)` URL in a sandboxed iframe.
- **Live content** — embed and daily cards update automatically the moment
  their file is created, edited or deleted; web cards can auto-refresh on an
  interval.
- **Bookmarks** — pulls from Obsidian's core Bookmarks plugin.
- **Favorites** — a grid of curated note cards.
- **Recent files** — your recently opened files (configurable count).
- **Links / launchpad** — a grid of tiles opening notes, URLs or commands.
- **Commands** — tiles that run any command-palette command, with an adjustable
  **button size**.
- **Clock & greeting** — digital or **analogue** face, several date formats
  (including a custom moment.js format), and a live greeting with an optional
  **playful** (cheeky, randomised) mode.
- **Text / jot-down** — a quick scratch field saved with the card, rendered as
  **Markdown** (double-click to edit).

### Multiple dashboards
- **Switcher** — a `[1] [2] [+]` row in the top-left switches between boards and
  adds new ones. Give a board an **emoji/icon** to label its button instead of a
  number. Right-click a button for **dashboard settings** (name, icon,
  overrides) or to **delete** it.
- **Per-dashboard overrides** — each board can override the global **grid
  columns**, **row height** and **background**, or fall back to the defaults.
- **Pinned cards** — pin any card to show it on *every* dashboard, sharing one
  definition and position across boards.
- **Keyboard shortcuts** — commands to jump to a dashboard by position
  (*Switch to dashboard 1…9*) and to move to the **next/previous** dashboard.
  Bind them under **Settings → Hotkeys** (e.g. `Ctrl/Cmd+1`).

### Arranging the dashboard
- **Drag & resize** — hit **Arrange** to move cards (drag anywhere) and resize
  them (corner handle); everything snaps to the grid and is saved. Cards push
  each other out of the way as you drag and compact upward when you let go.
- **On-board management** — in arrange mode each card header is editable:
  rename inline, swap the embedded file via a fuzzy picker, or remove the card.
  **Add card** (toolbar) drops in a new card from the library.
- **Per-card colors** — give any card an accent and a background tint.
- **Granular sizing** — numeric width/height per card, plus a configurable row
  height so cards can be sized finely.
- **Import / export** — back up or share the active board's layout as JSON.
- The dashboard can either scroll or be locked to a single page.

### Mobile
- **Mobile mode** — an optional search-only launcher: on phones and tablets the
  dashboard collapses to just the search field (desktop is unaffected).

## Usage
- Hearth opens automatically on startup and replaces empty new tabs (both
  toggleable in settings).
- Open it any time from the ribbon **home** icon or the command
  **“Open home dashboard”**.
- Configure everything under **Settings → Hearth**.

## Development

```bash
npm install      # install dependencies
npm run dev      # watch build -> main.js
npm run build    # typecheck + production build
```

To test in a vault, symlink or copy `main.js`, `manifest.json` and `styles.css`
into `<vault>/.obsidian/plugins/hearth/`.

## Roadmap
- [x] Drag & resize cards on a free-form grid (custom lightweight engine)
- [x] More card types (recent, links/launchpad, commands, clock)
- [x] Per-card backgrounds and accent colors
- [x] Card library / templates
- [x] Best-effort Bases (`.base`) embedding (depends on the core Bases plugin)
- [x] **Manage embeds from the dashboard** — add, remove, swap embedded files
  and rename cards directly on the board, fully driven by the user
- [x] **Filter click expands a match menu** — clicking a search filter drops
  down the matching items immediately
- [x] **Excalidraw filter** — dedicated file-type filter for Excalidraw drawings
- [x] **"Other" filter** — catch-all for every file not matched by any other
  filter
- [x] Collision-aware auto-packing while dragging
- [x] Inline web/iframe embeds
- [x] Import/export dashboard layouts
- [x] **Configure cards on the board** — every per-card setting (type, title,
  content, colors and size) is edited from the card itself in arrange mode, not
  in the settings tab
- [x] **More granular card sizing** — numeric width & height inputs per card
- [x] **Customizable clock** — 24-hour time, seconds, greeting toggle/override
  and date display mode
- [x] **`.usheet` (Univer Sheet) support** — recognized as spreadsheets in the
  file-type filters
- [x] **Compact spacing** — toggle to tighten card padding and the top margin
- [x] **Bookmark favicons** — show site favicons next to URL bookmarks
- [x] **Real app icon** — used for the ribbon, tab and header logo (shipped in
  the bundle)
- [x] **Commands card** — tiles that run chosen command-palette commands
- [x] **Mobile search** — results float as an overlay so they no longer push
  the dashboard off-screen on phones
- [x] **Live cards** — per-card auto-refresh interval for embed and web cards
- [x] **Embed zoom** — per-card scale control for embedded content
- [x] **Editable `.md` embeds** — a per-card toggle to edit an embedded note in
  place; edits save straight back to the vault
- [x] **Excalidraw drawing card** — dedicated card template for embedding an
  Excalidraw drawing, with a prompt to install the plugin when it's missing
- [x] **Canvas card** — dedicated card template for embedding a `.canvas` file,
  with a prompt to enable the core Canvas plugin when it's off
- [x] **Multiple dashboards** — several switchable boards, managed from the
  `[1] [2] [+]` switcher in the top-left (right-click a button for settings or
  delete)
- [x] **Per-dashboard overrides** — columns, row height and background can be set
  per board, falling back to the global defaults
- [x] **Per-dashboard icon** — an emoji/short text on the switcher button instead
  of a number
- [x] **Pinned cards** — show a card on every dashboard, shared across boards
- [x] **Dashboard keyboard shortcuts** — switch to a board by position, or
  next/previous (bindable in Settings → Hotkeys)
- [x] **Mobile mode** — an option to collapse to just the search field on phones
  and tablets, leaving the dashboard for desktop
- [x] **Granular row height** — a Row height setting for finer control over how
  tall cards can be
- [x] **Command tile size** — adjustable button size on the commands card
- [x] **Daily note card** — always embeds today's daily note, with a prompt to
  create it when missing
- [x] **Live embeds** — embed and daily cards refresh from vault events the
  moment their file changes; editable notes sync without ever losing the cursor
- [x] **Reorder list items** — move links, command tiles and favorites up/down
  from the card's settings
- [x] **Live-mode editable embeds** — rendered Markdown by default, double-click
  to edit the raw note
- [x] **Open-note button** — a hideable button on the daily-note card
- [x] **Analogue clock & richer dates** — analogue face, more date formats
  (incl. custom), and optional playful greetings
### Planned

Bigger ideas
- [ ] Reorder dashboards in the switcher (drag the buttons)
- [ ] Per-board fit-to-page / max-width overrides

## License
MIT © ondreu
