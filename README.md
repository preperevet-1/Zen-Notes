# Zen Notes — 0.2.2 alpha

Experimental Sine mod for Zen Browser.

## Fixes in 0.2.2

- Fixes a newly created note showing as **New Tab** in the Zen sidebar. Zen Notes now re-applies the note title when Firefox updates the underlying `about:blank` tab label.
- Makes inline Markdown conversion more reliable by processing complete Markdown after text input, not only on a keydown shortcut.
- Makes block shortcuts more robust when `contenteditable` creates bare text nodes or `<div>` blocks.
- Prevents duplicate `-` / `1.` markers when a native list has already continued after Enter.
- Keeps the note page inside the browser stack so Zen's sidebar remains usable.
- Keeps note IDs in Firefox SessionStore for better recovery after restart.
- No Markdown shortcut/footer hints are shown inside the note.

## Markdown shortcuts

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
