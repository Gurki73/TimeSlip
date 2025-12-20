/**
 * @typedef {Object} BuildingBlock
 * @property {string} type - repeat | timeframe | amount | group | dependency | exception
 * @property {string} id
 * @property {string} label
 * @property {boolean} [default]
 * @property {boolean} [required]
 * @property {boolean} [isMain]
 * @property {boolean} [isCondition]
 * @property {any} [details]
 * @property {function(BuildingBlock): string} [toHumanReadable]
 * @property {function(BuildingBlock): object} [toMachineReadable]
 */

/**
 * Helper to build block objects from concise definitions.
 * Automatically adds `isMain` (uppercase id) or `isCondition` (lowercase id).
 * @param {string} type
 * @param {Array<Object>} defs
 * @returns {Record<string, BuildingBlock>}
 */
function makeBlocks(type, defs) {
    const result = {};
    for (const def of defs) {
        const isMain = /^[A-Z]/.test(def.id);
        const isCondition = /^[a-z]/.test(def.id);

        const full = {
            type,
            ...def,
            isMain,
            isCondition,
            details: def.details || {},
            toHumanReadable() {
                // for exceptions, use example if available
                if (type === 'exception') return def.example || def.label || '';
                return def.label || '';
            },
            toMachineReadable() {
                // machine-readable format includes id, type, and any details
                return { type, id: def.id, label: def.label, details: def.details || {} };
            }
        };

        result[def.id] = full;
    }
    return result;
}

/* --- 1️⃣ Repeats --- */
const repeatDefs = [
    { id: "W0", label: "", default: true, details: {} },
    { id: "W1", label: "jeden", details: {} },
    { id: "W2", label: "entweder", details: {} },
    { id: "W3", label: "nur", details: { number: 0 } },
    { id: "W4", label: "X mal pro", details: { number: 0 } }
];

/* --- 2️⃣ Timeframes --- */
const timeframeDefs = [
    { id: "T0", label: "", default: true, details: {} },
    { id: "T1", label: "Schicht", details: { shifts: [] } },
    { id: "T2", label: "Tag", details: { days: [] } },
    { id: "T3", label: "Woche", details: { weeks: [] } },
    { id: "T5", label: "Abwesenheit", details: {} }
];

/* --- 3️⃣ Amounts --- */
const amountDefs = [
    { id: "A1", required: true, default: true, label: "ungefähr", details: { bottom: 0, top: 0 } },
    { id: "A3", required: true, default: false, label: "zwischen", details: { bottom: 0, top: 0 } },
    { id: "A4", required: true, default: false, label: "maximal", details: { bottom: 0, top: 0 } },
    { id: "A5", required: true, default: false, label: "minimal", details: { bottom: 0, top: 0 } },
    { id: "A8", required: true, default: false, label: "genau", details: { bottom: 0, top: 0 } }
];

/* --- 4️⃣ Groups --- */
const groupDefs = [
    { id: "G0", label: "Aufgabe", default: true, details: { roles: [] } },
    { id: "G1", label: "Gruppe", details: { roles: [] } },
    { id: "G2", label: "Alternative", details: { roles: [] } }
];

/* --- 5️⃣ Dependencies --- */
const dependencyDefs = [
    { id: "D0", label: "anwesend", default: true, details: { roles: [] } },
    { id: "D1", label: "abwesend", details: { roles: [] } },
    { id: "D2", label: "braucht", details: { roles: [] } },
    { id: "D3", label: "hilft", details: { roles: [] } },
    { id: "D4", label: "im Verhältnis", details: { roles: [] } }
];

