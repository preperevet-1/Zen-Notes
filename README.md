# Zen Notes — 0.3.0 alpha

Experimental Sine mod for Zen Browser.

## Alpha 0.3 changes

- Notes remain normal Zen tabs.
- Uses a document-style monochrome icon for the note tab and **Create Note** menu item.
- The backing internal page is now `about:home#zen-note=...` instead of `about:blank`, avoiding Zen's misleading **Not secure** identity for the blank page.
- Markdown saving was rewritten so Firefox `contenteditable` wrappers no longer flatten lists. Bullet and numbered lists should survive switching tabs/restarting Zen.
- More Obsidian-like editing behavior:
  - headings `#` through `######`
  - bullet and numbered lists
  - list continuation on Enter
  - empty list item + Enter exits the list
  - Tab / Shift+Tab indents/outdents list items
  - task lists (`- [ ]`, `- [x]`)
  - bold, italic, inline code, strikethrough and highlight
  - fenced code blocks and blockquotes
- Notes are still stored as standalone `.md` files in `<Zen profile>/zen-notes/`.

## Important: Zen Boosts

Boosts are **not fully supported yet** in this alpha. Zen's own Boosts manager only allows Boosts on `http` and `https` pages, while the current note editor is a browser-chrome overlay backed by an internal `about:` page. The correct fix is to move the editor into a real HTTPS content page / content actor in the next architecture step, rather than pretending Boosts work here.

## Install/update

Replace the files in your GitHub repository, commit them, update/reinstall the mod in Sine, then restart Zen.
