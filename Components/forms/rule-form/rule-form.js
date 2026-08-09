// Components\forms\rule-form\rule-form.js
import { loadRoleData, loadTeamnames } from '../../../js/loader/role-loader.js';
import { loadOfficeDaysData } from '../../../js/loader/calendar-loader.js';
import { runLiveSanity, runRuleTest, normalizeDateInput, executeRuleset } from './ruleChecker.js';
import { ensureCalendarReady, computeAttendanceForRange } from '../../calendar/calendar.js';
import { toggleExceptionTable, updateWizard } from './ruleFlowWizzard.js';
import { createHelpButton } from '../../../js/Utils/helpPageButton.js';
import { createWindowButtons } from '../../../js/Utils/minMaxFormComponent.js';
import { createDataModeToggle } from '../../../js/Utils/DataMode-select.js';
import { getShiftSymbol } from '../../../js/Utils/globalIcons.js';
import { blocks, createRuleFromBlueprint } from "./buildingBlocks.js";
import { translateCurrentRule, translateExistingRules, renderRoleSpan, generateFullHumanSentence } from "./translatorHuman.js";
import { updateRulesPreview } from "./translatorMachine.js";
import { loadRuleData, saveRuleData, deleteRule as deleteRuleFromDisk, getAllRules } from '../../../js/loader/rule-loader.js';
import { createSaveButton } from '../../../js/Utils/saveButton.js';
import { confirmAction } from '../../../js/Utils/conformation-dialog.js'

// temporary
import { getCell, getSelect } from './ruleDomAdapter.js';
const _getElementById = document.getElementById.bind(document);
// end temporary

// ============= CONSTANTS =============
const INPUT_BINDINGS = [
    { key: 'W', handler: handleTopCellNumberInput },
    { key: 'T', handler: handleTopCellTimeFrame },
    { key: 'A', handler: handleTopCellNumberInput },
    { key: 'G', handler: handleTopCellRoles },
    { key: 'D', handler: handleTopCellDependency },
    { key: 'E', handler: handleTopCellException },
    { key: 'w', handler: handleTopCellNumberInput },
    { key: 't', handler: handleTopCellTimeFrame },
    { key: 'a', handler: handleTopCellNumberInput },
    { key: 'g', handler: handleTopCellRoles },
    { key: 'd', handler: handleTopCellDependency },
];

const MAIN_BLOCK_LABELS = {
    R: 'Wiederholungen',
    T: 'Zeitraum',
    A: 'Anzahl',
    G: 'Aufgaben',
    D: 'Abhängigkeiten',
    E: 'Ausnahmen'
};

const SECONDARY_BLOCK_LABELS = {
    r: 'Wiederholungen',
    t: 'Zeitraum',
    a: 'Anzahl',
    g: 'Aufgaben',
    d: 'Abhängigkeiten'
};


const SVG_NS = "http://www.w3.org/2000/svg";
const BLOCK_KEY_MAP = { W: "repeat", T: "timeframe", A: "amount", G: "group", D: "dependency", E: "exception" };

const DEFAULT_BLUEPRINT = {
    repeat: "W0",
    timeframe: "T0",
    amount: "A1",
    group: "G0",
    dependency: "D0",
    exception: "E0",
    isMain: true
};

const RULE_FUTURE_WINDOW_MONTHS = 6;
const SCROLL_THRESHOLD = 40;
const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const TEAM_KEY_ORDER = ['blue', 'green', 'red', 'black', 'azubi', 'none'];
const ROLE_INDEX_MAX = 13;

// ============= STATE =============
let rulesScrollbox;
let teamnames = ["Blau", "Grün", "Rot", "Schwarz", "Azubi"];
let cachedRoles = [];
let ruleOfficeDays;
let api;
let eventDelegationInitialized = false;
let ruleForEditing = {};
let ruleSet = [];
let testPassed = false;
let saveButtonHeader;
let userScrolledUp = false;
let cachedShiftSymbols = 'none';
let lastTestReport = null;

// ============= UTILITY FUNCTIONS =============
const dateKey = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const debounce = (fn, wait = 150) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), wait);
    };
};

const safeId = (raw) => {
    return String(raw || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_\-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
};

const announceStatus = (message) => {
    const live = document.getElementById("typing-text");
    if (live) live.textContent = `> ${message}`;
};

const showSuccess = (msg) => console.log("✅", msg);
const showFailure = (msg) => console.log("❌", msg);

function buildFallbackRoleByIndex(colorIndex) {
    if (colorIndex === 0) return { colorIndex: '0', name: 'Keine', emoji: '🚫' };
    if (colorIndex === 13) return { colorIndex: '13', name: 'Azubi', emoji: '✏️' };
    return { colorIndex: String(colorIndex), name: `Aufgabe ${colorIndex}`, emoji: '🧩' };
}

function normalizeRuleRoles(rawRoles) {
    if (!Array.isArray(rawRoles)) return [];

    const byIndex = new Map();
    rawRoles
        .map((role, idx) => {
            const colorIndex = Number(role?.colorIndex ?? role?.index ?? idx);
            if (!Number.isInteger(colorIndex) || colorIndex < 0 || colorIndex > ROLE_INDEX_MAX) return null;
            return {
                colorIndex: String(colorIndex),
                name: String(role?.name ?? '?').trim(),
                emoji: String(role?.emoji ?? '⊖').trim()
            };
        })
        .filter(Boolean)
        .forEach((role) => byIndex.set(Number(role.colorIndex), role));

    const normalized = [];
    for (let idx = 0; idx <= ROLE_INDEX_MAX; idx++) {
        const role = byIndex.get(idx);
        if (!role) {
            normalized.push(buildFallbackRoleByIndex(idx));
            continue;
        }

        const hasRealName = role.name && !['?', 'name'].includes(role.name.toLowerCase());
        const hasRealEmoji = role.emoji && role.emoji !== '⊖';
        if (!hasRealName || !hasRealEmoji) {
            const fallback = buildFallbackRoleByIndex(idx);
            normalized.push({
                ...fallback,
                name: hasRealName ? role.name : fallback.name,
                emoji: hasRealEmoji ? role.emoji : fallback.emoji
            });
            continue;
        }

        normalized.push(role);
    }

    return normalized;
}

async function loadRuleRolesWithRetry(maxRetries = 3, delayMs = 220) {
    let lastRoles = [];
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const loaded = await loadRoleData(api);
        const normalized = normalizeRuleRoles(loaded);
        lastRoles = normalized;
        if (normalized.length > 0) return normalized;
        if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
    return lastRoles.length > 0 ? lastRoles : normalizeRuleRoles([]);
}

const getScopedElementById = (id) => {
    const tableContainer = document.getElementById('table-container');
    if (!tableContainer) {
        console.warn('Table container not found');
        return null;
    }
    const el = tableContainer.querySelector(`#${id}`);
    if (!el) console.warn('[MISSING RULE DOM]', id);
    return el;
};

// ============= DATE UTILITIES =============
const getFutureRuleStartDate = () => {
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(0, 0, 0, 0);
    return start;
};

const getFutureRuleEndDate = (startDate, monthsAhead) => {
    const end = new Date(startDate);
    end.setMonth(end.getMonth() + (Number(monthsAhead) || 0));
    end.setDate(end.getDate() - 1);
    end.setHours(0, 0, 0, 0);
    return end;
};

// ============= INITIALIZATION =============
export async function initializeRuleForm(passedApi) {
    api = passedApi;
    if (!api) console.error("API was not passed ==> " + api);

    try {
        await loadInitialData();
    } catch (error) {
        console.error('Error during initialization:', error);
        return;
    }

    const formContainer = document.getElementById('form-container');
    if (!formContainer) {
        console.error('Form container not found');
        return;
    }

    formContainer.innerHTML = '';

    try {
        const response = await fetch('Components/forms/rule-form/rule-form.html');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        formContainer.innerHTML = await response.text();
    } catch (err) {
        console.error(`Loading rule form failed: ${err}`);
        return;
    }

    if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }

    initializeUI();
    initializeRuleEditor();
}

async function loadInitialData() {
    ruleOfficeDays = await loadOfficeDaysData(api);
    cachedRoles = await loadRuleRolesWithRetry();
    ruleSet = await loadRuleData(api);
    teamnames = await loadTeamnames(api);

    if (!Array.isArray(cachedRoles)) {
        console.warn("Roles is not an array, initializing empty array");
        cachedRoles = normalizeRuleRoles([]);
    }
    if (cachedRoles.length < 1) {
        cachedRoles = await loadRuleRolesWithRetry();
        if (!Array.isArray(cachedRoles)) cachedRoles = normalizeRuleRoles([]);
    }
}

function initializeUI() {
    rulesScrollbox = document.getElementById("rules-scrollbox");
    if (rulesScrollbox) {
        rulesScrollbox.addEventListener("scroll", handleRulesScroll);
    }

    cachedShiftSymbols = localStorage.getItem('shiftSymbols');

    updateDivider("bg-rules");
    initSaveButtons();
    initTestButton();

    document.getElementById("expand-rules-btn")?.addEventListener("click", () => {
        scrollRulesToBottomIfAllowed(true);
    });

    translateExistingRules(ruleSet, cachedRoles, teamnames);
    scrollRulesToBottomIfAllowed();
}

function initializeRuleEditor() {
    initializeInputFunctions();
    initEventDelegation();
    startNewRule({ announce: false });
}

// ============= EVENT HANDLERS =============
const handleRulesScroll = () => {
    const atBottom = rulesScrollbox.scrollHeight - rulesScrollbox.scrollTop - rulesScrollbox.clientHeight < SCROLL_THRESHOLD;
    userScrolledUp = !atBottom;
};

// ============= BUTTON INITIALIZATION =============
function initTestButton() {
    const testBtn = document.getElementById("test-rule");
    if (!testBtn) {
        console.warn("Test button not found in DOM");
        return;
    }

    testBtn.removeEventListener("click", onTestRuleClick);
    testBtn.addEventListener("click", onTestRuleClick);
    testPassed = false;
}

function initSaveButtons() {
    updateSaveButtonState();
}

function updateSaveButtonState() {
    const saveBtn = document.getElementById("save-rule");
    if (!saveBtn) return;
    saveBtn.disabled = !testPassed;
    saveBtn.setAttribute("aria-disabled", String(!testPassed));
}

