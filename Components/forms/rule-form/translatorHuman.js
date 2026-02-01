// Components/forms/rule-form/translateHuman.js
// Build human-readable German sentences for rules.
// Uses client role names exactly as provided (no pluralization).
// Exports: translateToHuman(rule, roles), generateHumanSentence(rule, roles), populateExistingRules(ruleSet, roles)
import { populateFormFromRule, copyRule, deleteRule, editRule, awakeRule, goAsleep } from './rule-form.js';
import { createEllipsis } from '../../../js/Utils/ellipsisButton.js';


const TEAM = Object.freeze({
    NONE: 0,
    BLUE: 1,
    GREEN: 2,
    RED: 3,
    BLACK: 4,
    AZUBI: 5
});

const TEAM_PRIMARY_ROLE = {
    [TEAM.NONE]: 0,
    [TEAM.BLUE]: 1,
    [TEAM.GREEN]: 4,
    [TEAM.RED]: 7,
    [TEAM.BLACK]: 10,
    [TEAM.AZUBI]: 13
};

const ROLE_TO_TEAM = Object.freeze({
    0: TEAM.NONE,
    1: TEAM.BLUE,
    2: TEAM.BLUE,
    3: TEAM.BLUE,
    4: TEAM.GREEN,
    5: TEAM.GREEN,
    6: TEAM.GREEN,
    7: TEAM.RED,
    8: TEAM.RED,
    9: TEAM.RED,
    10: TEAM.BLACK,
    11: TEAM.BLACK,
    12: TEAM.BLACK,
    13: TEAM.AZUBI
});

const TEAM_REGISTRY = {
    [TEAM.NONE]: { dot: '⚪️' },
    [TEAM.BLUE]: { dot: '🔵' },
    [TEAM.GREEN]: { dot: '🟢' },
    [TEAM.RED]: { dot: '🔴' },
    [TEAM.BLACK]: { dot: '⚫' },
    [TEAM.AZUBI]: { dot: '🟠' }
};

const TEAM_KEY = {
    [TEAM.BLUE]: 'blue',
    [TEAM.GREEN]: 'green',
    [TEAM.RED]: 'red',
    [TEAM.BLACK]: 'black',
    [TEAM.AZUBI]: 'azubi',
    [TEAM.NONE]: 'none'
};

const RULE_ELLIPSIS_ACTIONS = ['copy', 'edit', 'delete'];


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

function resolveTeamName(team, teamnames) {
    if (!teamnames) return '';

    // array fallback (old behavior)
    if (Array.isArray(teamnames)) {
        return teamnames[team] ?? '';
    }

    // object-based (new behavior)
    const key = TEAM_KEY[team];
    return key ? teamnames[key] ?? '' : '';
}

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

function groupAndSortByCategory(rules) {
    const categories = new Map();

    for (const r of rules) {
        const key = r.categoryTeam;
        if (!categories.has(key)) categories.set(key, []);
        categories.get(key).push(r);
    }

    for (const [, list] of categories) {
        list.sort(ruleComparator);
    }

    return categories;
}

function ruleComparator(a, b) {
    // 1️⃣ warnings first
    if (a.isWarning !== b.isWarning) {
        return a.isWarning ? -1 : 1;
    }

    // 2️⃣ fewer teams first
    if (a.teamCount !== b.teamCount) {
        return a.teamCount - b.teamCount;
    }

    // 3️⃣ complexity: false → true
    if (a.isComplex !== b.isComplex) {
        return a.isComplex ? 1 : -1;
    }

    // 4️⃣ ratio: false → true
    if (a.isRatio !== b.isRatio) {
        return a.isRatio ? 1 : -1;
    }

    // 5️⃣ team-scoped role
    if (a.minRoleForTeam !== b.minRoleForTeam) {
        return a.minRoleForTeam - b.minRoleForTeam;
    }

    // 6️⃣ stable fallback
    return String(a.id).localeCompare(String(b.id));
}


function prepareRulesForDisplay(enrichedRules) {
    return explodeByTeam(enrichedRules).map(r => ({
        ...r,
        minRoleForTeam:
            r.categoryTeam === '0'
                ? Infinity
                : getMinRoleForTeam(r.roles, r.categoryTeam)
    }));
}


