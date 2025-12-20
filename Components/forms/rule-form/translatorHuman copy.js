// Components/forms/rule-form/translateHuman.js
// Build human-readable German sentences for rules.
// Uses client role names exactly as provided (no pluralization).
// Exports: translateToHuman(rule, roles), generateHumanSentence(rule, roles), populateExistingRules(ruleSet, roles)
/*
import { populateFormFromRule } from './rule-form.js';

const weekdayMap = [
    { name: "Montag", abbr: "Mo", adv: "montags" },
    { name: "Dienstag", abbr: "Di", adv: "dienstags" },
    { name: "Mittwoch", abbr: "Mi", adv: "mittwochs" },
    { name: "Donnerstag", abbr: "Do", adv: "donnerstags" },
    { name: "Freitag", abbr: "Fr", adv: "freitags" },
    { name: "Samstag", abbr: "Sa", adv: "samstags" },
    { name: "Sonntag", abbr: "So", adv: "sonntags" }
];

const shiftMap = {
    early: { name: "Früh", adv: "früh" },
    day: { name: "Tag", adv: "tagsüber" },
    late: { name: "Spät", adv: "spät" }
};

// vacation code => label
const vacCodeToLabel = {
    vac: "Urlaub",
    sik: "Genesung",
    spe: "Sonderurlaub",
    otc: "Ausgleichstag",
    but: "Geschäftsreise",
    par: "Elternzeit",
    hom: "Home-Office",
    unp: "unbezahlt",
    sho: "Berufsschule"
};

// grouped convenience sets (you said you group them conceptually)
const vacationGroups = {
    dienstlich: ["but", "hom"],
    frei: ["vac", "otc", "spe"],
    Schulferien: ["sho"],
    verhindert: ["sik", "par", "unp"]
};

// ---------- helpers ----------
function joinGermanList(items = [], connector = "und") {
    if (!items || items.length === 0) return "";
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} ${connector} ${items[1]}`;
    const allButLast = items.slice(0, -1).join(", ");
    const last = items[items.length - 1];
    return `${allButLast} ${connector} ${last}`;
}

function cleanUpText(s) {
    return (s || "").replace(/\s+/g, " ").trim();
}

function findRoleByIdOrIndex(id, roles = []) {
    if (id == null) return null;
    // try colorIndex match (string or number)
    const byColor = roles.find(r => String(r.colorIndex) === String(id));
    if (byColor) return byColor;
    // fallback: numeric index into array
    const idx = Number(id);
    if (!Number.isNaN(idx) && roles[idx]) return roles[idx];
    // nothing found
    return null;
}

function roleNamesFromIds(roleIds = [], roles = []) {
    if (!Array.isArray(roleIds)) return [];
    return roleIds
        .map(id => {
            const r = findRoleByIdOrIndex(id, roles);
            return r ? r.name : `Rolle ${String(id)}`;
        })
        .filter(Boolean);
}

// ---------- block formatters ----------

const weekdays = {
    Mo: "Montag",
    Di: "Dienstag",
    Mi: "Mittwoch",
    Do: "Donnerstag",
    Fr: "Freitag",
    Sa: "Samstag",
    So: "Sonnstag",
}

// repeat (W)
function formatSentenceStart(repeatBlock = {}, timeFrameBlock = {}) {

    const repeatID = repeatBlock.id || "W0";
    const timeframeID = timeFrameBlock.id || "T0";

    if (!timeFrameBlock.details) timeFrameBlock.details = { days: [] };
    // empty repeat 
    if (repeatID === "W0" && timeframeID === 'T0') return "Es sollten immer ";

    if (repeatID !== "W0" && timeframeID === "T0") {
        const repeatText = repeatBlock.toHumanReadable() || "";
        return `${repeatText} .... sollten  `;
    }
    if (repeatID === "W0") {
        if (timeframeID === 'T1') {  // shifts
            let shiftText = "<Fehler>";
            if (timeFrameBlock.details.days[0] === 'day') shiftText = "Tag";
            if (timeFrameBlock.details.days[0] === 'early') shiftText = "Früh";
            if (timeFrameBlock.details.days[0] === 'late') shiftText = "Spät";
            return `In  der ${shiftText}-Schicht sollen`;
        }
        if (timeframeID === 'T2') {  // days
            if (timeFrameBlock.details.days.length < 1) timeFrameBlock.details.days.push('<Fehl-Tag>');

            const dayTextParts = [];

            timeFrameBlock.details.days.forEach((weekday, index) => {
                dayTextParts.push(weekday);

                if (timeFrameBlock.details.days.length > 1 && index < timeFrameBlock.details.days.length - 1) {
                    const connector = index === timeFrameBlock.details.days.length - 2 ? ' und ' : ',';
                    dayTextParts.push(connector);
                }
            });

            return `${dayTextParts.join('')} sollen`;
        }

        if (timeframeID === 'T3') {  // week
            return "Wöchentlich sollen";
        }
        if (timeframeID === 'T5') {  // Absents
            const weeklyText = timeFrameBlock.toHumanReadable();
            return `Während ${weeklyText}`
        }
    }
    // repeat = always
    if (repeatID === "W1") {
        if (timeframeID === 'T1') {  // shifts
            let shiftText = "<Fehler>";
            if (timeFrameBlock.details.days[0] === 'day') shiftText = "Tag";
            if (timeFrameBlock.details.days[0] === 'early') shiftText = "Früh";
            if (timeFrameBlock.details.days[0] === 'late') shiftText = "Spät";
            return `In jeder ${shiftText}-Schicht sollen`;
        }

        if (timeframeID === 'T2') {  // days

            if (timeFrameBlock.details.days < 1) timeFrameBlock.details.days.push('<Fehl-Tag>');
            if (timeFrameBlock.details.days < 2) timeFrameBlock.details.days.push('<Fehl-Tag>');

            const dayTextParts = [];

            timeFrameBlock.details.days.forEach((weekday, index) => {
                dayTextParts.push(weekday);

                if (timeFrameBlock.details.days.length > 1 && index < timeFrameBlock.details.days.length - 1) {
                    const connector = index === timeFrameBlock.details.days.length - 2 ? ' und ' : ',';
                    dayTextParts.push(connector);
                }
            });

            return `Jeden ${dayTextParts.join('')} sollen`;
        }
        if (timeframeID === 'T3') {  // week
            return "Jede Woche";
        }
        if (timeframeID === 'T5') {  // Absents
            const weeklyText = timeFrameBlock.toHumanReadable();
            return `Während jeder ${weeklyText}`
        }
    }
    //  REPEAT 0 XOR
    if (repeatID === "W2") {

        if (timeframeID === 'T1') {  // shifts
            return `<Fehler>`;
        }

        if (timeframeID === 'T2') {  // days

            if (timeFrameBlock.details.days.length < 1) timeFrameBlock.details.days.push('<Fehl-Tag>');
            if (timeFrameBlock.details.days.length < 2) timeFrameBlock.details.days.push('<Fehl-Tag>');

            const dayTextParts = [];

            timeFrameBlock.details.days.forEach((weekday, index) => {
                dayTextParts.push(weekday);

                if (timeFrameBlock.details.days.length > 1 && index < timeFrameBlock.details.days.length - 1) {
                    const connector = index === timeFrameBlock.details.days.length - 2 ? ' oder ' : ',';
                    dayTextParts.push(connector);
                }
            });

            return `Entweder am ${dayTextParts.join('')} sollen`;
        }

        if (timeframeID === 'T3') {  // week
            return "<Fehler>";
        }
        if (timeframeID === 'T5') {  // Absents
            return `<Fehler>`
        }
    }
    // // repeat = only
    if (repeatID === "W3") {
        if (timeframeID === 'T1') {  // shifts
            let shiftText = "<Fehler>";
            if (timeFrameBlock.details.days[0] === 'day') shiftText = "Tag";
            if (timeFrameBlock.details.days[0] === 'early') shiftText = "Früh";
            if (timeFrameBlock.details.days[0] === 'late') shiftText = "Spät";
            return `Nur in der ${shiftText}-Schicht sollen`;
        }
        if (timeframeID === 'T2') {  // days

            if (timeFrameBlock.details.days.length < 1) timeFrameBlock.details.days.push('<Fehl-Tag>');

            const dayTextParts = [];

            timeFrameBlock.details.days.forEach((weekday, index) => {
                dayTextParts.push(weekday);

                if (timeFrameBlock.details.days.length > 1 && index < timeFrameBlock.details.days.length - 1) {
                    const connector = index === timeFrameBlock.details.days.length - 2 ? ' oder ' : ', ';
                    dayTextParts.push(connector);
                }
            });

            return `Nur an ${dayTextParts.join('')}en sollen`;
        }

        if (timeframeID === 'T3') {  // week
            return "<Fehler>";
        }
        if (timeframeID === 'T5') {  // Absents
            return "<Fehler>";
        }
    }
    // Per day per week
    if (repeatID === "W4") {
        const countText = timeFrameBlock.details.bottom || "?";
        if (timeframeID === 'T1') {  // shifts
            return "<Fehler>";
        }
        if (timeframeID === 'T2') {  // days
            return "<Fehler>";
        }
        if (timeframeID === 'T3') {  // week
            const countText2 = repeatBlock.details.bottom || "?";
            return `${countText2} mal pro Woche sollen`;
        }
        if (timeframeID === 'T5') {  // Absents
            return "<Fehler>";
        }
    }
}


// amount (A)
function formatAmount(amountBlock = {}) {

    // "A1"=ungefär; "A3"= zwischen; "A4" = maximal; "A5"= minimal; "A8"= genau

    const t = amountBlock.id || "A1";

    if (!amountBlock.details) amountBlock.details = {};
    switch (t) {
        case "A1": {
            const n = amountBlock.details.bottom ?? 0;
            return (n != null) ? `ungefähr ${n}` : "ungefähr";
        }
        case "A3": {
            const b = amountBlock.details.bottom ?? 0;
            const t2 = amountBlock.details.top ?? 0;
            if (b != null && t2 != null) return `zwischen ${b} und ${t2}`;
            return "zwischen <Fehler>";
        }
        case "A4": {
            const n = amountBlock.details.bottom ?? 0;
            return (n != null) ? `maximal ${n}` : "maximal";
        }
        case "A5": {
            const n = amountBlock.details.bottom ?? 0;
            return `mindestens ${n}`;
        }
        case "A8": {
            const n = amountBlock.details.bottom ?? 0;
            return (n != null) ? `genau ${n}` : "genau";
        }
        default: return "";
    }
}

// exception (E)
function formatException(block = {}) {
    const t = block.type || "E0";
    switch (t) {
        case "E0": return "";
        case "E2": return "oder";
        case "E3": return "aber";
        case "E4": return "außer";
        case "E5": return "aber nicht mehr als";
        case "E6": return "aber nicht weniger als";
        default: return "";
    }
}

// ---------- Compose sentence pieces ----------
// build the core "amount + group + dependency" phrase
function buildCorePhrase(groupBlock, dependencyBlock, roles) {

    let coreParts = [];

    //   "G0" = Aufgabe;  "G1" = Gruppe;     "G2" = Alternative
    //   "D0" = anwesend; "D2" = braucht;       "D3"=hilft ; "D4"= im Verhältnis

    console.log("dependency block:", dependencyBlock);
    console.log(" group  block:", groupBlock);

    if (!groupBlock.details) groupBlock.details = { roles: [] };

    if (dependencyBlock.id === "D0") {

        if (groupBlock.id == "G0") {

            if (groupBlock.details.roles.length < 1) groupBlock.details.roles.push("<Fehl-Rolle>");

            const roleIndex = groupBlock.details.roles[0];
            const roleName = roleNamesFromIds([roleIndex], roles);

            coreParts.push(`${roleName} anwesend sein`);
        } else if (groupBlock.id === "G1") {

            const roleTextParts = [];

            if (groupBlock.details.roles.length < 1) groupBlock.details.roles.push("<Fehl-Rolle>");

            groupBlock.details.roles.forEach((role, index) => {

                const roleName = roleNamesFromIds([role], roles);
                roleTextParts.push(`${roleName}`);
                if (groupBlock.details.roles.length > 1 && index < groupBlock.details.roles.length - 1) {
                    const connector = index === groupBlock.details.roles.length - 2 ? ' und ' : ',';
                    roleTextParts.push(connector);
                }
            });

            coreParts.push(`${roleTextParts.join('')} anwesend sein`);
        } else if (groupBlock.id === "G2") {

            const roleTextParts = [];

            if (groupBlock.details.roles.length < 1) groupBlock.details.roles.push("<Fehl-Rolle>");
            if (groupBlock.details.roles.length < 2) groupBlock.details.roles.push("<Fehl-Rolle>");

            groupBlock.details.roles.forEach((role, index) => {
                const roleIndex = parseInt(role, 10);
                const roleName = roleNamesFromIds([roleIndex], roles);
                roleTextParts.push(`${roleName}`);
                if (groupBlock.details.roles.length > 1 && index < groupBlock.details.roles.length - 1) {
                    const connector = index === groupBlock.details.roles.length - 2 ? ' oder ' : ',';
                    roleTextParts.push(connector);
                }
            });

            coreParts.push(`${roleTextParts.join('')} anwesend sein`);
        }
        console.log("core parts = ", coreParts);
        const core = coreParts.join(" ").trim();
        return cleanUpText(core);
    }

    if (dependencyBlock.id === "D2") { // needs
        if (groupBlock.id === "G0") {

            if (groupBlock.details.roles.length < 1) groupBlock.details.roles.push("<Fehl-Rolle>");

            const roleIndex = parseInt(groupBlock.details.roles[0],);
            const roleName = roleNamesFromIds([roleIndex], roles);
            const helperName = groupBlock.details.role[0] || "?";
            const helperCount = groupBlock.details.bottom || "?";

            coreParts.push(`${roleName} braucht ${helperCount} ${helperName}`);

        } else if (groupBlock.id === "G1") {

            if (groupBlock.details.roles.length < 1) groupBlock.details.roles.push("<Fehl-Rolle>");
            if (groupBlock.details.roles.length < 2) groupBlock.details.roles.push("<Fehl-Rolle>");

            const roleIndex = parseInt(groupBlock.details.roles[0],);
            const roleName = roleNamesFromIds([roleIndex], roles);
            const helperName = groupBlock.details.role[0] || "?";
            const helperCount = groupBlock.details.bottom || "?";

            coreParts.push(`${roleName} brauchen ${helperCount} ${helperName}`);

        } else if (groupBlock.id === "G2") { // or
            coreParts.push("<Fehler>");
        }
        console.log("core parts = ", coreParts);
        const core = coreParts.join(" ").trim();
        return cleanUpText(core);
    }

    if (dependencyBlock.id === "D3") { // helps

        if (groupBlock.id === "G0") {

            if (groupBlock.details.roles.length < 1) groupBlock.details.roles.push("<Fehl-Rolle>");

            const roleIndex = parseInt(groupBlock.details.roles[0],);
            const roleName = roleNamesFromIds([roleIndex], roles);
            const neederName = groupBlock.details.role[0];
            const neederCount = groupBlock.details.bottom || "?";
            coreParts.push(`${roleName} hilft ${neederCount} ${neederName}`);

        } else if (groupBlock.id === "G1" || groupBlock.id === "G2") {

            if (groupBlock.details.roles.length < 1) groupBlock.details.roles.push("<Fehl-Rolle>");
            if (groupBlock.details.roles.length < 2) groupBlock.details.roles.push("<Fehl-Rolle>");

            const roleIndex = parseInt(groupBlock.details.roles[0],);
            const roleName = roleNamesFromIds([roleIndex], roles);
            const neederName = groupBlock.details.role[0] || "?";
            const neederCount = groupBlock.details.bottom || "?";

            coreParts.push(`${roleName} helfen ${neederCount} ${neederName}`);

        }
        console.log("core parts = ", coreParts);
        const core = coreParts.join(" ").trim();
        return cleanUpText(core);
    }
}

export function generateHumanSentence(rulePart = {}, roles = [], isCondition = false) {
    if (!rulePart) return "";

    const rep = rulePart.repeat || {};
    const tf = rulePart.timeframe || {};

    const sentenceStart = formatSentenceStart(rep, tf);

    const am = rulePart.amount || {};
    const sentenceAmount = formatAmount(am);

    const gr = rulePart.group || {};
    const de = rulePart.dependency || {};

    const coreText = buildCorePhrase(gr, de, roles);

    const parts = [];
    if (sentenceStart) parts.push(sentenceStart);
    if (sentenceAmount) parts.push(sentenceAmount);
    if (coreText) parts.push(coreText);

    const sentenceCore = parts.join(" ").trim();
    if (!sentenceCore) return "ungenügende Auwahl zum erstellen einer neuen Regel!";

    return cleanUpText(`${sentenceCore}`);
}

export function generateFullHumanSentence(rule = {}, roles = []) {
    console.log("generateFullHumanSentence() incoming rule:", rule);

    // --- GUARD 1: rule must be an object with at least one known module ---
    if (!rule || typeof rule !== "object") {
        console.warn("Guard 1 failed: rule missing or not object");
        return "";
    }

    const mainPart = rule;
    const condPart = rule.condition || null;

    // Determine exception type
    const exType =
        (mainPart.exception && mainPart.exception.type) ||
        (rule.exception && rule.exception.type) ||
        "E0";

    // Build natural language segments
    const mainText = generateHumanSentence(mainPart, roles, false) || "";
    const condText = condPart ? (generateHumanSentence(condPart, roles, true) || "") : "";

    console.log("main text:", mainText);
    console.log("cond text:", condText);

    // --- GUARD 2: if no condition or exception is E0 → simple sentence ---
    if (!condText || exType === "E0") {
        console.warn("Guard 2: No cond or E0 → simple sentence");
        return cleanUpText(`${mainText}.`);
    }

    // connector (fallback)
    const connector = formatException({ type: exType }) || exType;

    // --- Exception types ---
    switch (exType) {
        case "E2": // oder
            return cleanUpText(`Es ${mainText} oder ${condText}.`);

        case "E3": // aber → wenn nicht, dann …
            return cleanUpText(`Es ${mainText}; wenn nicht, ${condText}.`);

        case "E4": // außer
            return cleanUpText(`Es ${mainText}, außer ${condText}.`);

        case "E5": { // nicht mehr als
            const limit = condPart?.amount?.top ?? condPart?.amount?.bottom ?? "";
            if (limit)
                return cleanUpText(`Es ${mainText}, aber nicht mehr als ${limit}.`);

            return cleanUpText(`Es ${mainText}, aber nicht mehr als ...`);
        }

        case "E6": { // nicht weniger als
            const limit = condPart?.amount?.bottom ?? condPart?.amount?.top ?? "";
            if (limit)
                return cleanUpText(`Es ${mainText}, aber nicht weniger als ${limit}.`);

            return cleanUpText(`Es ${mainText}, aber nicht weniger als ...`);
        }

        default:
            // fallback using formatException
            return cleanUpText(`Es ${mainText} ${connector} ${condText}.`);
    }
}


// translateToHuman: typing preview in #typing-text (keeps previous behavior)
export function translateToHuman(rule = {}, roles = []) {

    if (roles.length < 1) {
        console.error(" no roles for rules: ");
        console.trace("Trace for Updated ruleForEdeting");
    }

    console.log("rule for typing effect:", rule);
    console.log(" passed roles for typing effect:", roles);

    const sentence = generateFullHumanSentence(rule, roles);
    if (!sentence) return false;

    // typing effect container
    const typingContainer = document.getElementById("typing-text");
    if (typingContainer) {
        applyTypingEffectWithCursor(typingContainer, sentence);
    }
    return true;
}

export function populateExistingRules(ruleSet, roles) {
    const rulesList = document.getElementById('rules-list');
    const template = document.getElementById('rule-item-template');
    rulesList.innerHTML = '';

    ruleSet.forEach((rule, idx) => {
        const frag = template.content.cloneNode(true);
        const li = frag.querySelector('li');
        const ruleTextEl = frag.querySelector('.rule-text');
        const editBtn = frag.querySelector('.edit-rule');
        const deleteBtn = frag.querySelector('.delete-rule');

        ruleTextEl.innerHTML = generateFullHumanSentence(rule, roles) || `Regel ${rule.id || idx}`;
        li.dataset.ruleId = rule.id || String(idx);

        // edit
        editBtn.addEventListener('click', () => {
            populateFormFromRule(rule);
            // ensure editor visible
            document.getElementById('rule-form-container').scrollIntoView({ behavior: 'smooth' });
        });

        // duplicate
        const cloneBtn = document.createElement('button');
        cloneBtn.className = 'noto clone-rule';
        cloneBtn.textContent = '♻️';
        cloneBtn.title = 'Regel duplizieren';
        cloneBtn.addEventListener('click', async () => {
            const newRule = JSON.parse(JSON.stringify(rule));
            delete newRule.id;
            newRule.created = Date.now();
            newRule.updated = Date.now();
            // populate editor with clone & change id
            newRule.id = `rule_${Date.now()}`;
            populateFormFromRule(newRule);
            ruleForEdeting = newRule;
        });

        // delete
        deleteBtn.addEventListener('click', async () => {
            if (!confirm('Regel löschen?')) return;
            // call save/delete via loader
            const res = await deleteRule(api, rule.id); // your existing deleteRule wrapper
            if (res && res.success) {
                showSuccess('Regel gelöscht');
                ruleSet = await loadRuleData(api);
                populateExistingRules(ruleSet, cachedRoles);
            } else {
                showFailure('Löschen fehlgeschlagen');
            }
        });

        // append clone button near edit/delete
        const liContainer = frag.querySelector('li');
        liContainer.insertBefore(cloneBtn, editBtn);

        rulesList.appendChild(frag);
    });
}

// typing effect helper
function applyTypingEffectWithCursor(container, text) {
    if (!container) return;
    container.textContent = "";
    const cursor = document.createElement("span");
    cursor.className = "blinking-cursor";
    cursor.textContent = "▮";
    let i = 0;
    const speed = 18;
    container.appendChild(cursor);
    const interval = setInterval(() => {
        container.textContent = text.slice(0, i);
        container.appendChild(cursor);
        i++;
        if (i > text.length) {
            clearInterval(interval);
            // keep final text
            container.textContent = text;
        }
    }, speed);
}

export default {
    translateToHuman,
    generateHumanSentence,
    generateFullHumanSentence,
    populateExistingRules
};
*/