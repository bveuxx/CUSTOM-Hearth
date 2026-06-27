# Hearth

A beautiful, customizable **home screen for Obsidian** — search, dashboard, and
launcher in one. Hearth gives your vault a welcoming front page: a big search
field, quick file-type filters, a new-note button, and a grid of cards that
embed notes, images, bases, bookmarks and quick text.

> Status: **v0.2** — the top section and a fully arrangeable card dashboard
> (drag, resize, templates, per-card colors) are in. See [Roadmap](#roadmap)
> for what's next.

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
  can embed, a card can show.
- **Bookmarks** — pulls from Obsidian's core Bookmarks plugin.
- **Favorites** — a grid of curated note cards.
- **Recent files** — your recently opened files (configurable count).
- **Links / launchpad** — a grid of tiles opening notes, URLs or commands.
- **Clock & greeting** — a live time-of-day greeting, clock and date.
- **Text / jot-down** — a quick scratch field saved with the card.

### Arranging the dashboard
- **Drag & resize** — hit **Arrange** to move cards (drag anywhere) and resize
  them (corner handle); everything snaps to the grid and is saved.
- **Card library** — **Add card** opens a picker of ready-made presets.
- **Per-card colors** — give any card an accent and a background tint.
- The dashboard can either scroll or be locked to a single page.

## Installation (BRAT)

Hearth isn't in the community store yet, so install it as a beta plugin with
[BRAT](https://github.com/TfTHacker/obsidian42-brat):

1. Install **BRAT** from Community Plugins and enable it.
2. Run the command **“BRAT: Add a beta plugin for testing”**.
3. Enter the repository: `ondreu/Hearth` and confirm.
4. BRAT downloads the latest release and installs Hearth. Enable it under
   **Settings → Community plugins**.

BRAT will keep Hearth up to date with each new release. New releases are cut
automatically by GitHub Actions when a version tag (e.g. `0.1.0`) is pushed.

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
- [x] More card types (recent, links/launchpad, clock)
- [x] Per-card backgrounds and accent colors
- [x] Card library / templates
- [x] Best-effort Bases (`.base`) embedding (depends on the core Bases plugin)
- [ ] **Manage embeds from the dashboard** — cards shouldn't be fixed presets;
  add, remove, and swap embedded files directly on the board, fully driven by
  the user
- [ ] **Filter click expands a match menu** — clicking a search filter should
  drop down the matching items immediately (not only after focusing the search
  field); especially handy for groups with just a few files
- [ ] **Excalidraw filter** — dedicated file-type filter for Excalidraw drawings
- [ ] **"Other" filter** — catch-all for every file not matched by any other
  filter
- [ ] Collision-aware auto-packing while dragging
- [ ] Inline web/iframe embeds
- [ ] Import/export dashboard layouts

## License
MIT © ondreu