/* --- 6️⃣ Exceptions --- */
const exceptionDefs = [
    {
        id: "E0",
        label: "",
        type: "none",
        example: "Keine Ausnahme",
        default: true,
        details: {},
        operator: "NONE"
    },

    //
    // LOGISCHE VERKNÜPFUNGEN (LINKS)
    //
    {
        id: "E1",
        label: "und",
        type: "link",
        example: "Bedingungen im Hauptsatz UND Nebensatz müssen erfüllt sein.",
        details: {},
        operator: "AND"
        // result = main && secondary
    },
    {
        id: "E2",
        label: "oder",
        type: "link",
        example: "Bedingungen im Hauptsatz ODER Nebensatz müssen erfüllt sein.",
        details: {},
        operator: "OR"
        // result = main || secondary
    },

    //
    // SPEZIALFÄLLE MIT ASYMMETRISCHER LOGIK
    //
    {
        id: "E3",
        label: "aber",
        type: "link",
        example:
            "Der Hauptsatz gilt nicht, WENN die Bedingung im Nebensatz erfüllt ist, UND der Hauptsatz nicht erfüllt ist.",
        details: {},
        operator: "BUT"
        // result = (!main) && secondary
    },
    {
        id: "E4",
        label: "außer",
        type: "link",
        example:
            "Der Hauptsatz gilt AUSGENOMMEN den Fällen, in denen die Bedingung im Nebensatz erfüllt ist.",
        details: {},
        operator: "EXCEPT"
        // result = main && (!secondary)
    },

    //
    // GRENZWERTE / LIMITATIONEN
    //
    {
        id: "E5",
        label: "aber nicht mehr als",
        type: "limitation",
        example: "Es gibt maximal X Aufgaben.",
        details: { max: 0 },
        operator: "LIMIT_MAX"
        // result = main && (value <= max)
    },
    {
        id: "E6",
        label: "aber nicht weniger als",
        type: "limitation",
        example: "Es gibt mindestens X Aufgaben.",
        details: { min: 0 },
        operator: "LIMIT_MIN"
        // result = main && (value >= min)
    }
];

/**
 * Combine everything into one export.
 */
export const blocks = {
    ...makeBlocks("repeat", repeatDefs),
    ...makeBlocks("timeframe", timeframeDefs),
    ...makeBlocks("amount", amountDefs),
    ...makeBlocks("group", groupDefs),
    ...makeBlocks("dependency", dependencyDefs),
    ...makeBlocks("exception", exceptionDefs)
};

// 🧠 Auto-generate lowercase “condition” copies
Object.keys(blocks).forEach(key => {
    const lowerId = key.toLowerCase();
    if (lowerId !== key && !blocks[lowerId]) {
        const clone = { ...blocks[key], id: lowerId, isMain: false, isCondition: true };
        blocks[lowerId] = clone;
    }
});

export default blocks;

export function createRuleFromBlueprint(blueprint = {}) {
    return {
        id: blueprint.id ?? crypto.randomUUID?.() ?? Date.now().toString(),

        main: {
            repeat: repeatFactory(resolveId(blueprint.main?.repeat?.type, "W0")),
            timeframe: timeframeFactory(resolveId(blueprint.main?.timeframe?.type, "T0")),
            amount: amountFactory(resolveId(blueprint.main?.amount?.type, "A1")),
            group: groupFactory(resolveId(blueprint.main?.group?.type, "G0")),
            dependency: dependencyFactory(resolveId(blueprint.main?.dependency?.type, "D0")),
            exception: exceptionFactory(resolveId(blueprint.main?.exception?.type, "E0"))
        },

        secondary: {
            repeat: repeatFactory(resolveId(blueprint.secondary?.repeat?.type, "w0")),
            timeframe: timeframeFactory(resolveId(blueprint.secondary?.timeframe?.type, "t0")),
            amount: amountFactory(resolveId(blueprint.secondary?.amount?.type, "a1")),
            group: groupFactory(resolveId(blueprint.secondary?.group?.type, "g0")),
            dependency: dependencyFactory(resolveId(blueprint.secondary?.dependency?.type, "d0"))
            // ⚠️ intentionally NO exception in secondary
        }
    };
}

// --- helpers -------------------------------------------------

function resolveId(id, fallback) {
    if (typeof id === "string" && blocks[id]) return id;
    return fallback;
}

function repeatFactory(id) { return { ...blocks[id] }; }
function timeframeFactory(id) { return { ...blocks[id] }; }
function amountFactory(id) { return { ...blocks[id] }; }
function groupFactory(id) { return { ...blocks[id] }; }
function dependencyFactory(id) { return { ...blocks[id] }; }
function exceptionFactory(id) { return { ...blocks[id] }; }