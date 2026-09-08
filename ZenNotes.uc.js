"use strict";

(() => {
  const LOG = "[Zen Notes]";
  const VERSION = "0.3.0-alpha";
  // about:home avoids the misleading “Not secure” identity shown by about:blank in Zen.
  // SessionStore remains the canonical way to identify note tabs.
  const TAB_URL_PREFIX = "about:home#zen-note=";
  const LEGACY_TAB_URL_PREFIXES = ["about:blank#zen-note="];

  if (window.gZenNotes?.destroy) {
    try {
      window.gZenNotes.destroy();
    } catch (error) {
      console.error(LOG, "Failed to destroy previous instance", error);
    }
  }

  const FileIO = globalThis.IOUtils;
  const Paths = globalThis.PathUtils;

  let SessionStoreAPI = globalThis.SessionStore || null;
  if (!SessionStoreAPI && globalThis.ChromeUtils?.importESModule) {
    try {
      ({ SessionStore: SessionStoreAPI } = ChromeUtils.importESModule(
        "resource:///modules/sessionstore/SessionStore.sys.mjs"
      ));
    } catch (error) {
      console.warn(LOG, "SessionStore API unavailable; URL fallback will be used", error);
    }
  }

  if (!FileIO || !Paths) {
    throw new Error(`${LOG} IOUtils/PathUtils are unavailable in this chrome context`);
  }

  class ZenNotesController {
    constructor() {
      this.notes = [];
      this.storageDir = Paths.join(Paths.profileDir, "zen-notes");
      this.indexPath = Paths.join(this.storageDir, "index.json");
      this.currentNoteId = null;
      this.noteTabs = new Map();
      this.saveTimer = null;
      this._expectingCreatePopupUntil = 0;
      this._destroyed = false;
      this._loadingPage = false;

      this._onPopupShowing = this._onPopupShowing.bind(this);
      this._onCreateButtonPointer = this._onCreateButtonPointer.bind(this);
      this._onTabSelect = this._onTabSelect.bind(this);
      this._onTabClose = this._onTabClose.bind(this);
      this._onMutation = this._onMutation.bind(this);
      this._onWindowKeyDown = this._onWindowKeyDown.bind(this);
    }

    async init() {
      try {
        await this._ensureStorage();
        await this._loadIndex();

        document.addEventListener("popupshowing", this._onPopupShowing, true);
        document.addEventListener("keydown", this._onWindowKeyDown, true);
        gBrowser.tabContainer.addEventListener("TabSelect", this._onTabSelect);
        gBrowser.tabContainer.addEventListener("TabClose", this._onTabClose);

        this.observer = new MutationObserver(this._onMutation);
        this.observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
        });

        this._bindCreateButton();
        this._recoverExistingNoteTabs();
        await this._restoreMissingNoteTabs();
        await this._syncSelectedTab();

        console.info(LOG, `${VERSION} loaded`);
      } catch (error) {
        console.error(LOG, "Initialization failed", error);
      }
    }

    async _ensureStorage() {
      await FileIO.makeDirectory(this.storageDir, { ignoreExisting: true });
    }

    async _loadIndex() {
      if (!(await FileIO.exists(this.indexPath))) {
        this.notes = [];
        await this._writeIndex();
        return;
      }

      try {
        const raw = await FileIO.readUTF8(this.indexPath);
        const parsed = JSON.parse(raw);
        this.notes = Array.isArray(parsed?.notes) ? parsed.notes : [];
      } catch (error) {
        console.error(LOG, "Could not read index.json; starting with an empty index", error);
        this.notes = [];
      }
    }

    async _writeIndex() {
      await FileIO.writeUTF8(
        this.indexPath,
        JSON.stringify({ version: 2, notes: this.notes }, null, 2)
      );
    }

    _makeId() {
      if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
      return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    _notePath(id) {
      return Paths.join(this.storageDir, `${id}.md`);
    }

    _noteURL(id) {
      return `${TAB_URL_PREFIX}${encodeURIComponent(id)}`;
    }

    _idFromTab(tab) {
      const attr = tab?.getAttribute?.("zen-notes-id");
      if (attr) return attr;

      try {
        const stored = SessionStoreAPI?.getCustomTabValue?.(tab, "zen-notes-id");
        if (stored) return stored;
      } catch (error) {
        console.warn(LOG, "Could not read note id from SessionStore", error);
      }

      const spec = tab?.linkedBrowser?.currentURI?.spec || "";
      const prefixes = [TAB_URL_PREFIX, ...LEGACY_TAB_URL_PREFIXES];
      const prefix = prefixes.find((candidate) => spec.startsWith(candidate));
      if (!prefix) return null;
      try {
        return decodeURIComponent(spec.slice(prefix.length));
      } catch {
        return null;
      }
    }

    _getNote(id) {
      return this.notes.find((note) => note.id === id) || null;
    }

    async createNote() {
      const now = new Date().toISOString();
      const note = {
        id: this._makeId(),
        title: "New Note",
        createdAt: now,
        updatedAt: now,
      };

      this.notes.unshift(note);
      await this._writeIndex();
      await FileIO.writeUTF8(this._notePath(note.id), "# New Note\n\n");

      const tab = this._openNoteTab(note, { select: true });
      this.noteTabs.set(note.id, tab);
      await this._showNote(note.id, { focusTitle: true });
    }

    async _readNote(note) {
      const path = this._notePath(note.id);
      if (!(await FileIO.exists(path))) {
        return { title: note.title || "New Note", body: "" };
      }

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
        console.error(LOG, `Failed reading note ${note.id}`, error);
        return { title: note.title || "New Note", body: "" };
      }
    }

    _queueSave() {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = window.setTimeout(() => {
        this._saveCurrentNow().catch((error) =>
          console.error(LOG, "Autosave failed", error)
        );
      }, 300);
    }

    async _saveCurrentNow() {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;

      if (!this.currentNoteId) return;
      const note = this._getNote(this.currentNoteId);
      const page = document.getElementById("zen-notes-page");
      const titleEl = document.getElementById("zen-notes-page-title");
      const editor = document.getElementById("zen-notes-editor-content");
      if (!note || !page || page.hidden || !titleEl || !editor) return;

      const title = titleEl.textContent.trim() || "New Note";
      const body = this._editorToMarkdown(editor);

      note.title = title;
      note.updatedAt = new Date().toISOString();

      await FileIO.writeUTF8(this._notePath(note.id), `# ${title}\n\n${body}`);
      await this._writeIndex();
      this._syncTabAppearance(note.id);
    }

    _noteIconDataURI() {
      // Monochrome document outline matching the built-in Zen / macOS SF Symbols feel.
      // It is intentionally a tiny inline SVG so the mod has no external icon dependency.
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7.25 2.75h6.95L18.75 7.3v13.95H7.25a2 2 0 0 1-2-2V4.75a2 2 0 0 1 2-2Z" fill="none" stroke="#7f7f7f" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 2.95V7.5h4.5" fill="none" stroke="#7f7f7f" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }

    _markTab(tab, note) {
      if (!tab || !note) return;
      tab.setAttribute("zen-notes-id", note.id);
      tab.setAttribute("label", note.title || "New Note");
      tab.label = note.title || "New Note";
      tab.setAttribute("image", this._noteIconDataURI());
      tab.setAttribute("zen-notes-tab", "true");

      try {
        SessionStoreAPI?.setCustomTabValue?.(tab, "zen-notes-id", note.id);
      } catch (error) {
        console.warn(LOG, "Could not persist note id in SessionStore", error);
      }
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
      } catch (error) {
        console.warn(LOG, "addTab with principal failed, retrying", error);
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

    async _restoreMissingNoteTabs() {
      // No Notes hub exists yet, so every saved note must stay reachable.
      // Missing tabs are restored in the background on startup.
      for (const note of [...this.notes].reverse()) {
        if (this.noteTabs.has(note.id)) continue;
        const tab = this._openNoteTab(note, { background: true });
        this.noteTabs.set(note.id, tab);
      }
    }

    _syncTabAppearance(noteId) {
      const note = this._getNote(noteId);
      const tab = this.noteTabs.get(noteId);
      if (!note || !tab) return;
      this._markTab(tab, note);
    }

    async _onTabSelect() {
      await this._syncSelectedTab();
    }

    async _onTabClose(event) {
      const tab = event.target;
      const id = this._idFromTab(tab);
      if (!id) return;

      if (id === this.currentNoteId) {
        await this._saveCurrentNow();
        this.currentNoteId = null;
        this._hidePage();
      }
      this.noteTabs.delete(id);
    }

    async _syncSelectedTab() {
      const tab = gBrowser.selectedTab;
      const id = this._idFromTab(tab);
      if (!id || !this._getNote(id)) {
        if (this.currentNoteId) await this._saveCurrentNow();
        this.currentNoteId = null;
        this._hidePage();
        return;
      }

      if (this.currentNoteId && this.currentNoteId !== id) {
        await this._saveCurrentNow();
      }
      await this._showNote(id);
    }

    async _showNote(noteId, options = {}) {
      const note = this._getNote(noteId);
      if (!note) return;

      this._ensurePage();
      const page = document.getElementById("zen-notes-page");
      const titleEl = document.getElementById("zen-notes-page-title");
      const editor = document.getElementById("zen-notes-editor-content");
      if (!page || !titleEl || !editor) return;

      const noteData = await this._readNote(note);
      this.currentNoteId = noteId;
      this._loadingPage = true;

      titleEl.textContent = noteData.title || "New Note";
      editor.replaceChildren(this._markdownToFragment(noteData.body));
      if (!editor.childNodes.length) editor.appendChild(this._emptyParagraph());

      note.title = noteData.title || note.title || "New Note";
      this._syncTabAppearance(note.id);
      page.hidden = false;
      this._loadingPage = false;

      requestAnimationFrame(() => {
        if (options.focusTitle) {
          titleEl.focus();
          this._selectAll(titleEl);
        }
      });
    }

    _hidePage() {
      const page = document.getElementById("zen-notes-page");
      if (page) page.hidden = true;
    }

    _getHost() {
      // Put the note UI inside the selected tab's own browser stack.
      // This keeps Zen chrome (vertical sidebar, top bar, compact UI) above it.
      const selectedBrowser = gBrowser?.selectedBrowser;
      const browserStack = selectedBrowser?.parentElement;
      if (browserStack) return browserStack;

      return (
        document.getElementById("tabbrowser-tabbox") ||
        document.getElementById("appcontent") ||
        document.getElementById("browser") ||
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
          host.classList?.add("zen-notes-page-host");
          host.append(page);
        }
        return true;
      }

      host.classList?.add("zen-notes-page-host");

      page = document.createElement("div");
      page.id = "zen-notes-page";
      page.hidden = true;

      const scroll = document.createElement("div");
      scroll.className = "zen-notes-page-scroll";

      const canvas = document.createElement("main");
      canvas.className = "zen-notes-page-canvas";

      const title = document.createElement("div");
      title.id = "zen-notes-page-title";
      title.contentEditable = "true";
      title.spellcheck = true;
      title.setAttribute("role", "textbox");
      title.setAttribute("aria-label", "Note title");
      title.setAttribute("data-placeholder", "New Note");

      const editor = document.createElement("div");
      editor.id = "zen-notes-editor-content";
      editor.contentEditable = "true";
      editor.spellcheck = true;
      editor.setAttribute("role", "textbox");
      editor.setAttribute("aria-multiline", "true");
      editor.setAttribute("data-placeholder", "");

      title.addEventListener("input", () => {
        if (this._loadingPage) return;
        const note = this._getNote(this.currentNoteId);
        if (note) {
          note.title = title.textContent.trim() || "New Note";
          this._syncTabAppearance(note.id);
        }
        this._queueSave();
      });

      title.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          this._focusEditorStart(editor);
        }
      });

      title.addEventListener("paste", (event) => this._pastePlainText(event));
      editor.addEventListener("paste", (event) => this._pastePlainText(event));
      editor.addEventListener("beforeinput", (event) => this._onEditorBeforeInput(event));
      editor.addEventListener("input", (event) => {
        if (this._loadingPage) return;

        // Inline Markdown is rendered immediately after its closing marker is typed.
        if (["*", "`", ")", "~", "="].includes(event.data)) {
          this._renderInlineMarkdownInCurrentBlock();
        }
        this._queueSave();
      });
      editor.addEventListener("keydown", (event) => this._onEditorKeyDown(event));

      canvas.append(title, editor);
      scroll.append(canvas);
      page.append(scroll);
      host.append(page);
      return true;
    }

    _onEditorBeforeInput(event) {
      if (event.inputType !== "insertText" || event.data !== " ") return;
      if (this._applyTaskMarkdownShortcut() || this._applyBlockMarkdownShortcut()) {
        event.preventDefault();
        this._queueSave();
      }
    }

    _pastePlainText(event) {
      const text = event.clipboardData?.getData("text/plain");
      if (typeof text !== "string") return;
      event.preventDefault();
      document.execCommand("insertText", false, text);
    }

    _onEditorKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey) {
        if (event.key.toLowerCase() === "b") {
          event.preventDefault();
          document.execCommand("bold", false);
          this._queueSave();
          return;
        }
        if (event.key.toLowerCase() === "i") {
          event.preventDefault();
          document.execCommand("italic", false);
          this._queueSave();
          return;
        }
      }

      if (event.key === "Tab") {
        const li = this._currentListItem();
        if (li && this._indentListItem(li, event.shiftKey ? -1 : 1)) {
          event.preventDefault();
          this._queueSave();
          return;
        }
      }

      if (event.key === " " && !event.metaKey && !event.ctrlKey && !event.altKey) {
        // Fallback for builds where beforeinput is not dispatched in browser chrome.
        if (this._applyTaskMarkdownShortcut() || this._applyBlockMarkdownShortcut()) {
          event.preventDefault();
          this._queueSave();
          return;
        }
      }

      if (event.key === "Enter" && !event.shiftKey) {
        const li = this._currentListItem();
        if (li) {
          if (this._handleListEnter(li)) {
            event.preventDefault();
            this._queueSave();
            return;
          }
        }

        const block = this._currentTopLevelBlock();
        if (block && block.textContent.trim() === "```") {
          event.preventDefault();
          this._replaceBlock(block, "pre", "");
          this._queueSave();
          return;
        }
        this._renderInlineMarkdownInCurrentBlock();
      }
    }

    _currentTopLevelBlock() {
      const editor = document.getElementById("zen-notes-editor-content");
      const selection = window.getSelection();
      if (!editor || !selection?.rangeCount) return null;

      let node = selection.anchorNode;
      if (!node) return null;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      if (!node || !editor.contains(node)) return null;

      while (node && node.parentElement !== editor) {
        node = node.parentElement;
      }
      return node && node !== editor ? node : null;
    }

    _applyBlockMarkdownShortcut() {
      const block = this._currentTopLevelBlock();
      if (!block) return false;
      const marker = (block.textContent || "").replace(/\u00a0/g, " ").trim();

      if (/^#{1,6}$/.test(marker)) return !!this._replaceBlock(block, `h${marker.length}`, "");
      if (marker === ">") return !!this._replaceBlock(block, "blockquote", "");
      if (marker === "-" || marker === "*") return !!this._replaceBlockWithList(block, "ul");
      if (/^\d+\.$/.test(marker)) return !!this._replaceBlockWithList(block, "ol");
      return false;
    }

    _applyTaskMarkdownShortcut() {
      const li = this._currentListItem();
      if (!li || li.classList.contains("zen-notes-task-item")) return false;
      const marker = (li.textContent || "").replace(/ /g, " ").trim();
      const match = marker.match(/^\[([ xX])\]$/);
      if (!match) return false;

      const checked = match[1].toLowerCase() === "x";
      li.textContent = "";
      li.classList.add("zen-notes-task-item");
      li.dataset.checked = checked ? "true" : "false";
      li.append(this._createTaskCheckbox(checked), document.createTextNode(""));
      this._placeCaretAtEnd(li);
      return true;
    }

    _createTaskCheckbox(checked = false) {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.className = "zen-notes-task-checkbox";
      input.checked = !!checked;
      input.contentEditable = "false";
      input.setAttribute("aria-label", "Task");
      input.addEventListener("change", () => {
        const li = input.closest("li");
        if (li) li.dataset.checked = input.checked ? "true" : "false";
        this._queueSave();
      });
      return input;
    }

    _currentListItem() {
      const block = this._currentTextBlock();
      return block?.tagName === "LI" ? block : null;
    }

    _selectionAtEnd(node) {
      const selection = window.getSelection();
      if (!selection?.rangeCount || !selection.isCollapsed) return false;
      const caret = selection.getRangeAt(0).cloneRange();
      const tail = document.createRange();
      tail.selectNodeContents(node);
      tail.collapse(false);
      return caret.compareBoundaryPoints(Range.START_TO_START, tail) === 0;
    }

    _handleListEnter(li) {
      const list = li.parentElement;
      if (!list || !["UL", "OL"].includes(list.tagName)) return false;

      const text = this._listItemInlineMarkdown(li).trim();
      const isEmpty = text === "";
      if (isEmpty) {
        this._exitList(li);
        return true;
      }

      // Let the browser split a line in the middle naturally. We only take over the
      // common end-of-item case so list DOM stays deterministic across reloads.
      if (!this._selectionAtEnd(li)) return false;

      const next = document.createElement("li");
      if (li.classList.contains("zen-notes-task-item")) {
        next.classList.add("zen-notes-task-item");
        next.dataset.checked = "false";
        next.append(this._createTaskCheckbox(false), document.createTextNode(""));
      } else {
        next.append(document.createElement("br"));
      }
      li.after(next);
      this._placeCaretAtEnd(next);
      return true;
    }

    _exitList(li) {
      const list = li.parentElement;
      if (!list) return;

      const p = this._emptyParagraph();
      const trailing = [];
      let cursor = li.nextElementSibling;
      while (cursor) {
        const next = cursor.nextElementSibling;
        trailing.push(cursor);
        cursor = next;
      }

      li.remove();
      if (trailing.length) {
        const tailList = document.createElement(list.tagName.toLowerCase());
        if (list.classList.contains("zen-notes-task-list")) tailList.classList.add("zen-notes-task-list");
        trailing.forEach((item) => tailList.append(item));
        list.after(p, tailList);
      } else {
        list.after(p);
      }
      if (!list.children.length) list.remove();
      this._placeCaretAtEnd(p);
    }

    _indentListItem(li, direction) {
      const list = li.parentElement;
      if (!list || !["UL", "OL"].includes(list.tagName)) return false;

      if (direction > 0) {
        const prev = li.previousElementSibling;
        if (!prev) return false;
        let nested = Array.from(prev.children).find((el) => el.tagName === list.tagName);
        if (!nested) {
          nested = document.createElement(list.tagName.toLowerCase());
          prev.append(nested);
        }
        nested.append(li);
        this._placeCaretAtEnd(li);
        return true;
      }

      const parentLi = list.parentElement?.closest?.("li");
      if (!parentLi) return false;
      parentLi.after(li);
      if (!list.children.length) list.remove();
      this._placeCaretAtEnd(li);
      return true;
    }

    _replaceBlock(block, tagName, text) {
      const el = document.createElement(tagName);
      if (tagName === "pre") {
        const code = document.createElement("code");
        code.textContent = text;
        el.append(code);
      } else if (text) {
        el.textContent = text;
      } else {
        el.append(document.createElement("br"));
      }
      block.replaceWith(el);
      this._placeCaretAtEnd(tagName === "pre" ? el.querySelector("code") : el);
      return el;
    }

    _replaceBlockWithList(block, type) {
      const list = document.createElement(type);
      const li = document.createElement("li");
      li.append(document.createElement("br"));
      list.append(li);
      block.replaceWith(list);
      this._placeCaretAtEnd(li);
      return list;
    }

    _currentTextBlock() {
      const editor = document.getElementById("zen-notes-editor-content");
      const selection = window.getSelection();
      if (!editor || !selection?.rangeCount) return null;

      let node = selection.anchorNode;
      if (!node) return null;
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      if (!node || !editor.contains(node)) return null;

      let candidate = node;
      while (candidate && candidate !== editor) {
        if (["P", "H1", "H2", "H3", "BLOCKQUOTE", "LI"].includes(candidate.tagName)) {
          return candidate;
        }
        candidate = candidate.parentElement;
      }
      return null;
    }

    _renderInlineMarkdownInCurrentBlock() {
      const block = this._currentTextBlock() || this._currentTopLevelBlock();
      if (!block || ["UL", "OL", "PRE"].includes(block.tagName)) return false;
      const raw = block.textContent;
      if (!/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|~~[^~]+~~|==[^=]+==)/.test(raw)) return false;

      const html = this._inlineMarkdownToHTML(raw);
      if (html === this._escapeHTML(raw)) return false;
      block.innerHTML = html || "<br>";
      this._placeCaretAtEnd(block);
      return true;
    }

    _emptyParagraph() {
      const p = document.createElement("p");
      p.append(document.createElement("br"));
      return p;
    }

    _focusEditorStart(editor) {
      if (!editor.childNodes.length) editor.append(this._emptyParagraph());
      editor.focus();
      const first = editor.firstElementChild || editor;
      const range = document.createRange();
      range.selectNodeContents(first);
      range.collapse(true);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }

    _placeCaretAtEnd(node) {
      if (!node) return;
      const range = document.createRange();
      range.selectNodeContents(node);
      range.collapse(false);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      node.parentElement?.focus?.();
      if (node.isContentEditable) node.focus();
    }

    _selectAll(node) {
      const range = document.createRange();
      range.selectNodeContents(node);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }

    _escapeHTML(text) {
      return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    _inlineMarkdownToHTML(text) {
      let html = this._escapeHTML(text);
      html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
      html = html.replace(/~~([^~]+)~~/g, "<del>$1</del>");
      html = html.replace(/==([^=]+)==/g, "<mark>$1</mark>");
      html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      html = html.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
      html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
      return html;
    }

    _markdownToFragment(markdown) {
      const fragment = document.createDocumentFragment();
      const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
      let i = 0;

      while (i < lines.length) {
        const line = lines[i];

        if (line.startsWith("```")) {
          const codeLines = [];
          i += 1;
          while (i < lines.length && !lines[i].startsWith("```")) {
            codeLines.push(lines[i]);
            i += 1;
          }
          if (i < lines.length) i += 1;
          const pre = document.createElement("pre");
          const code = document.createElement("code");
          code.textContent = codeLines.join("\n");
          pre.append(code);
          fragment.append(pre);
          continue;
        }

        const heading = line.match(/^(#{1,6})\s+(.*)$/);
        if (heading) {
          const el = document.createElement(`h${heading[1].length}`);
          el.innerHTML = this._inlineMarkdownToHTML(heading[2]);
          fragment.append(el);
          i += 1;
          continue;
        }

        if (/^>\s?/.test(line)) {
          const quote = document.createElement("blockquote");
          quote.innerHTML = this._inlineMarkdownToHTML(line.replace(/^>\s?/, ""));
          fragment.append(quote);
          i += 1;
          continue;
        }

        if (/^[-*]\s+/.test(line)) {
          const ul = document.createElement("ul");
          while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
            const source = lines[i].replace(/^[-*]\s+/, "");
            const task = source.match(/^\[([ xX])\]\s?(.*)$/);
            const li = document.createElement("li");
            if (task) {
              const checked = task[1].toLowerCase() === "x";
              ul.classList.add("zen-notes-task-list");
              li.classList.add("zen-notes-task-item");
              li.dataset.checked = checked ? "true" : "false";
              li.append(this._createTaskCheckbox(checked));
              const span = document.createElement("span");
              span.innerHTML = this._inlineMarkdownToHTML(task[2]);
              li.append(span);
            } else {
              li.innerHTML = this._inlineMarkdownToHTML(source);
            }
            ul.append(li);
            i += 1;
          }
          fragment.append(ul);
          continue;
        }

        if (/^\d+\.\s+/.test(line)) {
          const ol = document.createElement("ol");
          while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
            const li = document.createElement("li");
            li.innerHTML = this._inlineMarkdownToHTML(lines[i].replace(/^\d+\.\s+/, ""));
            ol.append(li);
            i += 1;
          }
          fragment.append(ol);
          continue;
        }

        const p = document.createElement("p");
        if (line === "") p.append(document.createElement("br"));
        else p.innerHTML = this._inlineMarkdownToHTML(line);
        fragment.append(p);
        i += 1;
      }

      return fragment;
    }

    _inlineNodeToMarkdown(node) {
      if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || "";
      if (node.nodeType !== Node.ELEMENT_NODE) return "";

      const tag = node.tagName;
      const inner = Array.from(node.childNodes)
        .map((child) => this._inlineNodeToMarkdown(child))
        .join("");

      if (tag === "BR" || tag === "INPUT") return "";
      if (tag === "STRONG" || tag === "B") return `**${inner}**`;
      if (tag === "EM" || tag === "I") return `*${inner}*`;
      if (tag === "DEL" || tag === "S") return `~~${inner}~~`;
      if (tag === "MARK") return `==${inner}==`;
      if (tag === "CODE") return `\`${inner}\``;
      if (tag === "A") {
        const href = node.getAttribute("href") || "";
        return href ? `[${inner}](${href})` : inner;
      }
      return inner;
    }

    _listItemInlineMarkdown(li) {
      return Array.from(li.childNodes)
        .filter((child) => !(child.nodeType === Node.ELEMENT_NODE && ["UL", "OL", "INPUT"].includes(child.tagName)))
        .map((child) => this._inlineNodeToMarkdown(child))
        .join("");
    }

    _listToMarkdownLines(list, depth = 0) {
      const lines = [];
      const indent = "  ".repeat(depth);
      let number = 1;

      for (const li of Array.from(list.children).filter((el) => el.tagName === "LI")) {
        const task = li.classList.contains("zen-notes-task-item") || li.querySelector(":scope > .zen-notes-task-checkbox");
        const checked = li.dataset.checked === "true" || li.querySelector(":scope > .zen-notes-task-checkbox")?.checked;
        const marker = list.tagName === "OL" ? `${number}.` : "-";
        const taskPrefix = task ? `[${checked ? "x" : " "}] ` : "";
        lines.push(`${indent}${marker} ${taskPrefix}${this._listItemInlineMarkdown(li)}`.trimEnd());

        for (const nested of Array.from(li.children).filter((el) => ["UL", "OL"].includes(el.tagName))) {
          lines.push(...this._listToMarkdownLines(nested, depth + 1));
        }
        number += 1;
      }
      return lines;
    }

    _blockNodeToMarkdownLines(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.nodeValue || "";
        return text.trim() ? [text] : [];
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return [];

      const tag = node.tagName;
      if (/^H[1-6]$/.test(tag)) {
        return [`${"#".repeat(Number(tag.slice(1)))} ${this._inlineNodeToMarkdown(node)}`];
      }
      if (tag === "BLOCKQUOTE") return [`> ${this._inlineNodeToMarkdown(node)}`];
      if (tag === "UL" || tag === "OL") return this._listToMarkdownLines(node);
      if (tag === "PRE") return ["```", node.textContent || "", "```"];
      if (tag === "P") return [this._inlineNodeToMarkdown(node)];

      // Firefox contenteditable can insert DIV wrappers around lists/paragraphs.
      // Recurse through those wrappers instead of flattening them to plain text,
      // otherwise Markdown markers (notably '-' bullets) disappear after reload.
      const blockChildren = Array.from(node.childNodes).filter((child) =>
        child.nodeType === Node.ELEMENT_NODE &&
        (/^H[1-6]$/.test(child.tagName) || ["P", "DIV", "BLOCKQUOTE", "UL", "OL", "PRE"].includes(child.tagName))
      );
      if (blockChildren.length) {
        const lines = [];
        for (const child of node.childNodes) {
          if (child.nodeType === Node.TEXT_NODE) {
            if ((child.nodeValue || "").trim()) lines.push(child.nodeValue || "");
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            lines.push(...this._blockNodeToMarkdownLines(child));
          }
        }
        return lines;
      }

      return [this._inlineNodeToMarkdown(node)];
    }

    _editorToMarkdown(editor) {
      const out = [];
      for (const node of editor.childNodes) {
        out.push(...this._blockNodeToMarkdownLines(node));
      }
      // Preserve meaningful blank lines but never collapse list content into wrappers.
      return out.join("\n").replace(/\n{4,}/g, "\n\n\n").replace(/[ \t]+$/gm, "").replace(/\s+$/, "");
    }

    _bindCreateButton() {
      const button = document.getElementById("zen-create-new-button");
      if (!button || button.dataset.zenNotesBound === "true") return;

      button.dataset.zenNotesBound = "true";
      button.addEventListener("pointerdown", this._onCreateButtonPointer, true);
      button.addEventListener("click", this._onCreateButtonPointer, true);
      this.createButton = button;
    }

    _onCreateButtonPointer() {
      this._expectingCreatePopupUntil = Date.now() + 1800;
    }

    _onPopupShowing(event) {
      const popup = event.target;
      if (!popup || typeof popup.querySelectorAll !== "function") return;
      if (popup.querySelector("#zen-notes-create-menuitem")) return;

      const labels = Array.from(popup.children || [])
        .map((node) => node.getAttribute?.("label") || node.textContent || "")
        .join(" ")
        .toLowerCase();

      const looksLikeZenCreateMenu =
        labels.includes("new tab") &&
        (labels.includes("create space") || labels.includes("create folder"));

      const openedFromCreateButton = Date.now() <= this._expectingCreatePopupUntil;
      if (!openedFromCreateButton && !looksLikeZenCreateMenu) return;

      try {
        const item = document.createXULElement("menuitem");
        item.id = "zen-notes-create-menuitem";
        item.setAttribute("label", "Create Note");
        item.setAttribute("class", "menuitem-iconic");
        item.setAttribute("image", this._noteIconDataURI());
        item.addEventListener("command", () => {
          this.createNote().catch((error) => console.error(LOG, error));
        });

        const children = Array.from(popup.children || []);
        const createFolder = children.find(
          (node) =>
            (node.getAttribute?.("label") || "").trim().toLowerCase() === "create folder"
        );
        const firstSeparator = children.find((node) => node.localName === "menuseparator");

        if (createFolder?.nextSibling) popup.insertBefore(item, createFolder.nextSibling);
        else if (firstSeparator) popup.insertBefore(item, firstSeparator);
        else popup.insertBefore(item, popup.firstChild);
      } catch (error) {
        console.error(LOG, "Could not add Create Note to Zen menu", error);
      }
    }

    _onWindowKeyDown(event) {
      if (event.key !== "Escape") return;
      const page = document.getElementById("zen-notes-page");
      const active = document.activeElement;
      if (!page || page.hidden) return;
      if (active === document.getElementById("zen-notes-page-title") || active === document.getElementById("zen-notes-editor-content")) {
        active.blur();
      }
    }

    _onMutation() {
      if (this._destroyed) return;
      this._bindCreateButton();

      const selectedId = this._idFromTab(gBrowser?.selectedTab);
      if (selectedId && this._getNote(selectedId)) {
        this._ensurePage();
      }
    }

    destroy() {
      this._destroyed = true;
      window.clearTimeout(this.saveTimer);

      document.removeEventListener("popupshowing", this._onPopupShowing, true);
      document.removeEventListener("keydown", this._onWindowKeyDown, true);
      gBrowser?.tabContainer?.removeEventListener("TabSelect", this._onTabSelect);
      gBrowser?.tabContainer?.removeEventListener("TabClose", this._onTabClose);
      this.observer?.disconnect();

      if (this.createButton) {
        this.createButton.removeEventListener("pointerdown", this._onCreateButtonPointer, true);
        this.createButton.removeEventListener("click", this._onCreateButtonPointer, true);
        delete this.createButton.dataset.zenNotesBound;
      }

      const page = document.getElementById("zen-notes-page");
      page?.parentElement?.classList?.remove("zen-notes-page-host");
      page?.remove();
      document.getElementById("zen-notes-create-menuitem")?.remove();
    }
  }

  const controller = new ZenNotesController();
  window.gZenNotes = controller;

  const start = () => controller.init();
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
})();
