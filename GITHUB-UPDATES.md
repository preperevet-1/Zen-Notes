# Zen Notes 0.14.26 alpha — PDF export fix

PDF export now uses Gecko's outputDestination=kOutputDestinationFile instead of the obsolete printToFile property. The isolated export frame permits printing, and success is only reported after a nonempty output file exists. The export picker label is now PDF (.pdf); page dimensions remain 8.5 × 11 inches.

Validation: DOM regressions and mocked PDF success/failure checks. Actual printing in Zen still requires manual verification.

Replace mod files and fully restart Zen after updating through Sine.

# Zen Notes 0.14.25 alpha — Add to Note across Spaces

Add to Note lists all stored notes rather than only visible/open tabs. Appending updates the original note file without opening, adopting or creating a tab in the source Space. Open-note creation reuses an existing tab across all stored Spaces/windows. Pending edits in an existing note editor are saved before append and its view is refreshed afterward. Existing duplicate tabs are not removed automatically.

Validation: 50 DOM checks plus cross-Space append and PDF settings tests passed. Cross-Space tests assert no tab creation, no destination mounting and unchanged active Space. Live Zen workspace behavior remains unverified.

Upload archive contents to the repository root; updatedAt is advanced for Sine. Restart Zen after updating.

# Zen Notes 0.14.24 alpha

Remove the floating image action panel. Keep only the bottom-right resize corner, drawn with a solid gray 2px stroke and no blur, filters or shadow. Resize behavior is unchanged.

Validation: syntax and markup checks; live Zen appearance remains unverified. updatedAt advanced for Sine.

# Zen Notes 0.14.23 alpha — Image panel corrections

Explicit SVG namespace for Gecko/XHTML image controls. Fixed two-button Preview / View code panel with contrasting surface. Image frames align to their own height instead of stretching to taller neighbors; controls are clipped within the frame. Removed image hover outline and added a neutral gray resize grip with contrast on dark/light images.

Validation: syntax and DOM regressions. Live Zen visual validation remains outstanding. updatedAt advanced for Sine.

# Zen Notes 0.14.22 alpha — Image controls

Top-right rounded two-icon panel for Preview and View code. Bottom-right curved resize grip replaces the centered line. Corner dragging combines horizontal and vertical movement while retaining aspect ratio. Hover controls use theme colors. updatedAt advanced for Sine.

Validation: JavaScript syntax; live Zen appearance remains unverified.

# Zen Notes 0.14.21 alpha — Tags, images and PDF export

Fix unchecked alignment menu items. Theme-colored hashtag pills. PDF Letter option in Export (native Gecko printing, 8.5 × 11 inches). Save Image in image context menu. Rounded images with hover outline, Preview and View code controls, minimal bottom resize handle and right/bottom edge dragging. Preview closes with Escape. Updated updatedAt timestamp for Sine update detection; GitHub language override included.

Validation: 49 DOM regressions plus a mocked native PDF settings/output-path test passed. Actual PDF creation, image downloads and native Zen visual interaction have not been verified in this environment. PDF export uses the HTML exporter; complex Markdown layout may differ from the editor.

Upload archive contents to the repository root, including theme.json. Then check for updates in Sine and fully restart Zen. Personal notes were not changed.

# Zen Notes 0.14.20 alpha

Preserve source offsets when focusing table cells so empty formatting places the caret inside delimiters. Give callout bodies independent editing hosts and exempt their native input from whole-note selection handling. Block rendered-math selection through selectstart/mousedown and a selectionchange guard, while retaining source editing through View code.

Validation: syntax and 46 jsdom tests passed, including exact underline caret offset in a cell, math selection clearing and callout native beforeinput/focus. Live Zen behavior remains unverified. Replace mod files and fully restart Zen.

# Zen Notes 0.14.19 alpha

Table arrow keys explicitly move/extend the caret; Shift+Enter inserts an actual editing newline, serialized as a Markdown table break. Hide Copy while code is editing. Rendered math disables text selection. Callout body supports direct plain-text editing and Enter while the title remains in source editing. Native table context menu follows Format / clipboard / Row / Column / sorting groups; all existing table actions remain, without the excluded lookup, linking or external-service entries.

Validation: syntax and 43 jsdom tests passed. Native browser caret movement, clipboard commands and visual behavior require live Zen validation. Replace the mod files and fully restart Zen.

# Zen Notes 0.14.18 alpha — Tables and block interaction

Retain code styling during input and anchor code controls to their line. Read-only Math and Callout fields reject native focus; View code explicitly enters editing. Table repeat key events insert printable characters; compact cell padding and consistent transparent edge controls with 16px plus icons. Custom grouped table menu preserves all 16 existing actions and their disabled states.

Validation: syntax and 41 jsdom tests, including code input, read-only block focus, repeat key dispatch and table menu action preservation. Native key repeat, popup placement and live Zen visuals remain unverified.

Replace mod files and fully restart Zen.

# Zen Notes 0.14.17 alpha

