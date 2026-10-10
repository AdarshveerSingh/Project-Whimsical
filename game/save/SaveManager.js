// ============================================================
// SAVE MANAGER
// ============================================================
//
// IndexedDB     save records (full CRUD)
// localStorage  player settings
// sessionStorage  one-shot "load this save after reload" handoff
// Cookie        id of the last save used ("continue")
//
// A save record:
//   {
//     id,            // unique id (IndexedDB key)
//     version,       // save format version, for migrations
//     name,          // shown in the menu
//     seed,          // world seed (the world is regenerated from it)
//     createdAt,     // ms since epoch
//     updatedAt,     // ms since epoch
//     state          // player position, rotation, play time, ... (or null)
//   }
//
// Terrain, trees and so on are deterministic from the seed,
// so they never need to be stored.
// ============================================================


const DB_NAME = "worldgame";
const DB_VERSION = 1;
const STORE = "saves";

export const SAVE_VERSION = 1;

const PENDING_KEY = "worldgame.pendingSave";       // sessionStorage
const SETTINGS_KEY = "worldgame.settings";         // localStorage
const LAST_SAVE_COOKIE = "worldgame_lastSave";     // cookie

const DEFAULT_SETTINGS = {
    masterVolume: 0.8,
    viewDistance: 3,
    showStats: true
};


// ------------------------------------------------------------
// COOKIE HELPERS
// ------------------------------------------------------------

function setCookie(name, value, days = 365) {

    const expires = new Date(Date.now() + days * 86400000).toUTCString();

    document.cookie =
        `${name}=${encodeURIComponent(value)}; ` +
        `expires=${expires}; path=/; SameSite=Lax`;
}


function getCookie(name) {

    const entry = document.cookie
        .split("; ")
        .find((row) => row.startsWith(name + "="));

    return entry ? decodeURIComponent(entry.split("=")[1]) : null;
}


function deleteCookie(name) {

    document.cookie =
        `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}


// ------------------------------------------------------------
// RECORD HELPERS
// ------------------------------------------------------------

function makeId() {

    if (typeof crypto !== "undefined" && crypto.randomUUID) {
        return crypto.randomUUID();
    }

    return (
        Date.now().toString(36) + "-" +
        Math.random().toString(36).slice(2, 10)
    );
}


function cleanName(name) {

    return String(name ?? "").trim().slice(0, 60) || "Untitled world";
}


// Upgrade older records to the current format here
function migrate(record) {

    if (record.version === SAVE_VERSION) {
        return record;
    }

    return { ...record, version: SAVE_VERSION };
}


export class SaveManager {

    constructor() {

        this.db = null;
    }


    // ========================================================
    // OPEN DATABASE
    // ========================================================

    open() {

        return new Promise((resolve, reject) => {

            if (!("indexedDB" in window)) {
                reject(new Error("IndexedDB is not available."));
                return;
            }

            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = () => {

                const db = request.result;

                if (!db.objectStoreNames.contains(STORE)) {

                    const store = db.createObjectStore(STORE, {
                        keyPath: "id"
                    });

                    store.createIndex("updatedAt", "updatedAt");
                }
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this);
            };

            request.onerror = () => reject(request.error);
        });
    }


    // Runs `work` in one transaction. Resolves with the value passed
    // to set() once the transaction has committed.
    transaction(mode, work) {

        return new Promise((resolve, reject) => {

            const tx = this.db.transaction(STORE, mode);
            const store = tx.objectStore(STORE);

            let result;
            let failure = null;

            const set = (value) => { result = value; };

            const fail = (error) => {
                failure = error;
                tx.abort();
            };

            tx.oncomplete = () => resolve(result);

            tx.onabort = () => reject(
                failure ?? tx.error ?? new Error("Transaction aborted.")
            );

            work(store, set, fail);
        });
    }


    // ========================================================
    // CREATE
    // ========================================================

    create({ name, seed, state = null }) {

        const now = Date.now();

        const record = {
            id: makeId(),
            version: SAVE_VERSION,
            name: cleanName(name),
            seed: Number(seed),
            createdAt: now,
            updatedAt: now,
            state
        };

        return this.transaction("readwrite", (store, set) => {

            store.add(record);
            set(record);
        });
    }


    // ========================================================
    // READ
    // ========================================================

    get(id) {

        return this.transaction("readonly", (store, set) => {

            const request = store.get(id);

            request.onsuccess = () => {
                set(request.result ? migrate(request.result) : null);
            };
        });
    }


    // Newest first
    list() {

        return this.transaction("readonly", (store, set) => {

            const request = store.getAll();

            request.onsuccess = () => {

                set(
                    request.result
                        .map(migrate)
                        .sort((a, b) => b.updatedAt - a.updatedAt)
                );
            };
        });
    }


    // ========================================================
    // UPDATE
    // ========================================================
    //
    // Merges `changes` into the record (for example { name } or
    // { seed, state }) and refreshes updatedAt.
    //

    update(id, changes) {

        return this.transaction("readwrite", (store, set, fail) => {

            const request = store.get(id);

            request.onsuccess = () => {

                const existing = request.result;

                if (!existing) {
                    fail(new Error(`Save not found: ${id}`));
                    return;
                }

                const updated = {
                    ...existing,
                    ...changes,
                    id: existing.id,
                    createdAt: existing.createdAt,
                    version: SAVE_VERSION,
                    updatedAt: Date.now()
                };

                if (changes.name !== undefined) {
                    updated.name = cleanName(changes.name);
                }

                store.put(updated);
                set(updated);
            };
        });
    }


    // ========================================================
    // DELETE
    // ========================================================

    async remove(id) {

        await this.transaction("readwrite", (store) => {
            store.delete(id);
        });

        if (this.getLastSaveId() === id) {
            this.setLastSaveId(null);
        }
    }


    // ========================================================
    // LOAD HANDOFF (sessionStorage)
    // ========================================================
    //
    // The world is built from the seed at startup, so loading a
    // save reloads the page. The chosen id survives the reload here.
    //

    setPendingLoad(id) {

        sessionStorage.setItem(PENDING_KEY, id);
    }


    consumePendingLoad() {

        const id = sessionStorage.getItem(PENDING_KEY);

        sessionStorage.removeItem(PENDING_KEY);

        return id;
    }


    // ========================================================
    // LAST SAVE (cookie)
    // ========================================================

    getLastSaveId() {

        return getCookie(LAST_SAVE_COOKIE);
    }


    setLastSaveId(id) {

        if (id) {
            setCookie(LAST_SAVE_COOKIE, id);
        } else {
            deleteCookie(LAST_SAVE_COOKIE);
        }
    }


    // ========================================================
    // SETTINGS (localStorage)
    // ========================================================

    getSettings() {

        try {

            const stored = JSON.parse(
                localStorage.getItem(SETTINGS_KEY) ?? "{}"
            );

            return { ...DEFAULT_SETTINGS, ...stored };

        } catch {

            return { ...DEFAULT_SETTINGS };
        }
    }


    updateSettings(changes) {

        const settings = { ...this.getSettings(), ...changes };

        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

        return settings;
    }


    resetSettings() {

        localStorage.removeItem(SETTINGS_KEY);

        return { ...DEFAULT_SETTINGS };
    }
}