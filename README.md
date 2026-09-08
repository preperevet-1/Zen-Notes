# Zen Notes

Alpha 0.2 of a local notes mod for Zen Browser, installed through Sine.

## Alpha 0.2

- `Create Note` stays in Zen's `+` menu.
- A note is created as a **normal Zen tab**, not in a separate Notes section.
- Opening that tab shows a full-page, Notion-like editor in the main browser area.
- The note title is the large editable `New Note` heading on the page.
- Notes autosave locally as standalone `.md` files in the Zen profile's `zen-notes` folder.
- Basic visual Markdown shortcuts:
  - `# `, `## `, `### ` → headings
  - `- ` / `* ` → bullet list
  - `1. ` → numbered list
  - `> ` → quote
  - typing inline `**bold**`, `*italic*`, or `` `code` `` is converted when you continue with Space/Enter
  - `Cmd+B` / `Cmd+I` (Ctrl on Windows/Linux)
- Saved files remain normal Markdown and can be moved to another editor later.

## Alpha limitations

This is intentionally small. There is no notes hub, delete UI, context-menu capture, images, sync, or complex block system yet.

Because there is no hub yet, saved note tabs are restored on startup so notes remain reachable.
