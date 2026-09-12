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
