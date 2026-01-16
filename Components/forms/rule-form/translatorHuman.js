// Components/forms/rule-form/translateHuman.js
// Build human-readable German sentences for rules.
// Uses client role names exactly as provided (no pluralization).
// Exports: translateToHuman(rule, roles), generateHumanSentence(rule, roles), populateExistingRules(ruleSet, roles)
import { populateFormFromRule } from './rule-form.js';
import { createEllipsis } from '../../../js/Utils/ellipsisButton.js';

// ========== CONSTANTS & CONFIGURATIONS ==========
const WEEKDAY_CONFIG = [
    { name: "Montag", abbr: "Mo", adv: "montags" },
    { name: "Dienstag", abbr: "Di", adv: "dienstags" },
    { name: "Mittwoch", abbr: "Mi", adv: "mittwochs" },
    { name: "Donnerstag", abbr: "Do", adv: "donnerstags" },
    { name: "Freitag", abbr: "Fr", adv: "freitags" },
    { name: "Samstag", abbr: "Sa", adv: "samstags" },
    { name: "Sonntag", abbr: "So", adv: "sonntags" }
];

const SHIFT_CONFIG = {
    early: { name: "Früh", adv: "früh" },
    day: { name: "Tag", adv: "tagsüber" },
    late: { name: "Spät", adv: "spät" }
};

