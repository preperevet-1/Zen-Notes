# Zen Notes — 0.4.1 alpha.1

Experimental local Markdown notes for Zen Browser through Sine.

## What changed in 0.4

- Notes remain normal Zen tabs — no separate Notes section.
- Filled document icon in the Zen sidebar/tab list.
- Outline document icon next to **Create Note** in Zen's `+` menu.
- Replaced the fragile HTML-list/contenteditable model with a line-stable Markdown editor.
- Markdown is always the source of truth, so `-`, `1.`, tasks and indentation cannot disappear because Firefox rewrote `<ul>/<li>` DOM.
- Arrow Up/Down now move between note lines instead of leaking to Zen's URL/search field.
- Obsidian-style current-line/source behavior: the active line shows Markdown source; inactive lines render as Live Preview.
- List continuation: Enter after `- item`, `1. item`, `- [ ] task`, or `> quote` automatically continues the marker.
- Enter on an empty list item exits the list.
- Tab / Shift+Tab indent and outdent list lines.
- Cmd/Ctrl+B, Cmd/Ctrl+I and Cmd/Ctrl+E wrap selection as bold, italic and inline code Markdown.
- Basic Live Preview for headings, unordered/ordered lists, tasks, blockquotes, fenced code, horizontal rules, bold, italic, strike, highlight, inline code, Markdown links and `[[wikilinks]]`.
- Zen Boost bridge: the small **Boost** action at the top-right opens Zen's native Boost editor for Zen Notes. Font, text case, size, colors and custom CSS are mirrored into the note page.
- Unsupported site-inspection-only Boost controls (Zap / picker / inspector) are hidden for note pages because the note editor is a browser-chrome overlay rather than website DOM.

## Storage

Each note is a standalone Markdown file:

```text
<Zen profile>/zen-notes/<note-id>.md
<Zen profile>/zen-notes/index.json
```

The file format is intentionally portable:

```md
# Note title

## Heading

- item
- [ ] task

**bold** and ==highlight==
```

## Markdown behavior

This alpha follows Obsidian's Live Preview interaction model rather than converting Markdown into browser `<ul>/<li>` while typing. The active line exposes its Markdown source, and lines outside the cursor render a preview. This avoids the list corruption seen in 0.2/0.3.

Supported in this alpha:

```text
# Heading 1 ... ###### Heading 6
- bullet
* bullet
+ bullet
1. ordered
- [ ] task
- [x] done
> quote
``` fenced code
--- horizontal rule
**bold**
*italic*
~~strike~~
==highlight==
`inline code`
[label](https://example.com)
[[wikilink]]
```

## Zen Boosts

Open a note and hover near the top-right of the page to reveal **Boost**. It opens Zen's own Boost editor using the shared `zen-notes.local` Boost profile, so one Boost currently styles all notes consistently.

Custom Boost CSS is scoped to `#zen-notes-page` so it cannot accidentally restyle the rest of the Zen browser UI.

## Known alpha limitations

- This is an Obsidian-style Live Preview implementation, not Obsidian's private editor code.
- Multi-line text selection is still basic; editing is line-oriented in this alpha.
- Markdown tables, footnotes, embeds and backlinks are not yet implemented.
- Boost Zap / element picker / inspector do not operate on the note overlay and are intentionally hidden.
- No note delete/rename context menu yet.
- No “Add selected website text to note” context menu yet.


## 0.4.1 hotfix

- Fixes the blank note page seen in Zen 1.20+/Firefox 150 by mounting the editor on the stable `tabbrowser-tabbox` instead of a transient `browserStack`.
- Explicitly uses XHTML elements for the editor surface.
- Hides the underlying `about:home` tabpanel only while a Zen Note is selected so it cannot cover the editor.
- Uses Zen/Firefox's built-in `page-portrait.svg` for the **Create Note** popup icon.
- Keeps the filled document glyph for the normal sidebar/tab icon.

## 0.4.1 hotfix 3

- Fixed the caret landing at offset 0 (before the list marker) instead of after it when: pressing Enter to continue a `-`/`1.`/`- [ ]`/`>` line, Backspace-merging into the previous line, or Left/Right crossing between lines. The caret is now re-asserted on a second animation frame, since Gecko can silently reset a freshly-focused note line's selection one frame after "focus" fires.
- The native Zen **Boost** button and the **Boosts** section in the urlbar's site-data panel are keyed to the tab's real URL host. Since a Zen Note lives at `about:home#zen-note=<id>`, Zen never matched it to our boost (stored under the synthetic `zen-notes.local` domain), so the button stayed disabled and the Boosts list stayed empty — clicks never even reached our Boost bridge. The button is now re-enabled while a note tab is selected, and a "Zen Notes Boost" row is added to the list so it isn't blank; both are reverted for every other tab.
- The sidebar/tab-list note icon was rendering dark (matching tab-label text color) instead of the intended lighter `#888891`, because Zen's own `.tab-icon-image` CSS out-specified our override even with `!important`. Bumped the selector's specificity so ours wins; the **Create Note** menu-item glyph is untouched and stays dark/`currentColor` as intended.