function translateToHuman(rule = {}, roles = []) {
    if (!roles?.length) {
        console.error("No roles provided for rule translation");
        return false;
    }

    const sentence = generateFullHumanSentence(rule, roles);
    if (!sentence) return false;

    return sentence;
}

function identifyTeams(rule) {
    const roles = [];

    if (rule.main?.group?.details?.roles) {
        roles.push(...rule.main.group.details.roles);
    }

    if (rule.condition?.group?.details?.roles) {
        roles.push(...rule.condition.group.details.roles);
    }

    const teams = [];

    if ([1, 2, 3].some(r => roles.includes(r))) teams.push(1);
    if ([4, 5, 6].some(r => roles.includes(r))) teams.push(2);
    if ([7, 8, 9].some(r => roles.includes(r))) teams.push(3);
    if ([10, 11, 12].some(r => roles.includes(r))) teams.push(4);
    if ([13].some(r => roles.includes(r))) teams.push(5);

    return teams;
}
function enrichRule(rule, idx, roles) {
    const errors = [];
    const teams = identifyTeams(rule);

    const hasMainException = has(rule, ['main', 'exception', 'id']);
    if (!hasMainException) errors.push('mandatory exception missing');

    const isComplex =
        hasMainException && rule.main.exception.id !== 'E0';

    let isRatio = false;
    if (isComplex) {
        const hasConditionDependency =
            has(rule, ['condition', 'dependency', 'id']);

        if (!hasConditionDependency) {
            errors.push('mandatory dependency missing (complex rule)');
        } else {
            isRatio =
                rule.main?.dependency?.id !== 'D0' ||
                rule.condition.dependency.id !== 'd0';
        }
    }

    try {
        roles = extractRolesSorted(rule);
    } catch {
        errors.push('roles could not be extracted');
    }

    return {
        ...rule,               // 🔑 keeps isAsleep, created, updated
        _idx: idx,              // metadata (namespaced)
        teams,
        teamCount: teams.length,
        isWarning: rule?.type === 'warning',
        isComplex,
        isRatio,
        roles,
        isCorrupt: errors.length > 0 || teams.length === 0,
        errors
    };
}

function has(obj, path) {
    return path.every(key => obj && (obj = obj[key]) !== undefined);
}

function explodeByTeam(enrichedRules) {
    const result = [];

    enrichedRules.forEach(r => {
        if (r.teams.length === 0) {
            result.push({ ...r, categoryTeam: '0' });
        } else {
            r.teams.forEach(team => {
                result.push({ ...r, categoryTeam: team });
            });
        }
    });

    return result;
}

function getMinRoleForTeam(roles, team) {
    const teamRoles = roles.filter(r => ROLE_TO_TEAM[r] === team);
    return teamRoles.length ? Math.min(...teamRoles) : Infinity;
}
/*
function renderCategory({ team, teamName, rules, container }) {
    const tpl = document.getElementById('rule-category');
    const fragment = tpl.content.cloneNode(true);

    const li = fragment.querySelector('.rule-category');
    const title = fragment.querySelector('.rule-category-title');
    const dot = fragment.querySelector('.rule-dot');
    const list = fragment.querySelector('.rule-category-list');

    title.textContent = "Regeln füt Team: " + teamName || " INJEXT TEAM-NAME HERE";
    dot.textContent = TEAM_REGISTRY[team]?.dot ?? '⚪️';

    rules.forEach(rule => renderRule(rule, list));

    container.appendChild(fragment);
}
*/

function renderCategory({ team, teamName, rules, container }) {
    const tpl = document.getElementById('rule-category');
    const fragment = tpl.content.cloneNode(true);

    const li = fragment.querySelector('.rule-category');
    const title = fragment.querySelector('.rule-category-title');
    const dot = fragment.querySelector('.rule-dot');
    const list = fragment.querySelector('.rule-category-list');

    title.textContent = "Regeln für Team: " + teamName || " INJEXT TEAM-NAME HERE";
    dot.textContent = TEAM_REGISTRY[team]?.dot ?? '⚪️';

    // 🔑 inject team + role info
    li.dataset.team = team;
    li.dataset.primaryRole = TEAM_PRIMARY_ROLE[team];

    rules.forEach(rule => renderRule(rule, list));
    container.appendChild(fragment);
}

function enrichRules(ruleSet, roles) {
    return ruleSet.map((rule, idx) => enrichRule(rule, idx, roles));
}