Smaller toolbar, 16px Text control, 190px submenu and 18/17/16px headings. Reset native button appearance to remove square copy borders. Replace View code labels with Lucide code-xml icons (https://lucide.dev/icons/code-xml). Smooth callout borders and math hover strokes, respecting reduced motion. Refresh cached math source before rendering; Enter at the end of a formula exits to the next line and renders immediately, while Shift+Enter continues inside the block.

Validation: syntax and 37 jsdom tests passed, including typing into an empty math block and rendering after one Enter. Native Zen visuals remain unverified. Replace mod files and fully restart Zen.

# Zen Notes 0.14.16 alpha — Quick Menu proportions

More rounded toolbar and text menu, compact spacing, larger 20px Text control and 18px chevron. Heading options use bold 22/20/18px typography. Names and actions are unchanged; no shortcut labels. Menu typography is explicitly scoped to resist note-theme font overrides.

Validation: JavaScript syntax and DOM regression checks. Live Zen appearance remains unverified.

# Zen Notes 0.14.15 alpha

Empty Markdown link destination with caret inside parentheses. Narrower text-style menu with differentiated heading sizes and larger Text/chevron control. Code copy uses an unboxed icon, cancels mouse focus and announces “Added to your clipboard”. Math supports single-line display delimiters and has a separate View code action. Callouts use theme variables, grouped hover borders and View code.

Validation: syntax and 35 jsdom tests passed. Native Zen visual rendering, Boost switching and toast placement have not been verified. The exact reported math rendering issue was not reproduced from the supplied screenshots; this build improves delimiter support and reading/edit interaction.

Replace mod files and restart Zen. Personal notes were not modified.

# Zen Notes 0.14.14 alpha — Quick Menu and formatting

- Selection toolbar: Link, Bold, Italic, Underline, Strikethrough, Text.
- Link inserts Markdown and selects the URL for replacement without a prompt.
- Custom text-style popover retains existing labels, uses larger type and a selected indicator, and omits shortcut labels.
- Preserve selection on pointer/mouse interaction and avoid moving the toolbar during formatting clicks. Remove pressed-item outlines.
- Separate italic and bold delimiters when combining styles; recognize HTML strikethrough in formatting transformations.

Validation: JavaScript syntax and 32 jsdom tests, including combined formatting toggles, Link caret selection and custom heading menu. Live Zen UI is not verified.

Replace the mod files and fully restart Zen.

# Zen Notes 0.14.13 alpha — Selection and text interaction

- Undo/Redo snapshots retain the body caret position; Redo restores it with the text.
- Single click enters Markdown source. Double click selects a word; four consecutive clicks on the same line select the line.
- Drag selection scrolls near the top and bottom of the note viewport, retaining its anchor across lines. Animation stops on release, cancellation, or document replacement.
- Copy and Cut supply Markdown plain text and semantic HTML lists instead of editor-specific list marker elements.

Validation: JavaScript syntax check and 29 jsdom tests passed. New regressions cover Redo caret position, formatted list clipboard data, click sequences, and upward multiline selection with simulated scroll geometry. Live Zen and physical trackpad behavior remain unverified.

Replace the mod files and fully restart Zen. Personal notes were not modified.

# Zen Notes 0.14.12 alpha — Editor stability and Undo / Redo

- Capture history before native input; Redo no longer records a new state before traversing history. Restore flags reset even if restoration fails.
- Cancel stale pointer selections when replacing the document; ignore detached lines in delayed blur handlers. Remove redundant inline DOM rebuilding on keyup.
- Enter inserts one clean line. Shift+Enter continues supported inline formatting or list style. Code blocks retain their indentation.
- Double-click text to enter Markdown source editing.

Validation: JavaScript syntax and 25 jsdom regression tests passed, including deleting old text, 30 new edits, Undo/Redo and editing after Undo. Native Zen interaction has not been tested; the reported intermittent freeze is not reproduced in this environment.

Replace the mod files and fully restart Zen. Personal notes are not included or modified.

# 0.14.11 alpha

Rework selection formatting and cursor placement; simplify the floating toolbar; add compact tables, unified callouts, code copying, real MathML formula rendering and smaller footnotes. Fix editor shortcut interception and stale sidebar titles. Remove redundant menu actions.

Validation: JavaScript syntax check and 20 jsdom tests passed. Live Zen visual and interaction verification remains outstanding.

# Оновлення через Sine та GitHub

Репозиторій: https://github.com/preperevet-1/zen-notes

## Одноразове налаштування

1. Завантажте **вміст** цієї папки в корінь репозиторію: ZenNotes.uc.js, ZenNotes.css, theme.json та приховану папку .github з workflow. Не вкладайте їх у додаткову папку zen-notes-v-0.10.
2. У GitHub → Settings → Actions → General дозвольте запуск Actions. Workflow потребує Contents: write; політика репозиторію/захищена гілка може заборонити автоматичний commit.
3. У Sine встановіть/прив’яжіть мод через репозиторій `preperevet-1/zen-notes`, без прив’язки до конкретного commit. Локальна заміна файлів сама по собі не змінює адресу встановленого моду.
4. Увімкніть автоматичні оновлення Sine (`sine.auto-updates = true`) та оновлення для Zen Notes (мод має бути увімкнений, без no-updates).

## Наступні оновлення

Змініть ZenNotes.uc.js або ZenNotes.css у стандартній гілці й виконайте push. Action перевірить синтаксис JavaScript та запише новий updatedAt у theme.json. Sine порівнює саме цю дату, а не лише номер версії. Дочекайтеся успішного Action, потім перезапустіть Zen. Якщо Sine завантажив JavaScript вже після запуску моду, виконайте ще один перезапуск за його повідомленням. Видаляти мод щоразу не потрібно.

Якщо Actions недоступні, оновлюйте updatedAt вручну до нового ISO timestamp, наприклад 2026-09-09T15:30:00Z. Повторення тієї самої дати може не запустити оновлення.

Ця збірка підготовлена локально: файли не опубліковано на GitHub, налаштування Sine не змінено. Нотатки зберігаються окремо від моду — у папці zen-notes профілю браузера. Не завантажуйте особисті нотатки до репозиторію.

Підтримка автооновлень: https://github.com/CosmoCreeper/Sine
