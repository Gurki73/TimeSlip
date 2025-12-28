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

export function resetWarnings() {
    warningList.clear();
    updateWarningsUI();
}

export function addWarning(type) {
    if (posWarnings[type]) warningList.add(type);
}

export function recalcWarnings() {
    const state = getCurrentFormState();

    resetWarnings();

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

    updateWarningsUI();
}

export function updateWarningsUI() {
    const container = document.querySelector(".request-form-warn");
    if (!container) return;

    container.innerHTML = "";

    const sorted = [...warningList].sort(
        (a, b) => posWarnings[b].rank - posWarnings[a].rank
    );

    if (sorted.length === 0) {
        const empty = document.createElement("div");
        empty.textContent = "Keine Warnungen.";
        empty.style.opacity = "0.5";
        container.appendChild(empty);
        updateSaveButtonState(sorted);
        return;
    }

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
    updateSaveButtonState(sorted);

    console.log("warnings list:", sorted);

    const maxRank = sorted.length ? Math.max(...sorted.map(type => posWarnings[type].rank)) : 0;
    updateWarningFrameStyle({ isEmpty: sorted.length < 1, maxRank });
}

function updateSaveButtonState(sortedWarnings) {
    const saveBtn = document.getElementById("requestStoreButton");
    if (!saveBtn) return;

    const maxRank = sortedWarnings.reduce(
        (max, type) => Math.max(max, posWarnings[type].rank),
        0
    );

    const enabled = maxRank <= 1;
    saveBtn.disabled = !enabled;
    saveBtn.style.opacity = enabled ? "1" : "0.4";
    saveBtn.style.filter = enabled ? "none" : "grayscale(80%)";
}

function updateWarningFrameStyle({ isEmpty, maxRank }) {

    console.log("warning frame style");

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
    const startDate = startInput?.value || "";

    const endInput = document.getElementById("request-end-picker");
    const endDate = endInput?.value || "";

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

