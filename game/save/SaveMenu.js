// ============================================================
// SAVE MENU
// ============================================================
//
// Overlay that exposes every CRUD operation on saves:
//   Create  : "New world", "Save current game as new"
//   Read    : the list, "Load"
//   Update  : "Overwrite", "Rename" (and autosave)
//   Delete  : "Delete" (with confirmation)
//
// Press the toggle key (default K) to open or close it.
// All user text is inserted with textContent, never innerHTML.
// ============================================================


const STYLE = `
.sm-root {
    position: fixed; inset: 0; z-index: 1000;
    display: none; align-items: center; justify-content: center;
    background: rgba(0, 0, 0, 0.55);
    font: 14px system-ui, sans-serif; color: #e8eef4;
}
.sm-panel {
    width: min(580px, 92vw); max-height: 82vh; overflow: auto;
    background: #1b2530; border-radius: 10px; padding: 18px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
}
.sm-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.sm-title { font-size: 18px; font-weight: 600; }
.sm-status { min-height: 18px; margin-bottom: 8px; color: #8fd3a8; }
.sm-status.sm-error { color: #ff8a8a; }
.sm-form { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.sm-form input {
    flex: 1 1 140px; padding: 7px 9px; border-radius: 6px;
    border: 1px solid #3a4856; background: #121a22; color: inherit;
}
.sm-btn {
    padding: 6px 11px; border-radius: 6px; border: 1px solid #3a4856;
    background: #26323f; color: inherit; cursor: pointer;
}
.sm-btn:hover { background: #32414f; }
.sm-danger:hover { background: #6b2b2b; }
.sm-list { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.sm-row {
    display: flex; justify-content: space-between; align-items: center;
    gap: 10px; padding: 10px; border-radius: 8px; background: #222d39;
}
.sm-active { outline: 1px solid #5fb3d9; }
.sm-name { font-weight: 600; }
.sm-meta { font-size: 12px; opacity: 0.7; margin-top: 2px; }
.sm-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.sm-empty { opacity: 0.7; padding: 8px 2px; }
`;


function parseSeed(text) {

    const trimmed = text.trim();

    // Blank: random seed
    if (trimmed === "") {
        return Math.floor(Math.random() * 2147483646) + 1;
    }

    // Whole number: use as is
    if (/^-?\d+$/.test(trimmed)) {
        return Math.abs(Number(trimmed) | 0) || 1;
    }

    // Text: 32-bit FNV-1a hash
    let h = 2166136261;

    for (let i = 0; i < trimmed.length; i++) {
        h ^= trimmed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }

    return ((h >>> 0) % 2147483646) + 1;
}


function formatDuration(seconds) {

    const total = Math.floor(seconds || 0);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);

    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}


function element(tag, className, text) {

    const node = document.createElement(tag);

    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;

    return node;
}


export class SaveMenu {

    constructor({
        saves,
        activeSave = null,
        seed,
        getState,
        toggleKey = "KeyK"
    }) {

        this.saves = saves;
        this.activeId = activeSave?.id ?? null;
        this.seed = seed;
        this.getState = getState;
        this.toggleKey = toggleKey;

        this.isOpen = false;

        this.build();

        window.addEventListener("keydown", (event) => {

            if (event.code === this.toggleKey) {
                this.toggle();
            }
        });
    }


    // ========================================================
    // BUILD
    // ========================================================

    build() {

        const style = document.createElement("style");
        style.textContent = STYLE;
        document.head.appendChild(style);

        this.root = element("div", "sm-root");

        // Keep menu input away from the game's key and mouse handlers
        for (const type of ["keydown", "keyup", "keypress", "click", "mousedown"]) {
            this.root.addEventListener(type, (event) => event.stopPropagation());
        }

        const panel = element("div", "sm-panel");

        // Header
        const head = element("div", "sm-head");
        head.append(element("div", "sm-title", "Saved worlds"));

        const close = element("button", "sm-btn", "Close");
        close.addEventListener("click", () => this.hide());
        head.append(close);

        // Status line
        this.status = element("div", "sm-status");

        // Create form
        const form = element("div", "sm-form");

        this.nameInput = element("input");
        this.nameInput.placeholder = "World name";
        this.nameInput.maxLength = 60;

        this.seedInput = element("input");
        this.seedInput.placeholder = "Seed (blank = random)";

        const newWorld = element("button", "sm-btn", "New world");
        newWorld.addEventListener("click", () => this.createWorld());

        const saveNew = element("button", "sm-btn", "Save current game as new");
        saveNew.addEventListener("click", () => this.saveCurrentAsNew());

        form.append(this.nameInput, this.seedInput, newWorld, saveNew);

        // List
        this.list = element("div", "sm-list");

        panel.append(head, this.status, form, this.list);
        this.root.append(panel);
        document.body.appendChild(this.root);
    }


    // ========================================================
    // SHOW / HIDE
    // ========================================================

    toggle() {

        if (this.isOpen) {
            this.hide();
        } else {
            this.show();
        }
    }


