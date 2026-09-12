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
