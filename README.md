# Zen Notes

### Your notes, inside Zen. — Version 1.1.3

Markdown notes in regular browser tabs, quick drafts in the sidebar, and a way to save text, links and images from the web without leaving your workspace.

**Local Markdown · Live Preview · Quick Notes · Tables & Math · Automatic Notes Sync**

## Get started

Zen Notes is a **Sine mod for Zen Browser**, not a standalone application or a Firefox extension. Both the JavaScript and stylesheet must load.

1. Install the mod through Sine using this repository: `https://github.com/preperevet-1/Zen-Notes`.
2. Enable Zen Notes and fully restart Zen.
3. Open the sidebar **+** menu and choose **Create Note**, or use **⌘⇧N** on macOS / **Ctrl+Shift+N** on Windows and Linux.

For a manual update of an existing installation, replace `ZenNotes.uc.js`, `ZenNotes.css` and `theme.json` together, then restart Zen. Upload the release files to the repository root rather than adding another version directory inside it. Keep the bundled library license files in the repository.

## Notes in Zen Library

On Zen builds with the new Library (including the 1.23t integration target), open **Library → Notes**, directly below Boosts. The mod registers Notes alongside the built-in sections.

- Browse white square note cards with titles at the top, using Media’s results wrapper, grid dimensions and spacing. Cards use isolated paper styling instead of native button styling, with clipped previews and a white background. Cards are sorted by most recently updated.
- Search by note title, case-insensitively, using the native Library search field.
- Preview the beginning of the note or its first embedded PNG/JPEG/GIF/WebP image (within the first 2 MB of source). Remote images are not fetched for thumbnails.
- Open the original note from its card without creating a copy.
- Right-click a card to open, rename inline, duplicate, export, reveal its file or delete the note. There is no creation button or note counter in the Library header.
- Cards scale on hover like Media without a hover border change.
- The Notes icon uses native Library theme colors, fills when selected, animates and respects reduced-motion settings.
- In Boosts, note entries show a note icon and `notes` beneath the title; other sites keep their original appearance.
- The **Donate to Zen** button is hidden only in Library's footer.

