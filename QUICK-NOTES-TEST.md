# Zen Notes 0.15.11-quick-test

Fix Quick Note opening: empty lines now use XML-valid self-closing breaks in browser chrome. Shortcut failures display an error notice instead of only logging to the console.

Validation: reproduced the invalid XML failure in 0.15.10; the fixed build passes XML fragment and Quick Note DOM regressions. Native Zen shortcut interaction remains to be verified.

# Zen Notes 0.15.10-quick-test

Quick Notes now use an always-rendered editable Markdown surface. Removed the preview/check button and selection toolbar. Right-click offers bold, italic, strikethrough, lists, task lists and links. Website links open a browser tab. Markdown remains the stored file format.

Validation: JavaScript syntax and DOM checks passed for live bold rendering, caret cleanup, lists, checkbox persistence, appended links and right-click menu. Native Zen editing, clipboard commands and layout still require testing.

# Zen Notes 0.15.9-quick-test

Existing nonempty quick drafts open in rendered Markdown preview. Use the check button to preview after editing; double-click preview text (or Enter on the preview) to edit. HTTP(S) preview links open a tab instead of activating source editing. Text selection exposes a compact toolbar: bold, italic, link, bullets, numbered list and checkbox list.

Validation: sidebar DOM tests including Markdown preview, selection formatting and link activation passed. Native Zen interaction and layout remain unverified.

# Zen Notes 0.15.8-quick-test

Opaque stack cards and two-stage collapse: content animates shut before compact cards stack. New Quick Notes explicitly expand and focus on creation. Remove note icon.

Minimal Markdown: editable source with preview on blur; bullets, ordered lists, bold, italic and clickable task checkboxes. Click preview text to edit. Cmd/Ctrl+B and I wrap selection; Enter continues list numbering/bullets/tasks, with an empty item ending the list. Website Add to Note refreshes any matching Quick Note card after updating the file.

Validation: syntax and sidebar DOM regressions passed, including Markdown/task persistence, list continuation, delayed collapse and external link append refresh. Native Zen visuals still require verification.

# Zen Notes 0.15.7-quick-test

Unify stack hover and keyboard-focus expansion. Collapse card bodies before applying stacked transforms, clip collapsed cards to a consistent 34px height and keep all cards expanded while editing. Prevents exposed note text overlapping media cards when moving toward Space buttons.

Validation: syntax and nine sidebar DOM checks, including pointer leave and focus transitions. Native rendering remains to be verified.

# Zen Notes 0.15.6-quick-test

Disable window dragging across Quick Note and stop pointer presses propagating to sidebar handlers without cancelling native selection. Thin low-contrast scrollbar with transparent track. Shared stack hover/focus expands Quick Note together with media cards. Add the same page icon used by the New Note menu before the title.

Validation: syntax and eight sidebar DOM checks passed, including preservation of default text selection and pointer event isolation. Native window dragging, scrollbar appearance and hover visuals still need verification in Zen.

# Zen Notes 0.15.5-quick-test

Remove native textarea borders and focus chrome. Compact card header is 34px including padding; expanded text area is 110px. Close now deletes the local draft through the normal deletion path, clears its remembered ID and removes matching cards from open windows. Opening again creates a blank note. Expand still keeps the note.

The shared media stack now orders visible cards by arrival; a media player appearing after Quick Note can become the front card. Reappearing media is treated as newly visible.

Seven DOM tests passed, including deletion/reopen and newly arriving media order. Native appearance remains unverified. Existing experimental Sync does not propagate deletions to other profiles.

# Zen Notes 0.15.4-quick-test — Shared media stack

Quick Note now lives inside Zen's media controls toolbar and shares its card styling and stacked/list presentation. A scoped adapter assigns visual stack positions without changing Zen's media-controller records. Hiding or expanding the note restores native media styling. Title is plain editable text without input chrome. Smaller action buttons appear on hover or keyboard focus.

Validation: syntax and seven sidebar tests covering persistence, restore, opening without duplication, shared stack, hidden media and cleanup passed. Actual native Zen layout remains unverified; this is a test build.

# Zen Notes 0.15.3-quick-test — Sidebar Quick Notes

Open Quick Note from the sidebar context menu, or Cmd+Shift+Option+N on macOS / Ctrl+Shift+Alt+N on Windows/Linux. The card sits immediately above Zen's media toolbar.

Collapsed: title and Open as note / Hide buttons. Hover or keyboard focus expands the text area. Focus keeps it expanded while typing; Escape blurs the field. Move the pointer away to collapse. The close button hides the card without deleting its note. Open as note opens the original note and finishes the quick draft; the next Quick Note creates a fresh draft.

This prototype uses plain-text/Markdown input, not the full live-preview editor. Input persists in a regular local note and participates in the existing automatic text Sync. A saved active draft reappears collapsed after restarting Zen. Existing Sync prototype restrictions remain.

Tests: five sidebar DOM scenarios (save, hide/reopen, restore, expansion without duplicate, fresh draft), 50 editor DOM checks and PDF mocks passed. Native Zen sidebar placement, hover rendering and compact mode still require visual testing.

