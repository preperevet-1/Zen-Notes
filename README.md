# Zen Notes — 0.1.0 alpha

A first experimental Sine mod for Zen Browser.

## What this alpha does

- Adds **Create Note** to Zen's `+` / Create New popup.
- Creates a note immediately and opens a minimal Markdown editor.
- Shows created notes directly in the Zen sidebar.
- Autosaves notes locally.
- Stores every note as a standalone `.md` file inside your Zen profile:
  - `<Zen profile>/zen-notes/<note-id>.md`
  - `<Zen profile>/zen-notes/index.json`

## Current limitations

- No delete/rename context menu yet.
- No Markdown preview yet — editor is plain Markdown text.
- No "Add selection to note" context-menu action yet.
- Sidebar placement is an alpha implementation and may need adjustment after testing against your exact Zen build.

## Sine

This repository uses Sine's `theme.json` format and a privileged userChromeJS script.

Before GitHub installation, replace `YOUR_USERNAME` in `theme.json` with your GitHub username/repository URL.