Previews load lazily with at most two concurrent reads. Notes continue to work on builds without Library; the new section appears only when Library is available. The integration follows the native [section registry](https://github.com/zen-browser/desktop/blob/dev/src/zen/library/ZenLibrary.mjs) and [media-card styling](https://github.com/zen-browser/desktop/blob/dev/src/zen/library/zen-library.css). These are internal APIs and can change between Zen releases.

Library registration, search, safe preview rendering, opening existing notes and cleanup have DOM regression coverage. Visual behavior in a running 1.23t build has not yet been verified.

## Notes that work like tabs

- Create, rename, duplicate, pin, unpin and delete notes from the relevant sidebar and tab menus.
- Edit the title directly in the note. Changes save automatically to local Markdown files.
- Keep notes in their original Spaces. Adding content from another Space updates the original note without creating a second tab there.
- Link notes together with **Link to Note** or `[[note title]]` / `[[note-id|label]]`.
- Use in-note search, selection, undo and redo.
- Use Zen's note appearance / Boost integration to customize presentation.

Closing a normal note tab is different from deleting its saved note. Use **Delete Note** to remove it.

## Markdown & editing

Live Preview renders Markdown while keeping its source editable. Select text for the floating formatting toolbar, or right-click for the editing menus.

| Content | Syntax or control |
| --- | --- |
| Headings | `# Heading`, `## Heading`, `### Heading` and Markdown heading levels |
| Bold / italic | `**bold**`, `*italic*` |
| Underline / strike | Formatting menu; `~~strikethrough~~` |
| Bulleted / numbered lists | `- Item`, `1. Item` |
| Tasks | `- [ ] Task`, `- [x] Completed task` |
| Quotes / callouts | `> Quote`, `> [!note] Note` |
| Inline / fenced code | Backticks or fenced code blocks; code copy control |
| Inline / block math | `$...$` and `$$` blocks, rendered with bundled KaTeX |
| Links | `[label](https://example.com)`, URLs, links to other notes |
| Tags | `#tag`, with theme-aware styling |
| Footnotes | Footnote insertion menu, `[^1]` and `[^1]: Definition` |
| Divider | `---` |
| Spoilers / colors | Formatting menus, text and background color choices |
| Date | Insert date from the editor menu |

Numbered lists automatically renumber from 1 after edits. Pasting multiple lines inside a numbered item continues that list. Adding captured web content to a note ending with a numbered list appends numbered items; a blank line separates the list from ordinary text. Source-mode mouse selection keeps the source editor open.

**Enter** continues a list with its next marker or number. Task continuation creates an unchecked item. Enter on an empty list item exits the list. **Shift+Enter** inserts a new line without repeating the list marker.

### Tables

Insert a Markdown table and edit cells directly. The table context menu supports:

- Adding and deleting rows or columns.
- Moving rows up/down and columns left/right.
- Left, center and right alignment by column.
- Ascending and descending column sorting.
- Deleting the entire table.

Tab / Shift+Tab move between cells. Enter moves down; Shift+Enter inserts a line break inside a cell.

## Images, PDFs & video

- Paste or drop images into a note, or choose an image from disk.
- Resize an image using its small corner handle. Images have rounded corners.
- Right-click an image to **Copy Image**, **Save Image…** or delete it.
- Import a PDF through the file picker, drag-and-drop or clipboard file insertion. PDFs appear as document links/cards, not images.
- Open attached PDFs from their links.
- Supported YouTube links show video previews; their context menu can hide or restore the preview.

Embedded images and PDFs are stored in the note's Markdown as data URLs. The editor uses short internal references so it does not need to display the encoded payload. Large attachments still increase note size and are excluded from Notes Sync.

## Quick Notes

Use **Quick Note** in the sidebar context menu or **⌘⇧⌥N / Ctrl+Shift+Alt+N**. Each invocation creates a separate draft.

- Multiple drafts share the sidebar stack with Zen's media cards.
- Hover expands the stack; keyboard focus keeps it open while editing.
- Edit the title and text directly, with automatic local saving and restoration after restart.
- Basic Markdown includes bold, italic, strikethrough, links, bullets, numbered lists and task checkboxes.
- Right-click for formatting and clipboard actions. There is no floating selection toolbar or preview checkbox.
- **Insert link** inserts `[text]()` with the caret inside the empty destination.
- Plain clicks edit link text. **⌘-click / Ctrl-click** opens the link.
- Spellchecking is disabled in the quick title and editor.
- The open button turns the draft into a regular note tab.

**The × button deletes that Quick Note**, including its saved draft. It does not just hide the card. Other drafts remain intact.

## Save content from the web

Select website text and use **Add text to note**, or use the add-selection shortcut. Browser context menus also provide note destinations for supported links and images.

Choose an existing note from any Space or create a new one. Captured content can include a source reference. Adding to an open Quick Note refreshes that draft; adding to a note in another Space does not move it or create another representation of it.

## Keyboard shortcuts

Use **⌘** on macOS and **Ctrl** on Windows/Linux for the modifier below. Formatting shortcuts apply while the main note editor has focus.

| Action | macOS | Windows / Linux |
| --- | --- | --- |
| New note | ⌘ Shift N | Ctrl Shift N |
| New Quick Note | ⌘ Shift Option N | Ctrl Shift Alt N |
| Add selected text to a note | ⌘ Shift A | Ctrl Shift A |
| Bold | ⌘ B | Ctrl B |
| Italic | ⌘ I | Ctrl I |
| Insert link | ⌘ K or ⌘ U | Ctrl K or Ctrl U |
| Underline | ⌘ Shift U | Ctrl Shift U |
| Strikethrough | ⌘ Shift X | Ctrl Shift X |
| Inline code | ⌘ E | Ctrl E |
| Code formatting | ⌘ Shift K | Ctrl Shift K |
| Quote | ⌘ Shift I | Ctrl Shift I |
| Spoiler | ⌘ Shift P | Ctrl Shift P |
| Select all | ⌘ A | Ctrl A |
| Undo | ⌘ Z | Ctrl Z |
| Redo | ⌘ Shift Z or ⌘ Y | Ctrl Shift Z or Ctrl Y |
| Find in note | ⌘ F | Ctrl F |

Additional editor keys:

- **Enter / Shift+Enter:** continue a list / new line without a marker.
- **Tab / Shift+Tab:** indent / outdent the current main-note line; move between table cells when editing a table.
- **Enter / Shift+Enter in Find:** next / previous match. Escape closes Find.
- **Escape in Quick Notes:** leave the focused editor.
- **⌘B / Ctrl+B** and **⌘I / Ctrl+I** also work in Quick Notes. Other quick formatting is available through right-click.

The mod reserves its note-creation shortcuts, which can overlap with browser defaults. Keyboard layout and other mods may affect shortcut handling.

## Import, export & platform integration

The editor context menu provides:

- **Import Markdown…** to bring in a `.md` file.
- **Export…** for Markdown, HTML or PDF.
- **Print / Save as PDF…** for the browser print flow. PDF output defaults to Letter page size.
- **Show in Finder** on macOS or **Show in Files** on Windows/Linux.
- **Send to Apple Notes** and available system sharing services on macOS only.

PDF import and export use different paths. Native PDF behavior depends on the Zen version and operating system; if direct export fails, use **Print / Save as PDF…**. Recent PDF and sidebar changes have local regression coverage, but are not fully verified on every supported platform.

## Automatic Notes Sync

Notes Sync uses your signed-in Zen / Mozilla account through a custom Sync engine. With the mod installed on each device and browser Sync configured, it enables and schedules itself automatically: there is no regular **Enable Sync** or **Sync Now** step. Background checks run approximately every two minutes while Zen is open.

This feature remains **experimental in 1.0**:

- It transfers text snapshots up to **64 KiB per serialized snapshot**.
- Notes containing embedded attachments are skipped.
- Deletions and Space placement do **not** sync.
- Conflicting versions may appear as a **Sync copy**; there is no collaborative text merge.
- Offline or unavailable Sync retries later.
- Account binding prevents automatically uploading the same profile's notes to a different account. Use a separate browser profile for another account.

The compatibility engine name remains `zennotestest`; changing that identifier would separate existing installations' sync data. Keep a local backup before relying on Sync for migration.

## Storage & backups

Notes live in the active Zen profile's `zen-notes` directory:

- `<note-id>.md` — note title and Markdown content.
- `index.json` — note metadata.
- `.deleted/` — local deletion markers.
- `sync-test-v1/` — Sync engine working data.

Quick draft IDs are also stored in browser preferences. Backing up the whole profile preserves those preferences as well as the notes. To back up note content alone, copy the `zen-notes` directory while Zen is closed or export individual notes as Markdown.

Local editing does not require Sync. Sync, remote images, video metadata and opening external links can use the network.

## Repository contents

| File | Purpose |
| --- | --- |
| `ZenNotes.uc.js` | Note editor, sidebar integration, storage and Sync |
| `ZenNotes.css` | Main editor and Quick Note styles |
| `theme.json` | Sine manifest and version |
| `README.md` | Installation, features and usage |
| `KATEX-LICENSE.txt` | Bundled KaTeX license |
| `LUCIDE-LICENSE.txt` | Bundled Lucide icons license |

No build step is required. Upload these files together; old test guides, generated archives and development scripts are not part of this release.

## Credits

Math rendering uses **KaTeX**. Icons use **Lucide**. Quick Notes adapt the installed Zen media stack's layout and reindexing behavior while keeping cards opaque. See the included library license notices.
