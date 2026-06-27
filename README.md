# Hearth

A beautiful, customizable **home screen for Obsidian** — search, dashboard, and
launcher in one. Hearth gives your vault a welcoming front page: a big search
field, quick file-type filters, a new-note button, and a grid of cards that
embed notes, images, bases, bookmarks and quick text.

> Status: **v1 (foundation)**. The top section and a basic card grid are
> functional. Drag & resize of cards and a few advanced embeds land in the next
> iterations — see [Roadmap](#roadmap).

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
- **Text / jot-down** — a quick scratch field saved with the card.

Each card has a configurable width/height (in grid columns). The dashboard can
either scroll or be locked to a single page.

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
- [ ] Drag & resize cards on a free-form grid (custom lightweight engine)
- [ ] More card embed types and inline embed previews
- [ ] Richer Bases embedding once the API allows it
- [ ] Per-card backgrounds and accent colors
- [ ] Card library / templates

## License
MIT © ondreu
