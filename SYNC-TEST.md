# Zen Notes 0.15.1-sync-test — Account API and PDF compatibility

Mozilla Account access uses getFxAccountsSingleton() on current Zen, with the legacy fxAccounts export as a fallback. All three account-access paths share this helper.

PDF export now reports preparation/saving progress, identifies the failing stage, and surfaces picker errors. It recognizes both paperId and paperName and both print-settings factories. The underlying cause of silent non-saving on Windows/Linux is not yet reproduced.

A separate Print / Save as PDF… command uses Zen's built-in print dialog. Choose Save to PDF there, save, then close the prepared preview tab. Its temporary HTML is deleted when that tab closes. This bypasses the mod's silent-print settings and file picker.

Tests: 50 editor checks, PDF success/failure mocks, native-dialog lifecycle mocks for Windows/Linux, picker-error handling, and nine Sync tests each with current and legacy account APIs. Real cross-device Sync and native Windows/Linux PDF output remain unverified.

Install on both devices and restart Zen. Enable Test Notes Sync, then Sync Notes Now. All prototype limitations in SYNC-TEST.md still apply.

# Zen Notes 0.15.0-sync-test

Experimental Mozilla/Firefox Sync engine, opt-in from the note context menu. This is a two-profile text-note transfer prototype, not a production continuous-merge implementation. It uses CryptoWrapper and the installed Firefox Sync Store / LegacyTracker / SyncEngine interfaces.

## Test on two Zen profiles/devices

1. Install Sine and this same build on both, then restart Zen.
2. Sign in to the same Mozilla Account and enable Zen Sync on both.
3. Create a small text-only note on device A with a unique phrase.
4. Right-click inside a note: Enable Test Notes Sync, then Sync Notes Now.
5. On device B, open/create a note to access the same context menu, enable Test Notes Sync, then Sync Notes Now.
6. Type `notes` in the address bar to find and open the transferred note. Imported notes do not automatically open tabs.
7. Repeat Sync Notes Now: an unchanged note should not be duplicated.
8. Edit the original separately on A and B, sync A then B. Different incoming text is kept as a (Sync copy), never written over the local original. This prototype can create such a copy for ordinary remote edits too.
9. Disable Test Notes Sync to stop this engine. Disabling does not delete snapshots already uploaded.

## Prototype scope

- Text-only snapshots, at most 64 KiB of JSON per note. Notes containing embedded base64 images/PDFs are skipped in full, with a skipped count in the notice. URL links remain links; remote content is not uploaded.
- Snapshots are immutable and previous revisions remain in the Sync collection. Download restores the newest snapshot per original note; divergent local content is retained separately.
- Local deletion markers prevent resurrection on that profile. Deletion does not propagate; a fresh profile may restore a previously deleted note from its existing remote snapshot.
- Space IDs and placement are not synchronized in this prototype. Open the imported note in the desired Space.
- One Mozilla Account per test profile. Switching accounts blocks this engine; use a separate profile.
- No native account password/token handling: Sync supplies encryption and transport through the logged-in account.
- Uses a separate `zennotestest` Sync collection. Local snapshots live in `zen-notes/sync-test-v1`.
- Existing PDF functionality is unchanged from 0.14.31.

## Validation

50 editor DOM regressions and mocked PDF tests passed. Nine additional local tests cover snapshot deduplication, empty-store restore, repeated import, conflict copies, deletion markers, invalid record IDs, embedded attachments, account changes and preservation of local notes on engine wipe.

Actual transfer through Mozilla servers between two logged-in Zen profiles has NOT been verified. A completed local/mock test is not proof of server support. If Sync Notes Now reports failure, inspect `about:sync-log`; do not share tokens or the full account log publicly.