// ============= RULE TESTING =============
async function onTestRuleClick(e) {
    if (e?.preventDefault) e.preventDefault();
    await runCurrentRuleValidation({ showStatus: true });
}

async function enrichReportWithImpact(report, draft, activeRules, futureContext) {
    try {
        const { attendanceByDate, attendanceStart, attendanceEnd, roleCount } = futureContext;
        const futureStart = normalizeDateInput(attendanceStart);
        const futureEnd = normalizeDateInput(attendanceEnd);

        if (!attendanceByDate || !futureStart || !futureEnd || futureStart > futureEnd) {
            return;
        }

        const derivedRoleCount = Number.isFinite(roleCount) ? roleCount :
            (Object.values(attendanceByDate)[0]?.length ?? 14);

        // Baseline (existing rules only)
        const baselineRuleset = updateRulesPreview(activeRules);
        const baselineStats = executeRuleset(
            { ...baselineRuleset, context: { ...baselineRuleset?.context, attendanceByDate, roleCount: derivedRoleCount } },
            futureStart, futureEnd, true
        );

        // Candidate (existing + draft)
        const candidateRuleset = updateRulesPreview([...activeRules, draft]);
        const candidateStats = executeRuleset(
            { ...candidateRuleset, context: { ...candidateRuleset?.context, attendanceByDate, roleCount: derivedRoleCount } },
            futureStart, futureEnd, true
        );

        // Delta comparison
        const impactRaw = compareRuleExecutions(baselineStats, candidateStats);

        const impactSummary = {
            before: baselineStats.summary,
            after: candidateStats.summary,
            delta: {
                total: candidateStats.summary.totalFailures - baselineStats.summary.totalFailures,
                byScope: computeScopeDelta(baselineStats.summary.byScope, candidateStats.summary.byScope)
            },
            added: impactRaw.added.length,
            removed: impactRaw.removed.length,
            changed: impactRaw.changed.length,
            window: { start: dateKey(futureStart), end: dateKey(futureEnd) },
            breakdown: buildImpactBreakdown(baselineStats.failures, candidateStats.failures)
        };

        report.details = report.details || {};
        report.details.impact = impactSummary;
    } catch (err) {
        console.error("Rule impact calculation failed:", err);
    }
}

async function buildFutureRuleContext() {
    const ready = await ensureCalendarReady(api);
    if (!ready) return null;

    const start = getFutureRuleStartDate();
    const end = getFutureRuleEndDate(start, RULE_FUTURE_WINDOW_MONTHS);
    const attendanceByDate = await computeAttendanceForRange(start, end);

    return {
        attendanceByDate,
        attendanceStart: start,
        attendanceEnd: end,
        roleCount: Array.isArray(cachedRoles) ? cachedRoles.length : null
    };
}

async function runCurrentRuleValidation({ showStatus = false } = {}) {
    lastTestReport = null;
    updateSaveButtonState();

    const draft = ruleForEditing;
    const activeRules = Array.isArray(ruleSet) ? ruleSet : [];
    const futureContext = await buildFutureRuleContext();

    try {
        const report = await runRuleTest(draft, activeRules, futureContext || {});

        if (futureContext?.attendanceByDate) {
            await enrichReportWithImpact(report, draft, activeRules, futureContext);
        }

        lastTestReport = report;
        testPassed = Boolean(report?.ok);
        updateSaveButtonState();
        renderRuleCheckReport(report);

        if (showStatus) {
            announceStatus(report?.ok ? "Regeltest erfolgreich." : "Regeltest fehlgeschlagen.");
        }

        return report;
    } catch (err) {
        console.error("Rule validation failed:", err);
        renderRuleFeedbackLines(['❌ Regeltest ist fehlgeschlagen. Bitte Eingaben prüfen.']);
        if (showStatus) announceStatus("Regeltest fehlgeschlagen.");
        return null;
    }
}

// ============= REPORT RENDERING =============
function renderRuleCheckReport(report) {
    const list = document.getElementById('rule-new-warnings-list');
    if (list) list.innerHTML = '';
    clearImpactCharts();

    const feedbackEntries = [];
    const errors = Array.isArray(report?.errors) ? report.errors : [];
    const warnings = Array.isArray(report?.warnings) ? report.warnings : [];
    const hasIssues = errors.length > 0 || warnings.length > 0;

    errors.forEach((entry) => {
        feedbackEntries.push({
            level: 'error',
            text: translateRuleCheckMessage(entry)
        });
    });
    warnings.forEach((entry) => {
        feedbackEntries.push({
            level: 'warning',
            text: translateRuleCheckMessage(entry)
        });
    });

    if (report?.ok && !hasIssues) {
        feedbackEntries.push({
            level: 'success',
            text: 'Keine Warnung – neue Regel ist gültig'
        });
    } else if (!report?.ok && !hasIssues) {
        feedbackEntries.push({
            level: 'error',
            text: 'Neue Regel ist nicht gültig.'
        });
    }

    renderRuleFeedbackLines(feedbackEntries);

    if (report?.details?.impact) {
        renderImpactCharts(report.details.impact);
    }
}

