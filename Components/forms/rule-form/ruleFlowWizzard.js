// Components/forms/rule-form/ruleFlowWizard.js
// Phase 1 - Refactored Flow Wizard
// Author: ChatGPT
// Supports dynamic forbidden pair handling, highlighting, soft-disable, tooltips

// ==========================
// 1. Block & Selector Mapping
// ==========================
const blocks = {
    W: { selector: 'request-type-select-repeats', mandatory: false },
    T: { selector: 'request-type-select-time', mandatory: false },
    A: { selector: 'request-type-select-amount', mandatory: false },
    G: { selector: 'request-type-select-group', mandatory: true },
    D: { selector: 'request-type-select-dependency', mandatory: true },
    E: { selector: 'request-type-select-exception', mandatory: false },
    // Secondary blocks
    w: { selector: 'ex-request-type-select-repeats', mandatory: false },
    t: { selector: 'ex-request-type-select-time', mandatory: false },
    a: { selector: 'ex-request-type-select-amount', mandatory: false },
    g: { selector: 'ex-request-type-select-group', mandatory: false },
    d: { selector: 'ex-request-type-select-dependency', mandatory: false },
};

// ==========================
// 2. Forbidden Pair / Blacklist
// ==========================
const forbiddenPairs = {
    // T0 = empty; T1 = shift;  T2 = Day;  T3 = week; T5 = absence
    // W0 = empty; W1 = always, W2 = Xor;  W3 = only; W4 = per 
    T_W: [['T1', 'W2'], ['T3', 'W2'], ['T5', 'W2'], ['T3', 'W3'], ['T5', 'W3'],
    ['T1', 'W4'], ['T2', 'W4'], ['T5', 'W4']],
    W_T: [['W2', 'T1'], ['W2', 'T3'], ['W2', 'T5'], ['W3', 'T3'], ['W3', 'T5'],
    ['W4', 'T1'], ['W4', 'T2'], ['W4', 'T5']],
};

// ==========================
// 3. Dynamic Wizard Update
// ==========================
export function updateWizard(lastChangedBlockID) {
    // Loop through all forbidden pairs relevant to the changed block
    Object.keys(forbiddenPairs).forEach(pairKey => {
        const pairs = forbiddenPairs[pairKey];
        pairs.forEach(([blockAValue, blockBValue]) => {
            const [blockAType, blockBType] = pairKey.split('_');
            const lastValue = getSelectedValue(lastChangedBlockID);
            // console.log(blockAType, blockBType, lastChangedBlockID);
            if (lastChangedBlockID.startsWith(blockAType) && lastValue === blockAValue) {
                setBlockForbidden(blocks[blockBType].selector, blockBValue);
            } else if (lastChangedBlockID.startsWith(blockBType) && lastValue === blockBValue) {
                setBlockForbidden(blocks[blockAType].selector, blockAValue);
            }
        });
    });
    updateSaveButtonState();
}

// ==========================
// 4. Highlight / Warning System
// ==========================
export function highlightBlock(selectorID, message = '') {
    const element = document.getElementById(selectorID);
    if (!element) return;

    element.classList.add('forbidden'); // CSS class: red outline
    if (message) attachTooltip(element, `📎 ${message}`);
}

export function clearHighlights() {
    Object.values(blocks).forEach(block => {
        const element = document.getElementById(block.selector);
        if (!element) return;
        element.classList.remove('forbidden');
        clearTooltip(element);
        // Also re-enable all options
        Array.from(element.options).forEach(opt => opt.disabled = false);
    });
}

// ==========================
// 5. Selector Option Management
// ==========================
export function setBlockForbidden(selectorID, optionValue) {
    const element = document.getElementById(selectorID);
    if (!element) return;

    // Keep current selection intact
    Array.from(element.options).forEach(opt => {
        if (opt.value === optionValue) {
            opt.disabled = true;
        }
    });

    highlightBlock(selectorID, `Option "${optionValue}" conflicts with another selection`);
}

// ==========================
// 6. Default Values / Prefill
// ==========================
// Optional at this stage, can be extended later
export function prefillDefaults() {
    Object.values(blocks).forEach(block => {
        const el = document.getElementById(block.selector);
        if (!el) return;
        if (!el.value || el.value === '') {
            // Pick first non-forbidden option as default
            const opt = Array.from(el.options).find(o => !o.disabled);
            if (opt) el.value = opt.value;
        }
    });
}

// ==========================
// 7. Save-Time Placeholder
// ==========================
export function validateBeforeSave() {
    // Placeholder for future save-time sanity checks
    // e.g., compare main vs secondary, mandatory checks, etc.
    console.warn('Save-time validation not yet implemented.');
}

// ==========================
// 9. Utility Functions
// ==========================

export function getSelectedValue(blockID) {
    if (!blockID) return null;

    const key = blockID[0];   // First character, e.g. "T" from "T1"
    const index = blockID.slice(1); // Remaining characters, e.g. "1"

    const block = blocks[key];
    if (!block) return null; // Unknown block type

    const domID = `${block.selector}`; // e.g. "request-type-select-time1"

    const el = document.getElementById(domID);
    if (!el) return null;

    return el.value;
}

export function attachTooltip(element, text) {
    element.dataset.tooltip = text; // Simple tooltip, could integrate Tippy.js or similar
}

export function clearTooltip(element) {
    delete element.dataset.tooltip;
}

// ==========================
// 10. Optional UX Enhancements
// ==========================
// CSS classes expected:
// .forbidden { border: 1px solid red; }
// Tooltips shown via CSS or JS on hover using data-tooltip

export function hasRedAlarms() {
    return Object.values(blocks).some(block => {
        const el = document.getElementById(block.selector);
        return el && el.classList.contains('forbidden');
    });
}

export function updateSaveButtonState() {
    const saveBtn = document.getElementById('save-rule-btn'); // your save button ID
    if (!saveBtn) return;

    if (hasRedAlarms()) {
        saveBtn.disabled = true;       // disable save
        saveBtn.classList.add('disabled'); // optional styling
    } else {
        saveBtn.disabled = false;
        saveBtn.classList.remove('disabled');
    }
}

export function toggleExceptionTable(isActive) {
    const exceptionTable = document.getElementById('rule-second-condition');
    if (exceptionTable) {
        exceptionTable.classList.toggle('hidden', !isActive); // match your current hidden toggle 
        exceptionTable.classList.toggle('inactive', !isActive);
        console.warn("Exception table visibility set to:", isActive);
    } else {
        console.warn("Exception table not found.");
    }
}

