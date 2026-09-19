# Zen Notes 0.15.4-quick-test — Shared media stack

Quick Note now lives inside Zen's media controls toolbar and shares its card styling and stacked/list presentation. A scoped adapter assigns visual stack positions without changing Zen's media-controller records. Hiding or expanding the note restores native media styling. Title is plain editable text without input chrome. Smaller action buttons appear on hover or keyboard focus.

Validation: syntax and seven sidebar tests covering persistence, restore, opening without duplication, shared stack, hidden media and cleanup passed. Actual native Zen layout remains unverified; this is a test build.

# Zen Notes 0.15.3-quick-test — Sidebar Quick Notes

Open Quick Note from the sidebar context menu, or Cmd+Shift+Option+N on macOS / Ctrl+Shift+Alt+N on Windows/Linux. The card sits immediately above Zen's media toolbar.

Collapsed: title and Open as note / Hide buttons. Hover or keyboard focus expands the text area. Focus keeps it expanded while typing; Escape blurs the field. Move the pointer away to collapse. The close button hides the card without deleting its note. Open as note opens the original note and finishes the quick draft; the next Quick Note creates a fresh draft.

This prototype uses plain-text/Markdown input, not the full live-preview editor. Input persists in a regular local note and participates in the existing automatic text Sync. A saved active draft reappears collapsed after restarting Zen. Existing Sync prototype restrictions remain.

Tests: five sidebar DOM scenarios (save, hide/reopen, restore, expansion without duplicate, fresh draft), 50 editor DOM checks and PDF mocks passed. Native Zen sidebar placement, hover rendering and compact mode still require visual testing.

