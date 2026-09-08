"use strict";

(() => {
  const LOG = "[Zen Notes]";
  const VERSION = "0.2.2-alpha";
  const TAB_URL_PREFIX = "about:blank#zen-note=";

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
      this._onTabAttrModified = this._onTabAttrModified.bind(this);
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
        gBrowser.tabContainer.addEventListener("TabAttrModified", this._onTabAttrModified);

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
      if (!spec.startsWith(TAB_URL_PREFIX)) return null;
      try {
        return decodeURIComponent(spec.slice(TAB_URL_PREFIX.length));
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
      return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M6.75 3.75h7.9l2.6 2.6v13.9H6.75z' fill='none' stroke='%23888' stroke-width='1.7' stroke-linejoin='round'/%3E%3Cpath d='M14.5 3.9v3h2.9M9.2 11h5.7M9.2 14.2h5.7' fill='none' stroke='%23888' stroke-width='1.7' stroke-linecap='round'/%3E%3C/svg%3E";
    }

    _markTab(tab, note) {
      if (!tab || !note || tab.closing) return;

      const title = note.title || "New Note";
      const icon = this._noteIconDataURI();

      if (tab.getAttribute("zen-notes-id") !== note.id) {
        tab.setAttribute("zen-notes-id", note.id);
      }
      // about:blank reports its own title as "New Tab" after addTab(). Keep
      // the visible Zen tab label owned by Zen Notes instead of the content page.
      if (tab.getAttribute("label") !== title || tab.label !== title) {
        tab.setAttribute("label", title);
        tab.label = title;
      }
      if (tab.getAttribute("image") !== icon) tab.setAttribute("image", icon);
      if (tab.getAttribute("zen-notes-tab") !== "true") {
        tab.setAttribute("zen-notes-tab", "true");
      }

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

      // Firefox/Zen can update an about:blank tab title asynchronously after
      // addTab() returns. Re-apply our title after those first title updates.
      requestAnimationFrame(() => this._markTab(tab, note));
      window.setTimeout(() => this._markTab(tab, note), 80);
      window.setTimeout(() => this._markTab(tab, note), 300);

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

    _onTabAttrModified(event) {
      const tab = event.target;
      const id = this._idFromTab(tab);
      const note = id ? this._getNote(id) : null;
      if (!note || tab.closing) return;

      const expectedTitle = note.title || "New Note";
      if (tab.label !== expectedTitle || tab.getAttribute("zen-notes-tab") !== "true") {
        queueMicrotask(() => this._markTab(tab, note));
      }
    }

    async _onTabSelect() {
      const id = this._idFromTab(gBrowser.selectedTab);
      if (id) this._syncTabAppearance(id);
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

        // Render complete inline Markdown after the browser has inserted text.
        // This is more reliable in Zen chrome than depending on keydown alone.
        if (event.inputType === "insertText" && !event.isComposing) {
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
      if (this._applyBlockMarkdownShortcut()) {
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

      if (event.key === " " && !event.metaKey && !event.ctrlKey && !event.altKey) {
        // Fallback for builds where beforeinput is not dispatched in browser chrome.
        if (this._applyBlockMarkdownShortcut()) {
          event.preventDefault();
          this._queueSave();
          return;
        }
      }

      if (event.key === "Enter" && !event.shiftKey) {
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

    _selectionNodeInEditor() {
      const editor = document.getElementById("zen-notes-editor-content");
      const selection = window.getSelection();
      if (!editor || !selection?.rangeCount) return { editor: null, node: null };

      let node = selection.anchorNode;
      if (!node) return { editor, node: null };

      // A collapsed selection can sometimes be anchored on the editor itself.
      if (node === editor) {
        const count = editor.childNodes.length;
        if (!count) return { editor, node: null };
        const offset = Math.max(0, Math.min(selection.anchorOffset, count));
        node = editor.childNodes[Math.min(offset, count - 1)] || editor.lastChild;
      }

      if (!editor.contains(node)) return { editor, node: null };
      return { editor, node };
    }

    _currentTextBlock() {
      const { editor, node: startNode } = this._selectionNodeInEditor();
      if (!editor || !startNode) return null;

      let node = startNode;

      // contenteditable occasionally leaves a bare text node directly under the
      // editor. Wrap it so Markdown shortcuts always operate on a real block.
      if (node.nodeType === Node.TEXT_NODE && node.parentNode === editor) {
        const p = document.createElement("p");
        editor.insertBefore(p, node);
        p.append(node);
        return p;
      }

      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      if (!node) return null;

      let candidate = node;
      while (candidate && candidate !== editor) {
        if (["P", "DIV", "H1", "H2", "H3", "BLOCKQUOTE", "LI"].includes(candidate.tagName)) {
          return candidate;
        }
        candidate = candidate.parentElement;
      }
      return null;
    }

    _currentTopLevelBlock() {
      const editor = document.getElementById("zen-notes-editor-content");
      if (!editor) return null;

      let node = this._currentTextBlock();
      if (!node) return null;
      while (node && node.parentElement !== editor) node = node.parentElement;
      return node && node !== editor ? node : null;
    }

    _applyBlockMarkdownShortcut() {
      const textBlock = this._currentTextBlock();
      if (!textBlock) return false;

      const marker = (textBlock.textContent || "").replace(/\u00a0/g, " ").trim();

      // If Enter already continued a native list, typing "- " / "1. " again
      // should not leave an extra marker inside the bullet. Just consume it.
      if (textBlock.tagName === "LI") {
        const parentTag = textBlock.parentElement?.tagName;
        const redundantBullet = parentTag === "UL" && (marker === "-" || marker === "*");
        const redundantNumber = parentTag === "OL" && /^\d+\.$/.test(marker);
        if (redundantBullet || redundantNumber) {
          textBlock.replaceChildren(document.createElement("br"));
          this._placeCaretAtEnd(textBlock);
          return true;
        }
        return false;
      }

      const block = this._currentTopLevelBlock() || textBlock;
      if (!block) return false;

      if (marker === "#") return !!this._replaceBlock(block, "h1", "");
      if (marker === "##") return !!this._replaceBlock(block, "h2", "");
      if (marker === "###") return !!this._replaceBlock(block, "h3", "");
      if (marker === ">") return !!this._replaceBlock(block, "blockquote", "");
      if (marker === "-" || marker === "*") return !!this._replaceBlockWithList(block, "ul");
      if (/^\d+\.$/.test(marker)) return !!this._replaceBlockWithList(block, "ol");
      return false;
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

    _renderInlineMarkdownInCurrentBlock() {
      const block = this._currentTextBlock() || this._currentTopLevelBlock();
      if (!block || ["UL", "OL", "PRE"].includes(block.tagName)) return false;
      const raw = block.textContent;
      if (!/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/.test(raw)) return false;

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

        const heading = line.match(/^(#{1,3})\s+(.*)$/);
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
            const li = document.createElement("li");
            li.innerHTML = this._inlineMarkdownToHTML(lines[i].replace(/^[-*]\s+/, ""));
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

      if (tag === "BR") return "";
      if (tag === "STRONG" || tag === "B") return `**${inner}**`;
      if (tag === "EM" || tag === "I") return `*${inner}*`;
      if (tag === "CODE") return `\`${inner}\``;
      if (tag === "A") {
        const href = node.getAttribute("href") || "";
        return href ? `[${inner}](${href})` : inner;
      }
      return inner;
    }

    _editorToMarkdown(editor) {
      const out = [];

      for (const node of editor.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.nodeValue?.trimEnd();
          if (text) out.push(text);
          continue;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) continue;

        const tag = node.tagName;
        if (tag === "H1") out.push(`# ${this._inlineNodeToMarkdown(node)}`);
        else if (tag === "H2") out.push(`## ${this._inlineNodeToMarkdown(node)}`);
        else if (tag === "H3") out.push(`### ${this._inlineNodeToMarkdown(node)}`);
        else if (tag === "BLOCKQUOTE") out.push(`> ${this._inlineNodeToMarkdown(node)}`);
        else if (tag === "UL") {
          for (const li of node.children) out.push(`- ${this._inlineNodeToMarkdown(li)}`);
        } else if (tag === "OL") {
          let index = 1;
          for (const li of node.children) {
            out.push(`${index}. ${this._inlineNodeToMarkdown(li)}`);
            index += 1;
          }
        } else if (tag === "PRE") {
          out.push("```");
          out.push(node.textContent || "");
          out.push("```");
        } else {
          out.push(this._inlineNodeToMarkdown(node));
        }
      }

      return out.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "");
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
      gBrowser?.tabContainer?.removeEventListener("TabAttrModified", this._onTabAttrModified);
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
