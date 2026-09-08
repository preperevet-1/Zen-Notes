"use strict";

(() => {
  const LOG = "[Zen Notes]";
  const VERSION = "0.5.2-alpha";
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
      this._closingNotes = new Set();

      this._onPopupShowing = this._onPopupShowing.bind(this);
      this._onCreateButtonPointer = this._onCreateButtonPointer.bind(this);
      this._onTabSelect = this._onTabSelect.bind(this);
      this._onTabClose = this._onTabClose.bind(this);
      this._onMutation = this._onMutation.bind(this);
      this._onBoostUpdate = this._onBoostUpdate.bind(this);
      this._onNativeBoostButton = this._onNativeBoostButton.bind(this);
    }

    async init() {
      try {
        await FileIO.makeDirectory(this.storageDir, { ignoreExisting: true });
        await this._loadIndex();

        document.addEventListener("popupshowing", this._onPopupShowing, false);
        gBrowser.tabContainer.addEventListener("TabSelect", this._onTabSelect);
        gBrowser.tabContainer.addEventListener("TabClose", this._onTabClose);
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
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7 2.5h7.1L19.5 7.9v11.85A2.25 2.25 0 0 1 17.25 22H6.75A2.25 2.25 0 0 1 4.5 19.75v-15A2.25 2.25 0 0 1 6.75 2.5H7Zm6.35 1.8v4.35h4.35L13.35 4.3Z" fill="context-fill"/></svg>`;
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
      icon.style.setProperty("-moz-context-properties", "fill, fill-opacity, stroke, stroke-opacity", "important");
      icon.style.setProperty("fill", "#888891", "important");
      icon.style.setProperty("fill-opacity", "1", "important");
      icon.style.setProperty("stroke", "#888891", "important");
      icon.style.setProperty("stroke-opacity", "1", "important");
      icon.style.setProperty("color", "#888891", "important");
      icon.style.setProperty("opacity", "0.9", "important");
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
      if (!id || window.closed || globalThis.gBrowser?.closing || event.detail?.adoptedBy) return;
      // Native TabClose is dispatched for removal; pinned unload/reset does not
      // dispatch it. Do not infer cancellation from DOM connectivity/animation.
      if (Array.from(gBrowser.tabs).some(other => other !== tab && !other.closing && this._idFromTab(other) === id)) return;
      for (const otherWindow of Services.wm.getEnumerator("navigator:browser")) {
        if (otherWindow === window || otherWindow.closed) continue;
        if (Array.from(otherWindow.gBrowser?.tabs || []).some(other => !other.closing && this._idFromTab(other) === id)) return;
      }
      this._closingNotes.add(id);
      if (id === this.currentNoteId) {
        window.clearTimeout(this.saveTimer);
        this.currentNoteId = null;
        this._hidePage();
      }
      this.noteTabs.delete(id);
      try { SessionStoreAPI?.deleteCustomTabValue?.(tab, "zen-notes-id"); } catch {}
      await this._enqueueWrite(async () => {
        await FileIO.writeUTF8(this._deletedPath(id), new Date().toISOString());
        await FileIO.remove(this._notePath(id), { ignoreAbsent: true });
        this.notes = this.notes.filter(note => note.id !== id);
        await this._writeIndex();
      });
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
      line.addEventListener("input", () => {
        line.dataset.raw = this._lineText(line);
        this._classifyLine(line, line.dataset.raw, false);
        this._queueSave();
      });
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
      return this._visibleOffsetToRaw(raw, visibleOffset);
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
      for (const line of editor.querySelectorAll(":scope > .zen-notes-line")) {
        const raw = line.dataset.raw ?? "";
        const fence = /^\s*```/.test(raw);
        line.dataset.codeBlock = insideFence || fence ? "true" : "false";
        this._renderLine(line, insideFence);
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
      text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt) => token(`<span class="zen-notes-embed">🖼 ${alt || "image"}</span>`));
      text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => token(`<span class="zen-notes-link" data-href="${href.replace(/"/g, "&quot;")}">${label}</span>`));
      text = text.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) => token(`<span class="zen-notes-wikilink" data-target="${target.replace(/"/g, "&quot;")}">${alias || target}</span>`));
      text = text.replace(/&lt;(https?:\/\/[^\s]+?)&gt;/g, (_, href) => token(`<span class="zen-notes-link" data-href="${href}">${href}</span>`));
      // Existing Markdown links and code are already stashed: only linkify plain URLs.
      text = text.replace(/https?:\/\/[^\s<>\uE000\uE001]+/g, match => {
        let href = match.replace(/[.,!?;:]+$/, "");
        while (href.endsWith(")") && (href.match(/\)/g) || []).length > (href.match(/\(/g) || []).length) href = href.slice(0, -1);
        return token(`<span class="zen-notes-link" data-href="${href}">${href}</span>`) + match.slice(href.length);
      });
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
      const text = line.firstChild || line.appendChild(document.createTextNode(""));
      const max = text.nodeType === Node.TEXT_NODE ? text.nodeValue.length : line.textContent.length;
      const pos = Math.max(0, Math.min(offset, max));
      const range = document.createRange();
      if (text.nodeType === Node.TEXT_NODE) range.setStart(text, pos);
      else { range.selectNodeContents(line); range.collapse(false); }
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
      const text = event.clipboardData?.getData("text/plain");
      if (typeof text !== "string") return;
      event.preventDefault();
      event.stopPropagation();

      const target = event.currentTarget;
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
          if (command === "selectAll" && target) {
            const all = document.createRange(); all.selectNodeContents(target);
            selection.removeAllRanges(); selection.addRange(all);
          } else document.execCommand(command);
        });
        if ((command === "copy" || command === "cut") && selection.isCollapsed) item.disabled = true;
        popup.append(item);
      }
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
      const text = context?.selectionInfo?.fullText || context?.contentData?.selectionInfo?.fullText || context?.selectedText || "";
      if (typeof text !== "string" || !text.trim()) return;
      const menu = document.createXULElement("menu");
      menu.id = "zen-notes-add-selection";
      menu.dataset.zenNotesMenu = "true";
      menu.setAttribute("label", "Add to Note");
      const choices = document.createXULElement("menupopup");
      for (const note of this.notes.filter(note => this._hasOpenNoteTab(note.id))) choices.append(this._menuItem(note.title, () => this._appendSelection(note.id, text)));
      choices.append(this._menuItem("Create Note…", async () => {
        const note = await this.createNote();
        await this._appendSelection(note.id, text);
      }));
      menu.append(choices);
      const separator = document.createXULElement("menuseparator");
      separator.id = "zen-notes-add-selection-separator";
      separator.dataset.zenNotesMenu = "true";
      const first = Array.from(popup.children).find(node =>
        node.localName === "menuseparator" && !node.hidden &&
        node.getAttribute("hidden") !== "true" &&
        window.getComputedStyle(node).display !== "none");
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

      if (popup.id === "contentAreaContextMenu") {
        this._addSelectionMenu(popup);
        return;
      }
      if (["tabContextMenu", "toolbar-context-menu", "zen-sidebar-context-menu"].includes(popup.id)) {
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
      window.clearTimeout(this.saveTimer);
      document.removeEventListener("popupshowing", this._onPopupShowing, false);
      document.removeEventListener("command", this._onNativeBoostButton, true);
      gBrowser?.tabContainer?.removeEventListener("TabSelect", this._onTabSelect);
      gBrowser?.tabContainer?.removeEventListener("TabClose", this._onTabClose);
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
