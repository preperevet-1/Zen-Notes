"use strict";

(() => {
  const LOG = "[Zen Notes]";
  const VERSION = "0.7.1-alpha";
  const HTML_NS = "http://www.w3.org/1999/xhtml";
  const MENU_NOTE_ICON = "chrome://global/skin/icons/page-portrait.svg";
  const TAB_URL_PREFIX = "about:home#zen-note=";
  const LEGACY_TAB_URL_PREFIXES = ["about:blank#zen-note="];
  const INDENT = "    ";

  if (window.gZenNotes?.destroy) {
    try { window.gZenNotes.destroy(); } catch (error) { console.error(LOG, error); }
  }

  const FileIO = globalThis.IOUtils;
  const Paths = globalThis.PathUtils;
  if (!FileIO || !Paths) throw new Error(`${LOG} IOUtils/PathUtils unavailable`);

  let SessionStoreAPI = globalThis.SessionStore || null;
  if (!SessionStoreAPI && globalThis.ChromeUtils?.importESModule) {
    try {
      ({ SessionStore: SessionStoreAPI } = ChromeUtils.importESModule(
        "resource:///modules/sessionstore/SessionStore.sys.mjs"
      ));
    } catch (error) {
      console.warn(LOG, "SessionStore unavailable", error);
    }
  }

  let ZenBoostsManager = null;
  try {
    ({ gZenBoostsManager: ZenBoostsManager } = ChromeUtils.importESModule(
      "resource:///modules/zen/boosts/ZenBoostsManager.sys.mjs"
    ));
  } catch (error) {
    console.warn(LOG, "Zen Boosts manager unavailable", error);
  }

  class ZenNotesController {
    constructor() {
      this.notes = [];
      this.storageDir = Paths.join(Paths.profileDir, "zen-notes");
      this.indexPath = Paths.join(this.storageDir, "index.json");
      this.currentNoteId = null;
      this.noteTabs = new Map();
      this.saveTimer = null;
      this._destroyed = false;
      this._loadingPage = false;
      this._expectingCreatePopupUntil = 0;
      this._activeLine = null;
      this._boostEditor = null;
      this._writes = Promise.resolve();
      this._histories = new Map();
      this._closingNotes = new Set();

      this._onPopupShowing = this._onPopupShowing.bind(this);
      this._onCreateButtonPointer = this._onCreateButtonPointer.bind(this);
      this._onTabSelect = this._onTabSelect.bind(this);
      this._onTabClose = this._onTabClose.bind(this);
      this._onMutation = this._onMutation.bind(this);
      this._onBoostUpdate = this._onBoostUpdate.bind(this);
      this._onNativeBoostButton = this._onNativeBoostButton.bind(this);
      this._onFindShortcut = event => {
        if (this.currentNoteId && (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "f") {
          event.preventDefault(); event.stopImmediatePropagation(); this._openFind();
        }
      };
    }

    async init() {
      try {
        await FileIO.makeDirectory(this.storageDir, { ignoreExisting: true });
        await this._loadIndex();

        document.addEventListener("keydown", this._onFindShortcut, true);
        document.addEventListener("popupshowing", this._onPopupShowing, false);
        gBrowser.tabContainer.addEventListener("TabSelect", this._onTabSelect);
        document.addEventListener("TabClose", this._onTabClose, true);
        // Zen's real "Create Boost" entry lives at #zen-site-data-boost inside
        // the site-info panel (the one opened from the identity/permissions
        // icon in the urlbar). Intercept its "command" event in the capture
        // phase so, while a note tab is selected, it opens OUR boost editor
        // (zen-notes.local) instead of trying to boost the note tab's real
        // about:home URL.
        document.addEventListener("command", this._onNativeBoostButton, true);

        this.observer = new MutationObserver(this._onMutation);
        this.observer.observe(document.documentElement, { childList: true, subtree: true });
        this.titleObserver = new MutationObserver(records => {
          for (const { target: tab } of records) {
            const note = this._getNote(this._idFromTab(tab));
            if (note && tab.getAttribute("image") !== this._filledNoteIcon()) tab.setAttribute("image", this._filledNoteIcon());
            if (note && tab.getAttribute("label") !== note.title) {
              tab.setAttribute("label", note.title);
              tab.label = note.title;
            }
          }
        });
        this.titleObserver.observe(gBrowser.tabContainer, {
          attributes: true, subtree: true, attributeFilter: ["label", "image", "pending", "zen-empty-tab"],
        });

        if (ZenBoostsManager && globalThis.Services?.obs) {
          Services.obs.addObserver(this._onBoostUpdate, "zen-boosts-update");
          Services.obs.addObserver(this._onBoostUpdate, "zen-boosts-active-change");
        }

        this._bindCreateButton();
        this._recoverExistingNoteTabs();
        // SessionStore restores tabs. An index entry alone must never reopen a note.
        await this._syncSelectedTab();
        this._applyBoost();

        console.info(LOG, `${VERSION} loaded`);
      } catch (error) {
        console.error(LOG, "Initialization failed", error);
      }
    }

    _onNativeBoostButton(event) {
      if (!this.currentNoteId) return;
      const target = event.target?.closest?.("#zen-site-data-boost");
      if (!target) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      try {
        target.closest("panel")?.hidePopup?.();
      } catch {}
      this.openNoteBoost();
    }


    async _loadIndex() {
      if (!(await FileIO.exists(this.indexPath))) {
        this.notes = [];
        await this._writeIndex();
        return;
      }
      try {
        const parsed = JSON.parse(await FileIO.readUTF8(this.indexPath));
        this.notes = Array.isArray(parsed?.notes) ? parsed.notes : [];
        await this._filterDeletedNotes();
      } catch (error) {
        console.error(LOG, "Could not read index", error);
        this.notes = [];
      }
    }

    _enqueueWrite(task) {
      const pending = this._writes.then(task);
      this._writes = pending.catch(error => console.error(LOG, error));
      return pending;
    }

    _deletedPath(id) { return Paths.join(this.storageDir, `${id}.deleted`); }

    async _filterDeletedNotes() {
      const keep = [];
      for (const note of this.notes) {
        if (await FileIO.exists(this._deletedPath(note.id))) continue;
        keep.push(note);
      }
      this.notes = keep;
    }

    async _writeIndex() {
      // Persistent tombstones also reject stale copies held by another window.
      await this._filterDeletedNotes();
      await FileIO.writeUTF8(
        this.indexPath,
        JSON.stringify({ version: 4, notes: this.notes }, null, 2)
      );
    }

    _makeId() {
      return globalThis.crypto?.randomUUID?.() || `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    _notePath(id) { return Paths.join(this.storageDir, `${id}.md`); }
    _noteURL(id) { return `${TAB_URL_PREFIX}${encodeURIComponent(id)}`; }
    _getNote(id) { return this.notes.find((note) => note.id === id) || null; }

    _idFromTab(tab) {
      const attr = tab?.getAttribute?.("zen-notes-id");
      if (attr) return attr;
      try {
        const stored = SessionStoreAPI?.getCustomTabValue?.(tab, "zen-notes-id");
        if (stored) return stored;
      } catch {}

      const spec = tab?.linkedBrowser?.currentURI?.spec || "";
      const prefix = [TAB_URL_PREFIX, ...LEGACY_TAB_URL_PREFIXES].find((p) => spec.startsWith(p));
      if (!prefix) return null;
      try { return decodeURIComponent(spec.slice(prefix.length)); } catch { return null; }
    }

    async createNote() {
      const now = new Date().toISOString();
      const note = { id: this._makeId(), title: "New Note", createdAt: now, updatedAt: now };
      this.notes.unshift(note);
      await this._writeIndex();
      await FileIO.writeUTF8(this._notePath(note.id), "# New Note\n\n");

      const tab = this._openNoteTab(note, { select: true });
      this.noteTabs.set(note.id, tab);
      await this._showNote(note.id, { focusTitle: true });
      return note;
    }

    async _readNote(note) {
      const path = this._notePath(note.id);
      if (!(await FileIO.exists(path))) return { title: note.title || "New Note", body: "" };
      try {
        const raw = (await FileIO.readUTF8(path)).replace(/\r\n/g, "\n");
        const lines = raw.split("\n");
        let title = note.title || "New Note";
        if (lines[0]?.startsWith("# ")) {
          title = lines.shift().slice(2).trim() || "New Note";
          if (lines[0] === "") lines.shift();
        }
        return { title, body: lines.join("\n") };
      } catch (error) {
        console.error(LOG, "Read note failed", error);
        return { title: note.title || "New Note", body: "" };
      }
    }

    _queueSave() {
      queueMicrotask(() => this._recordHistory());
      window.clearTimeout(this.saveTimer);
      this.saveTimer = window.setTimeout(() => {
        this._saveCurrentNow().catch((error) => console.error(LOG, "Autosave failed", error));
      }, 220);
    }

    async _saveCurrentNow() {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;
      if (!this.currentNoteId) return;

      const note = this._getNote(this.currentNoteId);
      const page = document.getElementById("zen-notes-page");
      const title = document.getElementById("zen-notes-page-title");
      const editor = document.getElementById("zen-notes-editor");
      if (!note || !page || page.hidden || !title || !editor) return;

      if (this._activeLine) this._activeLine.dataset.raw = this._lineText(this._activeLine);
      const noteTitle = title.textContent.trim() || "New Note";
      const body = this._editorMarkdown();
      note.title = noteTitle;
      note.updatedAt = new Date().toISOString();

      await this._enqueueWrite(async () => {
        if (this._closingNotes.has(note.id) || await FileIO.exists(this._deletedPath(note.id))) return;
        await FileIO.writeUTF8(this._notePath(note.id), `# ${noteTitle}\n\n${body}`);
        await this._writeIndex();
      });
      this._syncTabAppearance(note.id);
    }

    _outlineNoteIcon() {
      // Use Firefox/Zen's own built-in page glyph in chrome menus. This is more
      // reliable than a data: SVG in XUL popups and inherits the current theme.
      return MENU_NOTE_ICON;
    }

    _html(tagName) {
      return document.createElementNS(HTML_NS, tagName);
    }

    _filledNoteIcon() {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 2.5h8l5 5V21H6a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2Z" fill="context-fill" stroke="context-stroke" stroke-width="1.7" stroke-linejoin="round"/><path d="M14 2.5V8h5M8 12h7M8 16h7" fill="none" stroke="context-stroke" stroke-width="1.7" stroke-linecap="round"/></svg>`;
      return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }

    _markTab(tab, note) {
      if (!tab || !note) return;
      tab.setAttribute("zen-notes-id", note.id);
      tab.setAttribute("zen-notes-tab", "true");
      tab.setAttribute("label", note.title || "New Note");
      tab.label = note.title || "New Note";
      tab.setAttribute("image", this._filledNoteIcon());
      this._tintTabIcon(tab);
      try { SessionStoreAPI?.setCustomTabValue?.(tab, "zen-notes-id", note.id); } catch {}
    }

    // Belt-and-braces for the CSS rule above: set the color directly on the
    // icon element with inline !important, which beats any external
    // stylesheet rule (Zen's included) regardless of selector specificity.
    // Retries briefly because a just-created tab's internal template
    // (.tab-icon-image) may not be built yet on the same tick.
    _tintTabIcon(tab, attempt = 0) {
      const icon = tab?.querySelector?.(".tab-icon-image");
      if (!icon) {
        if (attempt < 5) requestAnimationFrame(() => this._tintTabIcon(tab, attempt + 1));
        return;
      }
      for (const name of ["fill", "fill-opacity", "stroke", "stroke-opacity", "color", "opacity", "-moz-context-properties"]) icon.style.removeProperty(name);
    }

    _openNoteTab(note, { select = false, background = false } = {}) {
      let tab;
      const url = this._noteURL(note.id);
      try {
        const principal = Services?.scriptSecurityManager?.getSystemPrincipal?.();
        tab = gBrowser.addTab(url, {
          skipAnimation: true,
          inBackground: background || !select,
          triggeringPrincipal: principal,
        });
      } catch {
        tab = gBrowser.addTab(url, { skipAnimation: true, inBackground: background || !select });
      }
      this._markTab(tab, note);
      if (select) gBrowser.selectedTab = tab;
      return tab;
    }

    _recoverExistingNoteTabs() {
      for (const tab of gBrowser.tabs) {
        const id = this._idFromTab(tab);
        const note = id ? this._getNote(id) : null;
        if (!note) continue;
        this.noteTabs.set(id, tab);
        this._markTab(tab, note);
      }
    }

    _syncTabAppearance(id) {
      const note = this._getNote(id);
      const tab = this.noteTabs.get(id);
      if (note && tab) this._markTab(tab, note);
    }

    async _onTabSelect() { await this._syncSelectedTab(); }

    async _onTabClose(event) {
      const tab = event.target;
      const id = this._idFromTab(tab);
      if (this._closingNotes.has(id)) return;
      if (!id || window.closed || globalThis.gBrowser?.closing || event.detail?.adoptedBy) return;
      // Native TabClose is dispatched for removal; pinned unload/reset does not
      // dispatch it. Do not infer cancellation from DOM connectivity/animation.
      if (Array.from(gBrowser.tabs).some(other => other !== tab && !other.closing && this._idFromTab(other) === id)) return;
      await this._deleteNote(id);
    }

    async _syncSelectedTab() {
      const id = this._idFromTab(gBrowser.selectedTab);
      if (!id || !this._getNote(id)) {
        if (this.currentNoteId) await this._saveCurrentNow();
        this.currentNoteId = null;
        this._hidePage();
        return;
      }
      if (this.currentNoteId === id && !document.getElementById("zen-notes-page")?.hidden) return;
      if (this.currentNoteId && this.currentNoteId !== id) await this._saveCurrentNow();
      await this._showNote(id);
    }

    _getHost() {
      // Mount once in the stable tab content container, not inside the currently
      // selected browserStack. browserStack can be swapped during TabSelect,
      // which caused 0.4.0 to leave the editor behind an empty about:home page.
      return (
        document.getElementById("tabbrowser-tabbox") ||
        document.getElementById("appcontent") ||
        gBrowser?.selectedBrowser?.parentElement ||
        document.documentElement
      );
    }

    _ensurePage() {
      const host = this._getHost();
      if (!host) return false;
      let page = document.getElementById("zen-notes-page");
      if (page) {
        if (page.parentElement !== host) {
          page.parentElement?.classList?.remove("zen-notes-page-host");
          host.classList.add("zen-notes-page-host");
          host.append(page);
        }
        return true;
      }

      host.classList.add("zen-notes-page-host");
      page = this._html("div");
      page.id = "zen-notes-page";
      page.hidden = true;

      const scroll = this._html("div");
      scroll.className = "zen-notes-page-scroll";

      const canvas = this._html("main");
      canvas.className = "zen-notes-page-canvas";

      const title = this._html("div");
      title.id = "zen-notes-page-title";
      this._setPlainEditable(title);
      title.spellcheck = true;
      title.setAttribute("role", "textbox");
      title.setAttribute("aria-label", "Note title");
      title.setAttribute("data-placeholder", "New Note");

      const editor = this._html("div");
      editor.id = "zen-notes-editor";
      editor.setAttribute("role", "textbox");
      editor.setAttribute("aria-multiline", "true");

      title.addEventListener("keydown", (event) => {
        // Keep Zen/Firefox global navigation/search shortcuts out of the note title.
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          this._focusLine(editor.querySelector(".zen-notes-line"), 0);
        }
      });
      title.addEventListener("input", () => {
        if (this._loadingPage) return;
        const note = this._getNote(this.currentNoteId);
        if (note) {
          note.title = title.textContent.trim() || "New Note";
          this._syncTabAppearance(note.id);
        }
        this._queueSave();
      });
      title.addEventListener("paste", (event) => this._pastePlainText(event));

      page.addEventListener("keydown", event => this._pageKeys(event), true);
      page.addEventListener("beforeinput", event => {
        if (event.inputType === "historyUndo" || event.inputType === "historyRedo") {
          event.preventDefault(); this._undo(event.inputType === "historyRedo"); return;
        }
        const selected = this._bodySelection();
        const range = window.getSelection().rangeCount ? window.getSelection().getRangeAt(0) : null;
        if (!selected || selected.start === selected.end || !range || (range.startContainer === range.endContainer && range.startContainer !== editor)) return;
        if (event.inputType.startsWith("delete") || event.inputType === "insertText") {
          event.preventDefault(); this._replaceBodySelection(event.data || "", selected);
        }
      }, true);
      page.addEventListener("contextmenu", event => this._editorContextMenu(event));
      canvas.append(title, editor);
      scroll.append(canvas);
      page.append(scroll);
      host.append(page);
      return true;
    }

    _setPlainEditable(el) {
      el.setAttribute("contenteditable", "plaintext-only");
      if (el.contentEditable !== "plaintext-only") el.contentEditable = "true";
    }

    async _showNote(id, options = {}) {
      try {
        await this._showNoteUnsafe(id, options);
      } catch (error) {
        console.error(LOG, "_showNote failed — falling back to underlying page", error);
      }
    }

    async _showNoteUnsafe(id, options = {}) {
      const note = this._getNote(id);
      if (!note) return;
      if (!this._ensurePage()) {
        console.error(LOG, "Could not mount note page host");
        return;
      }
      const page = document.getElementById("zen-notes-page");
      const title = document.getElementById("zen-notes-page-title");
      const editor = document.getElementById("zen-notes-editor");
      if (!page || !title || !editor) return;

      const data = await this._readNote(note);
      if (this._destroyed || this._idFromTab(gBrowser.selectedTab) !== id || !this._getNote(id)) return;
      this.currentNoteId = id;
      this._loadingPage = true;
      this._activeLine = null;
      title.textContent = data.title || "New Note";
      editor.replaceChildren();

      const lines = data.body === "" ? [""] : data.body.split("\n");
      for (const raw of lines) editor.append(this._makeLine(raw));
      this._renderAllLines();

      note.title = data.title || note.title || "New Note";
      this._syncTabAppearance(id);
      const host = this._getHost();
      host?.setAttribute?.("zen-notes-active", "true");
      page.hidden = false;
      page.style.removeProperty("display");
      page.style.removeProperty("visibility");
      this._loadingPage = false;
      this._recordHistory();
      document.querySelector(".zen-notes-find")?.setAttribute("hidden", "true");
      this._applyBoost();

      requestAnimationFrame(() => {
        if (options.focusTitle) {
          title.focus();
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(title);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      });
    }

    _hidePage() {
      this._clearFind();
      this._commitActiveLine();
      const page = document.getElementById("zen-notes-page");
      if (page) page.hidden = true;
      const host = this._getHost();
      host?.removeAttribute?.("zen-notes-active");
    }

    _makeLine(raw = "") {
      const line = this._html("div");
      line.className = "zen-notes-line";
      line.dataset.raw = raw;
      this._setPlainEditable(line);
      line.spellcheck = true;

      line.addEventListener("pointerdown", (event) => this._onLinePointerDown(event, line));
      line.addEventListener("focus", () => this._activateLine(line));
      line.addEventListener("blur", () => {
        // Delay so clicks on task checkbox can complete before render.
        window.setTimeout(() => {
          if (!this._contextMenuOpen && document.activeElement !== line) this._commitLine(line);
        }, 0);
      });
      line.addEventListener("input", (event) => {
        line.dataset.raw = this._lineText(line);
        this._classifyLine(line, line.dataset.raw, false);
        if (!event.isComposing) this._refreshInline(line);
        this._queueSave();
      });
      line.addEventListener("keyup", event => { if (!event.isComposing) this._refreshInline(line); });
      line.addEventListener("compositionend", () => this._refreshInline(line));
      line.addEventListener("keydown", (event) => this._onLineKeyDown(event, line));
      line.addEventListener("paste", (event) => this._pastePlainText(event));
      return line;
    }

    _lineText(line) {
      return (line.textContent || "").replace(/\u00a0/g, " ").replace(/\r?\n/g, "");
    }

    _onLinePointerDown(event, line) {
      if (event.button !== 0) return;
      const link = event.target?.closest?.(".zen-notes-link, .zen-notes-wikilink");
      if (link) {
        event.preventDefault();
        event.stopPropagation();
        this._followLink(link).catch(error => console.error(LOG, error));
        return;
      }
      const spoiler = event.target?.closest?.(".zen-notes-spoiler");
      if (spoiler) { event.preventDefault(); spoiler.classList.toggle("is-revealed"); return; }
      const checkbox = event.target?.closest?.(".zen-notes-task-checkbox");
      if (checkbox) {
        event.preventDefault();
        event.stopPropagation();
        const raw = line.dataset.raw || "";
        line.dataset.raw = /\[[xX]\]/.test(raw)
          ? raw.replace(/\[[xX]\]/, "[ ]")
          : raw.replace(/\[ \]/, "[x]");
        this._renderLine(line);
        this._queueSave();
        return;
      }

      for (const other of line.parentElement.children) {
        if (other !== line && other.classList.contains("is-editing")) this._commitLine(other);
      }
      if (this._activeLine === line) return;
      const rawOffset = this._rawOffsetFromPointer(line, event.clientX, event.clientY);
      event.preventDefault();
      event.stopPropagation();
      this._focusLine(line, rawOffset);
    }

    _rawOffsetFromPointer(line, x, y) {
      const raw = line.dataset.raw || "";
      const content = line.querySelector(".zen-notes-list-content") || line;
      let visibleOffset = (this._visibleTextForRaw(raw).length);
      try {
        const pos = document.caretPositionFromPoint?.(x, y);
        if (pos?.offsetNode && line.contains(pos.offsetNode)) {
          const range = document.createRange();
          range.setStart(content, 0);
          range.setEnd(pos.offsetNode, pos.offset);
          visibleOffset = range.toString().length;
        }
      } catch {}
      return line.classList.contains("is-editing") ? visibleOffset : this._visibleOffsetToRaw(raw, visibleOffset);
    }

    _visibleTextForRaw(raw) {
      let s = raw;
      s = s.replace(/^\s*#{1,6}\s+/, "");
      s = s.replace(/^\s*>\s?/, "");
      s = s.replace(/^\s*[-*+]\s+\[[ xX]\]\s+/, "");
      s = s.replace(/^\s*[-*+]\s+/, "");
      s = s.replace(/^\s*\d+[.)]\s+/, "");
      s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
      s = s.replace(/__([^_]+)__/g, "$1");
      s = s.replace(/~~([^~]+)~~/g, "$1");
      s = s.replace(/==([^=]+)==/g, "$1");
      s = s.replace(/`([^`]+)`/g, "$1");
      s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
      s = s.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b || a);
      s = s.replace(/\*([^*]+)\*/g, "$1");
      s = s.replace(/_([^_]+)_/g, "$1");
      return s;
    }

    _visibleOffsetToRaw(raw, visibleOffset) {
      // Exact source/display mapping is expensive. For click placement, find the
      // closest source position whose rendered prefix has the requested length.
      const prefix = raw.match(/^(?:\s*[-*+]\s+(?:\[[ xX]\]\s*)?|\s*\d+[.)]\s+|#{1,6}\s+|>\s?)/)?.[0].length || 0;
      if (visibleOffset === 0) return prefix;
      let best = raw.length;
      let bestDelta = Infinity;
      for (let i = prefix; i <= raw.length; i++) {
        const len = this._visibleTextForRaw(raw.slice(0, i)).length;
        const delta = Math.abs(len - visibleOffset);
        if (delta < bestDelta) { best = i; bestDelta = delta; }
        if (len > visibleOffset && delta > bestDelta) break;
      }
      return best;
    }

    _activateLine(line) {
      if (!line) return;
      if (this._activeLine && this._activeLine !== line) this._commitLine(this._activeLine);
      if (this._activeLine === line && line.classList.contains("is-editing")) return;
      const raw = line.dataset.raw ?? "";
      line.replaceChildren(document.createTextNode(raw));
      line.classList.add("is-editing");
      this._classifyLine(line, raw, false);
      this._activeLine = line;
    }

    _commitLine(line) {
      if (!line) return;
      if (line.classList.contains("is-editing")) line.dataset.raw = this._lineText(line);
      line.classList.remove("is-editing");
      if (this._activeLine === line) this._activeLine = null;
      this._renderLine(line);
    }

    _commitActiveLine() {
      if (this._activeLine) this._commitLine(this._activeLine);
    }

    _editorMarkdown() {
      const editor = document.getElementById("zen-notes-editor");
      if (!editor) return "";
      return Array.from(editor.querySelectorAll(":scope > .zen-notes-line"))
        .map((line) => line.classList.contains("is-editing") ? this._lineText(line) : line.dataset.raw ?? "")
        .join("\n")
;
    }

    _renderAllLines() {
      const editor = document.getElementById("zen-notes-editor");
      if (!editor) return;
      let insideFence = false;
      const tableLines = Array.from(editor.children);
      for (let i = 0; i < tableLines.length; i++) {
        const line = tableLines[i], raw = line.dataset.raw || "";
        const row = /^\s*\|.*\|\s*$/.test(raw);
        const separator = row && raw.trim().slice(1, -1).split("|").every(cell => /^\s*:?-{3,}:?\s*$/.test(cell));
        line.classList.toggle("is-table-row", row);
        line.classList.toggle("is-table-divider", separator);
        const prev = tableLines[i - 1];
        line.classList.toggle("is-table-start", row && (!prev || !/^\s*\|.*\|\s*$/.test(prev.dataset.raw || "")));
      }
      for (const line of editor.querySelectorAll(":scope > .zen-notes-line")) {
        const raw = line.dataset.raw ?? "";
        const fence = /^\s*```/.test(raw);
        line.dataset.codeBlock = insideFence || fence ? "true" : "false";
        this._renderLine(line, insideFence);
        if (insideFence || fence) line.classList.remove("is-table-row", "is-table-divider", "is-table-start");
        if (fence) insideFence = !insideFence;
      }
    }

    _renderLine(line, forceCode = null) {
      if (!line || line.classList.contains("is-editing")) return;
      const raw = line.dataset.raw ?? "";
      const isFence = /^\s*```/.test(raw);
      const isCode = isFence || forceCode === true || (forceCode === null && line.dataset.codeBlock === "true");
      this._classifyLine(line, raw, isCode);

      if (isCode) {
        line.innerHTML = isFence
          ? `<span class="zen-notes-md-marker">${this._escape(raw)}</span>`
          : `<span class="zen-notes-code-line">${this._escape(raw) || "<br/>"}</span>`;
        return;
      }

      const task = raw.match(/^(\s*)[-*+]\s+\[([ xX])\]\s?(.*)$/);
      if (task) {
        const depth = Math.floor(task[1].length / INDENT.length);
        line.style.setProperty("--zen-notes-indent", depth);
        const checked = task[2].toLowerCase() === "x";
        line.innerHTML = `<span class="zen-notes-task-checkbox" data-checked="${checked}"></span><span class="zen-notes-list-content${checked ? " is-done" : ""}">${this._inline(task[3]) || "<br/>"}</span>`;
        return;
      }

      const bullet = raw.match(/^(\s*)[-*+]\s+(.*)$/);
      if (bullet) {
        line.style.setProperty("--zen-notes-indent", Math.floor(bullet[1].length / INDENT.length));
        line.innerHTML = `<span class="zen-notes-bullet">•</span><span class="zen-notes-list-content">${this._inline(bullet[2]) || "<br/>"}</span>`;
        return;
      }

      const ordered = raw.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
      if (ordered) {
        line.style.setProperty("--zen-notes-indent", Math.floor(ordered[1].length / INDENT.length));
        line.innerHTML = `<span class="zen-notes-order">${ordered[2]}.</span><span class="zen-notes-list-content">${this._inline(ordered[3]) || "<br/>"}</span>`;
        return;
      }

      const heading = raw.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        line.innerHTML = this._inline(heading[2]) || "<br/>";
        return;
      }

      const callout = raw.match(/^>\s*\[!([\w-]+)\][+-]?\s*(.*)$/);
      if (callout) {
        line.innerHTML = `<strong class="zen-notes-callout">${this._escape(callout[1].toUpperCase())}${callout[2] ? ": " + this._inline(callout[2]) : ""}</strong>`;
        return;
      }
      const table = raw.trim();
      if (table.startsWith("|") && table.endsWith("|")) {
        const cells = table.slice(1, -1).split(/(?<!\\)\|/);
        if (cells.every(cell => /^\s*:?-{3,}:?\s*$/.test(cell))) {
          line.innerHTML = '<span class="zen-notes-rule"></span>';
        } else {
          line.innerHTML = `<span class="zen-notes-table-row" style="--columns:${cells.length}">${cells.map(cell => `<span>${this._inline(cell.trim())}</span>`).join("")}</span>`;
        }
        return;
      }
      const quote = raw.match(/^>\s?(.*)$/);
      if (quote) {
        line.innerHTML = this._inline(quote[1]) || "<br/>";
        return;
      }

      if (/^\s*(---|\*\*\*|___)\s*$/.test(raw)) {
        line.innerHTML = `<span class="zen-notes-rule"></span>`;
        return;
      }

      line.innerHTML = this._inline(raw) || "<br/>";
    }

    _classifyLine(line, raw, isCode) {
      line.classList.remove(
        "is-h1", "is-h2", "is-h3", "is-h4", "is-h5", "is-h6",
        "is-bullet", "is-ordered", "is-task", "is-quote", "is-code", "is-fence", "is-rule"
      );
      line.style.removeProperty("--zen-notes-indent");
      if (isCode || /^\s*```/.test(raw)) {
        line.classList.add("is-code");
        if (/^\s*```/.test(raw)) line.classList.add("is-fence");
        return;
      }
      const h = raw.match(/^(#{1,6})\s+/);
      if (h) line.classList.add(`is-h${h[1].length}`);
      else if (/^\s*[-*+]\s+\[[ xX]\]/.test(raw)) line.classList.add("is-task");
      else if (/^\s*[-*+]\s+/.test(raw)) line.classList.add("is-bullet");
      else if (/^\s*\d+[.)]\s+/.test(raw)) line.classList.add("is-ordered");
      else if (/^>\s?/.test(raw)) line.classList.add("is-quote");
      else if (/^\s*(---|\*\*\*|___)\s*$/.test(raw)) line.classList.add("is-rule");
    }

    _inline(raw) {
      let text = this._escape(raw);
      const stash = [];
      const token = (html) => `\uE000${stash.push(html) - 1}\uE001`;

      text = text.replace(/\\([\\`*{}\[\]()#+.!_>~-])/g, (_, c) => token(c));
      text = text.replace(/`([^`]+)`/g, (_, c) => token(`<code>${c}</code>`));
      text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, source) => {
        const url = source.replace(/^&lt;|&gt;$/g, "");
        return /^(?:https?:\/\/|data:image\/(?:png|jpeg|gif|webp);base64,)/i.test(url) ? token(`<img class="zen-notes-image" src="${url}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer"/>`) : token(`<span class="zen-notes-embed">${alt || "Image: unsupported URL"}</span>`);
      });
      text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => token(`<span class="zen-notes-link" data-href="${href.replace(/"/g, "&quot;")}">${label}</span>`));
      text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) => token(`<span class="zen-notes-wikilink" data-target="${target.replace(/"/g, "&quot;")}">${alias || target}</span>`));
      text = text.replace(/&lt;(https?:\/\/[^\s]+?)&gt;/g, (_, href) => token(`<span class="zen-notes-link" data-href="${href}">${href}</span>`));
      // Existing Markdown links and code are already stashed: only linkify plain URLs.
      text = text.replace(/https?:\/\/[^\s<>\uE000\uE001]+/g, match => {
        let href = match.replace(/[.,!?;:]+$/, "");
        while (href.endsWith(")") && (href.match(/\)/g) || []).length > (href.match(/\(/g) || []).length) href = href.slice(0, -1);
        return token(`<span class="zen-notes-link" data-href="${href}">${href}</span>`) + match.slice(href.length);
      });
      text = text.replace(/&lt;u&gt;(.+?)&lt;\/u&gt;/g, "<u>$1</u>");
      text = text.replace(/\|\|(.+?)\|\|/g, '<span class="zen-notes-spoiler" tabindex="0">$1</span>');
      text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
      text = text.replace(/~~([^~]+)~~/g, "<del>$1</del>");
      text = text.replace(/==([^=]+)==/g, "<mark>$1</mark>");
      text = text.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
      text = text.replace(/(^|[^_])_([^_]+)_/g, "$1<em>$2</em>");
      text = text.replace(/\uE000(\d+)\uE001/g, (_, i) => stash[Number(i)] || "");
      return text;
    }

    _escape(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    _onLineKeyDown(event, line) {
      // This is the critical fix for Zen stealing arrows / printable keys and
      // sending focus to the URL/search field while a note is being edited.
      event.stopPropagation();

      if (this._autoCloseMarker(event, line)) return;
      const selected = this._bodySelection();
      if (selected && selected.end > selected.start && ["Enter", "Backspace", "Delete"].includes(event.key)) {
        event.preventDefault(); this._replaceBodySelection(event.key === "Enter" ? "\n" : "", selected); return;
      }
      const key = event.key;
      if ((event.metaKey || event.ctrlKey) && !event.altKey) {
        const lower = key.toLowerCase();
        if (lower === "k") {
          event.preventDefault();
          this._wrapSelection(line, "[", "](https://)");
          return;
        }
        if (lower === "b") {
          event.preventDefault();
          this._wrapSelection(line, "**", "**");
          return;
        }
        if (lower === "i") {
          event.preventDefault();
          this._wrapSelection(line, "*", "*");
          return;
        }
        if (lower === "e") {
          event.preventDefault();
          this._wrapSelection(line, "`", "`");
          return;
        }
      }

      if (event.isComposing) return;
      if (key === "Enter") {
        event.preventDefault();
        this._handleEnter(line, event.shiftKey);
        return;
      }
      if (key === "Backspace" && this._caretOffset(line) === 0) {
        if (this._handleBackspaceAtStart(line)) event.preventDefault();
        return;
      }
      if (key === "Tab") {
        event.preventDefault();
        this._indentCurrentLine(line, event.shiftKey ? -1 : 1);
        return;
      }
      if (key === "ArrowUp" || key === "ArrowDown") {
        event.preventDefault();
        this._moveVertical(line, key === "ArrowUp" ? -1 : 1);
        return;
      }
      if ((key === "ArrowLeft" || key === "ArrowRight") && !event.altKey) {
        // Same fix as Up/Down: an unhandled arrow key leaves the event
        // un-prevented, and Zen's global shortcut steals it into the
        // search/URL bar. Explicitly prevent it and drive the caret
        // ourselves, crossing into the previous/next line at the boundary
        // (each line is its own isolated contenteditable, so the browser
        // can't do that crossing on its own).
        event.preventDefault();
        const dir = key === "ArrowLeft" ? "backward" : "forward";
        const granularity = (event.ctrlKey || event.metaKey) ? "word" : "character";
        const before = this._caretOffset(line);
        const raw = this._lineText(line);
        const atBoundary = dir === "backward" ? before === 0 : before === raw.length;
        if (atBoundary && !event.shiftKey) {
          const target = dir === "backward" ? line.previousElementSibling : line.nextElementSibling;
          if (target?.classList.contains("zen-notes-line")) {
            this._commitLine(line);
            const targetRaw = target.dataset.raw ?? "";
            this._focusLine(target, dir === "backward" ? targetRaw.length : 0);
            return;
          }
        }
        window.getSelection()?.modify(event.shiftKey ? "extend" : "move", dir, granularity);
        return;
      }
      if (key === "Escape") {
        event.preventDefault();
        line.blur();
      }
    }

    _caretOffset(line) {
      const sel = window.getSelection();
      if (!sel?.rangeCount) return 0;
      const range = sel.getRangeAt(0);
      if (!line.contains(range.startContainer)) return 0;
      const before = range.cloneRange();
      before.selectNodeContents(line);
      before.setEnd(range.startContainer, range.startOffset);
      return before.toString().length;
    }

    _selectionOffsets(line) {
      const sel = window.getSelection();
      if (!sel?.rangeCount) return { start: 0, end: 0 };
      const range = sel.getRangeAt(0);
      if (!line.contains(range.startContainer) || !line.contains(range.endContainer)) {
        const off = this._caretOffset(line);
        return { start: off, end: off };
      }
      const startRange = range.cloneRange();
      startRange.selectNodeContents(line);
      startRange.setEnd(range.startContainer, range.startOffset);
      const endRange = range.cloneRange();
      endRange.selectNodeContents(line);
      endRange.setEnd(range.endContainer, range.endOffset);
      return { start: startRange.toString().length, end: endRange.toString().length };
    }

    _setCaret(line, offset) {
      if (!line.firstChild) line.appendChild(document.createTextNode(""));
      let remaining = Math.max(0, Math.min(offset, line.textContent.length));
      const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
      let node, last = null;
      const range = document.createRange();
      while ((node = walker.nextNode())) {
        last = node;
        if (remaining <= node.length) { range.setStart(node, remaining); break; }
        remaining -= node.length;
      }
      if (!node) { if (last) range.setStart(last, last.length); else { range.selectNodeContents(line); range.collapse(false); } }
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }

    _focusLine(line, offset = 0) {
      if (!line) return;
      this._activateLine(line);
      line.focus();
      this._setCaret(line, offset);
    }

    _replaceLineRaw(line, raw, caret = null) {
      line.dataset.raw = raw;
      if (line.classList.contains("is-editing")) {
        line.replaceChildren(document.createTextNode(raw));
        this._classifyLine(line, raw, false);
        if (caret !== null) this._setCaret(line, caret);
      } else this._renderLine(line);
      this._queueSave();
    }

    _handleEnter(line, softBreak) {
      const raw = this._lineText(line);
      const { start, end } = this._selectionOffsets(line);
      const before = raw.slice(0, start);
      const after = raw.slice(end);

      if (softBreak) {
        // Markdown hard line break, stable in a line-based editor.
        const next = this._makeLine(after);
        line.after(next);
        this._replaceLineRaw(line, `${before}  `, `${before}  `.length);
        this._commitLine(line);
        this._focusLine(next, 0);
        this._renderAllLines();
        return;
      }

      const info = line.dataset.codeBlock === "true" ? { prefix: before.match(/^\s*/)[0] } : this._continuationForLine(raw, before, after);
      if (info.exitList) {
        this._replaceLineRaw(line, "", 0);
        return;
      }

      const currentRaw = info.currentRaw ?? before;
      const nextRaw = `${info.prefix || ""}${after}`;
      this._replaceLineRaw(line, currentRaw, currentRaw.length);
      this._commitLine(line);
      const next = this._makeLine(nextRaw);
      line.after(next);
      this._renderAllLines();
      this._focusLine(next, (info.prefix || "").length);
      this._queueSave();
    }

    _continuationForLine(fullRaw, before, after) {
      const emptyTask = fullRaw.match(/^(\s*)[-*+]\s+\[[ xX]\]\s*$/);
      const emptyBullet = fullRaw.match(/^(\s*)[-*+]\s*$/);
      const emptyOrdered = fullRaw.match(/^(\s*)\d+[.)]\s*$/);
      if (!after && (emptyTask || emptyBullet || emptyOrdered)) return { exitList: true };

      const task = before.match(/^(\s*)[-*+]\s+\[[ xX]\]\s+/);
      if (task) return { prefix: `${task[1]}- [ ] `, currentRaw: before };

      const bullet = before.match(/^(\s*)([-*+])\s+/);
      if (bullet) return { prefix: `${bullet[1]}${bullet[2]} `, currentRaw: before };

      const ordered = before.match(/^(\s*)(\d+)([.)])\s+/);
      if (ordered) return { prefix: `${ordered[1]}${Number(ordered[2]) + 1}${ordered[3]} `, currentRaw: before };

      if (/^\s*(?:>\s*)+$/.test(fullRaw) && !after) return { exitList: true };
      const quote = before.match(/^(\s*(?:>\s*)+)/);
      if (quote) return { prefix: quote[1], currentRaw: before };

      const indent = before.match(/^(\s+)/)?.[1] || "";
      return { prefix: indent, currentRaw: before };
    }

    _handleBackspaceAtStart(line) {
      const raw = this._lineText(line);
      const prefix = raw.match(/^(\s*)(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+|>\s?)/)?.[0];
      if (prefix) {
        const stripped = raw.slice(prefix.length);
        this._replaceLineRaw(line, stripped, 0);
        return true;
      }

      const prev = line.previousElementSibling;
      if (!prev?.classList.contains("zen-notes-line")) return false;
      const prevRaw = prev.dataset.raw ?? "";
      const currentRaw = raw;
      prev.dataset.raw = prevRaw + currentRaw;
      line.remove();
      this._renderLine(prev);
      this._focusLine(prev, prevRaw.length);
      this._renderAllLines();
      this._queueSave();
      return true;
    }

    _indentCurrentLine(line, direction) {
      const raw = this._lineText(line);
      const isListish = /^\s*(?:[-*+]\s+|\d+[.)]\s+|>\s?)/.test(raw);
      if (!isListish) {
        this._insertAtSelection(line, INDENT);
        return;
      }
      if (direction > 0) {
        this._replaceLineRaw(line, INDENT + raw, this._caretOffset(line) + INDENT.length);
      } else {
        const remove = raw.startsWith(INDENT) ? INDENT.length : Math.min(raw.match(/^\s*/)?.[0].length || 0, INDENT.length);
        this._replaceLineRaw(line, raw.slice(remove), Math.max(0, this._caretOffset(line) - remove));
      }
    }

    _moveVertical(line, direction) {
      const offset = this._caretOffset(line);
      const target = direction < 0 ? line.previousElementSibling : line.nextElementSibling;
      if (!target?.classList.contains("zen-notes-line")) return;
      this._commitLine(line);
      const raw = target.dataset.raw ?? "";
      this._focusLine(target, Math.min(offset, raw.length));
    }

    _wrapSelection(line, left, right) {
      const raw = this._lineText(line);
      const { start, end } = this._selectionOffsets(line);
      const selected = raw.slice(start, end);
      const next = raw.slice(0, start) + left + selected + right + raw.slice(end);
      this._replaceLineRaw(line, next, end + left.length + right.length);
      if (selected) {
        const text = line.firstChild;
        const range = document.createRange();
        range.setStart(text, start + left.length);
        range.setEnd(text, end + left.length);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }

    _insertAtSelection(line, value) {
      const raw = this._lineText(line);
      const { start, end } = this._selectionOffsets(line);
      const next = raw.slice(0, start) + value + raw.slice(end);
      this._replaceLineRaw(line, next, start + value.length);
    }

    _pastePlainText(event) {
      const image = Array.from(event.clipboardData?.items || []).find(item => /^image\/(png|jpeg|gif|webp)$/.test(item.type));
      if (image) {
        event.preventDefault(); event.stopPropagation();
        const selection = this._bodySelection(), id = this.currentNoteId, originalBody = this._editorMarkdown();
        const reader = new FileReader();
        reader.onload = () => {
          if (this.currentNoteId !== id || !selection || this._editorMarkdown() !== originalBody) return;
          this._replaceBodySelection(`![Image](${reader.result})`, selection);
          const active = this._activeLine;
          this._commitActiveLine();
          active?.blur();
        };
        reader.readAsDataURL(image.getAsFile());
        return;
      }
      const text = event.clipboardData?.getData("text/plain");
      if (typeof text !== "string") return;
      event.preventDefault();
      event.stopPropagation();

      const target = event.currentTarget;
      const bodySelection = this._bodySelection();
      if (bodySelection && this._editorMarkdown().slice(bodySelection.start, bodySelection.end).includes("\n")) {
        this._replaceBodySelection(text.replace(/\r\n/g, "\n"), bodySelection); return;
      }
      if (target?.classList?.contains("zen-notes-line")) {
        const normalized = text.replace(/\r\n/g, "\n");
        if (normalized.includes("\n")) {
          const line = target;
          const raw = this._lineText(line);
          const { start, end } = this._selectionOffsets(line);
          const parts = normalized.split("\n");
          const first = raw.slice(0, start) + parts.shift();
          const lastTail = raw.slice(end);
          this._replaceLineRaw(line, first, first.length);
          let cursor = line;
          for (let i = 0; i < parts.length; i++) {
            const isLast = i === parts.length - 1;
            const nextLine = this._makeLine(parts[i] + (isLast ? lastTail : ""));
            cursor.after(nextLine);
            cursor = nextLine;
          }
          this._commitLine(line);
          this._renderAllLines();
          if (/https?:\/\//i.test(text)) target.blur();
          else this._focusLine(cursor, (cursor.dataset.raw || "").length - lastTail.length);
          this._queueSave();
          return;
        }
      }

      document.execCommand("insertText", false, text);
      if (target?.classList?.contains("zen-notes-line") && /https?:\/\//i.test(text)) {
        // Show the pasted URL as a clickable preview immediately.
        this._commitLine(target);
        target.blur();
        this._queueSave();
      }
    }

    _boostDomain(id = this.currentNoteId) { return `${id}.zen-notes.local`; }

    async openNoteBoost() {
      if (!ZenBoostsManager || !this.currentNoteId) return;
      const domain = this._boostDomain();
      try {
        let boost = ZenBoostsManager.loadActiveBoostFromStore(this._boostDomain());
        if (!boost) boost = ZenBoostsManager.createNewBoost(domain);
        const uri = Services.io.newURI(`https://${domain}/`);
        const editorWindow = ZenBoostsManager.openBoostWindow(window, boost, uri);
        this._boostEditor = editorWindow;
        editorWindow?.addEventListener("load", () => {
          // Site DOM inspection/Zap tools target the underlying about:home browser,
          // not our chrome overlay. Hide only those unsupported tools; font, size,
          // case, colors and custom CSS remain native Zen Boost UI.
          const doc = editorWindow.document;
          for (const id of ["zen-boost-zap", "zen-boost-css-picker", "zen-boost-css-inspector"]) {
            const el = doc.getElementById(id);
            if (el) el.style.display = "none";
          }
        }, { once: true });
      } catch (error) {
        console.error(LOG, "Could not open Zen Boost editor", error);
      }
    }

    _onBoostUpdate() {
      window.setTimeout(() => this._applyBoost(), 0);
    }

    _applyBoost() {
      const page = document.getElementById("zen-notes-page");
      if (!page || !ZenBoostsManager || !this.currentNoteId) return;

      let data = null;
      try { data = ZenBoostsManager.loadActiveBoostFromStore(this._boostDomain())?.boostEntry?.boostData || null; } catch {}
      const style = document.getElementById("zen-notes-boost-custom-css") || (() => {
        const s = this._html("style");
        s.id = "zen-notes-boost-custom-css";
        document.documentElement.append(s);
        return s;
      })();

      page.style.removeProperty("--zen-notes-boost-font-family");
      page.style.removeProperty("--zen-notes-boost-font-scale");
      page.style.removeProperty("--zen-notes-boost-text-transform");
      page.style.removeProperty("--zen-notes-boost-bg");
      page.style.removeProperty("--zen-notes-boost-fg");
      page.style.removeProperty("--zen-notes-boost-accent");
      page.style.removeProperty("--zen-notes-boost-filter");
      style.textContent = "";
      if (!data || !data.changeWasMade) return;

      if (data.fontFamily) page.style.setProperty("--zen-notes-boost-font-family", `'${String(data.fontFamily).replace(/'/g, "\\'")}'`);
      if (data.sizeOverride && Number(data.sizeOverride) !== 1) page.style.setProperty("--zen-notes-boost-font-scale", String(Number(data.sizeOverride)));
      if (data.textCaseOverride && data.textCaseOverride !== "none") page.style.setProperty("--zen-notes-boost-text-transform", data.textCaseOverride);

      const hue = Number(data.dotAngleDeg || 0);
      const distance = Math.max(0, Math.min(1, Number(data.dotDistance || 0)));
      if (data.enableColorBoost) {
        const dark = !!window.gZenThemePicker?.isDarkMode;
        const sat = Math.round(12 + distance * 55);
        const bgLightness = dark ? 10 + distance * 4 : 98 - distance * 5;
        const fgLightness = dark ? 93 : 12;
        const accentLightness = dark ? 70 : 42;
        page.style.setProperty("--zen-notes-boost-bg", `hsl(${hue} ${Math.round(sat * 0.45)}% ${bgLightness}%)`);
        page.style.setProperty("--zen-notes-boost-fg", `hsl(${hue} ${Math.round(sat * 0.16)}% ${fgLightness}%)`);
        page.style.setProperty("--zen-notes-boost-accent", `hsl(${hue} ${sat}% ${accentLightness}%)`);
      }

      const brightness = Number(data.brightness ?? 0.5);
      const saturation = Number(data.saturation ?? 0.5);
      const contrast = Number(data.contrast ?? 0.75);
      // Native Boost color sliders are centered around their defaults. Map them
      // gently so text never becomes unreadable in a note.
      const b = 0.82 + brightness * 0.36;
      const s = 0.65 + saturation * 0.7;
      const c = 0.78 + contrast * 0.3;
      page.style.setProperty("--zen-notes-boost-filter", `brightness(${b}) saturate(${s}) contrast(${c})`);

      if ((data.customCSS || "").trim()) {
        const normalized = String(data.customCSS)
          .replace(/(^|[,{]\s*)(?:html|body|:root)(?=\s|[,{.#:[>+~])/g, "$1:scope");
        // @scope prevents a Boost written for notes from accidentally restyling
        // the entire Zen browser chrome.
        style.textContent = `@scope (#zen-notes-page) {\n${normalized}\n}`;
      }
    }

    async _deleteNote(id) {
      if (this._closingNotes.has(id)) return;
      const controllers = [];
      for (const win of Services.wm.getEnumerator("navigator:browser")) {
        const controller = win.gZenNotes;
        if (!controller) continue;
        controllers.push({ win, controller });
        controller._closingNotes.add(id);
        controller.notes = controller.notes.filter(note => note.id !== id);
        if (controller.currentNoteId === id) {
          win.clearTimeout(controller.saveTimer);
          controller.currentNoteId = null; controller._hidePage();
        }
        controller.noteTabs.delete(id);
      }
      this._closingNotes.add(id);
      this.notes = this.notes.filter(note => note.id !== id);
      await this._enqueueWrite(async () => {
        await FileIO.writeUTF8(this._deletedPath(id), new Date().toISOString());
        await FileIO.remove(this._notePath(id), { ignoreAbsent: true });
        if (Paths.tempDir) await FileIO.remove(Paths.join(Paths.tempDir, "zen-notes-share", `${id}.html`), { ignoreAbsent: true });
        await this._writeIndex();
      });
      for (const { win } of controllers) {
        for (const tab of Array.from(win.gBrowser.tabs)) {
          if (!tab.closing && this._idFromTab(tab) === id) win.gBrowser.removeTab(tab, { animate: false });
        }
      }
    }

    _insertDivider(position) {
      const body = this._editorMarkdown();
      const left = body.slice(0, position.start), right = body.slice(position.end);
      this._replaceBodySelection((left && !left.endsWith("\n") ? "\n" : "") + "---" + (!right.startsWith("\n") ? "\n" : ""), position);
    }

    async _populateNativeShare(popup, id) {
      if (Services.appinfo.OS !== "Darwin" || !this._getNote(id)) return;
      popup.replaceChildren(this._menuItem("Preparing note…", () => {}));
      try {
        if (id === this.currentNoteId) await this._saveCurrentNow();
        const note = this._getNote(id);
        if (!note) return;
        const data = await this._readNote(note);
        const dir = Paths.join(Paths.tempDir, "zen-notes-share");
        await FileIO.makeDirectory(dir, { ignoreExisting: true });
        const path = Paths.join(dir, `${id}.html`);
        await FileIO.writeUTF8(path, this._exportHTML(data));
        const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
        file.initWithPath(path);
        const uri = Services.io.newFileURI(file).spec;
        const service = Cc["@mozilla.org/widget/macsharingservice;1"].getService(Ci.nsIMacSharingService);
        const providers = service.getSharingProviders(uri);
        popup.replaceChildren();
        for (const provider of providers) {
          popup.append(this._menuItem(provider.menuItemTitle, () => service.shareUrl(provider.name, uri, data.title)));
        }
        if (!providers.length) popup.append(this._menuItem("No services available — use Export…", () => this._exportNote()));
      } catch (error) {
        console.error(LOG, "Native sharing failed", error);
        popup.replaceChildren(this._menuItem("Export HTML instead…", () => this._exportNote()));
      }
    }

    async _pickFile(mode, title, extension) {
      const picker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
      picker.init(window.browsingContext, title, mode);
      picker.appendFilter(extension.toUpperCase(), `*.${extension}`);
      picker.defaultExtension = extension;
      picker.defaultString = `${(this._getNote(this.currentNoteId)?.title || "Note").replace(/[\\/:*?"<>|]/g, "-")}.${extension}`;
      const result = await new Promise(resolve => picker.open(resolve));
      return result === Ci.nsIFilePicker.returnOK || result === Ci.nsIFilePicker.returnReplace ? picker.file.path : null;
    }

    async _exportNote() {
      await this._saveCurrentNow();
      const note = this._getNote(this.currentNoteId);
      if (!note) return;
      const data = await this._readNote(note);
      const picker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
      picker.init(window.browsingContext, "Export Note", Ci.nsIFilePicker.modeSave);
      picker.appendFilter("Markdown (.md)", "*.md");
      picker.appendFilter("HTML (.html)", "*.html");
      picker.defaultExtension = "";
      picker.defaultString = (note.title || "Note").replace(/[\\/:*?"<>|]/g, "-");
      const result = await new Promise(resolve => picker.open(resolve));
      if (![Ci.nsIFilePicker.returnOK, Ci.nsIFilePicker.returnReplace].includes(result)) return;
      let path = picker.file.path;
      const extension = /\.html?$/i.test(path) ? "html" : /\.md$/i.test(path) ? "md" : picker.filterIndex === 1 ? "html" : "md";
      if (!/\.(?:md|html?)$/i.test(path)) {
        path += `.${extension}`;
        if (await FileIO.exists(path) && !Services.prompt.confirm(window, "Replace file?", `Replace ${path}?`)) return;
      }
      let text = `# ${data.title}\n\n${data.body}`;
      if (extension === "html") text = this._exportHTML(data);
      await FileIO.writeUTF8(path, text);
    }

    _exportHTML(data) {
      const inline = text => this._inline(text).replace(/<span class="zen-notes-link" data-href="(https?:[^\"]*)">(.*?)<\/span>/g, '<a href="$1">$2</a>');
      const output = [];
      const lines = data.body.split("\n");
      let fence = null;
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        if (/^\s*```/.test(raw)) { if (fence !== null) { output.push(`<pre><code>${this._escape(fence.join('\n'))}</code></pre>`); fence = null; } else fence = []; continue; }
        if (fence !== null) { fence.push(raw); continue; }
        const heading = raw.match(/^(#{1,6})\s+(.*)$/);
        if (heading) { output.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); continue; }
        if (/^\s*\|.*\|\s*$/.test(raw)) {
          const rows = [];
          while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
            const cells = lines[i].trim().slice(1, -1).split(/(?<!\\)\|/);
            if (!cells.every(cell => /^\s*:?-{3,}:?\s*$/.test(cell))) rows.push(`<tr>${cells.map(cell => `<td>${inline(cell.trim())}</td>`).join('')}</tr>`);
            i++;
          }
          i--; output.push(`<table>${rows.join('')}</table>`); continue;
        }
        if (/^\s*(---|\*\*\*|___)\s*$/.test(raw)) { output.push('<hr>'); continue; }
        if (/^>\s?/.test(raw)) { output.push(`<blockquote>${inline(raw.replace(/^>\s?/, ''))}</blockquote>`); continue; }
        if (/^\s*[-*+]\s+/.test(raw)) { output.push(`<ul><li>${inline(raw.replace(/^\s*[-*+]\s+/, ''))}</li></ul>`); continue; }
        output.push(raw ? `<p>${inline(raw)}</p>` : '');
      }
      if (fence !== null) output.push(`<pre><code>${this._escape(fence.join('\n'))}</code></pre>`);
      return `<!doctype html><html><head><meta charset="utf-8"><title>${this._escape(data.title)}</title><style>body{font:16px/1.6 system-ui;max-width:860px;margin:40px auto;padding:0 20px}table{border-collapse:collapse}td{border:1px solid #bbb;padding:6px 12px}img{max-width:100%}pre{white-space:pre-wrap}blockquote{border-left:3px solid #aaa;padding-left:15px}</style></head><body><h1>${this._escape(data.title)}</h1>${output.join('\n')}</body></html>`;
    }

    async _importNote() {
      const path = await this._pickFile(Ci.nsIFilePicker.modeOpen, "Import Markdown Note", "md");
      if (!path) return;
      const raw = (await FileIO.readUTF8(path)).replace(/\r\n/g, "\n");
      const note = await this.createNote();
      const match = raw.match(/^# (.*)\n(?:\n)?/);
      document.getElementById("zen-notes-page-title").textContent = match ? match[1] : "Imported Note";
      this._setBody(match ? raw.slice(match[0].length) : raw);
      await this._saveCurrentNow();
      return note;
    }

    _autoCloseMarker(event, line) {
      if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return false;
      const raw = this._lineText(line), { start, end } = this._selectionOffsets(line), key = event.key;
      const pair = line._autoPair;
      // Track only an automatically inserted suffix, never skip a user's literal marker.
      const closeAt = pair && raw.startsWith(pair.prefix) && raw.endsWith(pair.suffix) ? raw.length - pair.suffix.length : -1;
      if (pair && closeAt < 0) line._autoPair = null;
      if (key === 'Backspace' && start === end && pair && start === pair.openEnd && closeAt === start) {
        event.preventDefault(); this._replaceLineRaw(line, raw.slice(0, start - pair.marker.length) + raw.slice(start + pair.marker.length), start - pair.marker.length); line._autoPair = null; return true;
      }
      if (key === ' ' && pair?.marker === '*' && start === pair.openEnd && closeAt === start && /^\s*\*$/.test(raw.slice(0, start))) {
        event.preventDefault(); this._replaceLineRaw(line, raw.slice(0, start) + ' ' + raw.slice(start + 1), start + 1); line._autoPair = null; return true;
      }
      if (!['*', '_', '`', '~', '='].includes(key)) return false;
      if (start === end && pair && closeAt === start && pair.marker[0] === key) {
        event.preventDefault();
        if (pair.marker.length === 1 && pair.openEnd === start && key !== '`') {
          this._replaceLineRaw(line, raw.slice(0, start) + key + key + raw.slice(start), start + 1);
          line._autoPair = { marker: key + key, openEnd: start + 1, prefix: raw.slice(0, start) + key, suffix: key + raw.slice(start) };
        } else {
          this._setCaret(line, start + 1);
          if (pair.marker.length === 1) line._autoPair = null;
          else line._autoPair = { ...pair, marker: pair.marker.slice(1), suffix: pair.suffix.slice(1), openEnd: -1 };
        }
        return true;
      }
      if (start !== end || (start === 0 || /[\s([{]/.test(raw[start - 1])) && (!raw[start] || /[\s)\]}.,!?]/.test(raw[start]))) {
        event.preventDefault();
        this._replaceLineRaw(line, raw.slice(0, start) + key + raw.slice(start, end) + key + raw.slice(end), start + 1);
        line._autoPair = { marker: key, openEnd: start + 1, prefix: raw.slice(0, start) + key, suffix: key + raw.slice(end) };
        return true;
      }
      return false;
    }

    _refreshInline(line) {
      if (!line.classList.contains("is-editing") || line.dataset.codeBlock === "true") return;
      const selected = this._selectionOffsets(line);
      if (selected.start !== selected.end) return;
      const raw = this._lineText(line); line.dataset.raw = raw;
      const pattern = /(\*\*|__|~~|==|`|\*|_)([^\n]+?)\1/g;
      let result = '', end = 0, match;
      while ((match = pattern.exec(raw))) {
        result += this._escape(raw.slice(end, match.index));
        const finish = match.index + match[0].length;
        if (selected.start >= match.index && selected.start < finish) result += this._escape(match[0]);
        else {
          const tag = { '**': 'strong', '__': 'strong', '~~': 'del', '==': 'mark', '`': 'code', '*': 'em', '_': 'em' }[match[1]];
          const marker = `<span class="zen-notes-source-marker">${this._escape(match[1])}</span>`;
          result += `${marker}<${tag}>${this._escape(match[2])}</${tag}>${marker}`;
        }
        end = finish;
      }
      result += this._escape(raw.slice(end));
      if (line.innerHTML !== result) { line.innerHTML = result; this._setCaret(line, selected.start); }
    }

    _snapshot() {
      return { title: document.getElementById("zen-notes-page-title")?.textContent || "",
        body: this._editorMarkdown() };
    }

    _recordHistory() {
      if (!this.currentNoteId || this._loadingPage || this._restoringHistory) return;
      const value = this._snapshot();
      let history = this._histories.get(this.currentNoteId);
      if (!history) { history = { entries: [], index: -1 }; this._histories.set(this.currentNoteId, history); }
      if (JSON.stringify(history.entries[history.index]) === JSON.stringify(value)) return;
      history.entries.splice(history.index + 1);
      history.entries.push(value);
      if (history.entries.length > 200) history.entries.shift();
      history.index = history.entries.length - 1;
    }

    _undo(redo = false) {
      this._recordHistory();
      const history = this._histories.get(this.currentNoteId);
      if (!history) return;
      const next = history.index + (redo ? 1 : -1);
      if (next < 0 || next >= history.entries.length) return;
      history.index = next;
      this._restoringHistory = true;
      const value = history.entries[next];
      document.getElementById("zen-notes-page-title").textContent = value.title;
      this._setBody(value.body);
      this._focusLine(document.getElementById("zen-notes-editor").firstElementChild, 0);
      this._restoringHistory = false;
      this._queueSave();
    }

    _setBody(body) {
      this._activeLine = null;
      const editor = document.getElementById("zen-notes-editor");
      editor.replaceChildren(...body.split("\n").map(raw => this._makeLine(raw)));
      this._renderAllLines();
    }

    _selectAll() {
      const editor = document.getElementById("zen-notes-editor");
      // One source selection across every line, including Markdown markers.
      this._commitActiveLine();
      for (const line of editor.children) {
        line.textContent = line.dataset.raw || "";
        line.classList.add("is-editing");
      }
      editor.firstElementChild?.focus();
      const range = document.createRange(); range.selectNodeContents(editor);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    }

    _bodySelection() {
      const editor = document.getElementById("zen-notes-editor");
      const selection = window.getSelection();
      if (!selection.rangeCount) return null;
      const range = selection.getRangeAt(0);
      if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return null;
      const lines = Array.from(editor.children);
      const offset = (node, position) => {
        if (node === editor) return lines.slice(0, position).reduce((n, l) => n + (l.dataset.raw || "").length + 1, 0);
        const line = (node.nodeType === 1 ? node : node.parentElement).closest(".zen-notes-line");
        const index = lines.indexOf(line);
        if (index < 0) return 0;
        const prefix = lines.slice(0, index).reduce((n, l) => n + (l.classList.contains("is-editing") ? this._lineText(l) : l.dataset.raw || "").length + 1, 0);
        const r = document.createRange(); r.selectNodeContents(line); r.setEnd(node, position);
        const local = line.classList.contains("is-editing") ? r.toString().length : this._visibleOffsetToRaw(line.dataset.raw || "", r.toString().length);
        return prefix + local;
      };
      const body = this._editorMarkdown();
      return { start: Math.min(body.length, offset(range.startContainer, range.startOffset)), end: Math.min(body.length, offset(range.endContainer, range.endOffset)) };
    }

    _replaceBodySelection(text, selection = this._bodySelection()) {
      if (!selection) return;
      this._recordHistory();
      const body = this._editorMarkdown();
      const result = body.slice(0, selection.start) + text + body.slice(selection.end);
      this._setBody(result);
      const before = result.slice(0, selection.start + text.length).split("\n");
      this._focusLine(document.getElementById("zen-notes-editor").children[before.length - 1], before.at(-1).length);
      this._queueSave();
    }

    _format(action, selection = this._bodySelection()) {
      if (!selection) return;
      let selected = this._editorMarkdown().slice(selection.start, selection.end);
      const note = this._getNote(this.currentNoteId);
      if (action === "clear") {
        const change = [...(note?.caseChanges || [])].reverse().find(change => change.after === selected);
        if (change) selected = change.before;
        else if (selected === selected.toLocaleUpperCase() && selected !== selected.toLocaleLowerCase()) selected = selected.toLocaleLowerCase();
      }
      const wraps = { bold: ["**", "**"], italic: ["*", "*"], strike: ["~~", "~~"], underline: ["<u>", "</u>"], spoiler: ["||", "||"], code: ["`", "`"], link: ["[", "](https://)"] };
      let value = selected;
      if (wraps[action]) value = wraps[action][0] + selected + wraps[action][1];
      else if (action === "clear") value = selected.replace(/!?(\[([^\]]*)\])\([^)]*\)/g, "$2").replace(/<\/?u>/g, "").replace(/(\*\*|__|~~|==|\|\||`|\*|_)/g, "").replace(/^\s*(?:#{1,6}\s+|>\s?)/gm, "");
      else if (action === "quote") value = selected.split("\n").map(line => `> ${line}`).join("\n");
      else if (action === "date") value = new Date().toLocaleDateString();
      else if (action === "upper") value = selected.toLocaleUpperCase();
      else if (action === "lower") value = selected.toLocaleLowerCase();
      else if (action === "capitalize") value = selected.toLocaleLowerCase().replace(/(^|\s)(\p{L})/gu, (_, space, letter) => space + letter.toLocaleUpperCase());
      if (note && ["upper", "lower", "capitalize"].includes(action)) {
        note.caseChanges = [...(note.caseChanges || []), { before: selected, after: value }].slice(-50);
      }
      this._replaceBodySelection(value, selection);
    }

    _pageKeys(event) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      // Find's input keeps native text editing shortcuts.
      if (event.target.closest?.(".zen-notes-find")) return;
      const actions = event.shiftKey ? { x: "strike", u: "underline", p: "spoiler", k: "code", i: "quote" } : { b: "bold", i: "italic", u: "link", k: "link", e: "code" };
      if (!["a", "z", "y", "f"].includes(key) && !actions[key]) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (key === "a") this._selectAll();
      else if (key === "z" || key === "y") this._undo(event.shiftKey || key === "y");
      else if (key === "f") this._openFind();
      else this._format(actions[key]);
    }

    _clearFind() {
      document.querySelectorAll(".zen-notes-found").forEach(el => el.classList.remove("zen-notes-found"));
      globalThis.CSS?.highlights?.delete("zen-notes-find");
      globalThis.CSS?.highlights?.delete("zen-notes-find-current");
    }

    _openFind() {
      let bar = document.querySelector(".zen-notes-find");
      if (!bar) {
        bar = this._html("div"); bar.className = "zen-notes-find";
        const input = this._html("input"); input.placeholder = "Find in note"; input.setAttribute("aria-label", "Find in note");
        const count = this._html("span"); count.className = "zen-notes-find-count";
        const search = (direction = 0) => {
          const query = input.value.toLocaleLowerCase();
          const lines = Array.from(document.querySelectorAll("#zen-notes-page-title, #zen-notes-editor > .zen-notes-line"));
          const matches = [];
          const ranges = [];
          for (const line of lines) {
            line.classList.remove("zen-notes-found");
            if (!query || line.classList.contains("is-table-divider")) continue;
            const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
            const nodes = []; let node, full = "";
            while ((node = walker.nextNode())) { nodes.push({ node, start: full.length }); full += node.textContent; }
            let offset = 0;
            while ((offset = full.toLocaleLowerCase().indexOf(query, offset)) !== -1) {
              const from = nodes.find(item => offset < item.start + item.node.length);
              const to = nodes.find(item => offset + query.length <= item.start + item.node.length);
              if (from && to) {
                const range = document.createRange();
                range.setStart(from.node, offset - from.start);
                range.setEnd(to.node, offset + query.length - to.start);
                ranges.push(range); matches.push(line);
              }
              offset += query.length;
            }
          }
          this._findIndex = direction && matches.length ? ((this._findIndex || 0) + direction + matches.length) % matches.length : 0;
          const hit = matches[this._findIndex];
          if (globalThis.CSS?.highlights && globalThis.Highlight) {
            CSS.highlights.set("zen-notes-find", new Highlight(...ranges));
            CSS.highlights.set("zen-notes-find-current", new Highlight(...(ranges[this._findIndex] ? [ranges[this._findIndex]] : [])));
          }
          if (hit) { hit.scrollIntoView({ block: "center" }); }
          count.textContent = matches.length ? `${this._findIndex + 1} / ${matches.length}` : "0 results";
        };
        input.addEventListener("input", () => search());
        input.addEventListener("keydown", event => { event.stopPropagation(); if (event.key === "Enter") { event.preventDefault(); search(event.shiftKey ? -1 : 1); } if (event.key === "Escape") { bar.hidden = true; this._clearFind(); } });
        bar.append(input, count);
        for (const [label, action] of [["Previous", () => search(-1)], ["Next", () => search(1)], ["Close", () => { bar.hidden = true; this._clearFind(); }]]) {
          const button = this._html("button"); button.textContent = label; button.addEventListener("click", action); bar.append(button);
        }
        document.getElementById("zen-notes-page").append(bar);
      }
      bar.hidden = false; bar.querySelector("input").focus(); bar.querySelector("input").select();
    }

    _menuItem(label, action) {
      const item = document.createXULElement("menuitem");
      item.setAttribute("label", label);
      item.dataset.zenNotesMenu = "true";
      item.addEventListener("command", () => Promise.resolve().then(action).catch(error => console.error(LOG, error)));
      return item;
    }

    _editorContextMenu(event) {
      event.preventDefault();
      event.stopPropagation();
      const selection = window.getSelection();
      const range = selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
      const target = event.target.closest("[contenteditable]");
      const bodySelection = this._bodySelection();
      let popup = document.getElementById("zen-notes-edit-menu");
      if (!popup) {
        popup = document.createXULElement("menupopup");
        popup.id = "zen-notes-edit-menu";
        popup.dataset.zenNotesMenu = "true";
        (document.getElementById("mainPopupSet") || document.documentElement).append(popup);
      }
      this._contextMenuOpen = true;
      popup.addEventListener("popuphidden", () => { this._contextMenuOpen = false; }, { once: true });
      popup.replaceChildren();
      for (const [label, command] of [["Copy", "copy"], ["Cut", "cut"], ["Paste", "paste"], ["Select All", "selectAll"]]) {
        const item = this._menuItem(label, () => {
          target?.focus();
          if (range) { selection.removeAllRanges(); selection.addRange(range); }
          if (command === "selectAll") {
            this._selectAll();
          } else document.execCommand(command);
        });
        if ((command === "copy" || command === "cut") && selection.isCollapsed) item.disabled = true;
        popup.append(item);
      }
      const formatting = document.createXULElement("menu"); formatting.setAttribute("label", "Formatting");
      const options = document.createXULElement("menupopup");
      const modifier = Services.appinfo.OS === "Darwin" ? "⌘" : "Ctrl+";
      const entries = [["Clear Formatting", "clear", ""], null,
        ["Strikethrough", "strike", "⇧" + modifier + "X"], ["Underline", "underline", "⇧" + modifier + "U"],
        ["Spoiler", "spoiler", "⇧" + modifier + "P"], ["Monospace", "code", "⇧" + modifier + "K"],
        ["Italic", "italic", modifier + "I"], ["Bold", "bold", modifier + "B"], ["Make Link", "link", modifier + "U"],
        ["Date", "date", ""], ["Quote", "quote", "⇧" + modifier + "I"], null,
        ["Make Upper Case", "upper", ""], ["Make Lower Case", "lower", ""], ["Capitalize", "capitalize", ""]];
      for (const entry of entries) {
        if (!entry) { options.append(document.createXULElement("menuseparator")); continue; }
        const [label, action, shortcut] = entry;
        const item = this._menuItem(label, () => this._format(action, bodySelection));
        if (shortcut) item.setAttribute("acceltext", shortcut);
        item.disabled = !bodySelection; options.append(item);
      }
      formatting.append(options); popup.append(document.createXULElement("menuseparator"), formatting);
      popup.append(this._menuItem("Add Divider", () => {
        const position = bodySelection || { start: this._editorMarkdown().length, end: this._editorMarkdown().length };
        this._insertDivider(position);
      }));
      popup.append(document.createXULElement("menuseparator"));
      popup.append(this._menuItem("Export…", () => this._exportNote()));
      const share = document.createXULElement("menu"); share.setAttribute("label", "Share…");
      const sharePopup = document.createXULElement("menupopup");
      sharePopup.addEventListener("popupshowing", () => this._populateNativeShare(sharePopup, this.currentNoteId));
      share.append(sharePopup);
      if (Services.appinfo.OS === "Darwin") popup.append(share);
      popup.append(this._menuItem("Import Markdown…", () => this._importNote()));
      popup.openPopupAtScreen(event.screenX, event.screenY, true);
    }

    _hasOpenNoteTab(id) {
      for (const browserWindow of Services.wm.getEnumerator("navigator:browser")) {
        if (browserWindow.closed) continue;
        if (Array.from(browserWindow.gBrowser?.tabs || []).some(tab => !tab.closing && this._idFromTab(tab) === id)) return true;
      }
      return false;
    }

    _addSelectionMenu(popup) {
      popup.querySelector("#zen-notes-add-selection")?.remove();
      popup.querySelector("#zen-notes-add-selection-separator")?.remove();
      const context = window.gContextMenu;
      const imageURL = context?.onImage ? context.imageURL || context.mediaURL : "";
      const isImage = /^https?:\/\//i.test(imageURL || "");
      const text = isImage ? `![Image](<${imageURL.replace(/>/g, "%3E")}>)` : context?.selectionInfo?.fullText || context?.contentData?.selectionInfo?.fullText || context?.selectedText || "";
      if (typeof text !== "string" || !text.trim()) return;
      const menu = document.createXULElement("menu");
      menu.id = "zen-notes-add-selection";
      menu.dataset.zenNotesMenu = "true";
      menu.setAttribute("label", "Add to Note");
      const choices = document.createXULElement("menupopup");
      for (const note of this.notes.filter(note => this._hasOpenNoteTab(note.id))) choices.append(this._menuItem(note.title, () => this._appendSelection(note.id, text)));
      choices.append(document.createXULElement("menuseparator"));
      choices.append(this._menuItem("Create Note…", async () => {
        const note = await this.createNote();
        await this._appendSelection(note.id, text);
      }));
      menu.append(choices);
      const separator = document.createXULElement("menuseparator");
      separator.id = "zen-notes-add-selection-separator";
      separator.dataset.zenNotesMenu = "true";
      const separators = Array.from(popup.children).filter(node =>
        node.localName === "menuseparator" && !node.hidden &&
        node.getAttribute("hidden") !== "true" &&
        window.getComputedStyle(node).display !== "none");
      const first = separators[isImage ? 1 : 0] || separators.at(-1);
      const anchor = first ? first.nextSibling : popup.firstChild;
      popup.insertBefore(menu, anchor);
      popup.insertBefore(separator, anchor);
    }

    async _appendSelection(id, text) {
      if (this.currentNoteId === id) await this._saveCurrentNow();
      await this._enqueueWrite(async () => {
        const note = this._getNote(id);
        if (!note || this._closingNotes.has(id) || await FileIO.exists(this._deletedPath(id))) return;
        const data = await this._readNote(note);
        await FileIO.writeUTF8(this._notePath(id), `# ${data.title}\n\n${data.body.replace(/\n+$/, "")}\n\n${text}\n`);
        note.updatedAt = new Date().toISOString();
        await this._writeIndex();
      });
      if (this.currentNoteId === id) await this._showNote(id);
    }

    async _followLink(link) {
      if (link.dataset.target) {
        const target = link.dataset.target;
        const note = this.notes.find(note => note.title.toLowerCase() === target.toLowerCase());
        if (note) {
          gBrowser.selectedTab = this.noteTabs.get(note.id) || this._openNoteTab(note, { select: true });
        }
        return;
      }
      const href = link.dataset.href;
      if (!/^https?:\/\//i.test(href || "")) return;
      window.openTrustedLinkIn(href, "tab");
    }

    _bindCreateButton() {
      const button = document.getElementById("zen-create-new-button");
      if (!button || button.dataset.zenNotesBound === "true") return;
      button.dataset.zenNotesBound = "true";
      button.addEventListener("pointerdown", this._onCreateButtonPointer, true);
      button.addEventListener("click", this._onCreateButtonPointer, true);
      this.createButton = button;
    }

    _onCreateButtonPointer() { this._expectingCreatePopupUntil = Date.now() + 1800; }

    _placeCreateNote(popup, item) {
      const folder = Array.from(popup.children).find(node => {
        const key = `${node.id} ${node.getAttribute("data-l10n-id") || ""}`;
        return /(?:new|create)[-_]?folder/i.test(key) || /^(?:new|create) folder$/i.test(node.getAttribute("label") || "");
      });
      if (folder) { if (folder.nextSibling !== item) popup.insertBefore(item, folder.nextSibling); }
      else if (item.parentNode !== popup) popup.append(item);
    }

    _onPopupShowing(event) {
      const popup = event.target;
      if (!popup || typeof popup.querySelectorAll !== "function") return;

      if (popup.parentElement?.classList?.contains("share-tab-url-item")) {
        const id = this._idFromTab(globalThis.TabContextMenu?.contextTab);
        if (id && this._getNote(id)) this._populateNativeShare(popup, id);
        return;
      }
      if (popup.id === "contentAreaContextMenu") {
        this._addSelectionMenu(popup);
        return;
      }
      if (popup.id === "tabContextMenu") {
        popup.querySelector("[data-zen-notes-create]")?.remove();
        popup.querySelector("#zen-notes-delete-note")?.remove();
        const tab = globalThis.TabContextMenu?.contextTab;
        const id = this._idFromTab(tab);
        if (id && this._getNote(id)) {
          const item = this._menuItem("Delete Note Permanently", () => this._deleteNote(id));
          item.id = "zen-notes-delete-note"; popup.append(item);
        }
        return;
      }
      if (["toolbar-context-menu", "zen-sidebar-context-menu"].includes(popup.id)) {
        if (!popup.querySelector("[data-zen-notes-create]")) {
          const item = this._menuItem("Create Note", () => this.createNote());
          item.dataset.zenNotesCreate = "true";
          this._placeCreateNote(popup, item);
        } else {
          this._placeCreateNote(popup, popup.querySelector("[data-zen-notes-create]"));
        }
        return;
      }
      if (popup.id === "zen-unified-site-data-panel") {
        this._patchSiteDataPanel(popup);
        // Zen's own script may (re)apply the disabled state on the Boost
        // button slightly after "popupshowing" fires. Re-assert one frame
        // later so our override reliably wins.
        requestAnimationFrame(() => this._patchSiteDataPanel(popup));
      }

      if (popup.querySelector("#zen-notes-create-menuitem")) return;

      const labels = Array.from(popup.children || [])
        .map((node) => node.getAttribute?.("label") || node.textContent || "")
        .join(" ")
        .toLowerCase();
      const looksLikeCreate = labels.includes("new tab") && (labels.includes("create space") || labels.includes("create folder"));
      if (Date.now() > this._expectingCreatePopupUntil && !looksLikeCreate) return;

      try {
        const item = document.createXULElement("menuitem");
        item.id = "zen-notes-create-menuitem";
        item.setAttribute("label", "Create Note");
        item.setAttribute("class", "menuitem-iconic");
        item.setAttribute("image", this._outlineNoteIcon());
        item.style.setProperty("list-style-image", `url("${MENU_NOTE_ICON}")`, "important");
        item.addEventListener("command", () => this.createNote().catch((error) => console.error(LOG, error)));

        this._placeCreateNote(popup, item);
      } catch (error) {
        console.error(LOG, "Could not add Create Note", error);
      }
    }

    // The site-data panel (bookmark/screenshot/reader/share row + Extensions
    // + Boosts + Settings, opened from the identity icon in the urlbar) is a
    // single DOM instance Zen reuses for every tab. Its "Boosts" section and
    // its footer "Boost" button are both keyed to the tab's *real* URL host.
    // A Zen Note lives at about:home#zen-note=<id>, so Zen never finds a
    // match for our boost (stored under the synthetic "zen-notes.local"
    // domain) — the button stays disabled and the Boosts section stays
    // empty. Re-enable the button while a note is selected and add our own
    // row to the (otherwise empty-looking) Boosts list, and undo both again
    // for every other tab so normal sites are unaffected.
    _patchSiteDataPanel(popup) {
      const boostButton = popup.querySelector("#zen-site-data-boost");
      const list = popup.querySelector("#zen-site-data-boost-list");
      const ownRow = list?.querySelector("#zen-notes-boost-status");

      if (!this.currentNoteId) {
        ownRow?.remove();
        return;
      }

      if (boostButton) {
        boostButton.removeAttribute("disabled");
        boostButton.disabled = false;
      }

      if (list && !ownRow) {
        try {
          const row = document.createXULElement("toolbarbutton");
          row.id = "zen-notes-boost-status";
          row.setAttribute("label", "Zen Notes Boost");
          row.setAttribute("class", "subviewbutton");
          row.addEventListener("command", () => {
            try { popup.hidePopup?.(); } catch {}
            this.openNoteBoost();
          });
          list.prepend(row);
        } catch (error) {
          console.error(LOG, "Could not patch site-data boost list", error);
        }
      }
    }

    _onMutation() {
      if (this._destroyed) return;
      this._bindCreateButton();
      const id = this._idFromTab(gBrowser?.selectedTab);
      if (id && this._getNote(id)) this._ensurePage();
    }

    destroy() {
      this._destroyed = true;
      this._clearFind();
      window.clearTimeout(this.saveTimer);
      document.removeEventListener("keydown", this._onFindShortcut, true);
      document.removeEventListener("popupshowing", this._onPopupShowing, false);
      document.removeEventListener("command", this._onNativeBoostButton, true);
      gBrowser?.tabContainer?.removeEventListener("TabSelect", this._onTabSelect);
      document.removeEventListener("TabClose", this._onTabClose, true);
      this.observer?.disconnect();
      this.titleObserver?.disconnect();
      document.querySelectorAll("[data-zen-notes-menu]").forEach(el => el.remove());

      if (ZenBoostsManager && globalThis.Services?.obs) {
        try { Services.obs.removeObserver(this._onBoostUpdate, "zen-boosts-update"); } catch {}
        try { Services.obs.removeObserver(this._onBoostUpdate, "zen-boosts-active-change"); } catch {}
      }

      if (this.createButton) {
        this.createButton.removeEventListener("pointerdown", this._onCreateButtonPointer, true);
        this.createButton.removeEventListener("click", this._onCreateButtonPointer, true);
        delete this.createButton.dataset.zenNotesBound;
      }

      const page = document.getElementById("zen-notes-page");
      page?.parentElement?.removeAttribute?.("zen-notes-active");
      page?.parentElement?.classList?.remove("zen-notes-page-host");
      page?.remove();
      document.getElementById("zen-notes-create-menuitem")?.remove();
      document.getElementById("zen-notes-boost-status")?.remove();
      document.getElementById("zen-notes-boost-custom-css")?.remove();
      try { this._boostEditor?.close?.(); } catch {}
    }
  }

  const controller = new ZenNotesController();
  window.gZenNotes = controller;
  const start = () => controller.init();
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
})();