function formatGermanList(items) {
    if (!items.length) return '';
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} und ${items[1]}`;
    return `${items.slice(0, -1).join(', ')} und ${items[items.length - 1]}`;
}


function translateRuleCheckMessage(raw) {
    const text = String(raw || '').trim();
    if (!text) return 'Unbekannter Prüfhinweis.';

    const [code, restRaw] = text.split(':');
    const rest = (restRaw || '').trim();

    switch (code) {
        case 'RULE_MISSING':
            return 'Kein Regelentwurf vorhanden.';
        case 'MISSING_BLOCKS': {
            if (!rest) return 'Pflichtblöcke fehlen.';

            const codes = rest.split(',').map(s => s.trim()).filter(Boolean);

            const mainMissing = [];
            const secondaryMissing = [];

            codes.forEach(code => {
                if (MAIN_BLOCK_LABELS[code]) {
                    mainMissing.push(MAIN_BLOCK_LABELS[code]);
                } else if (SECONDARY_BLOCK_LABELS[code]) {
                    secondaryMissing.push(SECONDARY_BLOCK_LABELS[code]);
                }
            });

            const parts = [];

            if (mainMissing.length) {
                parts.push(
                    `In der Hauptbedingung fehlen ${formatGermanList(mainMissing)}`
                );
            }

            if (secondaryMissing.length) {
                parts.push(
                    `In der Neben-Bedingung fehlen ${formatGermanList(secondaryMissing)}`
                );
            }

            return parts.length
                ? parts.join('. ') + '.'
                : 'Pflichtblöcke fehlen.';
        }
        case 'FORBIDDEN_COMBOS':
            return rest ? `Ungültige Kombinationen: ${rest}.` : 'Ungültige Kombinationen erkannt.';
        case 'RULE_TRANSLATION_EMPTY':
            return 'Die Regel konnte nicht in eine prüfbare Maschinenregel übersetzt werden.';
        case 'DUPLICATE_RULES':
            return rest ? `${rest} doppelte Regel(n) erkannt.` : 'Doppelte Regeln erkannt.';
        case 'POTENTIAL_CONFLICTS':
            return rest ? `${rest} potenzielle Konflikte erkannt.` : 'Potenzielle Konflikte erkannt.';
        case 'DELTA_NEW_RULES':
            return rest ? `${rest} neue Maschinenregel würden ergänzt.` : 'Neue Maschinenregeln würden ergänzt.';
        case 'DELTA_DUPLICATES':
            return rest ? `${rest} Duplikate in der Delta-Betrachtung.` : 'Duplikate in der Delta-Betrachtung.';
        case 'DELTA_CONFLICTS':
            return rest ? `${rest} Konflikte in der Delta-Betrachtung.` : 'Konflikte in der Delta-Betrachtung.';
        case 'FUTURE_VIOLATIONS':
            return rest ? `Langzeitprüfung: ${rest} mögliche Verstöße im Zukunftsfenster.` : 'Langzeitprüfung meldet mögliche Verstöße.';
        default:
            return text;
    }
}

function renderRuleFeedbackLines(lines = []) {
    const list = document.getElementById('rule-new-warnings-list');
    const title = document.querySelector('.rule-new-warnings-list');
    if (!list) return;

    list.innerHTML = '';
    list.classList.remove('is-success', 'is-alert');

    const entries = Array.isArray(lines)
        ? lines
            .map((entry) => normalizeFeedbackEntry(entry))
            .filter(Boolean)
        : [];

    entries.forEach((entry) => addListItem(list, entry));

    const show = entries.length > 0;
    const hasOnlySuccess = show && entries.every((entry) => entry.level === 'success');
    if (show) {
        list.classList.add(hasOnlySuccess ? 'is-success' : 'is-alert');
    }

    list.style.display = show ? 'block' : 'none';
    if (title) {
        title.style.display = show ? 'block' : 'none';
        title.textContent = 'Warnungen zur neuen Regel';
    }
}

function normalizeFeedbackEntry(entry) {
    if (entry == null) return null;
    if (typeof entry === 'string') {
        const text = entry.trim();
        if (!text) return null;
        return { text, level: 'info' };
    }

    const text = String(entry?.text || '').trim();
    if (!text) return null;

    const level = ['success', 'warning', 'error', 'info'].includes(entry?.level)
        ? entry.level
        : 'info';

    return { text, level };
}

function addListItem(list, entry) {
    const li = document.createElement('li');
    li.className = `rule-feedback-item is-${entry.level}`;
    li.textContent = entry.text;
    list.appendChild(li);
}

function clearImpactCharts() {
    const existing = document.getElementById('rule-impact-charts');
    if (existing) existing.remove();
}

function renderImpactCharts(impact) {
    const container = document.getElementById('rule-tables-container');
    if (!container || !impact?.breakdown) return;

    const root = document.createElement('section');
    root.id = 'rule-impact-charts';
    root.setAttribute('aria-label', 'Vergleich Baseline und Zukunft');

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'impact-toggle noto';
    toggle.textContent = '📊 Statistiken verbergen';
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-controls', 'rule-impact-scroll');
    root.appendChild(toggle);

    const scrollContainer = document.createElement('div');
    scrollContainer.id = 'rule-impact-scroll';
    scrollContainer.className = 'impact-scroll';
    root.appendChild(scrollContainer);

    const panelGrid = document.createElement('div');
    panelGrid.className = 'impact-grid';
    scrollContainer.appendChild(panelGrid);

    panelGrid.appendChild(createImpactSummaryPanel(impact));

    const weekdayRows = Array.isArray(impact.breakdown.weekday) ? impact.breakdown.weekday : [];
    const weekdayRoleRows = Array.isArray(impact.breakdown.weekdayRoles) ? impact.breakdown.weekdayRoles : [];
    panelGrid.appendChild(createWeekdayImpactPanel(weekdayRows, weekdayRoleRows));

    const roleRows = Array.isArray(impact.breakdown.teamRoles) ? impact.breakdown.teamRoles : [];
    panelGrid.appendChild(createTeamPolesPanel(roleRows));

    toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        const next = !expanded;
        toggle.setAttribute('aria-expanded', String(next));
        toggle.textContent = next ? '📊 Statistiken verbergen' : '📊 Statistiken anzeigen';
        scrollContainer.hidden = !next;
    });

    if (scrollContainer.children.length > 0) {
        container.insertBefore(root, document.getElementById('table-container'));
    }
}
function createWeekdayImpactPanel(weekdayRows, weekdayRoleRows) {
    const panel = createImpactPanel('Wochentags-Impact');
    const list = document.createElement('div');
    list.className = 'impact-weekday-list';

    if (!Array.isArray(weekdayRows) || !weekdayRows.length) {
        const empty = document.createElement('p');
        empty.className = 'impact-empty';
        empty.textContent = 'Keine Wochentagsdaten vorhanden.';
        panel.appendChild(empty);
        return panel;
    }

    // global normalization across the whole week
    const maxTotal = Math.max(
        1,
        ...weekdayRows.map(r => Math.max(
            Number(r?.before ?? 0),
            Number(r?.after ?? 0)
        ))
    );

    weekdayRows.forEach((row, idx) => {
        const container = document.createElement('div');
        container.className = 'impact-weekday-row';

        const name = document.createElement('span');
        name.className = 'impact-weekday-name';
        name.textContent = row?.label || WEEKDAY_SHORT[idx] || '?';
        container.appendChild(name);

        const bars = document.createElement('div');
        bars.className = 'impact-weekday-bars';

        const beforeTotal = Number(row?.before ?? 0);
        const afterTotal = Number(row?.after ?? 0);

        const beforeRoles = weekdayRoleRows[idx]?.beforeRoles || [];
        const afterRoles = weekdayRoleRows[idx]?.afterRoles || [];

        bars.appendChild(
            createTeamStackedBar('Alt', beforeRoles, beforeTotal, maxTotal)
        );

        bars.appendChild(
            createTeamStackedBar('Neu', afterRoles, afterTotal, maxTotal)
        );

        container.appendChild(bars);

        list.appendChild(container);
    });

    panel.appendChild(list);
    return panel;
}

function createImpactSummaryPanel(impact) {
    const panel = createImpactPanel('Zusammenfassung');
    const list = document.createElement('ul');
    list.className = 'impact-summary-list';

    const before = Number(impact?.before?.totalFailures ?? 0);
    const after = Number(impact?.after?.totalFailures ?? 0);
    const delta = Number(impact?.delta?.total ?? 0);
    const sign = delta > 0 ? '+' : '';
    const windowStart = impact?.window?.start || 'n/a';
    const windowEnd = impact?.window?.end || 'n/a';

    [
        `Deltas: gesamt ${sign}${delta}, neu ${impact?.added ?? 0}, gelöst ${impact?.removed ?? 0}`,
        `Zeitraum: ${windowStart} bis ${windowEnd}`,
        `Hauptmetriken: Alt ${before}, Neu ${after}, Geändert ${impact?.changed ?? 0}`
    ].forEach((line) => {
        const li = document.createElement('li');
        li.textContent = line;
        list.appendChild(li);
    });

    const scopeDelta = impact?.delta?.byScope && typeof impact.delta.byScope === 'object'
        ? impact.delta.byScope
        : {};
    const scopeKeys = Object.keys(scopeDelta);
    if (scopeKeys.length) {
        const scopeWrap = document.createElement('div');
        scopeWrap.className = 'impact-summary-scopes';
        scopeKeys.forEach((scope) => {
            const chip = document.createElement('span');
            const value = Number(scopeDelta[scope] || 0);
            chip.className = `impact-scope-chip ${value > 0 ? 'is-up' : value < 0 ? 'is-down' : 'is-flat'}`;
            chip.textContent = `${scope}: ${value > 0 ? '+' : ''}${value}`;
            scopeWrap.appendChild(chip);
        });
        panel.appendChild(scopeWrap);
    }

    panel.appendChild(list);
    return panel;
}

function createHeatmapPanel(weekdayRows, weekdayRoleRows) {
    const panel = createImpactPanel('Wochentags-Auslastung');
    const grid = document.createElement('div');
    grid.className = 'impact-heatmap-grid';

    const maxDensity = Math.max(1, ...weekdayRows.map((row) => Number(row?.after ?? 0)));
    weekdayRows.forEach((row, idx) => {
        const cell = document.createElement('div');
        cell.className = 'impact-heatmap-cell';

        const roleMix = weekdayRoleRows[idx]?.afterRoles || [];
        const density = Number(row?.after ?? 0);
        const intensity = Math.max(0.18, density / maxDensity);

        const fill = document.createElement('div');
        fill.className = 'impact-heatmap-fill';
        fill.style.opacity = String(intensity);
        fill.style.backgroundImage = buildRoleMixGradient(roleMix);
        cell.appendChild(fill);

        const label = document.createElement('span');
        label.className = 'impact-heatmap-day';
        label.textContent = row?.label || WEEKDAY_SHORT[idx] || '?';
        cell.appendChild(label);

        const value = document.createElement('span');
        value.className = 'impact-heatmap-count';
        value.textContent = `${density}`;
        cell.appendChild(value);

        const delta = Number(row?.delta ?? 0);
        const deltaEl = document.createElement('span');
        deltaEl.className = `impact-heatmap-delta ${delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : 'is-flat'}`;
        deltaEl.textContent = `${delta > 0 ? '+' : ''}${delta}`;
        cell.appendChild(deltaEl);

        grid.appendChild(cell);
    });

    panel.appendChild(grid);
    return panel;
}

function createTeamPolesPanel(rows) {
    const panel = createImpactPanel('Engpass-Analyse');
    const teams = aggregateTeamRows(rows);
    if (!teams.length) {
        const empty = document.createElement('p');
        empty.className = 'impact-empty';
        empty.textContent = 'Keine Teamdaten für den Zeitraum vorhanden.';
        panel.appendChild(empty);
        return panel;
    }

    const maxTeamTotal = Math.max(1, ...teams.map((team) => Math.max(team.beforeTotal, team.afterTotal)));
    const list = document.createElement('div');
    list.className = 'impact-team-list';

    teams.forEach((team) => {
        const row = document.createElement('div');
        row.className = 'impact-team-row';

        const name = document.createElement('span');
        name.className = 'impact-team-name';
        name.textContent = team.teamLabel;
        row.appendChild(name);

        const bars = document.createElement('div');
        bars.className = 'impact-team-bars';
        bars.appendChild(createTeamStackedBar('Alt', team.beforeByRole, team.beforeTotal, maxTeamTotal));
        bars.appendChild(createTeamStackedBar('Neu', team.afterByRole, team.afterTotal, maxTeamTotal));
        row.appendChild(bars);

        list.appendChild(row);
    });

    panel.appendChild(list);
    return panel;
}

function createImpactPanel(title) {
    const panel = document.createElement('article');
    panel.className = 'impact-panel';
    const heading = document.createElement('h4');
    heading.className = 'impact-title noto';
    heading.textContent = title;
    panel.appendChild(heading);
    return panel;
}

function buildRoleMixGradient(roleMix) {
    const validMix = Array.isArray(roleMix)
        ? roleMix.filter((entry) => Number(entry?.weight) > 0)
        : [];
    if (!validMix.length) {
        return 'linear-gradient(90deg, var(--accent-muted) 0%, var(--accent-muted) 100%)';
    }

    const totalWeight = validMix.reduce((sum, entry) => sum + Number(entry.weight || 0), 0);
    if (totalWeight <= 0) {
        return 'linear-gradient(90deg, var(--accent-muted) 0%, var(--accent-muted) 100%)';
    }

    let cursor = 0;
    const stops = [];
    validMix.forEach((entry) => {
        const ratio = Number(entry.weight || 0) / totalWeight;
        const next = Math.min(100, cursor + (ratio * 100));
        const color = `var(--role-${Number(entry.roleId)}-color)`;
        stops.push(`${color} ${cursor.toFixed(2)}% ${next.toFixed(2)}%`);
        cursor = next;
    });

    return `linear-gradient(90deg, ${stops.join(', ')})`;
}

function aggregateTeamRows(rows) {
    const byTeam = new Map();
    (Array.isArray(rows) ? rows : []).forEach((row) => {
        const teamKey = row?.teamKey || 'none';
        if (!byTeam.has(teamKey)) {
            byTeam.set(teamKey, {
                teamKey,
                teamLabel: row?.teamLabel || resolveTeamLabel(teamKey),
                beforeTotal: 0,
                afterTotal: 0,
                beforeByRole: [],
                afterByRole: []
            });
        }

        const entry = byTeam.get(teamKey);
        const roleId = Number(row?.roleId);
        const before = Number(row?.before || 0);
        const after = Number(row?.after || 0);

        if (before > 0) {
            entry.beforeByRole.push({ roleId, weight: before });
            entry.beforeTotal += before;
        }
        if (after > 0) {
            entry.afterByRole.push({ roleId, weight: after });
            entry.afterTotal += after;
        }
    });

    return Array.from(byTeam.values())
        .filter((entry) => entry.beforeTotal > 0 || entry.afterTotal > 0)
        .sort((a, b) => TEAM_KEY_ORDER.indexOf(a.teamKey) - TEAM_KEY_ORDER.indexOf(b.teamKey));
}

function createTeamStackedBar(label, roleMix, total, maxTotal) {
    const row = document.createElement('div');
    row.className = 'impact-team-bar-row';

    const labelEl = document.createElement('span');
    labelEl.className = 'impact-team-bar-label';
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const bar = document.createElement('div');
    bar.className = 'impact-team-bar';

    const fill = document.createElement('div');
    fill.className = 'impact-team-bar-fill';
    fill.style.width = `${Math.max(4, (Math.max(0, total) / Math.max(1, maxTotal)) * 100)}%`;
    fill.style.backgroundImage = buildRoleMixGradient(roleMix);
    bar.appendChild(fill);
    row.appendChild(bar);

    const value = document.createElement('span');
    value.className = 'impact-team-bar-value';
    value.textContent = `${total}`;
    row.appendChild(value);

    return row;
}

// ============= RULE OPERATIONS =============
function buildRuleForSave() {
    const source = ruleForEditing || {};
    const toSerializable = (value) => {
        try {
            return JSON.parse(JSON.stringify(value ?? {}));
        } catch (error) {
            console.warn('Rule serialization fallback used:', error);
            return {};
        }
    };
    const pickCondition = (ruleObj) => {
        const current = ruleObj?.secondary ?? {};
        const fallback = ruleObj?.condition ?? {};
        const keys = ['repeat', 'timeframe', 'amount', 'group', 'dependency'];
        const merged = {};

        keys.forEach((key) => {
            merged[key] = toSerializable(current[key] ?? fallback[key] ?? {});
        });

        return merged;
    };
    const main = toSerializable(source.main);
    const secondary = pickCondition(source);
    const now = Date.now();

    return {
        ...source,
        id: String(source.id || (crypto.randomUUID?.() ?? now)),
        created: source.created || now,
        updated: now,
        main,
        secondary,
        condition: secondary
    };
}

async function saveRule() {
    const payload = buildRuleForSave();

    if (isClientMode()) {
        const result = await saveRuleData(api, payload);
        if (!result?.success) {
            const message = Array.isArray(result?.errors) ? result.errors.join(', ') : (result?.error || 'Unbekannter Fehler');
            throw new Error(`Save failed: ${message}`);
        }
        ruleSet = await loadRuleData(api);
    } else {
        updateRuleInMemory(payload);
    }

    translateExistingRules(ruleSet, cachedRoles, teamnames);
    scrollRulesToBottomIfAllowed(true);
    resetInput();
    testPassed = false;
    lastTestReport = null;
    clearImpactCharts();
    updateSaveButtonState();

    if (localStorage.getItem('dataMode') === 'sample') {
        saveButtonHeader?.setState('readonly');
    } else {
        saveButtonHeader?.setState('blocked');
    }
}

async function onSaveRuleClick(event) {
    if (event?.preventDefault) event.preventDefault();

    const sanity = runLiveSanity(ruleForEditing);
    if (sanity?.blocking) {
        announceStatus("Bitte erst alle Pflichtfelder ausfüllen.");
        await runCurrentRuleValidation({ showStatus: false });
        return;
    }

    const report = await runCurrentRuleValidation({ showStatus: false });
    if (!report?.ok) {
        announceStatus("Regeltest fehlgeschlagen.");
        return;
    }

    const delta = Number(report?.details?.impact?.delta?.total ?? 0);
    if (delta > 0) {
        const ok = await confirmAction(
            `Diese neue Regel erhöht Regel-Verstöße um ${delta}. Sind Sie sicher?\n\nAbbrechen / Bestätigen`
        );
        if (!ok) {
            announceStatus("Speichern abgebrochen.");
            return;
        }
    }

    try {
        renderRuleFeedbackLines(['⏳ Speichere neue Regel ...']);
        await saveRule();
        renderRuleFeedbackLines([]);
        announceStatus("Regel gespeichert.");
    } catch (error) {
        const detail = error?.message ? String(error.message) : 'Unbekannter Fehler.';
        renderRuleFeedbackLines([`❌ Speichern fehlgeschlagen: ${detail}`]);
        announceStatus("Regel konnte nicht gespeichert werden.");
        throw error;
    }
}

function scrollRulesToBottomIfAllowed(force = false) {
    const box = document.getElementById("rules-scrollbox");
    if (!box) return;
    if (force || !userScrolledUp) {
        box.scrollTop = box.scrollHeight;
    }
}

function updateDivider(className) {
    const divider = document.getElementById('horizontal-divider-box');
    divider.innerHTML = '';

    const leftGap = document.createElement('div');
    leftGap.className = 'left-gap';

    const h2 = document.createElement('h2');
    h2.id = 'role-form-title';
    h2.className = 'sr-only';
    h2.innerHTML = `<span class="noto">🕸</span> Anwesentheit Regeln <span class="noto">🕷️</span>`;

    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'form-buttons';

    const helpBtn = createHelpButton('chapter-employees');
    helpBtn.setAttribute('aria-label', 'Hilfe öffnen für Rollen-Formular');

    const dataModeToggle = createDataModeToggle({
        onChange: (val) => console.log('DataMode changed to:', val)
    });

    const newRuleBtn = document.createElement('button');
    newRuleBtn.type = 'button';
    newRuleBtn.className = 'noto';
    newRuleBtn.textContent = '➕';
    newRuleBtn.title = 'Neue Regel erstellen';
    newRuleBtn.setAttribute('aria-label', 'Neue Regel erstellen');
    newRuleBtn.addEventListener('click', () => startNewRule({ announce: true }));

    saveButtonHeader = createSaveButton({ onSave: onSaveRuleClick });
    const windowBtns = createWindowButtons();

    buttonContainer.append(newRuleBtn, saveButtonHeader.el, helpBtn, dataModeToggle, windowBtns);
    divider.append(leftGap, h2, buttonContainer);
}

// ============= INPUT HANDLING =============
function initializeInputFunctions() {
    ensureEmptyDefaultOptions();

    INPUT_BINDINGS.forEach(({ key, handler }) => {
        const select = getSelect(key);
        if (!select) {
            console.warn(`[rule-form] Select not found for key "${key}"`);
            return;
        }
        select.addEventListener('change', event => {
            const value = event.target.value;

            if (!value) {
                clearRuleCellAndDraftBlock(key);
                return;
            }

            handler(value);
        });
    });
}

export function handleDelegatedChange(event) {
    const el = event.target;
    if (!el) return;

    const blockId = el.dataset.blockId || (el.id ? el.id.split('-')[0] : null);
    const inputID = el.dataset.inputId || (el.id ? el.id.split('-')[1] || 'value' : 'value');

    if (!blockId) return;

    const inputObj = {
        id: blockId,
        inputID,
        number1: el.dataset.number1 ? Number(el.dataset.number1) : null,
        number2: el.dataset.number2 ? Number(el.dataset.number2) : null,
        value: null,
        words: null
    };

    // Handle different input types
    if (el.type === 'checkbox') {
        const parent = el.closest('.inputRow') || el.closest('tbody') || el.parentElement;
        const boxes = parent ? parent.querySelectorAll('input[type="checkbox"]') : [el];
        inputObj.value = Array.from(boxes).filter(b => b.checked).map(b => b.dataset.index ?? b.value);
    } else if (el.tagName === 'SELECT') {
        inputObj.value = el.multiple ? Array.from(el.selectedOptions).map(o => o.value) : el.value;
    } else if (el.type === 'number') {
        inputObj.number1 = Number(el.value) || 0;
        inputObj.value = inputObj.number1;
    } else {
        inputObj.value = el.value;
    }

    handleInput(inputObj);
}

function initEventDelegation() {
    if (eventDelegationInitialized) return;

    const container = document.getElementById('rule-form-container');
    if (!container) return console.warn('Container not found');

    container.addEventListener('change', handleDelegatedChange);
    eventDelegationInitialized = true;
}

export function handleInput(inputObj) {

    const id = inputObj.id;
    if (!id || !blocks[id]) {
        console.warn("Invalid block id:", id, inputObj);
        return;
    }

    const firstChar = id.charAt(0);
    const isMain = firstChar === firstChar.toUpperCase();
    const scope = isMain ? "main" : "secondary";
    const key = BLOCK_KEY_MAP[firstChar.toUpperCase()];

    if (!key) {
        console.warn("Unknown prefix:", firstChar, id);
        return;
    }

    // Initialize rule structure
    if (!ruleForEditing.id) ruleForEditing.id = "ui-rule";
    if (!ruleForEditing.main) ruleForEditing.main = {};
    if (!ruleForEditing.secondary) ruleForEditing.secondary = {};

    if (key === "exception" && scope === "secondary") {
        console.warn("Secondary exceptions are not allowed:", id);
        return;
    }

    const block = blocks[id];
    ruleForEditing[scope][key] = block;

    const target = ruleForEditing[scope][key];
    if (!target) {
        console.warn("Failed to attach block:", scope, key);
        return;
    }

    // Apply input details based on key
    applyInputDetails(target, key, inputObj);

    const liveSanityResult = runLiveSanity(ruleForEditing);
    applyLiveSanityUIState(liveSanityResult, inputObj.id);

    translateCurrentRule(ruleForEditing, cachedRoles);

    const debug = document.getElementById("debug-output");
    if (debug) {
        debug.textContent = `Human: ${liveSanityResult.ok ? "✅ OK" : "⚠️ Error"}\n\n`;
    }

    drawRuleLine();
}

function applyLiveSanityUIState(liveSanityResult, lastUpdatedID = '') {
    const sanity = liveSanityResult || runLiveSanity(ruleForEditing || {});
    updateWizard(sanity, lastUpdatedID);

    if (localStorage.getItem('dataMode') === 'sample') {
        saveButtonHeader?.setState('readonly');
        return sanity;
    }

    saveButtonHeader?.setState(sanity.blocking ? 'blocked' : 'dirty');
    return sanity;
}

function applyInputDetails(target, key, inputObj) {
    if (!target.details) target.details = {};

    switch (key) {
        case "repeat":
        case "amount":
            if (inputObj.number1 != null) target.details.bottom = inputObj.number1;
            if (inputObj.number2 != null) target.details.top = inputObj.number2;
            break;
        case "timeframe":
            if (inputObj.words) target.details.days = inputObj.words;
            if (inputObj.value != null) {
                target.details.shifts = Array.isArray(inputObj.value) ? inputObj.value : [inputObj.value];
            }
            break;
        case "group":
            if (Array.isArray(inputObj.value)) {
                target.details.roles = inputObj.value;
            } else if (inputObj.value != null && inputObj.value !== '') {
                target.details.roles = [inputObj.value];
            }
            break;
        case "dependency":
            if (inputObj.words) {
                target.details.roles = Array.isArray(inputObj.words) ? inputObj.words : [inputObj.words];
            }
            if (inputObj.number1 != null) {
                const numericBottom = Number(inputObj.number1);
                if (Number.isFinite(numericBottom)) {
                    target.details.bottom = numericBottom;
                    // Backward-compatible aliases used by older translators/readers.
                    target.details.number = numericBottom;
                    target.details.count = numericBottom;
                    target.details.amount = numericBottom;
                }
            }
            if (inputObj.number2 != null) {
                const numericTop = Number(inputObj.number2);
                if (Number.isFinite(numericTop)) {
                    target.details.top = numericTop;
                }
            }
            break;
        case "exception":
            if (inputObj.words) target.details.rules = inputObj.words;
            break;
    }
}

function resetInput() {
    resetRule();
    toggleExceptionTable(false);
    document.querySelectorAll('.rule-table thead select').forEach(select => {
        const placeholder = Array.from(select.options).find(option => option.value === '');
        if (placeholder) {
            select.value = '';
        } else {
            select.selectedIndex = 0;
        }
        select.dispatchEvent(new Event('change'));
    });
}

function handleTopCellDependency(id) {
    const dependencyElement = document.createElement('div');
    const input1 = createNumberInput(id + '-number1', 1);
    const input2 = createNumberInput(id + '-number2', 2);

    const label = document.createElement('span');
    const dependencyRoleSelection = createRoleSelect(id + '-roleSelect');

    const inputObject = {
        id, inputID: "topCell",
        number1: 1, number2: 2,
        value: "", words: [dependencyRoleSelection.value]
    };

    setupDependencyInputListeners(input1, input2, dependencyRoleSelection, inputObject);

    switch (id.toLowerCase()) {
        case "d0": label.innerHTML = 'anwesend'; dependencyElement.append(label); break;
        case "d2": label.innerHTML = 'braucht'; dependencyElement.append(label, input1, dependencyRoleSelection); break;
        case "d3": label.innerHTML = 'hilft'; dependencyElement.append(label, input1, dependencyRoleSelection); break;
        case "d4":
            label.innerHTML = ' <= 🧩 ';
            dependencyElement.append(label, dependencyRoleSelection, input1, input2);
            break;
        default:
            console.warn("no match for dependency rule " + id);
            return;
    }

    const keyMap = { 'D': 'D', 'd': 'd' };
    const key = keyMap[id[0]];
    if (!key) return console.error(`Unknown dependency key for id ${id}`);

    const dependencyCell = getCell(key);
    if (!dependencyCell) {
        console.warn(`Cell not found for dependency key "${key}"`);
        return;
    }

    dependencyCell.innerHTML = '';
    dependencyCell.appendChild(dependencyElement);
    handleInput(inputObject);
}

function createNumberInput(id, defaultValue) {
    const input = document.createElement('input');
    input.type = 'number';
    input.classList.add('noto', 'rule-number-input');
    input.value = defaultValue;
    input.min = 1;
    input.max = 50;
    input.id = id;
    return input;
}

function createRoleSelect(id) {
    const select = document.createElement('select');
    select.classList.add('role-select', 'noto');
    select.id = id;

    cachedRoles.filter(r => !['⊖', 'keine', '?', 'name'].includes(r.name))
        .forEach((role, index) => {
            const option = document.createElement('option');
            const roleColor = getComputedStyle(document.body).getPropertyValue(`--role-${role.colorIndex}-color`);
            option.style.backgroundColor = roleColor;
            option.innerHTML = `${role.emoji} ⇨ ${role.name}`;
            option.title = role.name;
            option.value = String(role.colorIndex ?? index);
            select.appendChild(option);
        });

    select.addEventListener('change', () => updateShiftSelectColor(select));
    return select;
}

function setupDependencyInputListeners(input1, input2, roleSelect, inputObject) {
    [input1, input2].forEach(input => {
        input.addEventListener('input', () => {
            inputObject.number1 = parseFloat(input1.value) || 0;
            inputObject.number2 = parseFloat(input2.value) || 0;
            handleInput(inputObject);
        });
    });

    roleSelect.addEventListener('change', () => {
        inputObject.words = [roleSelect.value];
        handleInput(inputObject);
    });
}

function handleTopCellTimeFrame(id) {
    const inputObject = { id, inputID: "topCell", value: null };
    const timeFrameElement = document.createElement('div');

    switch (id.toLowerCase()) {
        case 't0': timeFrameElement.innerHTML = '...'; break;
        case 't1': buildShiftSelector(timeFrameElement, id, inputObject); break;
        case 't2': buildWorkdaySelector(timeFrameElement, id, inputObject); break;
        case 't3': timeFrameElement.innerHTML = 'Woche'; break;
        case 't4': timeFrameElement.innerHTML = 'Monat'; break;
        case 't5': buildOutOfOfficeSelector(timeFrameElement, id, inputObject); break;
        default:
            console.error(" time frame identifier " + id + " not identified");
            return;
    }

    const keyMap = { 'T': 'T', 't': 't' };
    const key = keyMap[id[0]];
    if (!key) return console.error(id + " unknown time frame selector");

    const timeCell = getCell(key);
    if (!timeCell) {
        console.warn(`Cell not found for key "${key}"`);
        return;
    }

    timeCell.innerHTML = '';
    timeCell.appendChild(timeFrameElement);
    handleInput(inputObject);
}

function buildShiftSelector(container, id, inputObject) {
    const existingShifts = ['day', 'early', 'late'];
    const shiftSelection = document.createElement('select');
    shiftSelection.classList.add('role-select', 'noto');

    existingShifts.forEach((shift, index) => {
        const shiftOption = document.createElement('option');
        const symbols = cachedShiftSymbols || 'none';
        const emoji = getShiftSymbol(shift, symbols);
        const name = shift === 'day' ? 'Tag' : shift === 'early' ? 'Früh/' : 'Spät';

        shiftOption.innerHTML = `${emoji} ⇨ ${name}`;
        shiftOption.title = name;
        shiftOption.value = shift;
        shiftOption.dataset.name = name;
        shiftOption.id = id + '-' + (index + 1);
        shiftSelection.appendChild(shiftOption);
    });

    updateShiftSelectColor(shiftSelection);

    shiftSelection.addEventListener('change', function () {
        const selectedOption = shiftSelection.options[shiftSelection.selectedIndex];
        inputObject.words = selectedOption.dataset.name;
        inputObject.value = selectedOption.value;
        handleInput(inputObject);
        updateShiftSelectColor(shiftSelection);
    });

    container.appendChild(shiftSelection);
}

function buildWorkdaySelector(container, id, inputObject) {
    const ruleWorkdays = [];
    const ruleWorkdayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

    ruleOfficeDays.forEach((item, index) => {
        if (item === 'never') return;
        let name = ruleWorkdayNames[index];
        if (item === 'morning') name += ' (früh)';
        else if (item === 'afternoon') name += ' (spät)';
        ruleWorkdays.push({ name, index });
    });

    if (ruleWorkdays.length < 1) {
        const workdayLabel = document.createElement('label');
        workdayLabel.style = "margin-left: 5px;";
        workdayLabel.textContent = 'Bitte Öffnungzeiten festlegen';
        container.appendChild(workdayLabel);
    } else {
        createCheckboxGroup("days", ruleWorkdays, container,
            (container) => handleCheckboxChangeWithNeighbors(container, id)(),
            { idPrefix: `${id}-checkbox` }
        );
    }
}

function buildOutOfOfficeSelector(container, id, inputObject) {
    const outOfOfficeElement = document.createElement('div');
    const outOfOfficeReasons = ['dienstlich', 'frei', 'Schulferien', 'unvorhergesehen'];
    const checkboxes = [];

    outOfOfficeReasons.forEach((reason, index) => {
        const reasonRow = document.createElement('div');
        reasonRow.style = 'display: flex; align-items: center; gap: 8px;';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.classList.add('reason-checkbox');
        checkbox.id = id + '-checkbox-' + index;

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.style = "max-height: 1.5rem;";
        label.textContent = reason;
        label.classList.add('reason-label', 'noto');

        reasonRow.appendChild(checkbox);
        reasonRow.appendChild(label);
        outOfOfficeElement.appendChild(reasonRow);
        checkboxes.push(checkbox);

        checkbox.addEventListener('change', () => {
            const selectedReasons = checkboxes
                .filter(cb => cb.checked)
                .map(cb => {
                    const idx = parseInt(cb.id.split('-').pop());
                    return outOfOfficeReasons[idx].replace(/[^a-zA-ZäöüÄÖÜß\s]/g, '').trim();
                });
            inputObject.words = [selectedReasons.join(', ')];
            handleInput(inputObject);
        });
    });

    outOfOfficeElement.classList.add('checkbox-grid');
    container.appendChild(outOfOfficeElement);
}

function updateShiftSelectColor(select) {
    const value = select.value;
    select.classList.remove('rule-form-shift-early', 'rule-form-shift-day', 'rule-form-shift-late');

    switch (value) {
        case 'morning': select.classList.add('rule-form-shift-early'); break;
        case 'full': select.classList.add('rule-form-shift-day'); break;
        case 'afternoon': select.classList.add('rule-form-shift-late'); break;
    }
}

function handleTopCellRoles(id) {
    const roleElement = document.createElement('div');
    roleElement.classList.add('noto', 'rule-role-element');

    const roleLabel = document.createElement('div');
    roleLabel.classList.add('noto', 'rule-role-label');

    const validRoles = cachedRoles.filter(r => !['⊖', 'keine', '?', 'name'].includes(r.name));

    if (validRoles.length === 0) {
        roleLabel.textContent = '⚠️ Bitte zuerst Rollen zuweisen!';
        roleElement.appendChild(roleLabel);
    } else if (['g1', 'g2'].includes(id.toLowerCase())) {
        handleMultiRoleSelection(id, roleElement, roleLabel, validRoles);
    } else if (id.toLowerCase() === 'g0') {
        handleSingleRoleSelection(id, roleElement, validRoles);
    }

    const isException = id[0] === id[0].toLowerCase();
    const roleCellId = isException ? 'rule-ex-g-td' : 'rule-main-G-td';
    const roleCell = document.getElementById(roleCellId);

    if (roleCell) {
        roleCell.innerHTML = '';
        roleCell.appendChild(roleElement);
    } else {
        console.warn('Role cell not found for id:', id);
    }

    // Ensure top-level group selection is reflected immediately in live sanity.
    handleInput({ id, inputID: 'topCell', value: [] });
}

function handleMultiRoleSelection(id, roleElement, roleLabel, validRoles) {
    roleLabel.textContent = id.toLowerCase() === 'g1' ? '🧩 und 🧩' : '🧩 oder 🧩';
    roleElement.appendChild(roleLabel);

    const items = validRoles.map(role => ({ name: role.name, index: role.colorIndex }));

    createCheckboxGroup('roles', items, roleElement,
        (container) => handleCheckboxChangeWithNeighbors(container, id)(),
        { idPrefix: `${id}-checkbox` }
    );
}

function handleSingleRoleSelection(id, roleElement, validRoles) {
    const singleRoleSelection = document.createElement('select');
    singleRoleSelection.classList.add('role-select', 'noto');
    singleRoleSelection.id = `${id}-select`;
    singleRoleSelection.name = 'roleIndicee';

    validRoles.forEach((role) => {
        const singleRoleOption = document.createElement('option');
        const roleColor = getComputedStyle(document.body).getPropertyValue(`--role-${role.colorIndex}-color`);
        singleRoleOption.style.backgroundColor = roleColor;
        singleRoleOption.textContent = `${role.emoji} ⇨ ${role.name}`;
        singleRoleOption.title = role.name;
        singleRoleOption.dataset.name = role.name;
        singleRoleOption.value = role.colorIndex;
        singleRoleSelection.appendChild(singleRoleOption);
    });

    if (validRoles[0]) {
        const initialColor = getComputedStyle(document.body).getPropertyValue(`--role-${validRoles[0].colorIndex}-color`);
        singleRoleSelection.style.backgroundColor = initialColor || '';
    }

    singleRoleSelection.addEventListener('change', () => {
        const selectedOption = singleRoleSelection.options[singleRoleSelection.selectedIndex];
        singleRoleSelection.style.backgroundColor = selectedOption.style.backgroundColor;
        handleInput({
            id, type: "group",
            words: selectedOption.dataset.name,
            value: selectedOption.value,
            details: { roles: [selectedOption.value] }
        });
        updateShiftSelectColor(singleRoleSelection);
    });

    roleElement.appendChild(singleRoleSelection);
    singleRoleSelection.dispatchEvent(new Event('change'));
}

function handleTopCellException(id) {

    const exceptionTexts = {
        E0: ' - - - ', E1: 'und', E2: 'oder', E3: 'aber',
        E4: 'außer', E5: 'aber nicht mehr als', E6: 'aber nicht weniger als',
    };

    const keyMap = { 'E': 'E' };
    const key = keyMap[id[0]];
    if (!key) return console.error(id + " unknown exception selector");

    const exceptionCell = getCell(key);
    if (!exceptionCell) {
        console.warn(`Cell not found for key "${key}"`);
        return;
    }

    exceptionCell.innerHTML = '';
    const exceptionLabel = document.createElement('div');
    exceptionLabel.classList.add('noto');
    exceptionLabel.textContent = exceptionTexts[id] || 'Unbekannte Ausnahme';
    exceptionCell.appendChild(exceptionLabel);

    handleInput({ id, inputID: "topCell", value: id });
    toggleExceptionTable(id !== 'E0');

    // Force reflow
    void document.getElementById('rule-tables-container')?.offsetHeight;
    window.dispatchEvent(new Event('resize'));
}

function handleTopCellNumberInput(id) {
    const container = document.createElement('div');
    if (!container) return console.warn('Container not found');
    container.classList.add('inputRow');

    const numLabel = document.createElement('span');
    numLabel.classList.add('noto');

    const input1 = createNumberInput(id + '-number1', 1);
    const input2 = createNumberInput(id + '-number2', 2);

    const inputObject = {
        id, inputID: "topCell",
        number1: 1, number2: 2
    };

    [input1, input2].forEach(input => {
        input.addEventListener('input', () => {
            inputObject.number1 = parseFloat(input1.value) || 0;
            inputObject.number2 = parseFloat(input2.value) || 0;
            handleInput(inputObject);
        });
    });

    buildNumberInputUI(id, container, numLabel, input1, input2);

    const keyMap = { 'A': 'A', 'a': 'a', 'W': 'W', 'w': 'w' };
    const key = keyMap[id[0]];
    if (!key) return console.error(id + " unknown number selector");

    const numberCell = getCell(key);
    if (!numberCell) {
        console.warn(`Cell not found for key "${key}"`);
        return;
    }

    numberCell.innerHTML = '';
    numberCell.appendChild(container);
    handleInput(inputObject);
}

function buildNumberInputUI(id, container, label, input1, input2) {
    switch (id.toLowerCase()) {
        case 'w0': label.innerHTML = '...'; container.append(label); break;
        case 'w1': label.innerHTML = 'jede(n)'; container.append(label); break;
        case 'w2': label.innerHTML = 'entweder'; container.append(label); break;
        case 'w3': label.innerHTML = 'nur'; container.append(label); break;
        case 'w4':
            label.innerHTML = ' x pro 🕒 <i class="text-info">(Woche)</i>';
            container.append(input1, label);
            break;
        case "a1":
            label.innerHTML = 'ungefähr: ';
            container.append(label, input1);
            break;
        case "a3":
            label.innerHTML = 'zwischen: ';
            const andLabel = document.createElement('span');
            andLabel.innerHTML = ' und ';
            input2.value = 3;
            container.append(label, input1, andLabel, input2);
            break;
        case "a4":
            label.innerHTML = 'maximal: ';
            container.append(label, input1);
            break;
        case "a5":
            label.innerHTML = 'minimal: ';
            container.append(label, input1);
            break;
        case "a8":
            label.innerHTML = 'genau: ';
            container.append(label, input1);
            break;
        default:
            console.warn(`Unhandled number input ID: ${id}`);
            break;
    }
}

function handleCheckboxChangeWithNeighbors(container, blockId) {
    return () => {
        const checked = Array.from(container.querySelectorAll('input[type="checkbox"]:checked'));
        const selectedNames = checked.map(cb => cb.dataset.name);
        const selectedValues = checked.map(cb => cb.dataset.index ?? cb.dataset.colorIndex ?? cb.value);

        handleInput({
            id: blockId,
            inputID: "topCell",
            words: selectedNames,
            value: selectedValues
        });
    };
}

// ============= CHECKBOX GROUP UTILITY =============
function createCheckboxGroup(type, items, parent, onChange, options = {}) {
    const container = document.createElement('div');
    container.classList.add('checkbox-grid');

    items.forEach((item) => {
        const wrapper = document.createElement('div');
        wrapper.classList.add('checkbox-item');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `${options.idPrefix || 'chk'}-${item.name}`;

        if (item.index != null) checkbox.dataset.index = item.index;
        if (item.colorIndex != null) checkbox.dataset.colorIndex = item.colorIndex;
        if (item.name) checkbox.dataset.name = item.name;

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.style.marginLeft = '0.05rem';
        label.style.paddingRight = '0.1rem';
        label.textContent = item.name;

        wrapper.appendChild(checkbox);
        wrapper.appendChild(label);
        container.appendChild(wrapper);

        checkbox.addEventListener('change', () => onChange(container, type));
    });

    parent.appendChild(container);
    return container;
}

// ============= SVG DRAWING =============
function drawRuleLine() {

    const svg = document.getElementById("rule-lines");
    svg.innerHTML = "";

    const a = document.getElementById("rule-main-E-th")?.getBoundingClientRect();
    const b = document.getElementById("space-between-tables")?.getBoundingClientRect();
    const c = document.getElementById("rule-ex-w-th")?.getBoundingClientRect();
    const container = document.getElementById("rule-diagram")?.getBoundingClientRect();

    if (!a || !b || !c || !container) return;

    const startX = a.right - container.left;
    const startY = a.top + a.height / 2 - container.top;
    const midX1 = startX + 32;
    const midY = b.top + b.height / 2 - container.top;
    const endX = c.left - container.left;
    const endY = c.top + c.height / 2 - container.top;
    const midX2 = endX - 32;

    const pathData = `M ${startX} ${startY} L ${midX1} ${startY} L ${midX1} ${midY} L ${midX2} ${midY} L ${midX2} ${endY} L ${endX} ${endY}`;

    const base = createSVGElement("path", { id: "rule-line-base", d: pathData });
    const flow = createSVGElement("path", { id: "rule-line-flow", d: pathData });

    svg.append(base, flow);
}

function createSVGElement(tag, attributes) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.entries(attributes).forEach(([key, value]) => el.setAttribute(key, value));
    return el;
}

// ============= RULE CRUD OPERATIONS =============
export function populateFormFromRule(rule, { setEditorState = true } = {}) {
    if (!rule || !rule.main) return;

    const condition = rule.secondary || rule.condition || {};

    const isBlockId = (value) => /^[WTAGDE]\d+$/i.test(String(value).replace(/\s+/g, ''));

    const normalizeType = (typeOrId, fallback, isSecondary) => {
        if (!typeOrId) return fallback;
        const t = String(typeOrId).trim();
        if (isBlockId(t)) return isSecondary ? t.toLowerCase() : t.toUpperCase();
        const head = t.charAt(0);
        const normHead = isSecondary ? head.toLowerCase() : head.toUpperCase();
        return normHead + t.slice(1);
    };

    const pickTypeId = (block, fallback, isSecondary) => {
        if (!block) return fallback;
        if (block.id && isBlockId(block.id)) {
            return isSecondary ? String(block.id).toLowerCase() : String(block.id).toUpperCase();
        }
        return normalizeType(block.type, fallback, isSecondary);
    };

    const findSelectValue = (sel, desired, fallback) => {
        const options = Array.from(sel.options || []);
        const desiredStr = desired != null ? String(desired) : '';
        const exact = options.find(opt => opt.value === desiredStr);
        if (exact) return exact.value;
        const lower = desiredStr.toLowerCase();
        const caseMatch = options.find(opt => opt.value.toLowerCase() === lower);
        if (caseMatch) return caseMatch.value;
        if (fallback != null) {
            const fallbackMatch = options.find(opt => opt.value === String(fallback));
            if (fallbackMatch) return fallbackMatch.value;
        }
        return options[0]?.value ?? desiredStr;
    };

    const setSelect = (key, value, fallback) => {
        const sel = getSelect(key);
        if (!sel) return;
        sel.value = findSelectValue(sel, value, fallback);

        const binding = INPUT_BINDINGS.find(item => item.key === key);
        if (binding?.handler) binding.handler(sel.value);
    };

    const fillNumberCell = (key, amountObj) => {
        const cell = getCell(key);
        if (!cell) return;
        const inputs = cell.querySelectorAll('input[type="number"]');
        if (!inputs.length) return;

        const bottom = amountObj?.bottom ?? amountObj?.number ?? amountObj?.details?.bottom ?? null;
        const top = amountObj?.top ?? amountObj?.details?.top ?? null;

        if (inputs.length >= 1 && bottom != null) inputs[0].value = bottom;
        if (inputs.length >= 2 && top != null) inputs[1].value = top;
        inputs.forEach(input => input.dispatchEvent(new Event('input', { bubbles: true })));
    };

    const toArray = (value) => {
        if (Array.isArray(value)) return value;
        if (value == null) return [];
        return [value];
    };

    const extractDetails = (block) => {
        if (!block || typeof block !== 'object') return {};
        return (block.details && typeof block.details === 'object') ? block.details : block;
    };

    const fillSelectInCell = (key, desired) => {
        const cell = getCell(key);
        if (!cell) return;
        const select = cell.querySelector('select');
        if (!select) return;

        select.value = findSelectValue(select, desired, select.value);
        select.dispatchEvent(new Event('change', { bubbles: true }));
    };

    const fillCheckboxesInCell = (key, selectedValues) => {
        const cell = getCell(key);
        if (!cell) return;
        const checkboxes = Array.from(cell.querySelectorAll('input[type="checkbox"]'));
        if (!checkboxes.length) return;

        const selectedSet = new Set(toArray(selectedValues).map(value => String(value)));
        checkboxes.forEach((checkbox) => {
            const boxValue = checkbox.dataset.index ?? checkbox.dataset.colorIndex ?? checkbox.value;
            checkbox.checked = selectedSet.has(String(boxValue));
        });

        checkboxes[0].dispatchEvent(new Event('change', { bubbles: true }));
    };

    const fillTimeframeCell = (key, timeframeObj) => {
        const details = extractDetails(timeframeObj);
        const shifts = toArray(details.shifts);
        const days = toArray(details.days);

        if (shifts.length) {
            fillSelectInCell(key, shifts[0]);
            return;
        }

        if (days.length) {
            fillCheckboxesInCell(key, days);
        }
    };

    const fillGroupCell = (key, groupObj) => {
        const details = extractDetails(groupObj);
        const roles = toArray(details.roles);
        if (!roles.length) return;

        const cell = getCell(key);
        if (!cell) return;

        const select = cell.querySelector('select');
        if (select) {
            fillSelectInCell(key, roles[0]);
            return;
        }

        fillCheckboxesInCell(key, roles);
    };

    const fillDependencyCell = (key, dependencyObj) => {
        const details = extractDetails(dependencyObj);
        const cell = getCell(key);
        if (!cell) return;

        const roleSelect = cell.querySelector('select');
        if (roleSelect) {
            const roles = toArray(details.roles);
            if (roles.length) {
                roleSelect.value = findSelectValue(roleSelect, roles[0], roleSelect.value);
                roleSelect.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        const inputs = cell.querySelectorAll('input[type="number"]');
        if (!inputs.length) return;

        const bottom = details.bottom ?? dependencyObj?.bottom ?? null;
        const top = details.top ?? dependencyObj?.top ?? null;
        if (inputs.length >= 1 && bottom != null) inputs[0].value = bottom;
        if (inputs.length >= 2 && top != null) inputs[1].value = top;
        inputs.forEach(input => input.dispatchEvent(new Event('input', { bubbles: true })));
    };

    // Main selects
    setSelect('W', pickTypeId(rule.main.repeat, 'W0', false), 'W0');
    setSelect('T', pickTypeId(rule.main.timeframe, 'T0', false), 'T0');
    setSelect('A', pickTypeId(rule.main.amount, 'A1', false), 'A1');
    setSelect('G', pickTypeId(rule.main.group, 'G0', false), 'G0');
    setSelect('D', pickTypeId(rule.main.dependency, 'D0', false), 'D0');
    setSelect('E', pickTypeId(rule.main.exception, 'E0', false), 'E0');

    // Secondary selects
    setSelect('w', pickTypeId(condition.repeat, 'w0', true), 'w0');
    setSelect('t', pickTypeId(condition.timeframe, 't0', true), 't0');
    setSelect('a', pickTypeId(condition.amount, 'a1', true), 'a1');
    setSelect('g', pickTypeId(condition.group, 'g0', true), 'g0');
    setSelect('d', pickTypeId(condition.dependency, 'd0', true), 'd0');

    // Fill details
    fillNumberCell('W', rule.main.repeat);
    fillTimeframeCell('T', rule.main.timeframe);
    fillNumberCell('A', rule.main.amount);
    fillGroupCell('G', rule.main.group);
    fillDependencyCell('D', rule.main.dependency);
    fillNumberCell('w', condition.repeat);
    fillTimeframeCell('t', condition.timeframe);
    fillNumberCell('a', condition.amount);
    fillGroupCell('g', condition.group);
    fillDependencyCell('d', condition.dependency);

    if (setEditorState) {
        const clone = typeof structuredClone === 'function'
            ? structuredClone(rule)
            : JSON.parse(JSON.stringify(rule));
        const mergedCondition = clone.secondary || clone.condition || {};
        ruleForEditing = {
            ...clone,
            secondary: mergedCondition,
            condition: mergedCondition
        };
        translateCurrentRule(ruleForEditing, cachedRoles);
        scrollRulesToBottomIfAllowed();
    }
}

export function copyRule(ruleView) {
    const rule = ruleView?.rule ?? ruleView;
    if (!rule) {
        console.warn('Copy rule failed: no rule provided', ruleView);
        return;
    }

    console.info('Copy rule into editor:', rule.id);
    populateFormFromRule(rule, { setEditorState: true });
    ruleForEditing.id = '';
    ruleForEditing.created = null;
    ruleForEditing.updated = null;
    translateCurrentRule(ruleForEditing, cachedRoles);
    scrollRulesToBottomIfAllowed();
}

export function editRule(ruleView) {
    const rule = ruleView?.rule ?? ruleView;
    if (!rule) {
        console.warn('Edit rule failed: no rule provided', ruleView);
        return;
    }

    console.info('Edit rule:', rule.id);
    populateFormFromRule(rule, { setEditorState: true });
}

function buildDeleteRuleMessage(ruleView) {
    const rule = ruleView?.rule ?? ruleView;
    let preview = '';

    try {
        preview = generateFullHumanSentence(rule, cachedRoles)
            .replace(/<[^>]*>/g, '')
            .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
            .replace(/\s+/g, ' ')
            .trim();
    } catch (err) {
        console.warn('Rule preview failed:', err);
    }

    const maxLen = 140;
    if (preview.length > maxLen) preview = `${preview.slice(0, maxLen - 1).trimEnd()}…`;

    return [
        'REGEL WIRKLICH LÖSCHEN?',
        preview ? `\n„${preview}“` : '',
        '\nDieser Vorgang kann nicht rückgängig gemacht werden.'
    ].join('');
}

export async function deleteRule(ruleView) {
    const ok = await confirmAction(buildDeleteRuleMessage(ruleView));
    if (!ok) return;

    const target = ruleView?.rule ?? ruleView;
    const targetId = target?.id ?? ruleView?.id;
    if (!targetId) {
        console.warn('Delete failed: missing rule id', ruleView);
        return;
    }

    if (isClientMode()) {
        const deleteRef = target?._sourcePath || targetId;
        const rawResult = await deleteRuleFromDisk(api, deleteRef);
        const result = (rawResult && typeof rawResult === 'object')
            ? rawResult
            : { success: Boolean(rawResult), error: rawResult ? null : 'Unbekannter Fehler beim Löschen' };

        if (!result.success) {
            const message = result.error || 'Unbekannter Fehler beim Löschen';
            console.warn(`Delete failed for "${targetId}":`, message);
            announceStatus(`Regel konnte nicht gelöscht werden: ${message}`);
            return result;
        }

        const previousRules = Array.isArray(ruleSet) ? [...ruleSet] : [];
        const filteredRules = previousRules.filter((rule) => {
            const sameId = String(rule?.id) === String(targetId);
            const sameSource = target?._sourcePath && rule?._sourcePath && String(rule._sourcePath) === String(target._sourcePath);
            return !(sameId || sameSource);
        });

        // Optimistic UI refresh: remove deleted entry immediately.
        ruleSet = filteredRules;
        translateExistingRules(ruleSet, cachedRoles, teamnames);
        scrollRulesToBottomIfAllowed(true);
        clearImpactCharts();
        updateSaveButtonState();
        announceStatus('Regel gelöscht.');

        // Background reload from disk. Guard against transient empty-list glitches.
        try {
            const reloadedRules = await loadRuleData(api);
            if (Array.isArray(reloadedRules)) {
                const looksTransientEmpty =
                    filteredRules.length > 0 &&
                    reloadedRules.length === 0;

                if (looksTransientEmpty) {
                    console.warn('[rule-form] Ignoring transient empty rules reload after delete.');
                } else {
                    ruleSet = reloadedRules;
                    translateExistingRules(ruleSet, cachedRoles, teamnames);
                    scrollRulesToBottomIfAllowed(true);
                }
            }
        } catch (reloadError) {
            console.warn('[rule-form] Reload after delete failed, keeping optimistic list.', reloadError);
        }

        return result;
    }

    const beforeCount = ruleSet.length;
    ruleSet = ruleSet.filter(rule => String(rule?.id) !== String(targetId));
    const deleted = beforeCount !== ruleSet.length;
    if (!deleted) {
        console.warn('Rule not found in sample mode:', targetId);
        return;
    }

    translateExistingRules(ruleSet, cachedRoles, teamnames);
    scrollRulesToBottomIfAllowed(true);
    clearImpactCharts();
    updateSaveButtonState();
    announceStatus('Regel gelöscht (Sample-Modus).');
    console.warn('Rule removed in sample mode:', targetId);
}

// ============= DATA MODE =============
export function getDataMode() {
    return localStorage.getItem('dataMode') === 'client' ? 'client' : 'sample';
}

export function isClientMode() {
    return getDataMode() === 'client';
}

// ============= COMPARISON UTILITIES =============
function compareRuleExecutions(baselineStats, candidateStats) {
    const baselineFailures = baselineStats?.failures || [];
    const candidateFailures = candidateStats?.failures || [];

    const makeKey = (f) => `${f.scope}|${f.ruleId}|${f.weekNumber || f.date || ''}|${f.type}`;

    const baselineKeys = new Set(baselineFailures.map(makeKey));
    const candidateKeys = new Set(candidateFailures.map(makeKey));

    return {
        added: candidateFailures.filter(f => !baselineKeys.has(makeKey(f))),
        removed: baselineFailures.filter(f => !candidateKeys.has(makeKey(f))),
        changed: [] // Could implement severity change detection
    };
}

function computeScopeDelta(baselineByScope = {}, candidateByScope = {}) {
    const allScopes = new Set([...Object.keys(baselineByScope), ...Object.keys(candidateByScope)]);
    const delta = {};

    allScopes.forEach(scope => {
        delta[scope] = (candidateByScope[scope] || 0) - (baselineByScope[scope] || 0);
    });

    return delta;
}

function buildImpactBreakdown(baselineFailures = [], candidateFailures = []) {
    return {
        weekday: buildWeekdayBreakdown(baselineFailures, candidateFailures),
        weekdayRoles: buildWeekdayRoleBreakdown(baselineFailures, candidateFailures),
        teamRoles: buildTeamRoleBreakdown(baselineFailures, candidateFailures)
    };
}

function buildWeekdayBreakdown(baselineFailures = [], candidateFailures = []) {
    const beforeCounts = countFailuresByWeekday(baselineFailures);
    const afterCounts = countFailuresByWeekday(candidateFailures);

    return WEEKDAY_SHORT.map((label, idx) => {
        const before = beforeCounts[idx] || 0;
        const after = afterCounts[idx] || 0;
        return { label, before, after, delta: after - before };
    });
}

function buildWeekdayRoleBreakdown(baselineFailures = [], candidateFailures = []) {
    const beforeRoles = countFailureRoleWeightsByWeekday(baselineFailures);
    const afterRoles = countFailureRoleWeightsByWeekday(candidateFailures);

    return WEEKDAY_SHORT.map((label, idx) => ({
        label,
        beforeRoles: beforeRoles[idx],
        afterRoles: afterRoles[idx]
    }));
}

function countFailuresByWeekday(failures = []) {
    const counts = Array(7).fill(0);
    failures.forEach((failure) => {
        const idx = resolveFailureWeekdayIndex(failure);
        if (idx < 0 || idx > 6) return;
        counts[idx] += 1;
    });
    return counts;
}

function countFailureRoleWeightsByWeekday(failures = []) {
    const weekdayMaps = Array.from({ length: 7 }, () => new Map());

    failures.forEach((failure) => {
        const idx = resolveFailureWeekdayIndex(failure);
        if (idx < 0 || idx > 6) return;

        const roleIds = normalizeRoleIdList(failure?.subjectRoles);
        const roles = roleIds.length ? roleIds : [0];
        const weight = 1 / roles.length;

        roles.forEach((roleId) => {
            const map = weekdayMaps[idx];
            map.set(roleId, (map.get(roleId) || 0) + weight);
        });
    });

    return weekdayMaps.map((map) => {
        const rows = Array.from(map.entries())
            .map(([roleId, weight]) => ({ roleId: Number(roleId), weight: Number(weight) }))
            .filter((entry) => Number.isFinite(entry.weight) && entry.weight > 0)
            .sort((a, b) => a.roleId - b.roleId);

        return rows;
    });
}

function normalizeRoleIdList(subjectRoles) {
    const ids = Array.isArray(subjectRoles) ? subjectRoles : [];
    const unique = new Set();

    ids.forEach((roleIdRaw) => {
        const roleId = Number(roleIdRaw);
        if (!Number.isInteger(roleId) || roleId < 0 || roleId > ROLE_INDEX_MAX) return;
        unique.add(roleId);
    });

    return [...unique];
}

function resolveFailureWeekdayIndex(failure) {
    if (!failure || typeof failure !== 'object') return -1;
    if (Number.isInteger(failure.weekdayIndex) && failure.weekdayIndex >= 0 && failure.weekdayIndex <= 6) {
        return failure.weekdayIndex;
    }

    const sourceDate = failure.date || failure.weekStart || null;
    if (!sourceDate) return -1;
    const parsed = new Date(sourceDate);
    if (Number.isNaN(parsed.getTime())) return -1;
    return (parsed.getDay() + 6) % 7;
}

function buildTeamRoleBreakdown(baselineFailures = [], candidateFailures = []) {
    const before = countFailuresByTeamRole(baselineFailures);
    const after = countFailuresByTeamRole(candidateFailures);
    const keys = new Set([...before.keys(), ...after.keys()]);
    const rows = [];

    keys.forEach((key) => {
        const baselineCount = before.get(key) || 0;
        const futureCount = after.get(key) || 0;
        if (baselineCount === 0 && futureCount === 0) return;

        const [teamKey, roleIdRaw] = key.split('|');
        const roleId = Number(roleIdRaw);
        rows.push({
            teamKey,
            teamLabel: resolveTeamLabel(teamKey),
            roleId,
            label: resolveRoleLabel(roleId),
            before: baselineCount,
            after: futureCount,
            delta: futureCount - baselineCount
        });
    });

    return rows.sort((a, b) => {
        const teamDiff = TEAM_KEY_ORDER.indexOf(a.teamKey) - TEAM_KEY_ORDER.indexOf(b.teamKey);
        if (teamDiff !== 0) return teamDiff;
        return Number(a.roleId) - Number(b.roleId);
    });
}

function countFailuresByTeamRole(failures = []) {
    const map = new Map();

    failures.forEach((failure) => {
        const uniqueRoles = normalizeRoleIdList(failure?.subjectRoles);
        if (!uniqueRoles.length) return;

        uniqueRoles.forEach((roleId) => {
            const teamKey = mapRoleToTeamKey(roleId);
            const key = `${teamKey}|${roleId}`;
            map.set(key, (map.get(key) || 0) + 1);
        });
    });

    return map;
}

function mapRoleToTeamKey(roleId) {
    if (roleId >= 1 && roleId <= 3) return 'blue';
    if (roleId >= 4 && roleId <= 6) return 'green';
    if (roleId >= 7 && roleId <= 9) return 'red';
    if (roleId >= 10 && roleId <= 12) return 'black';
    if (roleId === 13) return 'azubi';
    return 'none';
}

function resolveTeamLabel(teamKey) {
    const fallback = {
        blue: 'Team Blau',
        green: 'Team Grün',
        red: 'Team Rot',
        black: 'Team Schwarz',
        azubi: 'Ausbildung',
        none: 'Ohne Team'
    };

    if (!teamnames || typeof teamnames !== 'object') return fallback[teamKey] || 'Team';
    return teamnames[teamKey] || fallback[teamKey] || 'Team';
}

function resolveRoleLabel(roleId) {
    const role = Array.isArray(cachedRoles)
        ? cachedRoles.find(item => Number(item?.colorIndex) === Number(roleId))
        : null;

    if (!role) return `Rolle #${roleId}`;
    return `${role.emoji || '•'} ${role.name || `Rolle #${roleId}`}`.trim();
}

