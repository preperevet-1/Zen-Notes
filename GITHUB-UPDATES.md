# 0.14.9 alpha

- Keep rendered text during mouse selection and Select All; map selections back to Markdown for edits.
- Add a selection toolbar and Format / Paragraph / Insert context menus.
- Add Copy Image and Delete Image, with native image clipboard integration.
- Separate New Note from existing notes in Add Page to Note.
- Recover note icons across workspaces.
- Add an empty-note placeholder.

Validation: syntax check, 22 focused logic/DOM mock checks, 26 baseline checks. Live Zen UI verification remains outstanding. Maths entries store Markdown notation; TeX typesetting is not included.

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
