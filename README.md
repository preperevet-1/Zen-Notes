# Zen Notes — 0.2.1 alpha

Experimental Sine mod for Zen Browser.

## Fixes in 0.2.1

- The note page is mounted inside the selected tab's browser stack instead of over the whole Zen window, so the Zen sidebar/top UI stays usable.
- Note tab IDs are additionally persisted through Firefox SessionStore, improving note-tab recovery after a browser restart.
- Removed the Markdown hint/footer from the note page.
- Improved live Markdown shortcuts with `beforeinput` handling and more reliable inline formatting.

## Current Markdown shortcuts

- `# `, `## `, `### ` → headings
- `- ` / `* ` → bullet list
- `1. ` → numbered list
- `> ` → quote
- `**bold**`, `*italic*`, `` `code` `` → inline formatting
- `Cmd/Ctrl+B`, `Cmd/Ctrl+I`
- ````` + Enter`` → code block

Notes are stored locally as standalone Markdown files in:

`<Zen profile>/zen-notes/`

This is still an alpha build. No note hub/delete UI or "Add selection to note" context action yet.