function updateRuleInMemory(rule) {
    if (!rule || !rule.id) return;
    const idx = ruleSet.findIndex(item => String(item?.id) === String(rule.id));
    if (idx >= 0) {
        ruleSet[idx] = { ...ruleSet[idx], ...rule };
        return;
    }
    ruleSet.push(rule);
}

// Stub functions that need implementation
// Add this near the other rule operations
function resetRule() {
    ruleForEditing = createRuleFromBlueprint(DEFAULT_BLUEPRINT);
    ensureEmptyDefaultOptions();

    // Start new editor with empty mandatory blocks.
    ['A', 'G', 'D', 'a', 'g', 'd'].forEach(clearRuleCellAndDraftBlock);

    toggleExceptionTable(false);
    translateCurrentRule(ruleForEditing, cachedRoles);
    drawRuleLine();
}

function startNewRule({ announce = false } = {}) {
    clearRuleWarnings();
    resetInput();
    clearImpactCharts();
    testPassed = false;
    lastTestReport = null;
    updateSaveButtonState();
    applyLiveSanityUIState();
    if (announce) announceStatus('Neue Regel gestartet.');
}

function clearRuleWarnings() {
    const list = document.getElementById('rule-new-warnings-list');
    const title = document.querySelector('.rule-new-warnings-list');

    if (list) {
        list.innerHTML = '';
        list.style.display = 'none';
        list.classList.remove('is-success', 'is-alert');
    }

    if (title) {
        title.style.display = 'none';
    }

    clearImpactCharts(); // also remove charts
}