// ========== HELPER FUNCTIONS ==========
function joinGermanList(items = [], connector = "und") {
    if (!items?.length) return "";
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} ${connector} ${items[1]}`;

    const allButLast = items.slice(0, -1).join(", ");
    return `${allButLast} ${connector} ${items[items.length - 1]}`;
}

function cleanUpText(s) {
    return (s || "").replace(/\s+/g, " ").trim();
}

function findRoleByIdOrIndex(id, roles = []) {
    if (id == null) return null;

    // Try to match by colorIndex
    const byColor = roles.find(r => String(r.colorIndex) === String(id));
    if (byColor) return byColor;

    // Fallback to numeric index
    const idx = Number(id);
    if (!Number.isNaN(idx) && roles[idx]) return roles[idx];

    return null;
}

function getRoleNames(roleIds = [], roles = []) {
    if (!Array.isArray(roleIds)) return [];

    return roleIds
        .map(id => {
            const role = findRoleByIdOrIndex(id, roles);
            return role?.name || `Rolle ${String(id)}`;
        })
        .filter(Boolean);
}

// ========== BLOCK FORMATTERS ==========
const REPEAT_CONFIG = {
    W0: { // Empty/default repeat
        T0: () => "Es sollten immer ",
        T1: (tf) => `In der ${getShiftName(tf.details?.days?.[0])}-Schicht sollen`,
        T2: (tf) => `${formatDaysList(tf.details?.days, false)} sollen`,
        T3: () => "Wöchentlich sollen",
        T5: (tf) => `Während ${tf.toHumanReadable?.() || ""}`
    },
    W1: { // Always
        T0: (rep) => `${rep.toHumanReadable?.() || ""} .... sollten  `,
        T1: (tf) => `In jeder ${getShiftName(tf.details?.days?.[0])}-Schicht sollen`,
        T2: (tf) => `Jeden ${formatDaysList(tf.details?.days, true)} sollen`,
        T3: () => "Jede Woche",
        T5: (tf) => `Während jeder ${tf.toHumanReadable?.() || ""}`
    },
    W2: { // XOR
        T1: () => "<Fehler>",
        T2: (tf) => `Entweder am ${formatDaysList(tf.details?.days, false, "oder")} sollen`,
        T3: () => "<Fehler>",
        T5: () => "<Fehler>"
    },
    W3: { // Only
        T1: (tf) => `Nur in der ${getShiftName(tf.details?.days?.[0])}-Schicht sollen`,
        T2: (tf) => `Nur an ${formatDaysList(tf.details?.days, false, "oder")}en sollen`,
        T3: () => "<Fehler>",
        T5: () => "<Fehler>"
    },
    W4: { // Per day per week
        T1: () => "<Fehler>",
        T2: () => "<Fehler>",
        T3: (tf, rep) => `${rep.details?.bottom || "?"} mal pro Woche sollen`,
        T5: () => "<Fehler>"
    }
};

function formatSentenceStart(repeatBlock = {}, timeFrameBlock = {}) {
    const repeatId = repeatBlock.id || "W0";
    const timeFrameId = timeFrameBlock.id || "T0";

    const config = REPEAT_CONFIG[repeatId];
    if (!config || !config[timeFrameId]) {
        console.warn(`Unsupported combination: ${repeatId}/${timeFrameId}`);
        return "";
    }

    return config[timeFrameId](timeFrameBlock, repeatBlock);
}

function formatAmount(amountBlock = {}) {
    const amountType = amountBlock.id || "A1";
    const details = amountBlock.details || {};

    const amountFormatters = {
        A1: () => details.bottom != null ? `ungefähr ${details.bottom}` : "ungefähr",
        A3: () => details.bottom != null && details.top != null
            ? `zwischen ${details.bottom} und ${details.top}`
            : "zwischen <Fehler>",
        A4: () => details.bottom != null ? `maximal ${details.bottom}` : "maximal",
        A5: () => details.bottom != null ? `mindestens ${details.bottom}` : "mindestens",
        A8: () => details.bottom != null ? `genau ${details.bottom}` : "genau"
    };

    return amountFormatters[amountType]?.() || "";
}

function formatException(block = {}) {
    const exceptionTypes = {
        E0: "",
        E2: "oder",
        E3: "aber",
        E4: "außer",
        E5: "aber nicht mehr als",
        E6: "aber nicht weniger als"
    };

    return exceptionTypes[block.type || "E0"] || "";
}

// ========== CORE PHRASE BUILDERS ==========
function buildCorePhrase(groupBlock, dependencyBlock, roles) {
    const dependencyId = dependencyBlock.id;
    const groupId = groupBlock.id;
    const details = groupBlock.details || { roles: [] };
    const roleIds = details.roles || [];

    // Handle missing role data
    if (roleIds.length === 0) {
        roleIds.push("<Fehl-Rolle>");
    }

    const roleNames = getRoleNames(roleIds, roles);

    // Dependency: Present (D0)
    if (dependencyId === "D0") {
        const connector = groupId === "G2" ? "oder" : "und";
        const roleText = joinGermanList(roleNames, connector);
        return `${roleText} anwesend sein`;
    }

    // Dependency: Needs (D2)
    if (dependencyId === "D2") {
        if (groupId === "G2") return "<Fehler>";

        const helperName = details.role?.[0] || "?";
        const helperCount = details.bottom || "?";
        const roleText = groupId === "G0" ? roleNames[0] : joinGermanList(roleNames, "und");
        const verb = groupId === "G0" ? "braucht" : "brauchen";

        return `${roleText} ${verb} ${helperCount} ${helperName}`;
    }

    // Dependency: Helps (D3)
    if (dependencyId === "D3") {
        const neederName = details.role?.[0] || "?";
        const neederCount = details.bottom || "?";
        const roleText = groupId === "G0" ? roleNames[0] : joinGermanList(roleNames, "und");
        const verb = groupId === "G0" ? "hilft" : "helfen";

        return `${roleText} ${verb} ${neederCount} ${neederName}`;
    }

    return "";
}

// ========== UTILITY FUNCTIONS ==========
function getShiftName(shiftCode) {
    return SHIFT_CONFIG[shiftCode]?.name || "<Fehler>";
}

function formatDaysList(days = [], usePrefix = false, connector = "und") {
    if (!days?.length) return "<Fehl-Tag>";

    const dayNames = days.map(day =>
        WEEKDAY_CONFIG.find(w => w.abbr === day)?.name || day
    );

    const list = joinGermanList(dayNames, connector);
    return usePrefix ? list : list;
}

function generateHumanSentence(rulePart = {}, roles = []) {
    if (!rulePart) return "ungenügende Auswahl zum Erstellen einer neuen Regel!";

    const sentenceStart = formatSentenceStart(rulePart.repeat || {}, rulePart.timeframe || {});
    const amountText = formatAmount(rulePart.amount || {});
    const coreText = buildCorePhrase(rulePart.group || {}, rulePart.dependency || {}, roles);

    const parts = [sentenceStart, amountText, coreText].filter(Boolean);
    return cleanUpText(parts.join(" "));
}

function generateFullHumanSentence(rule = {}, roles = []) {
    if (!rule || typeof rule !== "object") {
        console.warn("Invalid rule object");
        return "";
    }

    const mainPart = rule.main || rule;
    const condPart = rule.condition || null;
    const exceptionType = mainPart.exception?.type || rule.exception?.type || "E0";

    const mainText = generateHumanSentence(mainPart, roles);
    const condText = condPart ? generateHumanSentence(condPart, roles) : "";

    // Simple case: no condition or no exception
    if (!condText || exceptionType === "E0") {
        return cleanUpText(`${mainText}.`);
    }

    // Handle exception cases
    const connector = formatException({ type: exceptionType });

    switch (exceptionType) {
        case "E2": // oder
            return cleanUpText(`Es ${mainText} oder ${condText}.`);

        case "E3": // aber → wenn nicht, dann …
            return cleanUpText(`Es ${mainText}; wenn nicht, ${condText}.`);

        case "E4": // außer
            return cleanUpText(`Es ${mainText}, außer ${condText}.`);

        case "E5": {
            const limit = condPart?.amount?.top ?? condPart?.amount?.bottom ?? "";
            return cleanUpText(`Es ${mainText}, aber nicht mehr als ${limit}.`);
        }

        case "E6": {
            const limit = condPart?.amount?.bottom ?? condPart?.amount?.top ?? "";
            return cleanUpText(`Es ${mainText}, aber nicht weniger als ${limit}.`);
        }

        default:
            return cleanUpText(`Es ${mainText} ${connector} ${condText}.`);
    }
}

export function translateCurrentRule(rule = {}, roles = []) {

    const sentence = translateToHuman(rule, roles);

    const typingContainer = document.getElementById("typing-text");
    if (typingContainer) {
        applyTypingEffectWithCursor(typingContainer, sentence);
    }
}

function translateToHuman(rule = {}, roles = []) {
    if (!roles?.length) {
        console.error("No roles provided for rule translation");
        return false;
    }

    const sentence = generateFullHumanSentence(rule, roles);
    if (!sentence) return false;

    return true;
}

/*
export function translateExistingRules(ruleSet = [], roles = []) {
    const rulesList = document.getElementById('rules-list');
    const template = document.getElementById('rule-item-template');

    if (!rulesList || !template) return;

    rulesList.innerHTML = '';

    ruleSet.forEach((rule, idx) => {
        const fragment = template.content.cloneNode(true);
        const li = fragment.querySelector('li');
        const ruleTextEl = fragment.querySelector('.rule-text');
        const editBtn = fragment.querySelector('.edit-rule');
        const deleteBtn = fragment.querySelector('.delete-rule');

        ruleTextEl.textContent = generateFullHumanSentence(rule, roles) || `Regel ${rule.id || idx}`;
        li.dataset.ruleId = rule.id || String(idx);

        // Edit button
        editBtn.addEventListener('click', () => {
            populateFormFromRule(rule);
            document.getElementById('rule-form-container')?.scrollIntoView({ behavior: 'smooth' });
        });

        // Delete button (requires external deleteRule function)
        deleteBtn.addEventListener('click', async () => {
            if (confirm('Regel löschen?')) {
                // This requires external deleteRule function to be available
                console.log('Delete rule:', rule.id);
            }
        });

        rulesList.appendChild(fragment);
    });
}
*/

export function translateExistingRules(ruleSet = [], roles = []) {
    const rulesList = document.getElementById('rules-list');
    const template = document.getElementById('rule-item-template');

    if (!rulesList || !template) return;

    rulesList.innerHTML = '';

    ruleSet.forEach((rule, idx) => {
        const fragment = template.content.cloneNode(true);
        const li = fragment.querySelector('li');
        const ruleTextEl = fragment.querySelector('.rule-text');

        li.classList.add('rule-item');

        ruleTextEl.textContent =
            generateFullHumanSentence(rule, roles) ||
            `Regel ${rule.id || idx}`;

        li.dataset.ruleId = rule.id || String(idx);

        const ellipsesContainer = fragment.querySelector('.rule-ellipses');
        ellipsesContainer.appendChild(createRuleEllipsis(rule));

        rulesList.appendChild(fragment);
    });
}

function applyTypingEffectWithCursor(container, text) {
    if (!container) return;
    if (typeof text !== "string") return;

    container.textContent = "";
    const cursor = document.createElement("span");
    cursor.className = "blinking-cursor";
    cursor.textContent = "▮";

    let index = 0;
    const speed = 18;
    container.appendChild(cursor);

    const interval = setInterval(() => {
        container.textContent = text.slice(0, index);
        container.appendChild(cursor);
        index++;

        if (index > text.length) {
            clearInterval(interval);
            container.textContent = text;
        }
    }, speed);
}

function createRuleEllipsis(rule) {
    return createEllipsis(
        ['edit', 'copy', 'delete'],
        {
            onEdit: () => {
                populateFormFromRule(rule);
                document
                    .getElementById('rule-form-container')
                    ?.scrollIntoView({ behavior: 'smooth' });
            },

            onCopy: async () => {
                await navigator.clipboard.writeText(
                    generateFullHumanSentence(rule)
                );
            },

            onDelete: async () => {
                if (confirm('Regel löschen?')) {
                    console.log('Delete rule:', rule.id);
                }
            }
        }
    );
}
