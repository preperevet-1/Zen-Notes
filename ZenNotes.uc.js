"use strict";

(() => {
  const LOG = "[Zen Notes]";
  const VERSION = "0.14.10-alpha";
  const HTML_NS = "http://www.w3.org/1999/xhtml";
  const NOTE_ICON_SVG = "<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n<path d=\"M6 22C5.46957 22 4.96086 21.7893 4.58579 21.4142C4.21071 21.0391 4 20.5304 4 20V4C4 3.46957 4.21071 2.96086 4.58579 2.58579C4.96086 2.21072 5.46957 2 6 2H14C14.3166 1.99949 14.6301 2.06161 14.9225 2.18277C15.215 2.30394 15.4806 2.48176 15.704 2.706L19.292 6.294C19.5168 6.51751 19.6952 6.78335 19.8167 7.07616C19.9382 7.36898 20.0005 7.68297 20 8V20C20 20.5304 19.7893 21.0391 19.4142 21.4142C19.0391 21.7893 18.5304 22 18 22H6Z\" fill=\"context-fill\"/>\n<path d=\"M15.6443 3.50091C16.6399 4.43015 17.7732 5.52444 18.6889 6.49206C19.2553 7.09058 18.824 8 18 8H15C14.4477 8 14 7.55228 14 7V4.22684C14 3.36399 15.0136 2.91214 15.6443 3.50091Z\" fill=\"context-stroke\" fill-opacity=\"0.55\"/>\n<path d=\"M3 20V4C3 3.20435 3.3163 2.44151 3.87891 1.87891C4.44152 1.3163 5.20435 1 6 1H14V1.00098C14.4479 1.00046 14.8919 1.08734 15.3057 1.25879C15.7193 1.43022 16.0949 1.68198 16.4111 1.99902L19.9971 5.58496L20.1133 5.70605C20.3773 5.99585 20.5896 6.32951 20.7402 6.69238C20.9122 7.1067 21.0005 7.55143 21 8V20C21 20.7956 20.6837 21.5585 20.1211 22.1211C19.5585 22.6837 18.7957 23 18 23H6C5.20435 23 4.44152 22.6837 3.87891 22.1211C3.3163 21.5585 3 20.7956 3 20ZM5 20C5 20.2652 5.10543 20.5195 5.29297 20.707C5.48051 20.8946 5.73478 21 6 21H18C18.2652 21 18.5195 20.8946 18.707 20.707C18.8946 20.5195 19 20.2652 19 20V7.99805C19.0003 7.81344 18.9642 7.6305 18.8936 7.45996C18.8227 7.28915 18.7181 7.13331 18.5869 7.00293L14.9961 3.41211C14.8658 3.28135 14.7106 3.17712 14.54 3.10645C14.3695 3.03581 14.1865 2.99974 14.002 3H6C5.73478 3 5.4805 3.10543 5.29297 3.29297C5.10543 3.4805 5 3.73478 5 4V20Z\" fill=\"context-stroke\"/>\n<path d=\"M14 2V7C14 7.26522 14.1054 7.51957 14.2929 7.70711C14.4804 7.89464 14.7348 8 15 8H20M15 8H20\" stroke=\"context-stroke\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n</svg>\n";
  const MENU_NOTE_ICON = "chrome://global/skin/icons/page-portrait.svg";
  const PDF_ICON = "data:image/svg+xml," + encodeURIComponent("<svg width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n<path d=\"M6 22C5.46957 22 4.96086 21.7893 4.58579 21.4142C4.21071 21.0391 4 20.5304 4 20V4C4 3.46957 4.21071 2.96086 4.58579 2.58579C4.96086 2.21072 5.46957 2 6 2H14C14.3166 1.99949 14.6301 2.06161 14.9225 2.18277C15.215 2.30394 15.4806 2.48176 15.704 2.706L19.292 6.294C19.5168 6.51751 19.6952 6.78335 19.8167 7.07616C19.9382 7.36898 20.0005 7.68297 20 8V20C20 20.5304 19.7893 21.0391 19.4142 21.4142C19.0391 21.7893 18.5304 22 18 22H6Z\" stroke=\"black\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n<path d=\"M14 2V7C14 7.26522 14.1054 7.51957 14.2929 7.70711C14.4804 7.89464 14.7348 8 15 8H20\" stroke=\"black\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n<path d=\"M10 9H8\" stroke=\"black\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n<path d=\"M16 13H8\" stroke=\"black\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n<path d=\"M16 17H8\" stroke=\"black\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>\n</svg>\n");
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
      this._quickNotes = new Map();
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
      this._videoTitles = new Map();
      this._closingNotes = new Set();

      this._onPopupShowing = this._onPopupShowing.bind(this);
      this._onCreateButtonPointer = this._onCreateButtonPointer.bind(this);
      this._onTabSelect = this._onTabSelect.bind(this);
      this._onTabClose = this._onTabClose.bind(this);
      this._onMutation = this._onMutation.bind(this);
      this._onBoostUpdate = this._onBoostUpdate.bind(this);
      this._onNativeBoostButton = this._onNativeBoostButton.bind(this);
      this._onFindShortcut = event => {
        if (event.target?.id === "tab-label-input" && event.key === "Enter" && !event.isComposing) {
          const tab = event.target.closest?.("tab.tabbrowser-tab") || globalThis.gZenVerticalTabsManager?._tabEdited;
          const id = this._idFromTab(tab);
          const title = event.target.value?.replace(/\s+/g, " ").trim();
          if (id && title) {
            this._nativeRename = { tab, id, title };
            window.setTimeout(async () => {
              try { await this._renameNote(id, title); }
              catch (error) { console.error(LOG, error); this._showNotice("Could not rename note"); }
              finally { if (this._nativeRename?.tab === tab) this._nativeRename = null; this._markTab(tab, this._getNote(id)); }
            }, 0);
          }
          return;
        }
        if ((Services.appinfo.OS === "Darwin" ? event.metaKey : event.ctrlKey) && event.shiftKey && event.altKey && (event.code === "KeyN" || (!event.code && event.key.toLowerCase() === "n"))) {
          event.preventDefault(); event.stopImmediatePropagation(); if (!event.repeat) this._createQuickNote().catch(console.error); return;
        }
        if ((event.metaKey || event.ctrlKey) && event.shiftKey && !event.altKey && ["n", "a"].includes(event.key.toLowerCase())) {
          event.preventDefault(); event.stopImmediatePropagation();
          if (event.key.toLowerCase() === "n") this.createNote().catch(console.error);
          else this._addSelectionShortcut().catch(console.error);
          return;
        }
        if (this.currentNoteId && (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "a" && !event.target.closest?.("#urlbar, .zen-notes-find, #zen-notes-page-title")) {
          event.preventDefault(); event.stopImmediatePropagation(); this._selectAll(); return;
        }
        const input = globalThis.gURLBar?.inputField;
        if (event.key === "Enter" && !event.isComposing && !event.metaKey && !event.ctrlKey && !event.altKey && input && (event.target === input || event.composedPath?.().includes(input)) && /^(?:new|create) note$/i.test(input.value.trim())) {
          event.preventDefault(); event.stopImmediatePropagation();
          gURLBar.view?.close();
          this.createNote().catch(error => console.error(LOG, error));
          return;
        }
        if (this.currentNoteId && (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "f") {
          event.preventDefault(); event.stopImmediatePropagation(); this._openFind();
        }
      };
    }

    _reserveNoteShortcuts() {
      this._reservedKeys ||= new Map();
      for (const key of document.querySelectorAll("key")) {
        const letter = (key.getAttribute("key") || "").toLowerCase();
        const modifiers = (key.getAttribute("modifiers") || "").split(/[\s,]+/);
        if (!["n", "a"].includes(letter) || !modifiers.includes("accel") || !modifiers.includes("shift") || (modifiers.includes("alt") && letter !== "n")) continue;
        if (this._reservedKeys.has(key)) continue;
        this._reservedKeys.set(key, key.getAttribute("disabled"));
        key.setAttribute("disabled", "true");
      }
    }

    async init() {
      try {
        await FileIO.makeDirectory(this.storageDir, { ignoreExisting: true });
        await this._migrateDeletedMarkers();
        await this._loadIndex();

        this._reserveNoteShortcuts();
        window.addEventListener("keydown", this._onFindShortcut, true);
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
            if (!tab.classList?.contains("tabbrowser-tab") || tab.closing) continue;
            const note = this._getNote(this._idFromTab(tab));
            if (note?.quick && !tab.closing && tab.hasAttribute("zen-dont-split-glance") && !tab.hasAttribute("zen-glance-tab")) this._promoteQuickNote(note.id).catch(console.error);
            if (note) {
              if (tab.getAttribute("zen-notes-tab") !== "true") this._markTab(tab, note);
              if (tab.getAttribute("image") !== this._filledNoteIcon()) tab.setAttribute("image", this._filledNoteIcon());
              this._tintTabIcon(tab);
            }
            const isBeingRenamed = this._nativeRename?.tab === tab || globalThis.gZenVerticalTabsManager?._tabEdited === tab;
            if (note && !isBeingRenamed && tab.getAttribute("label") !== note.title) {
              tab.setAttribute("label", note.title);
              tab.label = note.title;
            }
          }
        });
        this.titleObserver.observe(document.documentElement, {
          attributes: true, subtree: true, attributeFilter: ["label", "image", "zen-notes-tab", "pending", "zen-empty-tab", "zen-glance-tab", "zen-dont-split-glance"],
        });

        if (ZenBoostsManager && globalThis.Services?.obs) {
          Services.obs.addObserver(this._onBoostUpdate, "zen-boosts-update");
          Services.obs.addObserver(this._onBoostUpdate, "zen-boosts-active-change");
        }

        this._registerPaletteAction();
        this._registerNotesProvider();
        this._bindCreateButton();
        this._onSessionRestored = () => {
          if (this._destroyed) return;
          this._recoverExistingNoteTabs();
          this._syncSelectedTab().then(() => this._renderInactiveNotes()).then(() => this._repairNotePopups()).catch(error => console.error(LOG, error));
        };
        document.addEventListener("SSTabRestored", this._onSessionRestored);
        this._popupRepairTimers = [1000, 3500].map(delay => window.setTimeout(() => this._repairNotePopups().catch(console.error), delay));
        window.addEventListener("SSWindowStateReady", this._onSessionRestored);
        this._recoverExistingNoteTabs();
        // SessionStore restores tabs. An index entry alone must never reopen a note.
        await this._syncSelectedTab();
        this._applyBoost();
        await this._renderInactiveNotes();

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
      this._quickNotes = new Map();
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

    _deletedPath(id) { return Paths.join(this.storageDir, ".deleted", `${id}.deleted`); }

    async _migrateDeletedMarkers() {
      await FileIO.makeDirectory(Paths.join(this.storageDir, ".deleted"), { ignoreExisting: true });
      for (const path of await FileIO.getChildren(this.storageDir)) {
        const name = Paths.filename(path);
        if (!name.endsWith(".deleted") || name === ".deleted") continue;
        try {
        if ((await FileIO.stat(path)).type !== "regular") continue;
        const destination = Paths.join(this.storageDir, ".deleted", name);
        // Keep the marker until its replacement has been written successfully.
        if (!(await FileIO.exists(destination))) await FileIO.writeUTF8(destination, await FileIO.readUTF8(path));
        await FileIO.remove(path, { ignoreAbsent: true });
        } catch (error) {
          if (await FileIO.exists(path)) throw error;
        }
      }
    }

    async _filterDeletedNotes() {
      const keep = [];
      for (const note of this.notes) {
        if (await FileIO.exists(this._deletedPath(note.id)) || !(await FileIO.exists(this._notePath(note.id)))) continue;
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

    _noteFooter(note) {
      const footer = this._html("div"); footer.className = "zen-notes-footer";
      if (!note?.quick && note?.createdAt && Number.isFinite(Date.parse(note.createdAt))) {
        footer.textContent = "Created " + new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(note.createdAt));
      }
      return footer;
    }

    async _createQuickNote() {
      if (this._openingQuickNote) return this._openingQuickNote;
      this._openingQuickNote = this._openQuickNote();
      try { return await this._openingQuickNote; } finally { this._openingQuickNote = null; }
    }

    async _openQuickNote() {
      const manager = window.gZenGlanceManager;
      if (!manager?.openGlance) { this._showNotice("Quick Note is unavailable in this Zen version"); return; }
      const deadline = Date.now() + 2000;
      while (manager.closingGlance && Date.now() < deadline) await new Promise(resolve => window.setTimeout(resolve, 50));
      if (manager.closingGlance) { this._showNotice("Preview is still closing. Please try again."); return; }
      const existing = Array.from(this._quickNotes.values()).find(note => note.tab && !note.tab.closing && !note.discarding);
      if (existing) { gBrowser.selectedTab = existing.tab; return; }
      // Do not replace a website preview which is already open.
      if (Array.from(gBrowser.tabs).some(tab => !tab.closing && tab.hasAttribute("zen-glance-tab"))) { this._showNotice("Close the current preview to open Quick Note"); return; }
      await this._saveCurrentNow();
      const owner = gBrowser.selectedTab;
      const now = new Date().toISOString();
      const note = { id: this._makeId(), title: "Quick Note", body: "", createdAt: now, updatedAt: now, quick: true };
      const tab = gBrowser.addTab("about:blank", { inBackground: true, triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() });
      note.tab = tab; this._quickNotes.set(note.id, note);
      tab.setAttribute("zen-notes-quick", "true"); this._markTab(tab, note); this.noteTabs.set(note.id, tab);
      tab.addEventListener("GlanceClose", () => { note.discarding = true; }, { once: true });
      try {
        manager.lastLinkClickData = { clientX: 0, clientY: 0, width: 0, height: 0 };
        // Mount immediately, before the native opening animation completes.
        const opening = manager.openGlance({ url: "about:blank", triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() }, tab, owner);
        await this._showNote(note.id, { focusTitle: true });
        const openedTab = await opening;
        if (openedTab !== tab && !tab.closing) throw new Error("Glance did not open the draft tab");
        if (!tab.closing && this._quickNotes.has(note.id)) await this._showNote(note.id, { focusTitle: true });
      } catch (error) {
        this._quickNotes.delete(note.id); this.noteTabs.delete(note.id); if (!tab.closing) gBrowser.removeTab(tab);
        this._showNotice("Could not open Quick Note. Please try again."); throw error;
      }
    }

    async _promoteQuickNote(id) {
      const note = this._quickNotes.get(id);
      if (!note || note.discarding || note.tab?.closing) return;
      if (note.promoting) return note.promoting;
      note.promoting = (async () => {
        if (this.currentNoteId === id) await this._saveCurrentNow();
        const saved = { id, title: note.title || "New Note", createdAt: note.createdAt, updatedAt: note.updatedAt,
          compactVideos: note.compactVideos, videoTitles: note.videoTitles };
        await this._enqueueWrite(async () => {
          await FileIO.writeUTF8(this._notePath(id), `# ${saved.title}\n\n${note.body || ""}`);
          this.notes.unshift(saved);
          try { await this._writeIndex(); } catch (error) { this.notes = this.notes.filter(item => item.id !== id); throw error; }
        });
        this._quickNotes.delete(id); note.tab.removeAttribute("zen-notes-quick"); this._markTab(note.tab, saved);
        if (this.currentNoteId === id) document.querySelector("#zen-notes-page .zen-notes-footer")?.replaceWith(this._noteFooter(saved));
        this._showAddedToast(id, "Saved").catch(console.error);
      })();
      try { await note.promoting; } finally { note.promoting = null; }
    }

    _isPDF(bytes) { return bytes.length >= 5 && [37, 80, 68, 70, 45].every((byte, i) => bytes[i] === byte); }

    _pdfInfo(raw) {
      const text = this._expandImages(raw).trim().replace(/\s+\[Source: [^\]]*\]\([^\n]*\)$/, "");
      const markdown = text.match(/^\[([^\]]+)\]\(<?([^\n]+?)>?\)$/);
      const href = markdown ? markdown[2] : text;
      if (/^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/i.test(href)) return { href, name: markdown?.[1] || "Document.pdf" };
      try {
        const url = new URL(href);
        if (!/^https?:$/.test(url.protocol) || !/\.pdf$/i.test(url.pathname)) return null;
        let name = url.pathname.split("/").pop();
        try { name = decodeURIComponent(name); } catch {}
        return { href, name: /\.pdf$/i.test(markdown?.[1] || "") ? markdown[1] : name };
      } catch { return null; }
    }

    _colorMenu(label, property, selection) {
      const menu = document.createXULElement("menu"); menu.setAttribute("label", label);
      const popup = document.createXULElement("menupopup");
      const colors = [["Purple", "#a343c3", "#ead7f4"], ["Pink", "#cc2868", "#f9d5e5"], ["Orange", "#b5590b", "#ffe3c0"], ["Mint", "#087f73", "#c9f1e8"], ["Blue", "#087cc1", "#d4eaff"]];
      popup.append(this._menuItem("Default", () => this._applyTextColor(property, null, selection)), document.createXULElement("menuseparator"));
      for (const [name, foreground, background] of colors) {
        const item = this._menuItem(name, () => this._applyTextColor(property, property === "color" ? foreground : background, selection));
        item.classList.add("menuitem-iconic");
        item.setAttribute("image", "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="6" fill="${foreground}"/></svg>`));
        popup.append(item);
      }
      menu.disabled = !selection || selection.start === selection.end; menu.append(popup); return menu;
    }

    _safeColorStyle(style) {
      return /^(?:(?:color|background-color):#[0-9a-f]{6};?){1,2}$/i.test(style) ? style : null;
    }

    _applyTextColor(property, color, selection) {
      if (!selection || selection.start === selection.end || !["color", "background-color"].includes(property)) return;
      const body = this._editorMarkdown();
      const start = selection.start === 0 ? 0 : body.lastIndexOf("\n", selection.start - 1) + 1;
      const newline = body.indexOf("\n", selection.end);
      const end = newline < 0 ? body.length : newline;
      let absolute = start;
      const replacement = body.slice(start, end).split("\n").map(line => {
        const stack = [{}], pieces = []; let at = 0;
        const prefix = line.match(/^(?:\s*[-*+]\s+(?:\[[ xX]\]\s*)?|\s*\d+[.)]\s+|#{1,6}\s+|>\s?)/)?.[0].length || 0;
        const emit = (text, offset) => {
          const cuts = [...new Set([0, Math.max(0, Math.min(text.length, absolute + prefix - offset)), Math.max(0, Math.min(text.length, selection.start - offset)), Math.max(0, Math.min(text.length, selection.end - offset)), text.length])].sort((a, b) => a - b);
          for (let i = 1; i < cuts.length; i++) {
            const from = cuts[i - 1], to = cuts[i]; if (from === to) continue;
            const style = { ...stack.at(-1) };
            if (offset + from >= Math.max(selection.start, absolute + prefix) && offset + to <= selection.end) {
              if (color) style[property] = color; else delete style[property];
            }
            const css = Object.entries(style).map(([key, value]) => `${key}:${value}`).join(";");
            const content = text.slice(from, to);
            const last = pieces.at(-1);
            if (last?.css === css) last.content += content; else pieces.push({ css, content });
          }
        };
        for (const match of line.matchAll(/<span style="([^"]+)">|<\/span>/g)) {
          if (match[1] && !this._safeColorStyle(match[1]) || !match[1] && stack.length === 1) continue;
          emit(line.slice(at, match.index), absolute + at);
          if (match[1]) {
            const style = { ...stack.at(-1) };
            for (const pair of match[1].split(";").filter(Boolean)) { const [key, value] = pair.split(":"); style[key] = value; }
            stack.push(style);
          } else stack.pop();
          at = match.index + match[0].length;
        }
        emit(line.slice(at), absolute + at); absolute += line.length + 1;
        return pieces.map(({ css, content }) => css ? `<span style="${css}">${content}</span>` : content).join("");
      }).join("\n");
      this._replaceBodySelection(replacement, { start, end });
    }

    _renderColors(text, editing = false) {
      return text.replace(/(&lt;span style=&quot;([^&]+)&quot;&gt;)([\s\S]*?)(&lt;\/span&gt;)/g, (whole, opening, style, content, closing) => {
        if (!this._safeColorStyle(style)) return whole;
        return `${editing ? `<span class="zen-notes-source-marker">${opening}</span>` : ""}<span style="${style}">${content}</span>${editing ? `<span class="zen-notes-source-marker">${closing}</span>` : ""}`;
      });
    }

    _appendBody(body, text, kind = "Text") {
      const left = body, right = text.trim();
      if (!right) return body;
      return left ? left + (left.endsWith("\n") ? "" : kind === "Link" ? "\n" : "\n\n") + right : right;
    }

    _showNotice(text) {
      const manager = window.gZenUIManager;
      if (!manager?.showToast) { console.warn(LOG, text); return; }
      const message = "zen-notes-notice";
      Promise.resolve(manager.showToast(message, { timeout: 5000 })).catch(console.error);
      const toast = Array.from(document.getElementById("zen-toast-container")?.children || []).find(el => el._messageId === message);
      const label = toast?.querySelector("label");
      if (label) { label.removeAttribute("data-l10n-id"); label.textContent = text; }
      toast?.querySelector("button")?.remove(); toast?.removeAttribute("button");
    }

    _startNativeRename(tab) {
      const manager = globalThis.gZenVerticalTabsManager;
      if (!tab || !manager?.renameTabStart) return;
      manager.renameTabStart({ target: tab, type: "command", stopPropagation() {}, preventDefault() {} });
    }

    async _duplicateNote(id) {
      if (this.currentNoteId === id) await this._saveCurrentNow();
      const note = this._getNote(id); if (!note || note.quick) return;
      const data = await this._readNote(note), now = new Date().toISOString();
      const copy = { ...JSON.parse(JSON.stringify(note)), id: this._makeId(), title: `${data.title} copy`, createdAt: now, updatedAt: now };
      await this._enqueueWrite(async () => {
        await FileIO.writeUTF8(this._notePath(copy.id), `# ${copy.title}\n\n${data.body}`);
        this.notes.unshift(copy);
        try { await this._writeIndex(); } catch (error) { this.notes = this.notes.filter(item => item.id !== copy.id); throw error; }
      });
      this._openNoteTab(copy, { select: true });
      await this._showNote(copy.id);
      this._showNotice("Note duplicated");
    }

    async _revealNote(id) {
      if (this.currentNoteId === id) await this._saveCurrentNow();
      if (!id || !(await FileIO.exists(this._notePath(id)))) return;
      const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile);
      file.initWithPath(this._notePath(id));
      try { file.reveal(); } catch { file.parent.launch(); }
    }

    async _renameNote(id, title) {
      if (this.currentNoteId === id) await this._saveCurrentNow();
      const note = this._getNote(id); if (!note) return;
      title = title.replace(/[\r\n]/g, " ").trim() || "New Note";
      if (!note.quick) await this._enqueueWrite(async () => {
        if (!(await FileIO.exists(this._notePath(id))) || await FileIO.exists(this._deletedPath(id))) return;
        const data = await this._readNote(note);
        await FileIO.writeUTF8(this._notePath(id), `# ${title}\n\n${data.body}`);
        note.title = title; note.updatedAt = new Date().toISOString(); await this._writeIndex();
      });
      else note.title = title;
      for (const win of Services.wm.getEnumerator("navigator:browser")) {
        const controller = win.gZenNotes, other = controller?._getNote(id); if (!other) continue;
        other.title = note.title;
        for (const tab of Array.from(win.gBrowser.tabs)) if (controller._idFromTab(tab) === id) {
          controller._markTab(tab, other);
          const previewTitle = controller._getHost(tab)?.querySelector(".zen-notes-preview-title");
          if (previewTitle) previewTitle.textContent = note.title;
        }
        if (controller.currentNoteId === id) {
          const heading = win.document.getElementById("zen-notes-page-title"); if (heading) heading.textContent = note.title;
        }
      }
    }

    _registerNotesProvider() {
      try {
        const { UrlbarProvider } = ChromeUtils.importESModule("moz-src:///browser/components/urlbar/UrlbarUtils.sys.mjs");
        const managers = ChromeUtils.importESModule("moz-src:///browser/components/urlbar/UrlbarProvidersManager.sys.mjs");
        const UrlbarProvidersManager = managers.ProvidersManager?.getInstanceForSap(globalThis.gURLBar?.sapName || "urlbar") || managers.UrlbarProvidersManager;
        if (!UrlbarProvidersManager) throw new Error("URL bar providers manager unavailable");
        const { UrlbarShared } = ChromeUtils.importESModule("chrome://browser/content/urlbar/UrlbarShared.mjs");
        const { UrlbarResult } = ChromeUtils.importESModule("chrome://browser/content/urlbar/UrlbarResult.mjs");
        const { BrowserWindowTracker } = ChromeUtils.importESModule("resource:///modules/BrowserWindowTracker.sys.mjs");
        const native = UrlbarProvidersManager.getProvider("ZenUrlbarProviderGlobalActions");
        const old = UrlbarProvidersManager.getProvider("ZenNotesList"); if (old) UrlbarProvidersManager.unregisterProvider(old);
        class NotesProvider extends UrlbarProvider {
          get name() { return "ZenNotesList"; }
          get type() { return UrlbarShared.PROVIDER_TYPE.HEURISTIC; }
          async isActive(context) { return /^notes(?:\s|$)/i.test((context.searchString || "").trim()); }
          getPriority() { return 1; }
          async startQuery(context, add) {
            const win = BrowserWindowTracker.getTopWindow(), controller = win?.gZenNotes; if (!controller) return;
            this.cancelled = false; const generation = this.generation = (this.generation || 0) + 1;
            await controller._filterDeletedNotes(); if (this.cancelled || generation !== this.generation) return;
            const query = context.searchString.trim().replace(/^notes\s*/i, "").toLocaleLowerCase();
            const matches = controller.notes.filter(note => note.title.toLocaleLowerCase().includes(query));
            const entries = [{ title: "New Note", command: owner => owner.gZenNotes.createNote() }, ...matches.map(note => ({ title: note.title, command: owner => owner.gZenNotes._openLinkedNote(note.id) }))];
            entries.forEach((entry, index) => add(this, new UrlbarResult({ type: UrlbarShared.RESULT_TYPE.DYNAMIC, source: UrlbarShared.RESULT_SOURCE.ZEN_ACTIONS,
              payload: { dynamicType: "zen-actions", zenAction: true, title: entry.title, suggestion: entry.title, query: context.searchString, icon: MENU_NOTE_ICON, zenCommand: entry.command, shortcutContent: index === 0 ? (Services.appinfo.OS === "Darwin" ? "⌘ ⇧ N" : "Ctrl + Shift + N") : "" },
              heuristic: index === 0, suggestedIndex: index })));
          }
          cancelQuery() { this.cancelled = true; this.generation = (this.generation || 0) + 1; }
          getViewUpdate(result) { return native.getViewUpdate(result); }
          getViewTemplate() { return native.getViewTemplate(); }
          onEngagement(context, controller, details) {
            const win = details.element?.documentGlobal || BrowserWindowTracker.getTopWindow();
            if (details.result?.payload?.zenCommand) Promise.resolve(details.result.payload.zenCommand(win)).catch(console.error);
          }
        }
        if (!native) return;
        const provider = new NotesProvider(); UrlbarProvidersManager.registerProvider(provider);
        this._unregisterNotesProvider = () => { if (UrlbarProvidersManager.getProvider(provider.name) === provider) UrlbarProvidersManager.unregisterProvider(provider); };
      } catch (error) { console.error(LOG, "Notes search registration failed", error); }
    }

    _imageMatches(raw) { return Array.from(raw.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)); }

    _imageWidthRaw(raw, index, width) {
      let current = 0; width = Math.round(Math.max(64, Math.min(1600, width)));
      return raw.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (all, alt, url) => current++ === index ? `![${alt.replace(/\|width=\d+$/, "")}|width=${width}](${url})` : all);
    }

    _resizeImage(line, index, width) {
      if (!line?.isConnected) return;
      this._recordHistory(); line.dataset.raw = this._imageWidthRaw(line.dataset.raw || "", index, width);
      this._renderLine(line); this._queueSave();
    }

    _imagePointer(event) {
      const frame = event.target.closest?.(".zen-notes-image-frame");
      if (!frame || event.button !== 0 || event.target.closest?.(".zen-notes-table-cell")) return;
      const imageLine = frame.closest(".zen-notes-line");
      if (imageLine) imageLine._suppressMouseFocusUntil = Date.now() + 1000;
      event.preventDefault(); event.stopImmediatePropagation();
      const handle = event.target.closest?.(".zen-notes-image-resize");
      if (!handle) return;
      const line = frame.closest(".zen-notes-line"), index = Number(frame.dataset.imageIndex), id = this.currentNoteId;
      const start = event.clientX, width = frame.getBoundingClientRect().width, original = line.dataset.raw;
      this._recordHistory(); handle.setPointerCapture?.(event.pointerId);
      const move = e => { if (this.currentNoteId === id && line.isConnected) frame.style.width = `${Math.min(1600, Math.max(64, width + e.clientX - start))}px`; };
      const finish = e => {
        if (imageLine) imageLine._suppressMouseFocusUntil = Date.now() + 600;
        handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", finish); handle.removeEventListener("pointercancel", finish);
        if (this.currentNoteId !== id || line.dataset.raw !== original) return;
        if (e.type === "pointercancel") frame.style.width = `${width}px`; else this._resizeImage(line, index, width + e.clientX - start);
      };
      handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", finish); handle.addEventListener("pointercancel", finish);
    }

    _notePath(id) { return Paths.join(this.storageDir, `${id}.md`); }
    _noteURL(id) { return `${TAB_URL_PREFIX}${encodeURIComponent(id)}`; }
    _getNote(id) { return this.notes.find((note) => note.id === id) || this._quickNotes.get(id) || null; }

    _idFromTab(tab) {
      if (tab?.hasAttribute?.("zen-glance-tab") && !tab.hasAttribute("zen-notes-quick")) return null;
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
      await this._saveCurrentNow();
      const now = new Date().toISOString();
      const note = { id: this._makeId(), title: "New Note", createdAt: now, updatedAt: now };
      await FileIO.writeUTF8(this._notePath(note.id), "# New Note\n\n");
      this.notes.unshift(note);
      await this._writeIndex();

      this._creatingNote = true;
      try {
        const tab = this._openNoteTab(note, { select: true });
        this.noteTabs.set(note.id, tab);
        await this._showNote(note.id, { focusTitle: true });
      } finally { this._creatingNote = false; }
      await this._syncSelectedTab();
      return note;
    }

    async _readNote(note) {
      if (note.quick) return { title: note.title, body: note.body || "" };
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
      this._updatePlaceholder();
      this._recordHistory();
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
      const body = this._expandImages(this._editorMarkdown());
      note.title = noteTitle;
      note.updatedAt = new Date().toISOString();
      if (note.quick) { note.body = body; this._syncTabAppearance(note.id); return; }

      await this._enqueueWrite(async () => {
        if (this._closingNotes.has(note.id) || await FileIO.exists(this._deletedPath(note.id)) || !(await FileIO.exists(this._notePath(note.id)))) { await this._filterDeletedNotes(); return; }
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

    _filledNoteIcon() { return "data:image/svg+xml," + encodeURIComponent(NOTE_ICON_SVG); }

    _markTab(tab, note) {
      if (!tab || !note) return;
      if (this._nativeRename?.tab === tab || globalThis.gZenVerticalTabsManager?._tabEdited === tab) return;
      tab.setAttribute("zen-notes-id", note.id);
      tab.setAttribute("zen-notes-tab", "true");
      tab.linkedBrowser?.setAttribute("zen-notes-content", "true");
      tab.zenStaticLabel = note.title || "New Note";
      tab.setAttribute("label", note.title || "New Note");
      tab.label = note.title || "New Note";
      tab.setAttribute("image", this._filledNoteIcon());
      this._tintTabIcon(tab);
      try { if (!note.quick) SessionStoreAPI?.setCustomTabValue?.(tab, "zen-notes-id", note.id); } catch {}
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
      const paint = window.getComputedStyle(icon);
      const fill = paint.fill && paint.fill !== "none" ? paint.fill : "#dbe4f4";
      const stroke = paint.stroke && paint.stroke !== "none" ? paint.stroke : "#46536e";
      const svg = decodeURIComponent(this._filledNoteIcon().split(",")[1]).replaceAll("context-fill", fill).replaceAll("context-stroke", stroke);
      icon.style.setProperty("content", `url("data:image/svg+xml,${encodeURIComponent(svg)}")`, "important");
      for (const name of ["fill", "fill-opacity", "stroke", "stroke-opacity", "color", "opacity", "-moz-context-properties"]) icon.style.removeProperty(name);
    }

    _openNoteTab(note, { select = false, background = false } = {}) {
      let tab;
      const url = this._noteURL(note.id);
      try {
        const principal = Services?.scriptSecurityManager?.getSystemPrincipal?.();
        tab = gBrowser.addTab(url, {
          skipAnimation: true,
          inBackground: true,
          triggeringPrincipal: principal,
        });
      } catch {
        tab = gBrowser.addTab(url, { skipAnimation: true, inBackground: true });
      }
      this._markTab(tab, note);
      this.noteTabs.set(note.id, tab);
      if (select) gBrowser.selectedTab = tab;
      return tab;
    }

    _recoverExistingNoteTabs() {
      for (const tab of (globalThis.gZenWorkspaces?.allStoredTabs || gBrowser.tabs)) {
        if (tab.closing) continue;
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

    async _onTabSelect() {
      const tab = gBrowser.selectedTab;
      const note = this._getNote(this._idFromTab(tab));
      if (note) this._markTab(tab, note);
      if (!this._creatingNote) await this._syncSelectedTab();
    }

    async _onTabClose(event) {
      const tab = event.target;
      const id = this._idFromTab(tab);
      if (this._quickNotes.has(id)) { this._quickNotes.delete(id); this.noteTabs.delete(id); this._histories.delete(id); this._showNotice("Quick note discarded"); return; }
      if (this._closingNotes.has(id)) return;
      if (!id || window.closed || globalThis.gBrowser?.closing || event.detail?.adoptedBy) return;
      // Native TabClose is dispatched for removal; pinned unload/reset does not
      // dispatch it. Do not infer cancellation from DOM connectivity/animation.
      for (const win of Services.wm.getEnumerator("navigator:browser")) {
        if (Array.from(win.gZenWorkspaces?.allStoredTabs || win.gBrowser?.tabs || []).some(other => other !== tab && !other.closing && this._idFromTab(other) === id)) return;
      }
      await this._deleteNote(id);
      this._showNotice("Note deleted");
    }

    async _syncSelectedTab() {
      const selected = gBrowser.selectedTab;
      await this._filterDeletedNotes();
      if (selected !== gBrowser.selectedTab) return;
      const id = this._idFromTab(gBrowser.selectedTab);
      if (!id || !this._getNote(id)) {
        if (this.currentNoteId) await this._saveCurrentNow();
        if (selected !== gBrowser.selectedTab) return;
        this._hidePage();
        this.currentNoteId = null;
        return;
      }
      if (this.currentNoteId === id && !document.getElementById("zen-notes-page")?.hidden) return;
      if (this.currentNoteId && this.currentNoteId !== id) await this._saveCurrentNow();
      if (selected !== gBrowser.selectedTab) return;
      await this._showNote(id);
    }

    _getHost(tab = gBrowser.selectedTab) {
      return tab?.linkedBrowser?.closest?.(".browserStack") || tab?.linkedBrowser?.parentElement || null;
    }

    _parkEditor() {
      const page = document.getElementById("zen-notes-page");
      if (!page || page.hidden || !page.parentElement) return;
      this._commitActiveLine();
      const host = page.parentElement;
      host.querySelector(".zen-notes-page-preview")?.remove();
      const copy = page.cloneNode(true);
      copy.querySelector("#zen-notes-selection-toolbar")?.remove();
      copy.removeAttribute("id"); copy.classList.add("zen-notes-page-preview");
      for (const el of copy.querySelectorAll("[id]")) {
        if (el.id === "zen-notes-editor") el.classList.add("zen-notes-preview-editor");
        if (el.id === "zen-notes-page-title") el.classList.add("zen-notes-preview-title");
        el.removeAttribute("id");
      }
      for (const el of copy.querySelectorAll("[contenteditable]")) el.removeAttribute("contenteditable");
      copy.querySelector(".zen-notes-find")?.remove();
      const id = this.currentNoteId;
      copy.addEventListener("pointerdown", event => {
        event.preventDefault(); this._openLinkedNote(id);
        this._syncSelectedTab().catch(console.error);
      });
      host.append(copy);
      copy.querySelector(".zen-notes-page-scroll").scrollTop = page.querySelector(".zen-notes-page-scroll").scrollTop;
    }

    async _renderInactiveNotes() {
      for (const tab of Array.from(gBrowser.tabs)) {
        const id = this._idFromTab(tab), note = this._getNote(id), host = this._getHost(tab);
        if (!note || !host || tab === gBrowser.selectedTab || host.querySelector(".zen-notes-page-preview")) continue;
        const data = await this._readNote(note);
        if (this._destroyed || tab.closing || tab === gBrowser.selectedTab || host.querySelector(".zen-notes-page-preview")) continue;
        const preview = this._html("div"); preview.className = "zen-notes-page-preview";
        const scroll = this._html("div"); scroll.className = "zen-notes-page-scroll";
        const canvas = this._html("div"); canvas.className = "zen-notes-page-canvas";
        const title = this._html("h1"); title.className = "zen-notes-preview-title"; title.textContent = data.title;
        const body = this._html("div"); body.className = "zen-notes-preview-editor";
        canvas.append(title, body);
        const previous = this.currentNoteId;
        try {
          this.currentNoteId = id;
          for (const raw of data.body.split("\n")) {
            const line = this._makeLine(raw); line.removeAttribute("contenteditable"); body.append(line);
          }
          this._renderAllLines(body);
        } finally { this.currentNoteId = previous; }
        scroll.append(canvas); preview.append(scroll, this._noteFooter(note)); this._applyBoost(preview, id);
        preview.addEventListener("pointerdown", event => { event.preventDefault(); this._openLinkedNote(id); this._syncSelectedTab().catch(console.error); });
        host.classList.add("zen-notes-page-host"); host.setAttribute("zen-notes-active", "true"); host.append(preview);
      }
    }

    async _repairNotePopups() {
      if (this._repairingPopups) return;
      if (window.toolbar?.visible === false) {
        const target = Array.from(Services.wm.getEnumerator("navigator:browser")).find(win => win !== window && !win.closed && win.toolbar?.visible !== false && win.gZenNotes);
        if (target) await target.gZenNotes._repairNotePopups();
        return;
      }
      this._repairingPopups = true;
      try {
        for (const win of Services.wm.getEnumerator("navigator:browser")) {
          if (win === window || win.closed || win.toolbar?.visible !== false || !win.gBrowser) continue;
          const tabs = Array.from(win.gBrowser.tabs);
          if (!tabs.length || tabs.some(tab => !this._idFromTab(tab))) continue;
          for (const tab of tabs) {
            const id = this._idFromTab(tab);
            if (await FileIO.exists(this._notePath(id))) {
              gBrowser.adoptTab(tab, gBrowser.tabs.length, false);
            } else {
              // Only obsolete note tabs, never unrelated pages or existing files.
              win.gZenNotes?._closingNotes.add(id);
              win.gBrowser.removeTab(tab, { animate: false });
            }
          }
          if (!win.closed && Array.from(win.gBrowser.tabs).every(tab => !this._idFromTab(tab) && ["about:blank", "about:home", "about:newtab"].includes(tab.linkedBrowser.currentURI.spec))) win.close();
        }
        this._recoverExistingNoteTabs();
      } finally { this._repairingPopups = false; }
    }

    _ensurePage() {
      const host = this._getHost();
      if (!host) return false;
      let page = document.getElementById("zen-notes-page");
      if (page) {
        if (page.parentElement !== host) {
          this._parkEditor();
          page.hidden = true;
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
      title.spellcheck = false;
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

      page.addEventListener("dragover", event => {
        if (Array.from(event.dataTransfer?.types || []).includes("Files")) { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }
      });
      page.addEventListener("drop", event => this._dropImages(event).catch(error => console.error(LOG, error)));
      page.addEventListener("keydown", event => this._pageKeys(event), true);
      editor.addEventListener("keydown", event => {
        if (event.target !== editor) return;
        event.stopPropagation();
        if (event.metaKey || event.ctrlKey) return;
        const selection = this._bodySelection();
        if (selection && ["Backspace", "Delete", "Enter"].includes(event.key)) {
          event.preventDefault();
          if (selection.start === selection.end && event.key !== "Enter") {
            const body = this._editorMarkdown();
            if (event.key === "Backspace") selection.start -= [...body.slice(0, selection.start)].at(-1)?.length || 0;
            else selection.end += [...body.slice(selection.end)][0]?.length || 0;
          }
          this._replaceBodySelection(event.key === "Enter" ? "\n\n" : "", selection);
        }
      });
      editor.addEventListener("paste", event => { if (event.target === editor) this._pastePlainText(event); });
      page.addEventListener("beforeinput", event => {
        if (event.inputType === "historyUndo" || event.inputType === "historyRedo") {
          event.preventDefault(); this._undo(event.inputType === "historyRedo"); return;
        }
        if (event.target.closest?.(".zen-notes-table-cell")) return;
        const selected = this._bodySelection();
        const range = window.getSelection().rangeCount ? window.getSelection().getRangeAt(0) : null;
        if (!selected || !range) return;
        const visual = editor.hasAttribute("contenteditable");
        if (!visual && (selected.start === selected.end || range.startContainer === range.endContainer)) return;
        if (event.inputType.startsWith("delete") || ["insertText", "insertParagraph", "insertLineBreak"].includes(event.inputType)) {
          event.preventDefault();
          if (selected.start === selected.end && event.inputType.startsWith("delete")) {
            const body = this._editorMarkdown();
            if (event.inputType.endsWith("Backward")) selected.start -= [...body.slice(0, selected.start)].at(-1)?.length || 0;
            else selected.end += [...body.slice(selected.end)][0]?.length || 0;
          }
          const text = ["insertParagraph", "insertLineBreak"].includes(event.inputType) ? "\n" : event.data || "";
          this._replaceBodySelection(text, selected);
        }
      }, true);
      page.addEventListener("copy", event => {
        const selected = window.getSelection()?.toString() || "";
        const expanded = this._expandImages(selected);
        if (expanded !== selected && event.clipboardData) {
          event.clipboardData.setData("text/plain", expanded);
          event.preventDefault();
        }
      });
      page.addEventListener("contextmenu", event => this._editorContextMenu(event));
      page.addEventListener("pointerdown", event => this._imagePointer(event), true);
      editor.setAttribute("data-placeholder", "Your best ideas here…");
      this._selectionChanged ||= () => this._updateSelectionToolbar();
      document.addEventListener("selectionchange", this._selectionChanged);
      scroll.addEventListener("scroll", () => this._updateSelectionToolbar());
      page.addEventListener("cut", event => {
        if (!editor.hasAttribute("contenteditable")) return;
        const selected = this._bodySelection();
        if (selected && selected.start !== selected.end && event.clipboardData) {
          event.preventDefault(); event.clipboardData.setData("text/plain", window.getSelection().toString());
          this._replaceBodySelection("", selected);
        }
      });
      canvas.append(title, editor);
      scroll.append(canvas);
      page.append(scroll, this._noteFooter(null));
      host.append(page);
      return true;
    }

    _setPlainEditable(el) {
      el.spellcheck = false;
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
      this._parkEditor();
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
      page.querySelector(".zen-notes-footer")?.replaceWith(this._noteFooter(note));
      this._loadingPage = true;
      this._activeLine = null;
      title.textContent = data.title || "New Note";
      editor.replaceChildren();

      const normalizedBody = data.body.replace(/\n+Source: \[([^\]]*)\]\(([^\n]+)\)/g, " [Source: $1]($2)");
      const lines = normalizedBody === "" ? [""] : normalizedBody.split("\n");
      for (const raw of lines) editor.append(this._makeLine(raw));
      this._renderAllLines();

      note.title = data.title || note.title || "New Note";
      this._syncTabAppearance(id);
      const host = this._getHost();
      host?.setAttribute?.("zen-notes-active", "true");
      page.hidden = false;
      host?.querySelector(".zen-notes-page-preview")?.remove();
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
      this._parkEditor();
      this._clearFind();
      this._commitActiveLine();
      const page = document.getElementById("zen-notes-page");
      if (page) page.hidden = true;
      const host = page?.parentElement;
      if (!host?.querySelector(".zen-notes-page-preview")) host?.removeAttribute?.("zen-notes-active");
    }

    // Short editor references keep selection/caret offsets small. The portable
    // Markdown on disk still contains the original bytes; no external file can go missing.
    _compactImages(raw) {
      this._imageSources ||= new Map();
      this._imageAliases ||= new Map();
      return raw.replace(/data:(?:image\/(?:png|jpeg|gif|webp)|application\/pdf);base64,[A-Za-z0-9+/=]+/gi, source => {
        if (!this._imageAliases.has(source)) {
          const alias = `${source.startsWith("data:application/pdf") ? "zen-pdf" : "zen-image"}:${this._imageSources.size + 1}`;
          this._imageAliases.set(source, alias);
          this._imageSources.set(alias, source);
        }
        return this._imageAliases.get(source);
      });
    }

    _expandImages(raw) {
      return raw.replace(/zen-(?:image|pdf):\d+\b/g, alias => this._imageSources?.get(alias) || alias);
    }

    _makeLine(raw = "") {
      raw = this._compactImages(raw);
      const line = this._html("div");
      line.className = "zen-notes-line";
      line.dataset.raw = raw;
      this._setPlainEditable(line);
      line.spellcheck = false;

      line.addEventListener("pointerdown", (event) => this._onLinePointerDown(event, line));
      line.addEventListener("mousedown", event => { if (event.button === 2 || event.target.closest?.(".zen-notes-image-frame") || line._suppressMouseFocusUntil > Date.now()) event.preventDefault(); });
      line.addEventListener("click", event => { if (line._suppressMouseFocusUntil > Date.now()) { event.preventDefault(); event.stopPropagation(); } });
      line.addEventListener("focus", () => { if (line._suppressMouseFocusUntil > Date.now()) { line.blur(); return; } this._activateLine(line); });
      line.addEventListener("blur", () => {
        // Delay so clicks on task checkbox can complete before render.
        window.setTimeout(() => {
          if (!this._contextMenuOpen && !this._mouseSelecting && !line.parentElement?.hasAttribute("contenteditable") && document.activeElement !== line) this._commitLine(line);
        }, 0);
      });
      line.addEventListener("input", (event) => {
        line.dataset.raw = this._lineText(line);
        this._classifyLine(line, line.dataset.raw, false);
        if (!event.isComposing) this._refreshInline(line);
        this._queueSave();
      });
      line.addEventListener("keyup", event => { if (!event.isComposing && !event.metaKey && !event.ctrlKey) this._refreshInline(line); });
      line.addEventListener("compositionend", () => this._refreshInline(line));
      line.addEventListener("keydown", (event) => this._onLineKeyDown(event, line));
      line.addEventListener("paste", (event) => this._pastePlainText(event));
      return line;
    }

    _lineText(line) {
      return (line.textContent || "").replace(/\u00a0/g, " ").replace(/\r?\n/g, "");
    }

    _onLinePointerDown(event, line) {
      if (event.target.closest?.(".zen-notes-table-wrap")) return;
      if (event.button === 0 && line.classList.contains("is-empty-code")) {
        event.preventDefault(); event.stopPropagation(); this._recordHistory();
        const blank = this._makeLine(""); line.after(blank); this._renderAllLines(); this._focusLine(blank, 0); this._queueSave(); return;
      }
      if (event.button === 0) this._endWholeSelection();
      if (event.button !== 0) {
        // Cancel the focus default without cancelling the subsequent contextmenu.
        if (event.button === 2) event.preventDefault();
        return;
      }
      const link = event.target?.closest?.(".zen-notes-link, .zen-notes-wikilink");
      const spoiler = event.target?.closest?.(".zen-notes-spoiler");
      if (spoiler) { event.preventDefault(); spoiler.classList.toggle("is-revealed"); return; }
      const checkbox = event.target?.closest?.(".zen-notes-task-checkbox");
      if (checkbox) {
        line._suppressMouseFocusUntil = Date.now() + 600;
        this._recordHistory();
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
      const rawOffset = this._rawOffsetFromPointer(line, event.clientX, event.clientY);
      event.preventDefault();
      event.stopPropagation();
      line._suppressMouseFocusUntil = Date.now() + 600;
      this._startMouseSelection(event, line, rawOffset, link ? () => this._followLink(link, event.altKey).catch(error => console.error(LOG, error)) : null);
    }

    _startMouseSelection(event, line, rawOffset, clickAction = null) {
      this._cancelMouseSelection?.();
      const editor = line.parentElement, id = this.currentNoteId;
      const startX = event.clientX, startY = event.clientY;
      let prepared = false, anchor;
      const prepare = () => {
        if (prepared) return;
        this._mouseSelecting = true;
        this._prepareVisualSelection();
        const content = line.querySelector(".zen-notes-list-content") || line;
        const map = this._lineDisplayMap(line);
        const visible = map.offsets.filter(offset => offset < rawOffset).length;
        anchor = this._textPoint(content, visible);
        prepared = true;
      };
      const move = e => {
        if (!(e.buttons & 1) || this.currentNoteId !== id || !line.isConnected) { finish(); return; }
        if (!prepared && Math.hypot(e.clientX - startX, e.clientY - startY) < 4) return;
        e.preventDefault(); prepare();
        let position = document.caretPositionFromPoint?.(e.clientX, e.clientY);
        if (!position || !editor.contains(position.offsetNode)) {
          const bounds = editor.getBoundingClientRect();
          position = document.caretPositionFromPoint?.(Math.max(bounds.left + 1, Math.min(bounds.right - 1, e.clientX)), Math.max(bounds.top + 1, Math.min(bounds.bottom - 1, e.clientY)));
        }
        if (position && editor.contains(position.offsetNode)) window.getSelection().setBaseAndExtent(anchor.node, anchor.offset, position.offsetNode, position.offset);
      };
      const finish = e => {
        window.removeEventListener("pointermove", move, true); window.removeEventListener("pointerup", finish, true); window.removeEventListener("pointercancel", finish, true);
        this._mouseSelecting = false; this._cancelMouseSelection = null;
        if (e?.type === "pointerup" && this.currentNoteId === id && line.isConnected) {
          if (!prepared) {
            const now = Date.now(), double = this._lastNoteClick?.line === line && now - this._lastNoteClick.time < 400;
            this._lastNoteClick = { line, time: now };
            if (double) {
              prepare(); this._mouseSelecting = false;
              const content = line.querySelector(".zen-notes-list-content") || line;
              const text = content.textContent || "", map = this._lineDisplayMap(line);
              let start = map.offsets.filter(offset => offset < rawOffset).length, end = start;
              while (start > 0 && /[\p{L}\p{N}_]/u.test(text[start - 1])) start--;
              while (end < text.length && /[\p{L}\p{N}_]/u.test(text[end])) end++;
              const a = this._textPoint(content, start), b = this._textPoint(content, end);
              window.getSelection().setBaseAndExtent(a.node, a.offset, b.node, b.offset);
            } else if (clickAction) clickAction();
            else { line._suppressMouseFocusUntil = 0; this._focusLine(line, rawOffset); }
          }
          this._updateSelectionToolbar();
        }
      };
      this._cancelMouseSelection = finish;
      window.addEventListener("pointermove", move, true); window.addEventListener("pointerup", finish, true); window.addEventListener("pointercancel", finish, true);
    }

    _textPoint(root, offset) {
      const walker = document.createTreeWalker(root, 4);
      let node, last;
      while ((node = walker.nextNode())) {
        last = node;
        if (offset <= node.textContent.length) return { node, offset };
        offset -= node.textContent.length;
      }
      return last ? { node: last, offset: last.textContent.length } : { node: root, offset: 0 };
    }

    _prepareVisualSelection() {
      if (this._activeCell) this._commitTableCell(this._activeCell);
      const editor = document.getElementById("zen-notes-editor");
      for (const line of editor.children) {
        if (line.classList.contains("is-editing")) this._commitLine(line);
        line.removeAttribute("contenteditable");
      }
      this._activeLine = null;
      this._setPlainEditable(editor);
      editor.focus({ preventScroll: true });
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
      return line.classList.contains("is-editing") || line.dataset.codeBlock === "true" || line.dataset.mathBlock === "true" ? visibleOffset : this._visibleOffsetToRaw(raw, visibleOffset);
    }

    // Display offsets point to original source characters, including nested styling.
    // Mapping the complete source avoids counting incomplete Markdown prefixes.
    _lineDisplayMap(line) {
      const raw = line.dataset.raw || "";
      return line.dataset.codeBlock === "true" || line.dataset.mathBlock === "true"
        ? { text: raw, offsets: Array.from({ length: raw.length }, (_, index) => index), prefix: 0 }
        : this._displayMap(raw);
    }

    _displayMap(raw) {
      let text = "", offsets = [];
      const prefix = raw.match(/^(?:\s*[-*+]\s+(?:\[[ xX]\]\s*)?|\s*\d+[.)]\s+|#{1,6}\s+|>\s?)/)?.[0].length || 0;
      const walk = (part, base) => {
        for (let i = 0; i < part.length;) {
          const rest = part.slice(i);
          const tag = rest.match(/^(?:<span style="([^"]+)">|<\/span>|<\/?u>)/);
          if (tag && (!tag[1] || this._safeColorStyle(tag[1]))) { i += tag[0].length; continue; }
          const comment = rest.match(/^<!--(.*?)-->/);
          if (comment) { walk(comment[1], base + i + 4); i += comment[0].length; continue; }
          const footnote = rest.match(/^\[\^([^\]]+)\]/);
          if (footnote) { walk(footnote[1], base + i + 2); i += footnote[0].length; continue; }
          const link = rest.match(/^\[([^\]]+)\]\([^)]*\)/);
          const wiki = rest.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
          const pair = rest.match(/^(\*\*|__|~~|==|\|\||`|\*|_|\$)(.+?)\1/);
          if (link) { walk(link[1], base + i + 1); i += link[0].length; continue; }
          if (wiki) { const label = wiki[2] || wiki[1]; walk(label, base + i + 2 + (wiki[2] ? wiki[1].length + 1 : 0)); i += wiki[0].length; continue; }
          if (pair) {
            if (["`", "$"].includes(pair[1])) {
              for (let j = 0; j < pair[2].length; j++) { offsets.push(base + i + pair[1].length + j); text += pair[2][j]; }
            } else walk(pair[2], base + i + pair[1].length);
            i += pair[0].length; continue;
          }
          if (rest[0] === "\\" && /[\\`*{}\[\]()#+.!_>~-]/.test(rest[1] || "")) { i++; }
          offsets.push(base + i); text += part[i++];
        }
      };
      walk(raw.slice(prefix), prefix);
      return { text, offsets, prefix };
    }

    _visibleTextForRaw(raw) { return this._displayMap(raw).text; }

    _visibleOffsetToRaw(raw, visibleOffset, end = false) {
      const map = this._displayMap(raw);
      if (end && visibleOffset > 0) return (map.offsets[Math.min(visibleOffset, map.offsets.length) - 1] ?? raw.length - 1) + 1;
      return map.offsets[visibleOffset] ?? (visibleOffset === 0 ? map.prefix : raw.length);
    }

    _activateLine(line) {
      if (!line || line.dataset.tableOwner !== undefined) return;
      if (this._activeLine && this._activeLine !== line) this._commitLine(this._activeLine);
      if (this._activeLine === line && line.classList.contains("is-editing")) return;
      const raw = line.dataset.raw ?? "";
      line.replaceChildren(document.createTextNode(raw));
      line.classList.add("is-editing");
      this._classifyLine(line, raw, false);
      this._activeLine = line;
      this._updateCodeEditing();
    }

    _commitLine(line) {
      if (!line) return;
      if (line.classList.contains("is-editing")) line.dataset.raw = this._lineText(line);
      line.classList.remove("is-editing");
      if (this._activeLine === line) this._activeLine = null;
      this._renderLine(line);
      this._updateCodeEditing();
    }

    _commitActiveLine() {
      if (this._activeCell) this._commitTableCell(this._activeCell);
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

    _parseTableRow(raw) {
      const delimiters = [];
      for (let i = 0; i < raw.length; i++) if (raw[i] === "|") {
        let slashes = 0; for (let j = i - 1; j >= 0 && raw[j] === "\\"; j--) slashes++;
        if (!(slashes % 2)) delimiters.push(i);
      }
      if (!delimiters.length) return null;
      const edges = [-1, ...delimiters, raw.length], cells = [];
      for (let i = 1; i < edges.length; i++) {
        const from = edges[i - 1] + 1, to = edges[i], part = raw.slice(from, to);
        if ((i === 1 || i === edges.length - 1) && !part.trim()) continue;
        const start = from + (part.match(/^\s*/)?.[0].length || 0), value = part.trim();
        cells.push({ value, start: Math.min(start, to), end: Math.min(start, to) + value.length });
      }
      return cells.length ? cells : null;
    }

    _tableModel(raws, start) {
      const header = this._parseTableRow(raws[start] || ""), divider = this._parseTableRow(raws[start + 1] || "");
      if (!header || !divider || header.length !== divider.length || !divider.every(cell => /^:?-{2,}:?$/.test(cell.value))) return null;
      const rows = [header.map(c => c.value)], sourceRows = [0];
      let end = start + 1, columns = header.length;
      for (let i = start + 2; i < raws.length; i++) {
        const row = this._parseTableRow(raws[i]); if (!row) break;
        rows.push(row.map(c => c.value)); sourceRows.push(i - start); columns = Math.max(columns, row.length); end = i;
      }
      for (const row of rows) while (row.length < columns) row.push("");
      const align = Array.from({ length: columns }, (_, i) => {
        const value = divider[i]?.value || "---";
        return value.startsWith(":") && value.endsWith(":") ? "center" : value.endsWith(":") ? "right" : "left";
      });
      return { start, end, rows, sourceRows, align, columns };
    }

    _serializeTable(model) {
      const row = cells => "| " + cells.join(" | ") + " |";
      return [row(model.rows[0]), row(model.align.map(a => a === "center" ? ":---:" : a === "right" ? "---:" : "---")), ...model.rows.slice(1).map(row)].join("\n");
    }

    _tableAt(start) {
      const editor = document.getElementById("zen-notes-editor");
      return editor ? this._tableModel(Array.from(editor.children, line => line.dataset.raw || ""), start) : null;
    }

    _cellDisplay(raw) { return raw.replace(/\\\|/g, "|"); }
    _cellSource(text) { return text.replace(/\r?\n/g, "<br>").replace(/(?<!\\)\|/g, "\\|"); }

    _renderTable(line, model, interactive = true) {
      if (this._activeCell && line.contains(this._activeCell)) return;
      const wrap = this._html("div"); wrap.className = "zen-notes-table-wrap";
      wrap.setAttribute("contenteditable", "false"); wrap.dataset.tableStart = model.start;
      const table = this._html("table"), body = this._html("tbody");
      table.className = "zen-notes-table";
      model.rows.forEach((row, rowIndex) => {
        const tr = this._html("tr");
        row.forEach((raw, column) => {
          const td = this._html(rowIndex ? "td" : "th"), cell = this._html("div");
          cell.className = "zen-notes-table-cell"; cell.dataset.tableStart = model.start;
          cell.dataset.tableRow = model.sourceRows[rowIndex]; cell.dataset.tableColumn = column;
          cell.dataset.cellRaw = raw; cell.setAttribute("aria-label", `Row ${rowIndex + 1}, column ${column + 1}`);
          td.style.textAlign = model.align[column];
          cell.innerHTML = this._inline(this._cellDisplay(raw)).replace(/&lt;br\s*\/?&gt;/g, "<br/>") || "<br/>";
          if (interactive) {
            this._setPlainEditable(cell);
            cell.addEventListener("pointerdown", event => event.stopPropagation());
            cell.addEventListener("focus", () => this._activateTableCell(cell));
            cell.addEventListener("beforeinput", () => this._recordHistory());
            cell.addEventListener("input", event => { event.stopPropagation(); this._storeTableCell(cell); this._queueSave(); });
            cell.addEventListener("blur", () => window.setTimeout(() => { if (document.activeElement !== cell) this._commitTableCell(cell); }, 0));
            cell.addEventListener("keyup", event => event.stopPropagation());
            cell.addEventListener("keydown", event => this._tableCellKeys(event, cell));
            cell.addEventListener("paste", event => {
              event.preventDefault(); event.stopPropagation();
              document.execCommand("insertText", false, event.clipboardData?.getData("text/plain") || "");
            });
          }
          td.append(cell); tr.append(td);
        });
        body.append(tr);
      });
      table.append(body); wrap.append(table);
      if (interactive) {
        for (const [action, label] of [["column-after", "Add column after"], ["row-after", "Add row after"]]) {
          const button = this._html("button"); button.type = "button";
          button.className = `zen-notes-table-add ${action.startsWith("column") ? "add-column" : "add-row"}`;
          button.innerHTML = this._toolbarIcon("plus"); button.title = label; button.setAttribute("aria-label", label);
          button.addEventListener("pointerdown", event => { event.preventDefault(); event.stopPropagation(); });
          button.addEventListener("click", event => { event.stopPropagation(); this._tableAction(model.start, model.rows.length - 1, model.columns - 1, action); });
          wrap.append(button);
        }
      }
      line.replaceChildren(wrap);
    }

    _activateTableCell(cell) {
      if (cell.dataset.cellEditing === "true") return;
      this._endWholeSelection();
      if (this._activeCell !== cell) this._commitActiveLine();
      this._activeCell = cell; cell.dataset.cellEditing = "true";
      cell.textContent = this._cellDisplay(cell.dataset.cellRaw || "");
    }

    _storeTableCell(cell) {
      if (!cell?.isConnected || cell.dataset.cellEditing !== "true") return;
      const start = Number(cell.dataset.tableStart), sourceRow = Number(cell.dataset.tableRow), column = Number(cell.dataset.tableColumn);
      const editor = document.getElementById("zen-notes-editor"), line = editor?.children[start + sourceRow];
      if (!line || line.dataset.tableOwner !== String(start)) return;
      const cells = this._parseTableRow(line.dataset.raw)?.map(c => c.value) || [];
      while (cells.length <= column) cells.push("");
      cells[column] = this._cellSource(cell.textContent || "");
      cell.dataset.cellRaw = cells[column]; line.dataset.raw = "| " + cells.join(" | ") + " |";
    }

    _commitTableCell(cell) {
      if (!cell || cell.dataset.cellEditing !== "true") return;
      this._storeTableCell(cell);
      delete cell.dataset.cellEditing;
      cell.innerHTML = this._inline(this._cellDisplay(cell.dataset.cellRaw || "")).replace(/&lt;br\s*\/?&gt;/g, "<br/>") || "<br/>";
      if (this._activeCell === cell) this._activeCell = null;
    }

    _focusTableCell(start, sourceRow, column) {
      const cell = document.getElementById("zen-notes-editor")?.querySelector(`.zen-notes-table-cell[data-table-start="${start}"][data-table-row="${sourceRow}"][data-table-column="${column}"]`);
      if (!cell) return;
      this._activateTableCell(cell);
      cell.focus({ preventScroll: true });
      const range = document.createRange(); range.selectNodeContents(cell); range.collapse(false);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    }

    _tableCellKeys(event, cell) {
      event.stopPropagation();
      if (event.defaultPrevented || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
      const start = Number(cell.dataset.tableStart), column = Number(cell.dataset.tableColumn), model = this._tableAt(start);
      if (!model) return;
      const row = model.sourceRows.indexOf(Number(cell.dataset.tableRow));
      if (event.key === "Escape") { event.preventDefault(); cell.blur(); return; }
      if (!["Tab", "Enter"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "Enter" && event.shiftKey) { document.execCommand("insertText", false, "<br>"); return; }
      this._commitTableCell(cell);
      let nextRow = row, nextColumn = column;
      if (event.key === "Tab") {
        nextColumn += event.shiftKey ? -1 : 1;
        if (nextColumn < 0) { nextColumn = model.columns - 1; nextRow--; }
        if (nextColumn >= model.columns) { nextColumn = 0; nextRow++; }
      } else nextRow++;
      if (nextRow >= model.rows.length) {
        this._tableAction(start, row, column, "row-after", { row: nextRow, column: nextColumn }); return;
      }
      if (nextRow < 0) { this._focusTableCell(start, 0, 0); return; }
      this._focusTableCell(start, model.sourceRows[nextRow], nextColumn);
    }

    _mutateTable(model, row, column, action) {
      row = Math.max(0, Math.min(model.rows.length - 1, row)); column = Math.max(0, Math.min(model.columns - 1, column));
      if (action.startsWith("column-") && ["column-before", "column-after"].includes(action)) {
        const at = column + (action.endsWith("after") ? 1 : 0);
        model.rows.forEach(cells => cells.splice(at, 0, "")); model.align.splice(at, 0, "left"); model.columns++; return { row, column: at };
      }
      if (["row-before", "row-after"].includes(action)) {
        const at = Math.max(1, row + (action.endsWith("after") ? 1 : 0));
        model.rows.splice(at, 0, Array(model.columns).fill("")); return { row: at, column };
      }
      if (action === "delete-column" && model.columns > 1) { model.rows.forEach(cells => cells.splice(column, 1)); model.align.splice(column, 1); model.columns--; }
      if (action === "delete-row" && row > 0) model.rows.splice(row, 1);
      if (action === "move-row-up" && row > 1) { [model.rows[row - 1], model.rows[row]] = [model.rows[row], model.rows[row - 1]]; row--; }
      if (action === "move-row-down" && row > 0 && row < model.rows.length - 1) { [model.rows[row + 1], model.rows[row]] = [model.rows[row], model.rows[row + 1]]; row++; }
      if (action === "move-column-left" || action === "move-column-right") {
        const next = column + (action.endsWith("left") ? -1 : 1);
        if (next >= 0 && next < model.columns) {
          model.rows.forEach(cells => { [cells[column], cells[next]] = [cells[next], cells[column]]; });
          [model.align[column], model.align[next]] = [model.align[next], model.align[column]]; column = next;
        }
      }
      if (action.startsWith("align-")) model.align[column] = action.slice(6);
      if (action.startsWith("sort-")) {
        const direction = action.endsWith("ascending") ? 1 : -1;
        model.rows = [model.rows[0], ...model.rows.slice(1).sort((a, b) => direction * this._cellDisplay(a[column]).localeCompare(this._cellDisplay(b[column]), undefined, { numeric: true }))];
      }
      return { row: Math.min(row, model.rows.length - 1), column: Math.min(column, model.columns - 1) };
    }

    _tableAction(start, row, column, action, focus = null) {
      this._commitActiveLine();
      const model = this._tableAt(start); if (!model) return;
      this._recordHistory();
      const body = this._editorMarkdown().split("\n");
      const position = this._mutateTable(model, row, column, action);
      body.splice(start, model.end - start + 1, ...(action === "delete-table" ? [""] : this._serializeTable(model).split("\n")));
      this._setBody(body.join("\n")); this._queueSave();
      if (action !== "delete-table") {
        const target = focus || position;
        this._focusTableCell(start, target.row === 0 ? 0 : target.row + 1, target.column);
      }
    }

    _tableContextMenu(popup, cell) {
      const start = Number(cell.dataset.tableStart), column = Number(cell.dataset.tableColumn), model = this._tableAt(start);
      if (!model) return false;
      const row = model.sourceRows.indexOf(Number(cell.dataset.tableRow));
      const entries = [["Add Row Above", "row-before"], ["Add Row Below", "row-after"], ["Add Column Before", "column-before"], ["Add Column After", "column-after"], null,
        ["Move Row Up", "move-row-up"], ["Move Row Down", "move-row-down"], ["Move Column Left", "move-column-left"], ["Move Column Right", "move-column-right"], null,
        ["Align Left", "align-left"], ["Align Center", "align-center"], ["Align Right", "align-right"], ["Sort Ascending", "sort-ascending"], ["Sort Descending", "sort-descending"], null,
        ["Delete Row", "delete-row"], ["Delete Column", "delete-column"], ["Delete Table", "delete-table"]];
      for (const entry of entries) {
        if (!entry) { popup.append(document.createXULElement("menuseparator")); continue; }
        const [label, action] = entry, item = this._menuItem(label, () => this._tableAction(start, row, column, action));
        item.disabled = (action === "delete-row" && row === 0) || (action === "row-before" && row === 0) || (action === "delete-column" && model.columns === 1) || (action === "move-row-up" && row <= 1) || (action === "move-row-down" && (row === 0 || row === model.rows.length - 1)) || (action === "move-column-left" && column === 0) || (action === "move-column-right" && column === model.columns - 1);
        if (action.startsWith("align-")) { item.setAttribute("type", "radio"); item.setAttribute("checked", String(model.align[column] === action.slice(6))); }
        popup.append(item);
      }
      return true;
    }

    _codeGroups(raws) {
      const groups = []; let open = null;
      raws.forEach((raw, index) => {
        if (!open) {
          const match = raw.match(/^\s{0,3}(`{3,}|~{3,})([^`]*)$/);
          if (match) open = { start: index, marker: match[1][0], length: match[1].length, language: match[2].trim() };
        } else if (new RegExp(`^\\s{0,3}${open.marker}{${open.length},}\\s*$`).test(raw)) {
          groups.push({ ...open, end: index, closed: true }); open = null;
        }
      });
      if (open) groups.push({ ...open, end: raws.length - 1, closed: false });
      return groups;
    }

    _renderAllLines(editor = document.getElementById("zen-notes-editor")) {
      if (!editor) return;
      const lines = Array.from(editor.children), raws = lines.map(line => line.dataset.raw || "");
      const groups = this._codeGroups(raws), codes = new Map();
      for (const group of groups) for (let i = group.start; i <= group.end; i++) codes.set(i, group);
      const tables = [];
      for (let i = 0; i < lines.length; i++) {
        if (codes.has(i)) continue;
        const model = this._tableModel(raws, i);
        if (model) { tables.push(model); i = model.end; }
      }
      let insideMath = false;
      lines.forEach((line, i) => {
        for (const name of ["tableOwner", "codeStart", "codeEnd", "codeFence"]) delete line.dataset[name];
        line.classList.remove("is-table-host", "is-table-continuation", "is-table-row", "is-table-divider", "is-table-start", "is-code-top", "is-code-bottom", "is-empty-code", "is-code-editing");
        const group = codes.get(i), fence = group && (i === group.start || (group.closed && i === group.end));
        line.dataset.codeBlock = group ? "true" : "false";
        if (group) {
          line.dataset.codeStart = String(group.start); line.dataset.codeEnd = String(group.end);
          line.dataset.codeFence = fence ? "true" : "false";
          const empty = group.closed && group.end === group.start + 1;
          line.classList.toggle("is-empty-code", empty && i === group.start);
          line.classList.toggle("is-code-top", i === group.start + 1 && !empty);
          line.classList.toggle("is-code-bottom", i === group.end - (group.closed ? 1 : 0) && !empty);
        }
        line.dataset.mathBlock = !group && (insideMath || raws[i].trim() === "$$") ? "true" : "false";
        if (!group && raws[i].trim() === "$$") insideMath = !insideMath;
        const quote = !group && /^>\s?/.test(raws[i]);
        line.classList.toggle("is-quote-start", quote && !/^>\s?/.test(raws[i - 1] || ""));
        line.classList.toggle("is-quote-end", quote && !/^>\s?/.test(raws[i + 1] || ""));
      });
      for (const model of tables) for (let i = model.start; i <= model.end; i++) {
        lines[i].classList.remove("is-code", "is-fence");
        lines[i].dataset.tableOwner = String(model.start);
        lines[i].classList.add(i === model.start ? "is-table-host" : "is-table-continuation");
        lines[i].setAttribute("contenteditable", "false");
      }
      lines.forEach(line => this._renderLine(line));
      for (const model of tables) this._renderTable(lines[model.start], model, editor.id === "zen-notes-editor");
      this._updateCodeEditing(editor);
      this._updatePlaceholder();
    }

    _updateCodeEditing(editor = document.getElementById("zen-notes-editor")) {
      if (!editor) return;
      const start = this._activeLine?.dataset.codeStart;
      for (const line of editor.children) line.classList.toggle("is-code-editing", start !== undefined && line.dataset.codeStart === start && editor.contains(this._activeLine));
    }

    _renderLine(line, forceCode = null) {
      if (!line || line.classList.contains("is-editing") || line.dataset.tableOwner !== undefined) return;
      const raw = line.dataset.raw ?? "";
      const isFence = line.dataset.codeFence === "true";
      const isCode = isFence || forceCode === true || (forceCode === null && line.dataset.codeBlock === "true");
      this._classifyLine(line, raw, isCode);
      line.classList.toggle("is-fence", isFence);
      line.classList.toggle("zen-notes-image-row", !isCode && this._imageMatches(raw).length > 1);
      line.classList.toggle("is-image-line", !isCode && this._imageMatches(raw).length > 0 && !raw.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "").trim());
      line.spellcheck = false;

      if (isCode) {
        line.innerHTML = isFence
          ? `<span class="zen-notes-md-marker">${this._escape(raw)}</span>`
          : `<span class="zen-notes-code-line">${this._escape(raw) || "<br/>"}</span>`;
        return;
      }

      if (line.dataset.mathBlock === "true") {
        line.innerHTML = raw.trim() === "$$" ? '<span class="zen-notes-md-marker">$$</span>' : `<code class="zen-notes-math">${this._escape(raw) || "<br/>"}</code>`;
        return;
      }
      const footnote = raw.match(/^\[\^([^\]]+)\]:\s*(.*)$/);
      if (footnote) { line.innerHTML = `<small class="zen-notes-footnote"><sup>${this._escape(footnote[1])}</sup> ${this._inline(footnote[2])}</small>`; return; }
      const pdf = this._pdfInfo(raw);
      if (pdf) {
        line.spellcheck = false;
        line.innerHTML = `<span class="zen-notes-link zen-notes-pdf-card" data-href="${this._escape(pdf.href)}"><span class="zen-notes-file-icon" aria-hidden="true" style="mask-image:url('${PDF_ICON}')"></span><span>${this._escape(pdf.name)}</span></span>`;
        const citation = raw.match(/\s+(\[Source: [^\]]*\]\([^\n]*\))$/)?.[1];
        if (citation) line.innerHTML += this._inline(citation);
        return;
      }
      const preview = this._youtubePreview(raw);
      if (preview) {
        const note = this._getNote(this.currentNoteId);
        const compact = note?.compactVideos?.includes(preview.id);
        const title = this._videoTitles.get(preview.id) || note?.videoTitles?.[preview.id] || raw.trim().match(/^\[([^\]]+)\]/)?.[1] || "Video";
        line.innerHTML = `<span class="zen-notes-link zen-notes-video-card" data-href="${this._escape(preview.href)}" data-video-id="${preview.id}">${compact ? "" : `<img src="https://i.ytimg.com/vi/${preview.id}/hqdefault.jpg" alt="Video preview" referrerpolicy="no-referrer"/>`}<span>▶ ${this._escape(title)}</span></span>`;
        const citation = raw.match(/\s+(\[Source: [^\]]*\]\([^\n]*\))$/)?.[1];
        if (citation) line.innerHTML += this._inline(citation);
        this._loadVideoTitle(preview, line);
        return;
      }
      const task = raw.match(/^(\s*)[-*+]\s+\[([ xX])\]\s?(.*)$/);
      if (task) {
        const depth = Math.floor(task[1].length / INDENT.length);
        line.style.setProperty("--zen-notes-indent", depth);
        const checked = task[2].toLowerCase() === "x";
        line.innerHTML = `<span class="zen-notes-task-checkbox" role="checkbox" aria-checked="${checked}" aria-label="Task" data-checked="${checked}"></span><span class="zen-notes-list-content${checked ? " is-done" : ""}">${this._inline(task[3]) || "<br/>"}</span>`;
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

      const source = raw.match(/^Source: \[([^\]]*)\]\(<?(https?:\/\/[^>]+?)>?\)$/);
      if (source) {
        const url = source[2];
        line.innerHTML = `<span class="zen-notes-link zen-notes-source" data-href="${this._escape(url)}" title="${this._escape(source[1] || url)}" aria-label="Source: ${this._escape(source[1] || url)}"><img src="page-icon:${this._escape(url)}" alt=""/></span>`;
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

    _inline(raw, exporting = false) {
      let text = this._escape(this._expandImages(raw));
      const stash = [];
      const token = (html) => `\uE000${stash.push(html) - 1}\uE001`;

      text = text.replace(/\\([\\`*{}\[\]()#+.!_>~-])/g, (_, c) => token(c));
      text = text.replace(/`([^`]+)`/g, (_, c) => token(`<code>${c}</code>`));
      text = text.replace(/&lt;!--(.*?)--&gt;/g, (_, c) => token(exporting ? `<!--${c}-->` : `<span class="zen-notes-comment" title="Comment">${c}</span>`));
      text = text.replace(/\$([^$]+)\$/g, (_, c) => token(`<code class="zen-notes-math">${c}</code>`));
      text = text.replace(/\[\^([^\]]+)\]/g, (_, c) => token(`<sup class="zen-notes-footnote-ref">${c}</sup>`));
      let imageIndex = 0;
      text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, source) => {
        const url = source.replace(/^&lt;|&gt;$/g, "");
        const width = Number(alt.match(/\|width=(\d+)$/)?.[1]);
        const cleanAlt = alt.replace(/\|width=\d+$/, "");
        const index = imageIndex++;
        if (!/^(?:https?:\/\/|data:image\/(?:png|jpeg|gif|webp);base64,)/i.test(url)) return token(`<span class="zen-notes-embed">${cleanAlt || "Image: unsupported URL"}</span>`);
        if (exporting) return token(`<img class="zen-notes-image" src="${url}" alt="${cleanAlt}"${width ? ` width="${width}"` : ""}/>`);
        return token(`<span class="zen-notes-image-frame" contenteditable="false" data-image-index="${index}"${width ? ` style="width:${Math.max(64, Math.min(1600, width))}px"` : ""}><img class="zen-notes-image" draggable="false" src="${url}" alt="${cleanAlt}" loading="lazy" referrerpolicy="no-referrer"/><span class="zen-notes-image-resize" aria-label="Resize image"></span></span>`);
      });
      text = text.replace(/\[Source: ([^\]]*)\]\((?:&lt;)?(https?:[^)]+)\)/g, (_, label, target) => {
        const href = target.replace(/^&lt;|&gt;$/g, "");
        if (exporting) return token(`<a href="${href}">Source: ${label}</a>`);
        return token(`<span class="zen-notes-link zen-notes-source" data-href="${href}" title="${label}" aria-label="Source: ${label}"><img src="page-icon:${href}" alt=""/></span>`);
      });
      text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
        href = href.replace(/^&lt;|&gt;$/g, "").replace(/"/g, "&quot;");
        if (exporting && /^(?:https?:\/\/|data:application\/pdf;base64,)/i.test(href)) return token(`<a href="${href}">${label}</a>`);
        return token(`<span class="zen-notes-link" data-href="${href}">${label}</span>`);
      });
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
      text = this._renderColors(text);
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
      if (event.target.closest?.(".zen-notes-table-cell")) return;
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
      if (line.dataset.tableOwner !== undefined) {
        const editor = line.parentElement, start = Number(line.dataset.tableOwner), row = Array.from(editor.children).indexOf(line) - start;
        const parts = this._parseTableRow(line.dataset.raw || "") || [];
        const column = Math.max(0, parts.findIndex(part => offset <= part.end));
        this._focusTableCell(start, row === 1 ? 0 : row, column); return;
      }
      this._activateLine(line);
      line.focus();
      this._setCaret(line, offset);
      this._refreshInline(line);
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
      const paragraph = !info.prefix && line.dataset.codeBlock !== "true" && before.trim();
      if (paragraph) line.after(this._makeLine(""), next);
      else line.after(next);
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
      value = this._compactImages(value);
      const raw = this._lineText(line);
      const { start, end } = this._selectionOffsets(line);
      const next = raw.slice(0, start) + value + raw.slice(end);
      this._replaceLineRaw(line, next, start + value.length);
    }

    _pastePlainText(event) {
      const pdfs = Array.from(event.clipboardData?.files || []).filter(file => file.type === "application/pdf" || /\.pdf$/i.test(file.name));
      if (pdfs.length && this._bodySelection()) {
        event.preventDefault(); event.stopPropagation();
        this._dropImages({ dataTransfer: { files: pdfs }, selection: this._bodySelection(), target: null, preventDefault() {}, stopPropagation() {} }).catch(console.error); return;
      }
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
      const clipboardText = event.clipboardData?.getData("text/plain");
      const text = typeof clipboardText === "string" ? this._compactImages(clipboardText) : clipboardText;
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

    _applyBoost(page = document.getElementById("zen-notes-page"), id = this.currentNoteId) {
      if (!page || !ZenBoostsManager || !id) return;

      let data = null;
      try { data = ZenBoostsManager.loadActiveBoostFromStore(this._boostDomain(id))?.boostEntry?.boostData || null; } catch {}
      const style = page.id !== "zen-notes-page" ? this._html("style") : document.getElementById("zen-notes-boost-custom-css") || (() => {
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
      this._quickNotes.delete(id);
      this._closingNotes.add(id);
      this.notes = this.notes.filter(note => note.id !== id);
      await this._enqueueWrite(async () => {
        await FileIO.writeUTF8(this._deletedPath(id), new Date().toISOString());
        await FileIO.remove(this._notePath(id), { ignoreAbsent: true });
        if (Paths.tempDir) await FileIO.remove(Paths.join(Paths.tempDir, "zen-notes-share", `${id}.html`), { ignoreAbsent: true });
        await this._writeIndex();
      });
      for (const { win } of controllers) {
        for (const tab of Array.from(win.gZenWorkspaces?.allStoredTabs || win.gBrowser.tabs)) {
          if (!tab.closing && this._idFromTab(tab) === id) win.gBrowser.removeTab(tab, { animate: false });
        }
      }
    }

    _registerPaletteAction() {
      try {
        const { globalActions } = ChromeUtils.importESModule('resource:///modules/ZenUBGlobalActions.sys.mjs');
        const existing = globalActions.find(action => action.commandId === 'zen-notes-create');
        if (existing?.extraPayload) delete existing.extraPayload.prettyName;
        const shortcutContent = Services.appinfo.OS === "Darwin" ? "⌘ ⇧ N" : "Ctrl + Shift + N";
        if (existing) existing.extraPayload = { ...existing.extraPayload, shortcutContent };
        if (!existing) {
          globalActions.push({ commandId: 'zen-notes-create', label: 'New Note',
            extraPayload: { shortcutContent }, icon: MENU_NOTE_ICON,
            isAvailable: win => !!win.gZenNotes && !win.gZenNotes._destroyed,
            command: win => win.gZenNotes.createNote().catch(error => console.error(LOG, error)) });
        }
      } catch (error) { console.error(LOG, 'Could not register note palette action', error); }
    }

    async _dropImages(event) {
      const files = Array.from(event.dataTransfer?.files || []);
      if (!files.length) return;
      event.preventDefault(); event.stopPropagation();
      const id = this.currentNoteId;
      let position = event.selection || null;
      const target = event.target?.closest?.(".zen-notes-line");
      if (target) {
        const lines = Array.from(target.parentElement.children);
        const before = lines.slice(0, lines.indexOf(target)).reduce((offset, line) => offset + (line.classList.contains("is-editing") ? this._lineText(line) : line.dataset.raw || "").length + 1, 0);
        const offset = before + this._rawOffsetFromPointer(target, event.clientX, event.clientY);
        position = { start: offset, end: offset };
      }
      const initial = this._editorMarkdown();
      const images = [];
      for (const file of files) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const mime = this._isPDF(bytes) ? "application/pdf" : this._imageMime(bytes);
        if (!mime) continue;
        let data = '';
        for (let i = 0; i < bytes.length; i += 8192) data += String.fromCharCode(...bytes.subarray(i, i + 8192));
        images.push(mime === "application/pdf" ? `[${(file.name || "Document.pdf").replace(/[\[\]\r\n]/g, " ")}](data:${mime};base64,${btoa(data)})` : `![Image](data:${mime};base64,${btoa(data)})`);
      }
      if (!images.length || this.currentNoteId !== id) return;
      const current = this._editorMarkdown();
      const selection = current === initial && position ? position : { start: current.length, end: current.length };
      this._replaceBodySelection(images.join('\n'), selection);
      const active = this._activeLine; this._commitActiveLine(); active?.blur();
    }

    async _loadVideoTitle(preview, line) {
      const note = this._getNote(this.currentNoteId);
      if (note?.videoTitles?.[preview.id]) { this._videoTitles.set(preview.id, note.videoTitles[preview.id]); return; }
      if (this._videoTitles.has(preview.id)) return;
      this._videoTitles.set(preview.id, null);
      try {
        const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${preview.id}`)}&format=json`, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(8000) });
        if (!response.ok) return;
        const metadata = await response.json();
        if (typeof metadata.title !== 'string' || !metadata.title.trim()) return;
        this._videoTitles.set(preview.id, metadata.title);
        if (note && this._getNote(note.id)) { note.videoTitles = { ...(note.videoTitles || {}), [preview.id]: metadata.title }; await this._writeIndex(); }
        if (line.isConnected && !line.classList.contains('is-editing') && this._youtubePreview(line.dataset.raw || '')?.id === preview.id) this._renderLine(line);
      } catch (error) { console.warn(LOG, 'Video title unavailable'); }
    }

    async _shareTextWithService(name, id) {
      if (id === this.currentNoteId) await this._saveCurrentNow();
      const note = this._getNote(id);
      if (!note) return;
      const data = await this._readNote(note);
      const text = `${data.title}\n\n${this._plainNoteText(data.body)}`;
      const script = `ObjC.import('AppKit'); ObjC.import('Foundation');
function run(argv) {
  var done = false;
  ObjC.registerSubclass({name:'ZenNotesTextShareDelegate',protocols:['NSSharingServiceDelegate'],methods:{
    'sharingService:didShareItems:':{types:['void',['id','id']],implementation:function(){done=true;}},
    'sharingService:didFailToShareItems:error:':{types:['void',['id','id','id']],implementation:function(){done=true;}}
  }});
  var app=$.NSApplication.sharedApplication;
  var service=$.NSSharingService.sharingServiceNamed(argv[0]);
  var items=$([argv[1]]);
  if (!service || !service.canPerformWithItems(items)) throw Error('This service does not accept text');
  var delegate=$.ZenNotesTextShareDelegate.alloc.init;
  service.delegate=delegate;
  app.activateIgnoringOtherApps(true);
  service.performWithItems(items);
  var deadline=Date.now()+300000;
  while(!done && Date.now()<deadline) $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(0.1));
}`;
      const file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
      file.initWithPath('/usr/bin/osascript');
      const process = Cc['@mozilla.org/process/util;1'].createInstance(Ci.nsIProcess);
      process.init(file);
      const args = ['-l', 'JavaScript', '-e', script, '--', name, text];
      await new Promise((resolve, reject) => process.runwAsync(args, args.length, { observe: (_subject, topic) => {
        if (topic === 'process-finished' && process.exitValue === 0) resolve();
        else { Services.prompt.alert(window, 'Share Note', 'This service could not share the note as text.'); reject(new Error('Text sharing failed')); }
      } }, false));
    }

    _youtubePreview(raw) {
      raw = raw.replace(/\s+\[Source: [^\]]*\]\([^\n]*\)$/, "");
      const link = raw.trim().match(/^\[[^\]]*\]\((https?:\/\/[^)]+)\)$/);
      const href = link ? link[1] : raw.trim();
      let url;
      try { url = new URL(href); } catch { return null; }
      if (!['https:', 'http:'].includes(url.protocol)) return null;
      let id = null;
      if (url.hostname === 'youtu.be') id = url.pathname.slice(1);
      else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
        id = url.pathname === '/watch' ? url.searchParams.get('v') : url.pathname.match(/^\/(?:shorts|embed|live)\/([^/]+)$/)?.[1];
      }
      return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? { id, href: url.href } : null;
    }

    async _insertImageFile() {
      const noteId = this.currentNoteId;
      const selection = this._bodySelection();
      const original = this._editorMarkdown();
      const picker = Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
      picker.init(window.browsingContext, "Insert Image", Ci.nsIFilePicker.modeOpen);
      picker.appendFilter("Images", "*.png;*.jpg;*.jpeg;*.gif;*.webp");
      const result = await new Promise(resolve => picker.open(resolve));
      if (result !== Ci.nsIFilePicker.returnOK || this.currentNoteId !== noteId) return;
      const bytes = await FileIO.read(picker.file.path);
      const mime = this._isPDF(bytes) ? "application/pdf" : this._imageMime(bytes);
      if (!mime) throw new Error("Unsupported image: choose PNG, JPEG, GIF or WebP");
      let binary = '';
      for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
      const markdown = `![Image](data:${mime};base64,${btoa(binary)})`;
      if (this.currentNoteId !== noteId) return;
      const position = selection && this._editorMarkdown() === original ? selection : { start: this._editorMarkdown().length, end: this._editorMarkdown().length };
      this._replaceBodySelection(markdown, position);
      const active = this._activeLine; this._commitActiveLine(); active?.blur();
    }

    _imageMime(bytes) {
      if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return 'image/png';
      if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
      if (String.fromCharCode(...bytes.slice(0, 3)) === 'GIF') return 'image/gif';
      if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP') return 'image/webp';
      return null;
    }

    _plainNoteText(body) {
      return body.split('\n').map(raw => {
        let text = raw.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => /^data:/i.test(url) ? `[${alt || 'Image'}]` : `${alt || 'Image'}: ${url}`);
      text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => /^data:application\/pdf/i.test(href) ? `[${label}]` : `${label} — ${href}`);
        text = text.replace(/<\/?u>/g, '').replace(/\|\|/g, '');
        return this._visibleTextForRaw(text);
      }).join('\n');
    }

    async _sendToAppleNotes(id = this.currentNoteId) {
      if (Services.appinfo.OS !== 'Darwin') return;
      if (id === this.currentNoteId) await this._saveCurrentNow();
      const note = this._getNote(id);
      if (!note) return;
      const data = await this._readNote(note);
      const plain = this._plainNoteText(data.body);
      // Notes stores its body as HTML internally. Escape text instead of importing
      // an HTML attachment; content is passed as arguments, never executable code.
      const body = this._exportHTML(data).match(/<body>([\s\S]*)<\/body>/)[1];
      const script = 'on run argv\n tell application "Notes"\n  set newNote to make new note with properties {name:(item 1 of argv), body:(item 2 of argv)}\n  show newNote\n  activate\n end tell\nend run';
      const file = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsIFile);
      file.initWithPath('/usr/bin/osascript');
      const process = Cc['@mozilla.org/process/util;1'].createInstance(Ci.nsIProcess);
      process.init(file);
      const args = ['-e', script, '--', data.title, body];
      await new Promise((resolve, reject) => process.runwAsync(args, args.length, {
        observe: (_subject, topic) => topic === 'process-finished' && process.exitValue === 0 ? resolve() : reject(new Error('Apple Notes did not accept the note. Check macOS Automation permission for Zen.'))
      }, false));
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
        const service = Cc["@mozilla.org/widget/macsharingservice;1"].getService(Ci.nsIMacSharingService);
        const providers = service.getSharingProviders("https://example.com/");
        popup.replaceChildren();
        for (const provider of providers) {
          popup.append(this._menuItem(provider.menuItemTitle, () => /notes/i.test(provider.name) ? this._sendToAppleNotes(id) : this._shareTextWithService(provider.name, id)));
        }
        if (!providers.length) popup.append(this._menuItem("No services available — use Export…", () => this._exportNote()));
      } catch (error) {
        console.error(LOG, "Native sharing failed", error);
        popup.replaceChildren(this._menuItem("Export instead…", () => this._exportNote()));
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

    async _exportNote(id = this.currentNoteId) {
      await this._saveCurrentNow();
      const note = this._getNote(id);
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
      const inline = text => this._inline(text, true).replace(/<span class="zen-notes-link" data-href="(https?:[^\"]*)">(.*?)<\/span>/g, '<a href="$1">$2</a>');
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
        {
          const tag = { '**': 'strong', '__': 'strong', '~~': 'del', '==': 'mark', '`': 'code', '*': 'em', '_': 'em' }[match[1]];
          const marker = `<span class="zen-notes-source-marker">${this._escape(match[1])}</span>`;
          result += `${marker}<${tag}>${this._escape(match[2])}</${tag}>${marker}`;
        }
        end = finish;
      }
      result += this._escape(raw.slice(end));
      result = this._renderColors(result, true);
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
      const page = document.querySelector("#zen-notes-page .zen-notes-page-scroll");
      const scroll = page?.scrollTop || 0;
      const position = this._bodySelection()?.start || 0;
      const value = history.entries[next];
      document.getElementById("zen-notes-page-title").textContent = value.title;
      this._setBody(value.body);
      const before = value.body.slice(0, Math.min(position, value.body.length)).split("\n");
      const editor = document.getElementById("zen-notes-editor");
      this._focusLine(editor.children[before.length - 1] || editor.firstElementChild, before.at(-1).length);
      if (page) page.scrollTop = scroll;
      this._restoringHistory = false;
      this._queueSave();
    }

    _setBody(body) {
      this._activeCell = null;
      this._endWholeSelection();
      this._activeLine = null;
      const editor = document.getElementById("zen-notes-editor");
      editor.replaceChildren(...body.split("\n").map(raw => this._makeLine(raw)));
      this._renderAllLines();
      this._updatePlaceholder();
    }

    _endWholeSelection() {
      const editor = document.getElementById("zen-notes-editor");
      if (!editor?.hasAttribute?.("contenteditable")) return;
      editor.removeAttribute("contenteditable");
      for (const line of editor.children) { if (line.dataset.tableOwner === undefined) this._setPlainEditable(line); }
    }

    _selectAll() {
      const editor = document.getElementById("zen-notes-editor");
      this._prepareVisualSelection();
      const range = document.createRange(); range.selectNodeContents(editor);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      this._updateSelectionToolbar();
    }

    _bodySelection() {
      const editor = document.getElementById("zen-notes-editor");
      const selection = window.getSelection?.();
      if (!editor || !selection?.rangeCount) return null;
      const range = selection.getRangeAt(0);
      if (!editor.contains(range.startContainer) || !editor.contains(range.endContainer)) return null;
      const lines = Array.from(editor.children);
      const offset = (node, position, end = false) => {
        if (node === editor) return lines.slice(0, position).reduce((n, l) => n + (l.dataset.raw || "").length + 1, 0);
        const element = node.nodeType === 1 ? node : node.parentElement;
        const cell = element.closest(".zen-notes-table-cell");
        if (cell) {
          const rowIndex = Number(cell.dataset.tableStart) + Number(cell.dataset.tableRow), column = Number(cell.dataset.tableColumn);
          const parts = this._parseTableRow(lines[rowIndex]?.dataset.raw || ""), part = parts?.[column];
          if (part) {
            const r = document.createRange(); r.selectNodeContents(cell); r.setEnd(node, position);
            const raw = part.value, decoded = this._cellDisplay(raw);
            const visible = r.toString().length;
            const local = cell.dataset.cellEditing === "true" ? visible : this._visibleOffsetToRaw(decoded, visible, end);
            const offsets = []; for (let i = 0; i < raw.length; i++) { if (raw[i] === "\\" && raw[i + 1] === "|") i++; offsets.push(i); }
            const mapped = end && local > 0 ? (offsets[local - 1] ?? raw.length - 1) + 1 : offsets[local] ?? raw.length;
            return lines.slice(0, rowIndex).reduce((sum, line) => sum + (line.dataset.raw || "").length + 1, 0) + part.start + mapped;
          }
        }
        const line = (node.nodeType === 1 ? node : node.parentElement).closest(".zen-notes-line");
        const index = lines.indexOf(line);
        if (index < 0) return 0;
        const prefix = lines.slice(0, index).reduce((n, l) => n + (l.classList.contains("is-editing") ? this._lineText(l) : l.dataset.raw || "").length + 1, 0);
        const content = line.querySelector(".zen-notes-list-content") || line;
        const r = document.createRange(); r.selectNodeContents(content);
        if (content.contains(node)) r.setEnd(node, position);
        else if (node === line && position === 0) r.collapse(true);
        const local = line.classList.contains("is-editing") || line.dataset.codeBlock === "true" || line.dataset.mathBlock === "true" ? r.toString().length : this._visibleOffsetToRaw(line.dataset.raw || "", r.toString().length, end);
        return prefix + local;
      };
      const body = this._editorMarkdown();
      return { start: Math.min(body.length, offset(range.startContainer, range.startOffset)), end: Math.min(body.length, offset(range.endContainer, range.endOffset, !range.collapsed)) };
    }

    _replaceBodySelection(text, selection = this._bodySelection()) {
      if (!selection) return;
      text = this._compactImages(text);
      this._recordHistory();
      const body = this._editorMarkdown();
      const result = body.slice(0, selection.start) + text + body.slice(selection.end);
      this._setBody(result);
      const before = result.slice(0, selection.start + text.length).split("\n");
      this._focusLine(document.getElementById("zen-notes-editor").children[before.length - 1], before.at(-1).length);
      this._queueSave();
    }

    _formatSpans(raw) {
      const spans = [];
      const scan = (part, base) => {
        for (let i = 0; i < part.length;) {
          const rest = part.slice(i), code = rest.match(/^`+[^`]*`+/);
          if (code) { i += code[0].length; continue; }
          const color = rest.match(/^<span style="([^"]+)">([\s\S]*?)<\/span>/);
          if (color && this._safeColorStyle(color[1])) {
            const open = color[0].slice(0, color[0].indexOf(">") + 1), close = "</span>";
            spans.push({ action: "color", start: base + i, end: base + i + color[0].length, contentStart: base + i + open.length, contentEnd: base + i + color[0].length - close.length, open, close });
            scan(color[2], base + i + open.length); i += color[0].length; continue;
          }
          const pair = rest.match(/^(\*\*|__|~~|\*|_)([^\n]+?)\1/);
          const underline = rest.match(/^<u>([\s\S]*?)<\/u>/);
          if (pair || underline) {
            const full = (pair || underline)[0], open = pair ? pair[1] : "<u>", close = pair ? pair[1] : "</u>", text = pair ? pair[2] : underline[1];
            const action = { "**": "bold", "__": "bold", "*": "italic", "_": "italic", "~~": "strike", "<u>": "underline" }[open];
            spans.push({ action, start: base + i, end: base + i + full.length, contentStart: base + i + open.length, contentEnd: base + i + full.length - close.length, open, close });
            scan(text, base + i + open.length); i += full.length; continue;
          }
          const link = rest.match(/^!?\[([^\]]*)\]\([^)]*\)/);
          if (link) { if (!rest.startsWith("!")) scan(link[1], base + i + 1); i += link[0].length; continue; }
          const tag = rest.match(/^<[^>]+>/);
          if (tag) { i += tag[0].length; continue; }
          if (rest.startsWith("\\")) i++;
          i++;
        }
      };
      scan(raw, 0); return spans;
    }

    _formatState(selection) {
      if (!selection || selection.start === selection.end) return {};
      const body = this._editorMarkdown(), spans = this._formatSpans(body), positions = [];
      let base = 0;
      for (const line of body.split("\n")) {
        const map = this._displayMap(line);
        map.offsets.forEach((offset, i) => { if (!/\s/.test(map.text[i]) && base + offset >= selection.start && base + offset < selection.end) positions.push(base + offset); });
        base += line.length + 1;
      }
      return Object.fromEntries(["bold", "italic", "underline", "strike"].map(action => {
        const covered = positions.filter(position => spans.some(span => span.action === action && position >= span.contentStart && position < span.contentEnd)).length;
        return [action, positions.length && covered === positions.length ? true : covered ? "mixed" : false];
      }));
    }

    _removeActiveFormat(action, selection) {
      const body = this._editorMarkdown();
      const span = this._formatSpans(body).find(span => span.action === action && span.contentStart <= selection.start && span.contentEnd >= selection.end);
      if (!span) return false;
      const nested = this._formatSpans(body).filter(item => item !== span && item.start >= span.contentStart && item.end <= span.contentEnd);
      const activeAt = position => nested.filter(item => item.contentStart <= position && item.contentEnd >= position).sort((a, b) => a.start - b.start);
      const starts = activeAt(selection.start), ends = activeAt(selection.end);
      const before = body.slice(span.contentStart, selection.start) + [...starts].reverse().map(item => item.close).join("");
      const selected = starts.map(item => item.open).join("") + body.slice(selection.start, selection.end) + [...ends].reverse().map(item => item.close).join("");
      const after = ends.map(item => item.open).join("") + body.slice(selection.end, span.contentEnd);
      const visible = text => this._visibleTextForRaw(text).trim();
      const wrap = text => visible(text) ? span.open + text + span.close : text;
      const whole = !visible(before) && !visible(after);
      const value = whole ? body.slice(span.contentStart, span.contentEnd) : wrap(before) + selected + wrap(after);
      this._replaceBodySelection(value, { start: span.start, end: span.end });
      this._finishVisualEdit(); return true;
    }

    _format(action, selection = this._bodySelection()) {
      if (!selection) return;
      if (this._formatState(selection)[action] === true && this._removeActiveFormat(action, selection)) return;
      let selected = this._editorMarkdown().slice(selection.start, selection.end);
      const note = this._getNote(this.currentNoteId);
      if (action === "clear") {
        const change = [...(note?.caseChanges || [])].reverse().find(change => change.after === selected);
        if (change) selected = change.before;
        else if (selected === selected.toLocaleUpperCase() && selected !== selected.toLocaleLowerCase()) selected = selected.toLocaleLowerCase();
      }
      const wraps = { bold: ["**", "**"], italic: ["*", "*"], strike: ["~~", "~~"], underline: ["<u>", "</u>"], spoiler: ["||", "||"], highlight: ["==", "=="], maths: ["$", "$"], comment: ["<!-- ", " -->"], code: ["`", "`"], link: ["[", "](https://)"] };
      if (action === "link") {
        const input = { value: "https://" };
        if (!Services.prompt.prompt(window, "Add Link", "URL", input, null, {})) return;
        const url = input.value.trim();
        if (!/^(?:https?:\/\/|mailto:)/i.test(url)) { this._showNotice("Enter a web or email link"); return; }
        this._replaceBodySelection(`[${selected || url}](<${url.replace(/>/g, "%3E")}>)`, selection);
        this._finishVisualEdit(); return;
      }
      let value = selected;
      if (wraps[action]) value = wraps[action][0] + selected + wraps[action][1];
      else if (action === "clear") value = selected.replace(/<span style="([^"]+)">|<\/span>/g, (tag, style) => !style || this._safeColorStyle(style) ? "" : tag).replace(/!?(\[([^\]]*)\])\([^)]*\)/g, "$2").replace(/<\/?u>/g, "").replace(/(\*\*|__|~~|==|\|\||`|\*|_)/g, "").replace(/^\s*(?:#{1,6}\s+|>\s?)/gm, "");
      else if (action === "task") value = selected.split("\n").map(line => /^\s*[-*+]\s+\[[ xX]\]/.test(line) ? line : `- [ ] ${line.replace(/^\s*[-*+]\s+/, "")}`).join("\n");
      else if (action === "quote") value = selected.split("\n").map(line => `> ${line}`).join("\n");
      else if (action === "date") value = new Date().toLocaleDateString();
      else if (action === "upper") value = selected.toLocaleUpperCase();
      else if (action === "lower") value = selected.toLocaleLowerCase();
      else if (action === "capitalize") value = selected.toLocaleLowerCase().replace(/(^|\s)(\p{L})/gu, (_, space, letter) => space + letter.toLocaleUpperCase());
      if (note && ["upper", "lower", "capitalize"].includes(action)) {
        note.caseChanges = [...(note.caseChanges || []), { before: selected, after: value }].slice(-50);
      }
      this._replaceBodySelection(value, selection);
      this._finishVisualEdit();
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

    _removeImageRaw(raw, index) {
      const match = this._imageMatches(raw)[index];
      return match ? raw.slice(0, match.index) + raw.slice(match.index + match[0].length) : raw;
    }

    async _copyNoteImage(img) {
      try {
        if (!img) return;
        await img.decode();
        const canvas = this._html("canvas");
        canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        canvas.getContext("2d").drawImage(img, 0, 0);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
        if (!blob) throw new Error("Image encoding failed");
        const { BrowserUtils } = ChromeUtils.importESModule("resource://gre/modules/BrowserUtils.sys.mjs");
        BrowserUtils.copyImageToClipboard(await blob.arrayBuffer());
        this._showNotice("Image copied");
      } catch (error) { console.error(LOG, "Copy image failed", error); this._showNotice("Could not copy image"); }
    }

    _updatePlaceholder() {
      const editor = document.getElementById("zen-notes-editor");
      if (editor) editor.toggleAttribute("data-empty", !this._editorMarkdown().trim());
    }

    _finishVisualEdit() {
      const position = this._bodySelection()?.end ?? this._editorMarkdown().length;
      this._prepareVisualSelection();
      const editor = document.getElementById("zen-notes-editor");
      let rest = position, line = editor.lastElementChild;
      for (const candidate of editor.children) {
        if (rest <= candidate.dataset.raw.length) { line = candidate; break; }
        rest -= candidate.dataset.raw.length + 1;
      }
      if (line) {
        let content = line.querySelector(".zen-notes-list-content") || line;
        let offset = this._lineDisplayMap(line).offsets.filter(value => value < rest).length;
        if (line.dataset.tableOwner !== undefined) {
          const start = Number(line.dataset.tableOwner), row = Array.from(editor.children).indexOf(line) - start, parts = this._parseTableRow(line.dataset.raw) || [];
          const column = Math.max(0, parts.findIndex(part => rest <= part.end));
          content = editor.querySelector(`.zen-notes-table-cell[data-table-start="${start}"][data-table-row="${row === 1 ? 0 : row}"][data-table-column="${column}"]`) || content;
          offset = this._displayMap(parts[column]?.value || "").offsets.filter(value => value < rest - (parts[column]?.start || 0)).length;
        }
        const point = this._textPoint(content, offset), range = document.createRange();
        range.setStart(point.node, point.offset); range.collapse(true);
        const selected = window.getSelection(); selected.removeAllRanges(); selected.addRange(range);
      }
      this._hideSelectionToolbar();
    }

    _hideSelectionToolbar() {
      const toolbar = document.getElementById("zen-notes-selection-toolbar");
      if (toolbar) toolbar.hidden = true;
    }

    // Lucide v1.8.0, ISC license; SVG paths bundled locally, no runtime request.
    _toolbarIcon(action) {
      const paths = {"bold": "<path d=\"M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8\"/>", "italic": "<line x1=\"19\" x2=\"10\" y1=\"4\" y2=\"4\"/><line x1=\"14\" x2=\"5\" y1=\"20\" y2=\"20\"/><line x1=\"15\" x2=\"9\" y1=\"4\" y2=\"20\"/>", "underline": "<path d=\"M6 4v6a6 6 0 0 0 12 0V4\"/><line x1=\"4\" x2=\"20\" y1=\"20\" y2=\"20\"/>", "strikethrough": "<path d=\"M16 4H9a3 3 0 0 0-2.83 4\"/><path d=\"M14 12a4 4 0 0 1 0 8H6\"/><line x1=\"4\" x2=\"20\" y1=\"12\" y2=\"12\"/>", "type": "<path d=\"M12 4v16\"/><path d=\"M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2\"/><path d=\"M9 20h6\"/>", "chevron-down": "<path d=\"m6 9 6 6 6-6\"/>", "plus": "<path d=\"M5 12h14\"/><path d=\"M12 5v14\"/>"};
      const name = { paragraph: "type", strike: "strikethrough" }[action] || action;
      const svg = key => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" aria-hidden="true">${paths[key] || ""}</svg>`;
      return svg(name) + (action === "paragraph" ? svg("chevron-down") : "");
    }

    _updateSelectionToolbar() {
      const page = document.getElementById("zen-notes-page"), selection = window.getSelection();
      const selected = this._bodySelection();
      if (!page || page.hidden || this._mouseSelecting || this._contextMenuOpen || !selected || selected.start === selected.end || selection.isCollapsed || !selection.toString().trim()) { this._hideSelectionToolbar(); return; }
      let toolbar = document.getElementById("zen-notes-selection-toolbar");
      if (!toolbar) {
        toolbar = this._html("div"); toolbar.id = "zen-notes-selection-toolbar";
        toolbar.setAttribute("role", "toolbar"); toolbar.setAttribute("aria-label", "Format selection");
        toolbar.addEventListener("pointerdown", event => event.preventDefault());
        for (const [action, title] of [["paragraph", "Paragraph style"], ["bold", "Bold"], ["italic", "Italic"], ["underline", "Underline"], ["strike", "Strikethrough"]]) {
          const button = this._html("button"); button.type = "button";
          button.dataset.action = action;
          button.innerHTML = this._toolbarIcon(action);
          button.title = title; button.setAttribute("aria-label", title);
          button.addEventListener("click", () => {
            if (toolbar._noteId !== this.currentNoteId) return;
            if (action === "paragraph") {
              let popup = document.getElementById("zen-notes-style-menu");
              if (!popup) { popup = document.createXULElement("menupopup"); popup.id = "zen-notes-style-menu"; popup.dataset.zenNotesMenu = "true"; document.getElementById("mainPopupSet").append(popup); }
              const menu = this._editingMenus(toolbar._selection)[1];
              popup.replaceChildren(...Array.from(menu.firstChild.children));
              this._contextMenuOpen = true;
              popup.addEventListener("popuphidden", () => { this._contextMenuOpen = false; }, { once: true });
              popup.openPopup(button, "after_start", 0, 0, false, false);
            } else this._format(action, toolbar._selection);
          });
          toolbar.append(button);
        }
        page.append(toolbar);
      }
      toolbar._selection = { ...selected }; toolbar._noteId = this.currentNoteId;
      const active = this._formatState(selected);
      for (const button of toolbar.querySelectorAll("button[data-action]")) {
        if (button.dataset.action !== "paragraph") button.setAttribute("aria-pressed", String(active[button.dataset.action] || false));
      }
      const rect = selection.getRangeAt(0).getBoundingClientRect(), bounds = page.getBoundingClientRect();
      if (rect.bottom < bounds.top || rect.top > bounds.bottom) { toolbar.hidden = true; return; }
      toolbar.hidden = false;
      toolbar.style.left = `${Math.max(8, Math.min(bounds.width - toolbar.offsetWidth - 8, rect.left - bounds.left))}px`;
      const above = rect.top - bounds.top - toolbar.offsetHeight - 8;
      toolbar.style.top = `${Math.max(8, Math.min(bounds.height - toolbar.offsetHeight - 8, above >= 8 ? above : rect.bottom - bounds.top + 8))}px`;
    }

    _editingMenus(selection) {
      const format = [["Bold", "bold"], ["Italic", "italic"], ["Underline", "underline"], ["Strikethrough", "strike"], ["Highlight", "highlight"], null,
        ["Code", "code"], ["Maths", "maths"], ["Comment", "comment"], ["Spoiler", "spoiler"], null, ["Clear Formatting", "clear"]];
      const paragraph = [["Bullet List", "bullet"], ["Numbered List", "numbered"], ["Task List", "task"], null,
        ...Array.from({ length: 6 }, (_, n) => [`Heading ${n + 1}`, `h${n + 1}`]), ["Body", "body"], null, ["Quote", "quote"]];
      const insert = [["Link…", "link"], ["Footnote", "footnote"], ["Table", "table"], ["Callout", "callout"], ["Horizontal Rule", "rule"], null,
        ["Code Block", "codeblock"], ["Maths Block", "mathblock"], null, ["Date", "date"]];
      return [["Format", format], ["Paragraph", paragraph], ["Insert", insert]].map(([label, entries]) => {
        const menu = document.createXULElement("menu"); menu.setAttribute("label", label);
        const popup = document.createXULElement("menupopup");
        for (const entry of entries) {
          if (!entry) { popup.append(document.createXULElement("menuseparator")); continue; }
          const [title, action] = entry;
          const item = this._menuItem(title, () => {
            if (label === "Paragraph") this._paragraph(action, selection);
            else if (label === "Insert" && action !== "link") this._insertSyntax(action, selection);
            else this._format(action, selection);
          });
          item.disabled = !selection;
          if (label === "Format" && ["bold", "italic"].includes(action)) item.setAttribute("acceltext", (Services.appinfo.OS === "Darwin" ? "⌘" : "Ctrl+") + action[0].toUpperCase());
          popup.append(item);
        }
        menu.append(popup); return menu;
      });
    }

    _paragraph(action, selection) {
      if (!selection) return;
      const body = this._editorMarkdown();
      const start = selection.start === 0 ? 0 : body.lastIndexOf("\n", selection.start - 1) + 1;
      const newline = body.indexOf("\n", Math.max(selection.start, selection.end - 1));
      const end = newline < 0 ? body.length : newline;
      const raw = body.slice(start, end).split("\n").map((line, index) => {
        const clean = line.replace(/^(?:\s*[-*+]\s+(?:\[[ xX]\]\s*)?|\s*\d+[.)]\s+|#{1,6}\s+|>\s?)/, "");
        const prefix = { bullet: "- ", numbered: `${index + 1}. `, task: "- [ ] ", quote: "> ", body: "" }[action] ?? (/^h[1-6]$/.test(action) ? "#".repeat(Number(action[1])) + " " : "");
        return prefix + clean;
      }).join("\n");
      this._replaceBodySelection(raw, { start, end }); this._finishVisualEdit();
    }

    _insertSyntax(action, selection) {
      if (!selection) return;
      const body = this._editorMarkdown(), selected = body.slice(selection.start, selection.end);
      if (action === "date") { this._format("date", selection); return; }
      if (action === "footnote") {
        let n = 1; while (body.includes(`[^${n}]`)) n++;
        this._recordHistory();
        this._setBody(body.slice(0, selection.start) + selected + `[^${n}]` + body.slice(selection.end) + `\n\n[^${n}]: Footnote`);
        this._queueSave(); this._hideSelectionToolbar(); return;
      }
      const templates = { table: "|  |  |\n| --- | --- |\n|  |  |", callout: "> [!note]\n> " + (selected || "Note"),
        rule: "---", codeblock: "```\n" + selected + "\n```", mathblock: "$$\n" + (selected || "x = y") + "\n$$" };
      if (!(action in templates)) return;
      const prefix = selection.start > 0 && body[selection.start - 1] !== "\n" ? "\n\n" : "";
      const suffix = selection.end < body.length && body[selection.end] !== "\n" ? "\n\n" : "\n";
      this._replaceBodySelection(prefix + templates[action] + suffix, selection);
      if (action === "table") {
        const start = (body.slice(0, selection.start) + prefix).split("\n").length - 1;
        this._commitActiveLine(); this._focusTableCell(start, 0, 0); this._hideSelectionToolbar();
      } else this._finishVisualEdit();
    }

    _editorContextMenu(event) {
      event.preventDefault();
      event.stopPropagation();
      const selection = window.getSelection();
      const range = selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
      const target = event.target.closest("[contenteditable]");
      let bodySelection = this._bodySelection();
      const clickedLine = event.target.closest(".zen-notes-line");
      if (clickedLine && (!bodySelection || selection.isCollapsed)) {
        const lines = Array.from(clickedLine.parentElement.children), index = lines.indexOf(clickedLine);
        const start = lines.slice(0, index).reduce((sum, line) => sum + (line.dataset.raw || "").length + 1, 0) + this._rawOffsetFromPointer(clickedLine, event.clientX, event.clientY);
        bodySelection = { start, end: start };
      }
      this._hideSelectionToolbar();
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
      const tableCell = event.target.closest(".zen-notes-table-cell");
      if (tableCell && this._tableContextMenu(popup, tableCell)) {
        popup.openPopupAtScreen(event.screenX, event.screenY, true); return;
      }
      const frame = event.target.closest(".zen-notes-image-frame");
      if (frame) {
        const line = frame.closest(".zen-notes-line"), index = Number(frame.dataset.imageIndex);
        const noteId = this.currentNoteId, raw = line.dataset.raw;
        popup.append(this._menuItem("Copy Image", () => this._copyNoteImage(frame.querySelector("img"))));
        popup.append(document.createXULElement("menuseparator"));
        popup.append(this._menuItem("Delete Image", () => {
          if (this.currentNoteId !== noteId || !line.isConnected || line.dataset.raw !== raw) return;
          this._recordHistory(); line.dataset.raw = this._removeImageRaw(raw, index);
          this._renderAllLines(); this._queueSave();
        }));
        popup.openPopupAtScreen(event.screenX, event.screenY, true); return;
      }
      const video = event.target.closest("[data-video-id]");
      if (video) {
        const id = video.dataset.videoId, note = this._getNote(this.currentNoteId);
        const hidden = note?.compactVideos?.includes(id);
        popup.append(this._menuItem(hidden ? "Show Video Preview" : "Hide Video Preview", async () => {
          if (!note) return;
          note.compactVideos = hidden ? note.compactVideos.filter(value => value !== id) : [...(note.compactVideos || []), id];
          await this._writeIndex(); this._renderAllLines();
        }));
        popup.append(document.createXULElement("menuseparator"));
      }
      for (const [label, command] of [["Copy", "copy"], ["Cut", "cut"], ["Paste", "paste"], ["Select All", "selectAll"]]) {
        const item = this._menuItem(label, () => {
          if (!document.getElementById("zen-notes-editor").hasAttribute("contenteditable")) target?.focus();
          if (range) { selection.removeAllRanges(); selection.addRange(range); }
          if (command === "selectAll") {
            this._selectAll();
          } else document.execCommand(command);
        });
        if ((command === "copy" || command === "cut") && selection.isCollapsed) item.disabled = true;
        popup.append(item);
      }
      const noteLink = document.createXULElement("menu"); noteLink.setAttribute("label", "Link to Note");
      const noteChoices = document.createXULElement("menupopup");
      for (const note of this.notes.filter(note => note.id !== this.currentNoteId)) {
        noteChoices.append(this._menuItem(note.title, () => this._replaceBodySelection(`[[${note.id}|${(this._editorMarkdown().slice(bodySelection.start, bodySelection.end) || note.title).replace(/[\[\]|\r\n]/g, " ")}]]`, bodySelection)));
      }
      noteLink.disabled = !bodySelection || !noteChoices.children.length;
      noteLink.append(noteChoices);
      const menus = this._editingMenus(bodySelection);
      popup.append(document.createXULElement("menuseparator"), ...menus);
      const colors = document.createXULElement("menu"); colors.setAttribute("label", "Colors");
      const colorOptions = document.createXULElement("menupopup");
      colorOptions.append(this._colorMenu("Text Color", "color", bodySelection), this._colorMenu("Background Color", "background-color", bodySelection));
      colors.append(colorOptions); popup.append(colors, noteLink);
      popup.append(document.createXULElement("menuseparator"));
      if (Services.appinfo.OS === "Darwin") popup.append(this._menuItem("Send to Apple Notes", () => this._sendToAppleNotes()));
      popup.append(this._menuItem("Export…", () => this._exportNote()));
      popup.append(this._menuItem("Import Markdown…", () => this._importNote()));
      if (!this._getNote(this.currentNoteId)?.quick) popup.append(document.createXULElement("menuseparator"), this._menuItem(Services.appinfo.OS === "Darwin" ? "Show in Finder" : "Show in Folder", () => this._revealNote(this.currentNoteId)));
      popup.openPopupAtScreen(event.screenX, event.screenY, true);
    }

    _hasOpenNoteTab(id) {
      for (const browserWindow of Services.wm.getEnumerator("navigator:browser")) {
        if (browserWindow.closed) continue;
        if (Array.from(browserWindow.gBrowser?.tabs || []).some(tab => !tab.closing && this._idFromTab(tab) === id)) return true;
      }
      return false;
    }

    async _readSelectedFragment(browser) {
      if (this.currentNoteId) {
        const selection = window.getSelection();
        if (selection?.rangeCount && !selection.isCollapsed) {
          const rect = selection.getRangeAt(0).getBoundingClientRect();
          return { text: selection.toString(), x: window.mozInnerScreenX + rect.left, y: window.mozInnerScreenY + rect.bottom };
        }
      }
      const manager = browser.messageManager;
      if (!manager) return null;
      const topic = `ZenNotes:Selection:${Date.now()}:${Math.random()}`;
      return new Promise(resolve => {
        const finish = value => { window.clearTimeout(timer); manager.removeMessageListener(topic, receive); resolve(value); };
        const receive = message => finish(message.data);
        const timer = window.setTimeout(() => finish(null), 2000);
        manager.addMessageListener(topic, receive);
        const script = function(topic) {
          function find(win) {
            const selection = win.getSelection();
            if (selection?.rangeCount && !selection.isCollapsed) {
              const rect = selection.getRangeAt(0).getBoundingClientRect();
              return { text: selection.toString(), x: win.mozInnerScreenX + rect.left, y: win.mozInnerScreenY + rect.bottom };
            }
            for (let i = 0; i < win.frames.length; i++) { try { const found = find(win.frames[i]); if (found) return found; } catch {} }
            return null;
          }
          sendAsyncMessage(topic, find(content));
        };
        try { manager.loadFrameScript(`data:application/javascript,${encodeURIComponent(`(${script})(${JSON.stringify(topic)})`)}`, false); }
        catch { finish(null); }
      });
    }

    async _addSelectionShortcut() {
      const browser = gBrowser.selectedBrowser;
      const source = { url: browser.currentURI.spec, title: browser.contentTitle };
      const fragment = await this._readSelectedFragment(browser);
      let text = fragment?.text || "";
      if (!text) {
        const result = await browser.finder.getInitialSelection();
        text = typeof result === "string" ? result : result?.selectedText || "";
      }
      if (!text.trim()) return;
      await this._filterDeletedNotes();
      document.getElementById("zen-notes-selection-picker")?.remove();
      const popup = document.createXULElement("menupopup"); popup.id = "zen-notes-selection-picker";
      for (const note of this.notes) popup.append(this._menuItem(note.title, () => this._appendSelection(note.id, text, "Text", source)));
      popup.append(document.createXULElement("menuseparator"));
      popup.append(this._menuItem("New Note…", async () => { const note = await this.createNote(); await this._appendSelection(note.id, text, "Text", source); }));
      document.getElementById("mainPopupSet").append(popup);
      popup.setAttribute("sizetopopup", "none");
      const bounds = browser.getBoundingClientRect();
      const x = fragment?.x ?? window.mozInnerScreenX + bounds.left + bounds.width / 2;
      const y = fragment?.y ?? window.mozInnerScreenY + bounds.top + bounds.height / 2;
      popup.openPopupAtScreen(x, y + 4, true);
    }

    async _addSelectionMenu(popup) {
      popup.querySelector("#zen-notes-add-selection")?.remove();
      popup.querySelector("#zen-notes-add-selection-separator")?.remove();
      const context = window.gContextMenu;
      const generation = this._selectionMenuGeneration = (this._selectionMenuGeneration || 0) + 1;
      await this._filterDeletedNotes();
      if (generation !== this._selectionMenuGeneration) return;
      const source = { url: context?.browser?.currentURI?.spec || gBrowser.selectedBrowser?.currentURI?.spec, title: context?.browser?.contentTitle || gBrowser.selectedBrowser?.contentTitle };
      const imageURL = context?.onImage ? context.imageURL || context.mediaURL : "";
      const isImage = /^https?:\/\//i.test(imageURL || "");
      const linkURL = context?.onLink ? context.linkURL : "";
      const isLink = !isImage && /^(?:https?:|mailto:)/i.test(linkURL || "");
      const text = isLink ? linkURL : isImage ? `![Image](<${imageURL.replace(/>/g, "%3E")}>)` : context?.selectionInfo?.fullText || context?.contentData?.selectionInfo?.fullText || context?.selectedText || "";
      if (typeof text !== "string" || !text.trim()) return;
      const menu = document.createXULElement("menu");
      menu.id = "zen-notes-add-selection";
      menu.dataset.zenNotesMenu = "true";
      menu.setAttribute("label", isLink ? "Add Link to Note" : "Add to Note");
      const choices = document.createXULElement("menupopup");
      for (const note of this.notes.filter(note => this._hasOpenNoteTab(note.id))) choices.append(this._menuItem(note.title, () => this._appendSelection(note.id, text, isLink ? "Link" : isImage ? "Image" : "Text", source)));
      choices.append(document.createXULElement("menuseparator"));
      choices.append(this._menuItem("New Note…", async () => {
        const note = await this.createNote();
        await this._appendSelection(note.id, text, isLink ? "Link" : isImage ? "Image" : "Text", source);
      }));
      menu.append(choices);
      const separator = document.createXULElement("menuseparator");
      separator.id = "zen-notes-add-selection-separator";
      separator.dataset.zenNotesMenu = "true";
      const separators = Array.from(popup.children).filter(node =>
        node.localName === "menuseparator" && !node.hidden &&
        node.getAttribute("hidden") !== "true" &&
        window.getComputedStyle(node).display !== "none");
      const first = separators[0];
      const anchor = first || popup.firstChild;
      popup.insertBefore(menu, anchor);
      if (!first) popup.insertBefore(separator, anchor);
    }

    async _appendSelection(id, text, kind = "Text", source = null) {
      if (source?.url && /^https?:\/\//i.test(source.url)) {
        const label = (source.title || source.url).replace(/[\[\]\r\n]/g, " ");
        text = text.trimEnd() + ` [Source: ${label}](<${source.url.replace(/>/g, "%3E")}>)`;
      }
      let added = false;
      if (this.currentNoteId === id) await this._saveCurrentNow();
      await this._enqueueWrite(async () => {
        const note = this._getNote(id);
        if (!note || this._closingNotes.has(id) || await FileIO.exists(this._deletedPath(id)) || !(await FileIO.exists(this._notePath(id)))) { await this._filterDeletedNotes(); return; }
        const data = await this._readNote(note);
        await FileIO.writeUTF8(this._notePath(id), `# ${data.title}\n\n${this._appendBody(data.body, text, kind)}`);
        note.updatedAt = new Date().toISOString();
        await this._writeIndex();
        added = true;
      });
      if (added && this.currentNoteId === id) await this._showNote(id);
      if (added) this._showAddedToast(id, kind);
    }

    async _openLinkedNote(id) {
      const note = this._getNote(id);
      if (!note) return;
      for (const win of Services.wm.getEnumerator("navigator:browser")) {
        if (win.closed || !win.gBrowser) continue;
        const tabs = win.gZenWorkspaces?.allStoredTabs || win.gBrowser.tabs;
        const tab = Array.from(tabs).find(tab => !tab.closing && this._idFromTab(tab) === id);
        if (!tab) continue;
        const space = tab.getAttribute("zen-workspace-id");
        if (space && space !== win.gZenWorkspaces?.activeWorkspace) await win.gZenWorkspaces.changeWorkspaceWithID(space);
        win.gBrowser.selectedTab = tab; win.focus(); return;
      }
      this._openNoteTab(note, { select: true });
    }

    async _showAddedToast(id, kind) {
      const manager = window.gZenUIManager;
      if (!manager?.showToast) return;
      const message = "zen-notes-content-added";
      const pending = manager.showToast(message, { timeout: 6000 });
      const toast = Array.from(document.getElementById("zen-toast-container")?.children || []).find(el => el._messageId === message);
      if (toast) {
        const label = toast.querySelector("label");
        label.removeAttribute("data-l10n-id");
        label.textContent = kind === "Saved" ? "Note saved" : `${kind} added to note`;
        label.onclick = () => this._openLinkedNote(id);
        label.style.cursor = "pointer";
        toast.querySelector("button")?.remove();
        toast.removeAttribute("button");
      }
      await pending;
    }

    async _followLink(link, glance = false) {
      if (link.dataset.target) {
        await this._filterDeletedNotes();
        const target = link.dataset.target.trim();
        const note = this.notes.find(note => note.id === target) || this.notes.find(note => note.title.toLowerCase() === target.toLowerCase());
        if (note) {
          this._openLinkedNote(note.id);
        }
        return;
      }
      let href = this._expandImages(link.dataset.href || "");
      if (/^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/i.test(href)) {
        const bytes = Uint8Array.from(atob(href.split(",")[1]), c => c.charCodeAt(0));
        if (!this._isPDF(bytes)) return;
        const dir = Paths.join(Paths.tempDir, "zen-notes-pdf");
        await FileIO.makeDirectory(dir, { ignoreExisting: true });
        const path = Paths.join(dir, `${this._makeId()}.pdf`);
        await FileIO.write(path, bytes);
        const file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsIFile); file.initWithPath(path);
        window.openTrustedLinkIn(Services.io.newFileURI(file).spec, "tab"); return;
      }
      if (!/^https?:\/\//i.test(href || "")) return;
      if (glance && window.gZenGlanceManager?.openGlance) {
        // No content snapshot for chrome-editor links. In particular, never
        // request a snapshot with missing clientX/clientY coordinates.
        window.gZenGlanceManager.lastLinkClickData = { clientX: 0, clientY: 0, width: 0, height: 0 };
        await window.gZenGlanceManager.openGlance({ url: href,
          triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() });
      } else window.openTrustedLinkIn(href, "tab");
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
        this._restoreTabMenu?.();
        const tab = globalThis.TabContextMenu?.contextTab;
        const id = this._idFromTab(tab);
        const added = [], states = [];
        const append = item => { added.push(item); popup.append(item); };
        if (id && this._getNote(id)) {
          const keep = new Set(["context_moveTabToGroup", "context_moveTabToSplitView", "context_separateSplitView", "context_reverseSplitView"]);
          for (const child of popup.children) {
            states.push([child, child.hidden]);
            if (!keep.has(child.id)) child.hidden = true;
          }
          append(this._menuItem("Rename Note…", () => this._startNativeRename(tab)));
          append(this._menuItem("Duplicate Note", () => this._duplicateNote(id)));
          append(document.createXULElement("menuseparator"));
          append(this._menuItem(tab.pinned ? "Unpin Note" : "Pin Note", () => tab.pinned ? gBrowser.unpinTab(tab) : gBrowser.pinTab(tab)));
          append(document.createXULElement("menuseparator"));
          append(this._menuItem("Export Note…", () => this._exportNote(id)));
          append(document.createXULElement("menuseparator"));
          append(this._menuItem("Delete Note", async () => { await this._deleteNote(id); this._showNotice("Note deleted"); }));
        } else {
          const url = tab?.linkedBrowser?.currentURI?.spec;
          if (/^https?:\/\//i.test(url || "")) {
            const menu = document.createXULElement("menu"); menu.setAttribute("label", "Add Page to Note");
            const choices = document.createXULElement("menupopup");
            const text = `[${(tab.label || url).replace(/[\[\]\r\n]/g, " ")}](<${url.replace(/>/g, "%3E")}>)`;
            for (const note of this.notes) choices.append(this._menuItem(note.title, () => this._appendSelection(note.id, text, "Link")));
            if (choices.children.length) choices.append(document.createXULElement("menuseparator"));
            choices.append(this._menuItem("New Note…", async () => { const note = await this.createNote(); await this._appendSelection(note.id, text, "Link"); }));
            menu.append(choices);
            added.push(menu);
            const moveToFolder = Array.from(popup.children).find(node => node.id === "context_moveTabToGroup" || /move to folder/i.test(node.getAttribute?.("label") || ""));
            popup.insertBefore(menu, moveToFolder?.nextSibling || popup.firstChild);
          }
        }
        const restore = () => { for (const [node, hidden] of states) node.hidden = hidden; for (const node of added) node.remove(); this._restoreTabMenu = null; };
        this._restoreTabMenu = restore;
        const hidden = event => { if (event.target !== popup) return; popup.removeEventListener("popuphidden", hidden); restore(); };
        popup.addEventListener("popuphidden", hidden);
        return;
      }
      if (["toolbar-context-menu", "zen-sidebar-context-menu"].includes(popup.id)) {
        if (!popup.querySelector("[data-zen-notes-create]")) {
          const item = this._menuItem("New Note", () => this.createNote());
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
        item.setAttribute("label", "New Note");
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
      this._reserveNoteShortcuts();
      this._bindCreateButton();
      this._recoverExistingNoteTabs();
      const id = this._idFromTab(gBrowser?.selectedTab);
      if (id && this._getNote(id)) this._ensurePage();
    }

    destroy() {
      this._destroyed = true;
      this._cancelMouseSelection?.();
      document.removeEventListener("selectionchange", this._selectionChanged);
      for (const browser of document.querySelectorAll("browser[zen-notes-content]")) browser.removeAttribute("zen-notes-content");
      for (const [key, disabled] of this._reservedKeys || []) {
        if (disabled === null) key.removeAttribute("disabled"); else key.setAttribute("disabled", disabled);
      }
      this._reservedKeys?.clear();
      for (const timer of this._popupRepairTimers || []) window.clearTimeout(timer);
      document.querySelectorAll(".zen-notes-page-preview").forEach(el => el.remove());
      this._clearFind();
      window.clearTimeout(this.saveTimer);
      window.removeEventListener("keydown", this._onFindShortcut, true);
      document.removeEventListener("popupshowing", this._onPopupShowing, false);
      document.removeEventListener("command", this._onNativeBoostButton, true);
      gBrowser?.tabContainer?.removeEventListener("TabSelect", this._onTabSelect);
      document.removeEventListener("TabClose", this._onTabClose, true);
      document.removeEventListener("SSTabRestored", this._onSessionRestored);
      window.removeEventListener("SSWindowStateReady", this._onSessionRestored);
      this.observer?.disconnect();
      this.titleObserver?.disconnect();
      this._unregisterNotesProvider?.();
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

      this._restoreTabMenu?.();
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
