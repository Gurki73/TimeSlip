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

export function resetWarnings(saveBtn) {
    warningList.clear();
    updateWarningsUI(saveBtn);
}

export function addWarning(type) {
    if (posWarnings[type]) warningList.add(type);
}

export function recalcWarnings(saveBtn) {
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

    updateWarningsUI(saveBtn);
}

export function updateWarningsUI(saveBtn) {
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

    renderRuleCheckInfo(container);

    const saveState = saveBtn?.getState?.();
    if (maxRank <= 1 && saveState === 'dirty') {
        document.dispatchEvent(new CustomEvent('request-sanity-ok', {
            detail: { maxRank, warnings: sorted }
        }));
    }
}

export function setRuleCheckInfo(info) {
    ruleCheckInfo = info || null;
    if (lastSaveBtn) updateWarningsUI(lastSaveBtn);
}

function renderRuleCheckInfo(container) {
    if (!ruleCheckInfo) return;

    const wrapper = document.createElement("div");
    wrapper.className = "rulecheck-info";
    wrapper.style.marginTop = "6px";

    const heading = document.createElement("div");
    heading.textContent = "Regelprüfung";
    wrapper.appendChild(heading);

    const list = document.createElement("div");
    list.style.display = "flex";
    list.style.flexDirection = "column";
    list.style.gap = "3px";

    const lines = Array.isArray(ruleCheckInfo.lines) ? ruleCheckInfo.lines : [];
    const total = Number.isFinite(ruleCheckInfo.totalFailures) ? ruleCheckInfo.totalFailures : null;

    if (lines.length === 0 && total === 0) {
        const item = document.createElement("div");
        item.textContent = "Keine Regelverstöße.";
        list.appendChild(item);
    } else if (lines.length === 0 && total != null) {
        const item = document.createElement("div");
        item.textContent = `Regelverstöße: ${total}`;
        list.appendChild(item);
    } else {
        const maxLines = 4;
        lines.slice(0, maxLines).forEach(line => {
            const item = document.createElement("div");
            item.textContent = line;
            list.appendChild(item);
        });
        if (lines.length > maxLines) {
            const more = document.createElement("div");
            more.textContent = `Weitere: ${lines.length - maxLines}`;
            list.appendChild(more);
        }
    }

    wrapper.appendChild(list);
    container.appendChild(wrapper);
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
