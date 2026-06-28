import { readFileSync, writeFileSync, existsSync } from "node:fs";
import chalk from "chalk";
const SAVE_FILE = "Configuração.save";
function loadData() {
    try {
        if (existsSync(SAVE_FILE)) {
            const raw = readFileSync(SAVE_FILE, "utf-8");
            return JSON.parse(raw);
        }
    }
    catch (e) {
        console.error(chalk.red("Erro ao carregar Configuração.save:"), e);
    }
    return { guilds: {}, members: {}, tickets: {}, transcripts: {} };
}
function saveData(data) {
    try {
        writeFileSync(SAVE_FILE, JSON.stringify(data, null, 2), "utf-8");
    }
    catch (e) {
        console.error(chalk.red("Erro ao salvar Configuração.save:"), e);
    }
}
let saveTimeout = null;
function scheduleSave() {
    if (saveTimeout)
        clearTimeout(saveTimeout);
    saveTimeout = setTimeout(flushSave, 500);
}
function flushSave() {
    persisted = {
        guilds: Object.fromEntries(guildsStore),
        members: Object.fromEntries(membersStore),
        tickets: Object.fromEntries(ticketsStore),
        transcripts: Object.fromEntries(transcriptsStore),
    };
    saveData(persisted);
}
let persisted = loadData();
const guildsStore = new Map(Object.entries(persisted.guilds));
const membersStore = new Map(Object.entries(persisted.members));
const ticketsStore = new Map(Object.entries(persisted.tickets));
const transcriptsStore = new Map(Object.entries(persisted.transcripts));
function createMemoryModel(store) {
    return {
        async clear() {
            store.clear();
            scheduleSave();
        },
        attachSave(doc, key) {
            if (typeof doc.save !== "function") {
                doc.save = async function () {
                    store.set(key, this);
                    scheduleSave();
                };
            }
        },
        async get(id) {
            if (!store.has(id)) {
                const doc = { id };
                store.set(id, doc);
                scheduleSave();
            }
            const doc = store.get(id);
            this.attachSave(doc, id);
            return doc;
        },
        async getByChannel(channelId) {
            for (const [key, doc] of store.entries()) {
                if (doc.channelId === channelId) {
                    this.attachSave(doc, key);
                    return doc;
                }
            }
            return null;
        },
        async create(data) {
            const key = data.id || data.channelId || Math.random().toString(36).substring(2, 10);
            const doc = { ...data };
            store.set(key, doc);
            this.attachSave(doc, key);
            scheduleSave();
            return doc;
        },
        async findOne(query) {
            for (const [key, doc] of store.entries()) {
                let match = true;
                for (const [k, v] of Object.entries(query)) {
                    if (doc[k] !== v) {
                        match = false;
                        break;
                    }
                }
                if (match) {
                    this.attachSave(doc, key);
                    return doc;
                }
            }
            return null;
        },
        async updateOne(filter, update, options) {
            let doc = await this.findOne(filter);
            if (!doc && options?.upsert) {
                const merged = { ...filter, ...(update.$set || {}) };
                doc = await this.create(merged);
            }
            if (doc && update.$set) {
                Object.assign(doc, update.$set);
                scheduleSave();
            }
            return doc;
        },
    };
}
const guilds = createMemoryModel(guildsStore);
const members = createMemoryModel(membersStore);
const tickets = createMemoryModel(ticketsStore);
const transcripts = createMemoryModel(transcriptsStore);
export const db = { guilds, members, tickets, transcripts };
console.log(chalk.green(`✔ Dados carregados de ${SAVE_FILE}`));
