// js/loader/custom-loader.js

import { loadFile, saveFile } from './loader.js';

const folderPath = "custom-data";

let emojisRoles = [];
let emojisEmployees = [];
let emojisPool = [];

export async function loadEmojiData(api) {
    const relativePath = "custom-data/emojis.json";

    console.log("🔍 Loading emoji config from CLIENT:", relativePath);

    return await loadFile(
        api,
        "client",
        relativePath,
        async () => {
            console.warn("⚠️ CLIENT emoji.json missing → using SAMPLE fallback");
            const res = await fetch("samples/data/emojis.json");
            console.log("📦 SAMPLE fetch status:", res.status);
            return res.json();
        },
        true
    );
}


export function normalizeEmojiData(json) {
    const data = typeof json === "string" ? JSON.parse(json) : json;
    const categories = data.categories || {};

    const pool = Object.values(categories).flatMap(cat => Array.isArray(cat) ? cat : []);

    const employees = data.assignments?.employee || [];
    const roles = data.assignments?.tasks || [];

    return { categories, pool, employees, roles };
}

export async function saveEmojiData(api, { categories, employees, roles }) {

    const json = {
        categories,
        assignments: {
            employee: employees,
            tasks: roles
        }
    };

    const jsonText = JSON.stringify(json, null, 2);

    return await saveFile(api, "custom-data", "emojis.json", jsonText);
}
