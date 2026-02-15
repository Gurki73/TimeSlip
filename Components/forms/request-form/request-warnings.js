// request-warnings.js

// -- Static warning definitions ------------------------------------
const posWarnings = {
    past: { rank: 1, warn: "Der Start-Termin liegt in der Vergangenheit" },
    ordr: { rank: 5, warn: "Der End-Termin liegt vor dem Start-Termin" },
    urgn: { rank: 1, warn: "Eilig, Abwesenheit startet bald" },
    auto: { rank: 1, warn: "Dieser Antrag wird automatisch genehmigt." },
    homHint: { rank: 1, warn: "Nur beantragen, wenn außerhalb normaler Home-Office-Vereinbarung." },
    over: { rank: 4, warn: "Nicht genügend Überstunden" },
    vacx: { rank: 3, warn: "Nicht genügend Urlaubsanspruch" },
    nobo: { rank: 2, warn: "Kein Angestellter ausgewählt" },
    stat: { rank: 2, warn: "Kein Start-Termin ausgewählt" },
    shif: { rank: 2, warn: "Halber Tag frei nur an Einzeltagen" },
    notype: { rank: 2, warn: "Kein Abwesenheitstyp ausgewählt" }
};

let warningList = new Set();
let lastSaveBtn = null;
let ruleCheckInfo = null;

export function resetWarnings() {
    warningList.clear();
}

export function addWarning(type) {
    if (posWarnings[type]) warningList.add(type);
}

export function recalcWarnings(saveBtn, roles = [], requests = [], ruleset = [], employees) {
    const state = getCurrentFormState();

    resetWarnings(saveBtn);

    const startDate = state.startDate ? new Date(state.startDate) : null;
    const endDate = state.endDate ? new Date(state.endDate) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!state.employeeId) addWarning("nobo");
    if (!startDate) addWarning("stat");
    if (startDate && endDate && endDate < startDate) addWarning("ordr");
    if (startDate && startDate < today) addWarning("past");
    if (state.type === "hom") addWarning("homHint"); // match your <select> value
    if (!state.type || state.type === "none") addWarning("notype");

    updateWarningsUI(saveBtn, roles, requests, ruleset);
}

async function updateWarningsUI(saveBtn, roles, requests, ruleset, employees) {
    const container = document.querySelector(".request-form-warn");
    if (!container) return;

    if (saveBtn) lastSaveBtn = saveBtn;

    container.innerHTML = "";

    const sorted = [...warningList].sort(
        (a, b) => posWarnings[b].rank - posWarnings[a].rank
    );

    const isEmpty = sorted.length === 0;

    if (isEmpty) {
        const empty = document.createElement("div");
        empty.textContent = "Keine Warnungen.";
        empty.style.opacity = "0.5";
        container.appendChild(empty);
    } else {
        const heading = document.createElement("div");
        heading.textContent = "⚠️ Warnungen ⚠️";
        container.appendChild(heading);

        const list = document.createElement("div");
        list.style.display = "flex";
        list.style.flexDirection = "column";
        list.style.gap = "3px";

        sorted.forEach(type => {
            const item = document.createElement("div");
            item.textContent = posWarnings[type].warn;
            list.appendChild(item);
        });

        container.appendChild(list);
    }

    if (localStorage.getItem('dataMode') !== 'sample') updateSaveButtonState(saveBtn, sorted);
    const maxRank = sorted.length ? Math.max(...sorted.map(type => posWarnings[type].rank)) : 0;
    updateWarningFrameStyle({ isEmpty, maxRank });

    renderRuleCheckInfo(container, roles);

    const saveState = saveBtn?.getState?.();
    if (maxRank <= 1 && saveState === 'dirty') {
        document.dispatchEvent(new CustomEvent('request-sanity-ok', {
            detail: { maxRank, warnings: sorted }
        }));
    }
}

export function setRuleCheckInfo(info) {
    ruleCheckInfo = info || null;
    // if (lastSaveBtn) updateWarningsUI(lastSaveBtn);
}

function renderRuleCheckInfo(container, roles) {
    const normalized = normalizeRuleCheckInfo(ruleCheckInfo);
    if (!normalized) return;
    renderRuleDeltaPreview(container, normalized, roles);
}


