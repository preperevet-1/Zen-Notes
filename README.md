# Zen Notes 0.4.2 Alpha

Hotfix for Zen builds where the note editor was still hidden behind the New Tab page.

## 0.4.2 changes
- Stops mounting the editor as an overlay over `tabbrowser-tabbox`.
- Adds a dedicated content surface beside `tabbrowser-tabbox` and swaps it into the content area only while a Zen Note tab is active.
- Keeps note tabs as normal Zen tabs in the sidebar.
- Keeps the 0.4 Markdown/Live Preview editor and local `.md` storage.
- Keeps arrow-key isolation so Zen search does not steal Up/Down while editing.
- Uses an embedded document glyph for `Create Note` instead of relying on a Firefox icon URL.
- Filled document icon remains on note tabs.
- Zen Boost bridge remains available from the note surface.

## Storage
Notes are stored in the current Zen profile under `zen-notes/` as Markdown files plus `index.json`.
