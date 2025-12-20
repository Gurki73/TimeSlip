// js/loader/custom-loader.js

import { loadFile, saveFile } from './loader.js';

const folderPath = "custom-data";

let emojisRoles = [];
let emojisEmployees = [];
let emojisPool = [];

export async function loadEmojiData(api) {
    const relativePath = "custom-data/emojis.json";

    return await loadFile(
        api,
        "client",
        relativePath,
        () => fetch("assets/data/emojis.json").then(r => r.json()),
        true
    );
}

export function normalizeEmojiData(json) {
    const categories = json.categories || {};

    const pool = Object.values(categories).flat();

    const employees = json.assignments?.employee || [];
    const roles = json.assignments?.tasks || [];

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