function renderRuleDeltaPreview(container, ruleStatsDelta, allRoles = []) {
    if (!ruleStatsDelta) return;

    const baselineFailures = Array.isArray(ruleStatsDelta.baselineFailures)
        ? ruleStatsDelta.baselineFailures
        : [];
    const futureFailures = Array.isArray(ruleStatsDelta.futureFailures)
        ? ruleStatsDelta.futureFailures
        : [];

    const baselineMap = new Map();
    baselineFailures.forEach(failure => {
        const key = getFailureKey(failure);
        const prev = baselineMap.get(key) || 0;
        baselineMap.set(key, prev + getFailureWeight(failure));
    });

    const futureMap = new Map();
    futureFailures.forEach(failure => {
        const key = getFailureKey(failure);
        const prev = futureMap.get(key) || 0;
        futureMap.set(key, prev + getFailureWeight(failure));
    });

    const deltas = [];
    const allKeys = new Set([...baselineMap.keys(), ...futureMap.keys()]);
    allKeys.forEach(key => {
        const baselineValue = baselineMap.get(key) || 0;
        const futureValue = futureMap.get(key) || 0;
        const diff = futureValue - baselineValue;
        if (diff === 0) return;
        deltas.push({ key, diff });
    });

    const wrapper = document.createElement("div");
    wrapper.className = "rulecheck-info";

    const heading = document.createElement("div");
    heading.className = "rulecheck-title";
    heading.textContent = "What-If: Warnungen bei Genehmigung";
    wrapper.appendChild(heading);

    if (deltas.length === 0) {
        const empty = document.createElement("div");
        empty.className = "rulecheck-empty";
        empty.textContent = "Keine Änderungen gegenüber der aktuellen Warnungs-Basis.";
        wrapper.appendChild(empty);
        container.appendChild(wrapper);
        return;
    }

    deltas.sort((a, b) => {
        const absDiff = Math.abs(b.diff) - Math.abs(a.diff);
        if (absDiff !== 0) return absDiff;
        return a.key.localeCompare(b.key);
    });

    const list = document.createElement("div");
    list.className = "rulecheck-list";

    const maxLines = 6;
    deltas.slice(0, maxLines).forEach(entry => {
        const line = document.createElement("div");
        line.className = "rulecheck-line";

        const label = document.createElement("span");
        label.className = "rulecheck-label";
        label.textContent = buildFailureLabel(entry.key);
        line.appendChild(label);

        const delta = document.createElement("span");
        delta.className = entry.diff > 0 ? "rulecheck-delta-plus" : "rulecheck-delta-minus";
        delta.textContent = `${entry.diff > 0 ? '+' : ''}${entry.diff}`;
        line.appendChild(delta);

        list.appendChild(line);
    });

    if (deltas.length > maxLines) {
        const more = document.createElement("div");
        more.className = "rulecheck-more";
        more.textContent = `Weitere Änderungen: ${deltas.length - maxLines}`;
        list.appendChild(more);
    }

    wrapper.appendChild(list);
    container.appendChild(wrapper);
}

function normalizeRuleCheckInfo(info) {
    if (!info || typeof info !== 'object') return null;

    if (info.baselineStats && info.futureStats) {
        return {
            baselineFailures: info.baselineStats?.failures || [],
            futureFailures: info.futureStats?.failures || []
        };
    }

    if (info.baseline && info.delta) {
        return {
            baselineFailures: info.baseline?.failures || [],
            futureFailures: info.delta?.failures || []
        };
    }

    return null;
}

function getFailureKey(failure) {
    const scope = failure?.scope || '';
    const type = failure?.type || '';
    const date = failure?.date || '';
    const weekStart = failure?.weekStart || '';
    const weekEnd = failure?.weekEnd || '';
    return `${scope}|${type}|${date}|${weekStart}|${weekEnd}`;
}

function getFailureWeight(failure) {
    const total = Number(failure?.total);
    if (Number.isFinite(total) && total > 0) return total;
    return 1;
}

function buildFailureLabel(key) {
    const [scope, type, date, weekStart, weekEnd] = key.split('|');
    if (scope === 'weekly') {
        return `${type || 'Regel'}: KW (${formatDateDMY(weekStart)}–${formatDateDMY(weekEnd)})`;
    }
    return `${type || 'Regel'}: ${formatDateDMY(date)}`;
}

function formatDateDMY(value) {
    if (!value) return 'n/a';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}.${mm}.${yyyy}`;
}

function updateSaveButtonState(saveBtn, sortedWarnings) {

    if (!saveBtn || typeof saveBtn.setState !== 'function') {
        console.error("Invalid saveBtn passed:", saveBtn);
        return;
    }

    const maxRank = sortedWarnings.reduce(
        (max, type) => Math.max(max, posWarnings[type].rank),
        0
    );
    if (maxRank <= 1) saveBtn.setState('dirty');
    else saveBtn.setState('blocked');
}

function updateWarningFrameStyle({ isEmpty, maxRank }) {

    const container = document.querySelector(".request-form-warn");
    if (!container) return;

    container.classList.remove("warning-empty", "warning-pulse");

    if (isEmpty) {
        container.classList.add("warning-empty");
        container.style.opacity = "0.5";
        container.style.boxShadow = "none";
        return;
    }

    container.style.opacity = "1";

    if (maxRank > 4) {
        container.classList.add("warning-pulse");
    } else {
        container.style.boxShadow = "none";
    }
}

export function getCurrentFormState() {
    const employeeSelect = document.getElementById("requester-select");
    const employeeId = employeeSelect?.value || "";
    const employeeName = employeeSelect?.selectedOptions[0]?.textContent || "";

    const typeSelect = document.getElementById("request-type-select");
    const typeValue = typeSelect?.value || "";

    const startInput = document.getElementById("request-start-picker");
    const endInput = document.getElementById("request-end-picker");
    const previewStart = document.getElementById("request-preview-start")?.textContent || "";
    const previewEnd = document.getElementById("request-preview-end")?.textContent || "";

    const startDate = startInput?.value || parsePreviewDate(previewStart) || "";
    const endDate = endInput?.value || parsePreviewDate(previewEnd) || "";

    const storeButton = document.getElementById("requestStoreButton");

    return {
        employeeId,
        employeeName,
        type: typeValue,
        startDate,
        endDate,
        canStore: !storeButton?.disabled,
    };
}

function parsePreviewDate(previewText) {
    if (!previewText || previewText.includes("--")) return "";
    const parts = previewText.split(".");
    if (parts.length !== 3) return "";
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}