export function translateExistingRules(
    ruleSet = [],
    roles = [],
    teamnames = ["Blau", "Grün", "Rot", "Schwarz", "Azubi", "Falsch"]
) {
    const header = document.getElementById("exsiting-ruleh-header");
    if (!header) return;

    header.textContent = `Alle ${ruleSet.length} bestehenden Regeln`;

    const rulesList = document.getElementById('rules-list');
    if (!rulesList) return;

    rulesList.innerHTML = '';
    const enriched = enrichRules(ruleSet, roles);
    const prepared = prepareRulesForDisplay(enriched);
    const grouped = groupAndSortByCategory(prepared);

    for (const team of [
        TEAM.BLUE,
        TEAM.GREEN,
        TEAM.RED,
        TEAM.BLACK,
        TEAM.AZUBI,
        TEAM.NONE
    ]) {

        const rules = grouped.get(team);
        if (!rules || rules.length === 0) continue;

        renderCategory({
            team,
            teamName: resolveTeamName(team, teamnames),
            rules,
            container: rulesList,
            roles
        });
    }
    initializeCollapsedState();
    updateAllWarningCounters();
    autoExpandCategoriesWithWarnings();
    initRuleChevronHandlers();
}

function renderRule(ruleView, container) {

    if (ruleView._deleted) return;

    const tpl = document.getElementById('rule-item-template');
    const fragment = tpl.content.cloneNode(true);
    const li = fragment.querySelector('li');
    li.classList.add('existing-rule-item');
    const text = fragment.querySelector('.rule-text');
    li.dataset.ruleId = ruleView.id;
    text.textContent = generateFullHumanSentence(ruleView.rule) ?? '—';

    renderRoleDots(li, ruleView);
    renderEllipsis(li, ruleView);

    if (ruleView.errors?.length) {
        renderWarnings(ruleView, li);
    }

    container.appendChild(fragment);
}

function renderCompactDots(ruleView, marker) {
    const teams = ruleView.teams ?? [];
    const current = ruleView.categoryTeam;

    if (!current) return;

    // current team first
    addDot(marker, current, true);

    const others = teams.filter(t => t !== current);

    if (others.length) {
        addPlus(marker);

        others.slice(0, 2).forEach(team =>
            addDot(marker, team, false)
        );

        if (others.length > 2) {
            addCount(marker, others.length);
        }
    }
}

function addDot(container, team, isPrimary = false) {
    const span = document.createElement('span');
    span.className = 'rule-dot';
    if (isPrimary) span.classList.add('primary', 'noto');

    span.textContent = TEAM_REGISTRY[team]?.dot ?? '❓';
    container.appendChild(span);
}

function addPlus(container) {
    const span = document.createElement('span');
    span.className = 'rule-dot rule-plus';
    span.textContent = '+';
    container.appendChild(span);
}

function addCount(container, count) {
    const span = document.createElement('span');
    span.className = 'rule-dot rule-count';
    span.textContent = count;
    container.appendChild(span);
}


function renderRoleDots(li, ruleView) {
    const marker = li.querySelector('.rule-role-marker');
    if (!marker) return;

    marker.innerHTML = '';

    // default for now: compact mode
    renderCompactDots(ruleView, marker);
}

function renderWarnings(ruleView, ruleLi) {
    const ul = document.createElement('ul');
    ul.className = 'rule-warnings';

    ruleView.errors.forEach((err, i) => {
        const tpl = document.getElementById('warning-item-template');
        const fragment = tpl.content.cloneNode(true);
        const li = fragment.querySelector('li');
        const text = fragment.querySelector('.warning-text');

        text.textContent = err;
        ul.appendChild(li);
    });

    ruleLi.appendChild(ul);
}


