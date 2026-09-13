# Zen Notes 0.15.2-sync-test — Automatic Notes Sync

Install this build on both devices, restart Zen, and use the same Mozilla Account with Zen Sync. No Enable/Sync Now menu actions are needed or shown.

Notes Sync starts automatically after launch (5-second delay), after saves (5-second debounce), and polls every 2 minutes while Zen is running to receive remote changes. One window coordinates scheduling; overlapping runs are prevented. Offline/errors/locked Sync retry on a later interval. Changes made during a running sync are picked up on a later interval. Normal background success does not show a toast.

The existing account binding is retained. Signing into a different account in the same profile does not upload notes to that account. Use a separate profile for another account.

Prototype limits remain: text snapshots up to 64 KiB; notes with embedded attachments are skipped; deletion and Space placement do not sync; differing remote versions can appear as Sync copy. This is not collaborative text merging. To disable this test engine, disable the test mod and turn off services.sync.engine.zennotestest in about:config; the running test mod automatically enables its engine.

Validation: 50 editor regression tests, PDF mocks, snapshot restore/conflict tests and automatic scheduling guards. Real two-device transfer was reported working by the user on the previous build; the new automatic timing has only been checked locally with mocked Sync.