function ensureEmptyDefaultOptions() {
    const placeholderKeys = ['A', 'G', 'D', 'a', 'g', 'd'];
    placeholderKeys.forEach((key) => {
        const select = getSelect(key);
        if (!select) return;

        let emptyOption = Array.from(select.options).find((option) => option.value === '');
        if (!emptyOption) {
            emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = '...';
            emptyOption.dataset.placeholder = 'true';
            select.insertBefore(emptyOption, select.firstChild);
        }

        emptyOption.disabled = true;
        emptyOption.selected = true;
    });
}

function clearRuleCellAndDraftBlock(key) {
    const cell = getCell(key);
    if (cell) cell.innerHTML = '';

    if (!ruleForEditing || typeof ruleForEditing !== 'object') return;

    const scope = key === key.toUpperCase() ? 'main' : 'secondary';
    const blockKey = BLOCK_KEY_MAP[key.toUpperCase()];
    if (!scope || !blockKey || !ruleForEditing[scope]) return;

    delete ruleForEditing[scope][blockKey];
    applyLiveSanityUIState(null, key);
    translateCurrentRule(ruleForEditing, cachedRoles);
    drawRuleLine();
}

export async function awakeRule(ruleView) {
    const rule = { ...ruleView.rule, isAsleep: false, updated: Date.now() };

    if (isClientMode()) {
        return await saveRuleData(window.api, rule);
    }

    updateRuleInMemory(rule);
    console.info('Rule awakened (sample mode)');
}


export async function goAsleep(ruleView) {
    const rule = { ...ruleView.rule, isAsleep: true, updated: Date.now() };

    if (isClientMode()) {
        return await saveRuleData(window.api, rule);
    }

    updateRuleInMemory(rule);
    console.info('Rule put to sleep (sample mode)');
}