function applyTypingEffectWithCursor(container, text) {
    if (!container || typeof text !== "string") return;

    container.textContent = "";

    const cursor = document.createElement("span");
    cursor.className = "blinking-cursor";
    cursor.textContent = "▮";
    container.appendChild(cursor);

    let index = 0;
    const speed = 18;

    const interval = setInterval(() => {
        container.textContent = text.slice(0, index);
        container.appendChild(cursor);
        index++;

        if (index > text.length) {
            clearInterval(interval);

            setTimeout(() => {
                cursor.classList.add("cursor-stop");
            }, 2500);
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
function renderEllipsis(li, ruleView) {
    const host = li.querySelector('.rule-ellipses');
    if (!host) return;

    host.innerHTML = '';

    const isAsleep = !!ruleView.isAsleep;

    const actions = [
        ...RULE_ELLIPSIS_ACTIONS,
        isAsleep ? 'enable' : 'disable'
    ];

    const handlers = {
        copy: () => copyRule(ruleView),
        edit: () => editRule(ruleView),
        delete: () => deleteRule(ruleView),
        enable: () => awakeRule(ruleView),
        disable: () => goAsleep(ruleView)
    };

    const ellipsis = createEllipsis(actions, handlers, ruleView);
    host.appendChild(ellipsis);
}

export function initRuleChevronHandlers() {
    const rulesList = document.getElementById('rules-list');
    if (!rulesList) return;

    rulesList.addEventListener('click', (e) => {
        const chevron = e.target.closest('.rule-chevron');
        if (!chevron) return;

        // CATEGORY CHEVRON
        const category = chevron.closest('.rule-category');
        if (category && chevron.tagName === 'BUTTON') {
            toggleCategory(category, chevron);
            return;
        }

        // RULE CHEVRON
        const ruleItem = chevron.closest('.existing-rule-item');
        if (ruleItem) {
            toggleRule(ruleItem, chevron);
        }
    });
}

function toggleCategory(category, chevron) {
    const list = category.querySelector('.rule-category-list');
    if (!list) return;

    const expanded = chevron.getAttribute('aria-expanded') === 'true';

    chevron.setAttribute('aria-expanded', String(!expanded));
    list.setAttribute('aria-hidden', String(expanded));
}

function toggleRule(ruleItem, chevron) {
    const warnings = ruleItem.querySelector('.rule-warnings');
    if (!warnings) return;

    const expanded = chevron.getAttribute('aria-expanded') === 'true';

    chevron.setAttribute('aria-expanded', String(!expanded));
    warnings.setAttribute('aria-hidden', String(expanded));
}

function initializeCollapsedState() {
    document
        .querySelectorAll('.rule-category-list, .rule-warnings')
        .forEach(el => el.setAttribute('aria-hidden', 'true'));

    document
        .querySelectorAll('.rule-chevron')
        .forEach(ch => ch.setAttribute('aria-expanded', 'false'));
}

function autoExpandCategoriesWithWarnings() {
    document
        .querySelectorAll('.rule-warnings')
        .forEach(warnings => {
            const rule = warnings.closest('.existing-rule-item');
            const category = warnings.closest('.rule-category');

            if (!rule || !category) return;

            const ruleChevron = rule.querySelector('.rule-chevron');
            const categoryChevron = category.querySelector('.rule-category-header .rule-chevron');

            if (ruleChevron) toggleRule(rule, ruleChevron);
            if (categoryChevron) toggleCategory(category, categoryChevron);
        });
}

function updateWarningCounter(counterEl, count) {
    if (!counterEl) return;

    counterEl.textContent = `⚠️ ${count}`;

    if (count > 0) {
        counterEl.setAttribute('active', 'true');
    } else {
        counterEl.setAttribute('active', 'false');
    }
}

function countRuleWarnings(ruleItem) {
    return ruleItem.querySelectorAll('.rule-warnings > li').length;
}

function updateRuleWarningCounters() {
    document
        .querySelectorAll('.existing-rule-item')
        .forEach(rule => {
            const count = countRuleWarnings(rule);
            const counter = rule.querySelector('.warning-counter-team');

            updateWarningCounter(counter, count);

            // Optional UX: auto-expand rule if it has warnings
            if (count > 0) {
                const chevron = rule.querySelector('.rule-chevron');
                if (chevron) toggleRule(rule, chevron);
            }
        });
}

function updateCategoryWarningCounters() {
    document
        .querySelectorAll('.rule-category')
        .forEach(category => {
            const rules = category.querySelectorAll('.existing-rule-item');

            let total = 0;
            rules.forEach(rule => {
                total += countRuleWarnings(rule);
            });

            const counter = category.querySelector('.warning-counter-category');
            updateWarningCounter(counter, total);

            // Optional UX: auto-expand category if it has warnings
            if (total > 0) {
                const chevron = category.querySelector('.rule-category-header .rule-chevron');
                if (chevron) toggleCategory(category, chevron);
            }
        });
}

function updateAllWarningCounters() {
    updateRuleWarningCounters();
    updateCategoryWarningCounters();
}