    show() {

        this.isOpen = true;

        if (document.exitPointerLock) {
            document.exitPointerLock();
        }

        this.root.style.display = "flex";

        this.refresh();
    }


    hide() {

        this.isOpen = false;

        this.root.style.display = "none";
    }


    setStatus(message, isError = false) {

        this.status.textContent = message;

        this.status.className = isError ? "sm-status sm-error" : "sm-status";
    }


    // Runs a storage task and reports errors in the status line
    async run(task) {

        try {

            return { ok: true, value: await task() };

        } catch (error) {

            console.error(error);

            this.setStatus(`Error: ${error.message}`, true);

            return { ok: false };
        }
    }


    // ========================================================
    // READ: LIST
    // ========================================================

    async refresh() {

        const result = await this.run(() => this.saves.list());

        this.list.replaceChildren();

        if (!result.ok) {
            return;
        }

        if (result.value.length === 0) {

            this.list.append(
                element("div", "sm-empty", "No saves yet. Create one above.")
            );

            return;
        }

        for (const record of result.value) {
            this.list.append(this.renderRow(record));
        }
    }


    renderRow(record) {

        const isCurrent = record.id === this.activeId;

        const row = element("div", isCurrent ? "sm-row sm-active" : "sm-row");

        const info = element("div");

        info.append(
            element(
                "div",
                "sm-name",
                isCurrent ? `${record.name} (current)` : record.name
            ),
            element(
                "div",
                "sm-meta",
                `Seed ${record.seed} · saved ` +
                `${new Date(record.updatedAt).toLocaleString()} · played ` +
                `${formatDuration(record.state?.playTime)}`
            )
        );

        const actions = element("div", "sm-actions");

        const add = (label, handler, extraClass = "") => {

            const button = element("button", `sm-btn ${extraClass}`, label);
            button.addEventListener("click", handler);
            actions.append(button);
        };

        add("Load", () => this.loadSave(record.id));
        add("Overwrite", () => this.overwrite(record));
        add("Rename", () => this.rename(record));
        add("Delete", () => this.remove(record), "sm-danger");

        row.append(info, actions);

        return row;
    }


    // ========================================================
    // CREATE
    // ========================================================

    async createWorld() {

        const seed = parseSeed(this.seedInput.value);

        const result = await this.run(() =>
            this.saves.create({
                name: this.nameInput.value || `World ${seed}`,
                seed,
                state: null
            })
        );

        if (result.ok) {
            this.loadSave(result.value.id);
        }
    }


    async saveCurrentAsNew() {

        const result = await this.run(() =>
            this.saves.create({
                name: this.nameInput.value || "Saved game",
                seed: this.seed,
                state: this.getState()
            })
        );

        if (!result.ok) {
            return;
        }

        this.activeId = result.value.id;
        this.saves.setLastSaveId(result.value.id);

        this.nameInput.value = "";
        this.setStatus(`Created "${result.value.name}".`);

        await this.refresh();
    }


    // ========================================================
    // READ: LOAD
    // ========================================================

    // The world is generated from the seed at startup, so loading
    // hands the id over and reloads the page.
    loadSave(id) {

        this.saves.setPendingLoad(id);

        location.reload();
    }


    // ========================================================
    // UPDATE
    // ========================================================

    async overwrite(record) {

        if (!confirm(`Overwrite "${record.name}" with the current game?`)) {
            return;
        }

        const result = await this.run(() =>
            this.saves.update(record.id, {
                seed: this.seed,
                state: this.getState()
            })
        );

        if (!result.ok) {
            return;
        }

        this.activeId = record.id;
        this.saves.setLastSaveId(record.id);

        this.setStatus(`Saved to "${result.value.name}".`);

        await this.refresh();
    }


    async rename(record) {

        const name = prompt("New name:", record.name);

        if (name === null) {
            return;
        }

        const result = await this.run(() =>
            this.saves.update(record.id, { name })
        );

        if (result.ok) {
            this.setStatus(`Renamed to "${result.value.name}".`);
            await this.refresh();
        }
    }


    // Saves the current game into the active save periodically
    startAutosave(intervalMs = 60000) {

        const save = () => {

            if (!this.activeId) {
                return;
            }

            this.saves
                .update(this.activeId, { state: this.getState() })
                .catch((error) => console.warn("Autosave failed:", error));
        };

        this.autosaveTimer = setInterval(save, intervalMs);

        document.addEventListener("visibilitychange", () => {

            if (document.hidden) {
                save();
            }
        });
    }


    // ========================================================
    // DELETE
    // ========================================================

    async remove(record) {

        if (!confirm(`Delete "${record.name}"? This cannot be undone.`)) {
            return;
        }

        const result = await this.run(() => this.saves.remove(record.id));

        if (!result.ok) {
            return;
        }

        if (this.activeId === record.id) {
            this.activeId = null;
        }

        this.setStatus(`Deleted "${record.name}".`);

        await this.refresh();
    }
}