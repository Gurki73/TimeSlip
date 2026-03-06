// Components/forms/rule-form/ruleFlowWizard.js

import { getSelect, getCell, resetOptions, applyValidationState } from './ruleDomAdapter.js';

// “Wizard renders live sanity feedback for current rule only. It does not decide validity.”

const BLOCKS = {
    W: { scope: 'main' },
    T: { scope: 'main' },
    A: { scope: 'main' },
    G: { scope: 'main' },
    D: { scope: 'main' },
    E: { scope: 'main' },

    w: { scope: 'ex' },
    t: { scope: 'ex' },
    a: { scope: 'ex' },
    g: { scope: 'ex' },
    d: { scope: 'ex' },
};

function idsFor(key) {
    const cfg = BLOCKS[key];
    if (!cfg) return null;

    const prefix = `rule-${cfg.scope}-${key}`;
    return {
        th: `${prefix}-th`,
        select: `${prefix}-select`,
        td: `${prefix}-td`,
    };
}

/* ============================
   Public API
============================ */

export function updateWizard(liveResult, lastUpdatedID) {
    clearHighlights();

    const exValue = getSelectedValue('E');

    resetOptions('main', true);
    resetOptions('ex', exValue !== 'E0');

    applyValidationState(liveResult, lastUpdatedID);

    liveResult.forbidden.forEach(key => {
        const ids = idsFor(key);
        if (!ids) {
            console.warn(`Unknown forbidden block "${key}"`);
            return;
        }
        setForbidden(ids, "Forbidden combination");
    });

    // 🟡 Missing mandatory blocks
    liveResult.missingMandatory.forEach(key => {
        const ids = idsFor(key);
        if (!ids) {
            console.warn(`No block mapping for mandatory key "${key}"`);
            return;
        }

        highlight(ids.th);
        highlight(ids.td); 

        // console.log(`Highlighted mandatory block "${key}"`);
    });

    updateSaveButtonState();
}

export function clearHighlights() {
    Object.      keys(BLOCKS).forEach(key => {
        const ids = idsFor(key);
        if (!ids) return;

        [ids.th, ids.td].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.removeAttribute("data-highlight");
            el.removeAttribute("data-forbidden");
            el.classList.remove("forbidden");
            clearTooltip(el);
        });
    });
}

export function setBlockForbidden(key, optionValue) {
    const select = getSelect(key);
    if (!select) return;

    Array.from(select.options).forEach(opt => {
        if (opt.value === optionValue) opt.disabled = true;
    });

    const td = getCell(key);
    setForbidden(td, `Option "${optionValue}" conflicts with another selection`);
}


export function getSelectedValue(key) {
    const ids = idsFor(key);
    if (!ids) return null;

    const el = document.getElementById(ids.select);
    return el?.value ?? null;
}

export function hasRedAlarms() {
    return Object.keys(BLOCKS).some(key => {
        const ids = idsFor(key);
        const el = document.getElementById(ids?.select);
        return el && el.classList.contains("forbidden");
    });
}

export function updateSaveButtonState() {
    const saveBtn = document.getElementById("save-rule-btn");
    if (!saveBtn) return;

    if (hasRedAlarms()) {
        saveBtn.disabled = true;
        saveBtn.classList.add("disabled");
    } else {
        saveBtn.disabled = false;
        saveBtn.classList.remove("disabled");
    }
}

export function toggleExceptionTable(isActive) {
    document
        .getElementById("rule-second-condition")
        ?.classList.toggle("active", isActive);

    document
        .getElementById("rule-lines")
        ?.classList.toggle("active", isActive);
}

/* ============================
   Internal helpers
============================ */

function highlight(key) {
    const el = document.getElementById(key);
    if (el) el.setAttribute("data-highlight", "true");
}

function setForbidden(ids, message) {
    [ids.th, ids.td].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.setAttribute("data-forbidden", "true");
        el.classList.add("forbidden");
        if (message) attachTooltip(el, `📎 ${message}`);
    });
}

export function attachTooltip(element, text) {
    element.dataset.tooltip = text;
}

export function clearTooltip(element) {
    delete element.dataset.tooltip;
}

function groupByWeekday(violations) {
    const map = Array(7).fill(0);

    violations.forEach(v => {
        if (v.weekdayIndex != null) {
            map[v.weekdayIndex]++;
        }
    });

    return map;
}

function weekdayStats(counts, totalWeeks) {
    return counts.map(c => ({
        count: c,
        ratio: totalWeeks ? c / totalWeeks : 0
    }));
}
