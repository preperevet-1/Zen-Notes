"use strict";

(() => {
  const LOG = "[Zen Notes]";

  // Allows Sine / startup-cache reloads without duplicating the UI.
  if (window.gZenNotes?.destroy) {
    try {
      window.gZenNotes.destroy();
    } catch (error) {
      console.error(LOG, "Failed to destroy previous instance", error);
    }
  }

  // IOUtils and PathUtils are privileged Firefox globals in browser chrome.
  // Keeping them as globals avoids depending on internal module paths.
  const FileIO = globalThis.IOUtils;
  const Paths = globalThis.PathUtils;

  if (!FileIO || !Paths) {
    throw new Error(`${LOG} IOUtils/PathUtils are unavailable in this chrome context`);
  }

  class ZenNotesController {
    constructor() {
      this.notes = [];
      this.storageDir = Paths.join(Paths.profileDir, "zen-notes");
      this.indexPath = Paths.join(this.storageDir, "index.json");

      this.currentNoteId = null;
      this.saveTimer = null;
      this._expectingCreatePopupUntil = 0;
      this._destroyed = false;

      this._onPopupShowing = this._onPopupShowing.bind(this);
      this._onCreateButtonPointer = this._onCreateButtonPointer.bind(this);
      this._onKeyDown = this._onKeyDown.bind(this);
      this._onMutation = this._onMutation.bind(this);
    }

    async init() {
      try {
        await this._ensureStorage();
        await this._loadIndex();

        document.addEventListener("popupshowing", this._onPopupShowing, true);
        document.addEventListener("keydown", this._onKeyDown, true);

        this.observer = new MutationObserver(this._onMutation);
        this.observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
        });

        this._bindCreateButton();
        this._ensureSidebar();
        this._renderSidebar();

        console.info(LOG, "0.1.0-alpha loaded");
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
      const payload = JSON.stringify(
        {
          version: 1,
          notes: this.notes,
        },
        null,
        2
      );

      await FileIO.writeUTF8(this.indexPath, payload);
    }

    _makeId() {
      if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
      return `note-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    _notePath(id) {
      return Paths.join(this.storageDir, `${id}.md`);
    }

    async createNote() {
      const now = new Date().toISOString();
      const note = {
        id: this._makeId(),
        title: "Untitled Note",
        createdAt: now,
        updatedAt: now,
      };

      this.notes.unshift(note);
      await this._writeIndex();
      await FileIO.writeUTF8(this._notePath(note.id), "# Untitled Note\n\n");

      this._renderSidebar();
      await this.openNote(note.id, { focusTitle: true });
    }

    async _readNoteBody(note) {
      const path = this._notePath(note.id);
      if (!(await FileIO.exists(path))) return "";

      try {
        const raw = await FileIO.readUTF8(path);
        const lines = raw.replace(/\r\n/g, "\n").split("\n");

        // Markdown files are kept standalone/exportable: first line is the title.
        if (lines[0]?.startsWith("# ")) {
          lines.shift();
          if (lines[0] === "") lines.shift();
        }

        return lines.join("\n");
      } catch (error) {
        console.error(LOG, `Failed reading note ${note.id}`, error);
        return "";
      }
    }

    async _saveCurrentNow() {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = null;

      if (!this.currentNoteId) return;

      const note = this.notes.find((item) => item.id === this.currentNoteId);
      const titleInput = document.getElementById("zen-notes-title");
      const bodyInput = document.getElementById("zen-notes-body");
      if (!note || !titleInput || !bodyInput) return;

      const title = titleInput.value.trim() || "Untitled Note";
      const body = bodyInput.value;

      note.title = title;
      note.updatedAt = new Date().toISOString();

      await FileIO.writeUTF8(this._notePath(note.id), `# ${title}\n\n${body}`);
      await this._writeIndex();
      this._renderSidebar();
    }

    _queueSave() {
      window.clearTimeout(this.saveTimer);
      this.saveTimer = window.setTimeout(() => {
        this._saveCurrentNow().catch((error) =>
          console.error(LOG, "Autosave failed", error)
        );
      }, 350);
    }

    async openNote(noteId, options = {}) {
      if (this.currentNoteId && this.currentNoteId !== noteId) {
        await this._saveCurrentNow();
      }

      const note = this.notes.find((item) => item.id === noteId);
      if (!note) return;

      this.currentNoteId = noteId;
      const body = await this._readNoteBody(note);
      this._ensureEditor();

      const overlay = document.getElementById("zen-notes-overlay");
      const titleInput = document.getElementById("zen-notes-title");
      const bodyInput = document.getElementById("zen-notes-body");

      titleInput.value = note.title || "Untitled Note";
      bodyInput.value = body;
      overlay.hidden = false;

      this._renderSidebar();

      window.setTimeout(() => {
        if (options.focusTitle) {
          titleInput.focus();
          titleInput.select();
        } else {
          bodyInput.focus();
        }
      }, 0);
    }

    async closeEditor() {
      await this._saveCurrentNow();
      const overlay = document.getElementById("zen-notes-overlay");
      if (overlay) overlay.hidden = true;
      this.currentNoteId = null;
      this._renderSidebar();
    }

    _ensureEditor() {
      if (document.getElementById("zen-notes-overlay")) return;

      const overlay = document.createElement("div");
      overlay.id = "zen-notes-overlay";
      overlay.hidden = true;

      const panel = document.createElement("section");
      panel.id = "zen-notes-editor";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", "Zen Notes editor");

      const header = document.createElement("div");
      header.className = "zen-notes-editor-header";

      const title = document.createElement("input");
      title.id = "zen-notes-title";
      title.type = "text";
      title.placeholder = "Untitled Note";
      title.autocomplete = "off";
      title.spellcheck = true;
      title.addEventListener("input", () => this._queueSave());

      const close = document.createElement("button");
      close.id = "zen-notes-close";
      close.type = "button";
      close.setAttribute("aria-label", "Close note");
      close.textContent = "×";
      close.addEventListener("click", () => {
        this.closeEditor().catch((error) => console.error(LOG, error));
      });

      header.append(title, close);

      const body = document.createElement("textarea");
      body.id = "zen-notes-body";
      body.placeholder = "Write Markdown…";
      body.spellcheck = true;
      body.addEventListener("input", () => this._queueSave());

      const footer = document.createElement("div");
      footer.className = "zen-notes-editor-footer";
      footer.textContent = "Markdown · autosaved locally";

      panel.append(header, body, footer);
      overlay.append(panel);

      overlay.addEventListener("mousedown", (event) => {
        if (event.target === overlay) {
          this.closeEditor().catch((error) => console.error(LOG, error));
        }
      });

      document.documentElement.appendChild(overlay);
    }

    _ensureSidebar() {
      if (document.getElementById("zen-notes-sidebar")) return true;

      const tabs = document.getElementById("tabbrowser-tabs");
      if (!tabs?.parentNode) return false;

      const section = document.createElement("section");
      section.id = "zen-notes-sidebar";
      section.hidden = true;

      const header = document.createElement("div");
      header.className = "zen-notes-sidebar-header";
      header.textContent = "Notes";

      const list = document.createElement("div");
      list.id = "zen-notes-list";

      section.append(header, list);
      tabs.parentNode.insertBefore(section, tabs);
      return true;
    }

    _noteIcon() {
      return `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6.75 3.75h7.9l2.6 2.6v13.9H6.75z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
          <path d="M14.5 3.9v3h2.9M9.2 11h5.7M9.2 14.2h5.7" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
    }

    _renderSidebar() {
      if (!this._ensureSidebar()) return;

      const section = document.getElementById("zen-notes-sidebar");
      const list = document.getElementById("zen-notes-list");
      if (!section || !list) return;

      section.hidden = this.notes.length === 0;
      list.replaceChildren();

      for (const note of this.notes) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "zen-notes-item";
        row.dataset.zenNoteId = note.id;
        row.title = note.title || "Untitled Note";
        if (this.currentNoteId === note.id) row.dataset.active = "true";

        const icon = document.createElement("span");
        icon.className = "zen-notes-item-icon";
        icon.innerHTML = this._noteIcon();

        const label = document.createElement("span");
        label.className = "zen-notes-item-label";
        label.textContent = note.title || "Untitled Note";

        row.append(icon, label);
        row.addEventListener("click", () => {
          this.openNote(note.id).catch((error) => console.error(LOG, error));
        });

        list.appendChild(row);
      }
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
            (node.getAttribute?.("label") || "").trim().toLowerCase() ===
            "create folder"
        );

        const firstSeparator = children.find(
          (node) => node.localName === "menuseparator"
        );

        if (createFolder?.nextSibling) {
          popup.insertBefore(item, createFolder.nextSibling);
        } else if (firstSeparator) {
          popup.insertBefore(item, firstSeparator);
        } else {
          popup.insertBefore(item, popup.firstChild);
        }
      } catch (error) {
        console.error(LOG, "Could not add Create Note to Zen menu", error);
      }
    }

    _onKeyDown(event) {
      if (event.key === "Escape") {
        const overlay = document.getElementById("zen-notes-overlay");
        if (overlay && !overlay.hidden) {
          event.preventDefault();
          event.stopPropagation();
          this.closeEditor().catch((error) => console.error(LOG, error));
        }
      }
    }

    _onMutation() {
      if (this._destroyed) return;
      this._bindCreateButton();
      if (!document.getElementById("zen-notes-sidebar")) {
        this._ensureSidebar();
        this._renderSidebar();
      }
    }

    destroy() {
      this._destroyed = true;
      window.clearTimeout(this.saveTimer);

      document.removeEventListener("popupshowing", this._onPopupShowing, true);
      document.removeEventListener("keydown", this._onKeyDown, true);
      this.observer?.disconnect();

      if (this.createButton) {
        this.createButton.removeEventListener(
          "pointerdown",
          this._onCreateButtonPointer,
          true
        );
        this.createButton.removeEventListener(
          "click",
          this._onCreateButtonPointer,
          true
        );
        delete this.createButton.dataset.zenNotesBound;
      }

      document.getElementById("zen-notes-sidebar")?.remove();
      document.getElementById("zen-notes-overlay")?.remove();
      document.getElementById("zen-notes-create-menuitem")?.remove();
    }
  }

  const controller = new ZenNotesController();
  window.gZenNotes = controller;

  const start = () => controller.init();
  if (document.readyState === "complete") {
    start();
  } else {
    window.addEventListener("load", start, { once: true });
  }
})();
