import { getDictionaryEntry, applyGrammaticalContext } from "./dicctionary.js";

const ruleCellsIDs = {
    W: ["repead-header", "repeat-cell"],
    T: ["time-header", "time-cell"],
    A: ["amount-header", "amount-cell"],
    G: ["task-header", "task-cell"],
    D: ["dependency-header", "dependency-cell"],
    E: ["exception-header", "exception-cell"],
    w: ["ex-repeat-header", "ex-repeat-cell"],
    t: ["ex-time-header", "ex-time-cell"],
    a: ["ex-amount-header", "ex-amount-cell"],
    g: ["ex-task-header", "ex-task-cell"],
    d: ["ex-dependency-header", "ex-dependency-cell"],
};

const mandatoryInputs = new Set(["G", "A", "D"]);

const workflowPaths = {
    main: {
        sequence: ['G', 'D', 'T', 'W', 'A'],
        requirements: {
            G: { next: 'D', article: 'nominative' },
            D: { next: 'T', case: 'dative' },
            T: { next: 'W', article: 'dative' },
            W: { next: 'A', quantifier: true }
        }
    },
    exceptions: {
        sequence: ['E', 'g', 't', 'a'],
        requirements: {
            E: { next: 'g', conjunction: true },
            g: { next: 't', case: 'accusative' }
        }
    }
};

let currentState = {
    path: 'main',
    step: 0,
    context: {}
};

function clearAllHighlights() {
    Object.keys(ruleCellsIDs).forEach(id => clearHighlight(id, false));
}

function clearHighlight(id, isHighlight) {
    const cellNames = ruleCellsIDs[id];
    if (!cellNames) return;

    cellNames.forEach(cellName => {
        const highlightCell = document.getElementById(cellName);
        if (highlightCell) {
            highlightCell.dataset.highlight = isHighlight;
        }
    });
}

function normalizeValue() { }

export function updateWizzard(id, rawValue = null) {
    if (!Array.isArray(id) || !id[0]) {
        console.warn(`Invalid id passed: ${id}`);
        return; // exit early if id is invalid
    }

    const currentConfig = workflowPaths[currentState.path];
    const currentStep = currentConfig.sequence[currentState.step];

    if (id[0] !== currentStep) {
        console.warn(`Unexpected input ${id} for step ${currentStep}`);
    }

    const category = id[0];

    normalizeValue(id);
    const entry = getDictionaryEntry(id[0].toLowerCase(), id);
    if (entry) {
        // currentState.context[category] = { value, metadata: entry.metadata };
        applyGrammaticalContext(currentConfig, currentStep);
    }
    moveToNextStep(currentConfig);
    updateUI();
}


function moveToNextStep(config) {
    currentState.step++;
    if (currentState.step >= config.sequence.length) {
        currentState.path = 'exceptions';
        currentState.step = 0;
    }
}

function checkDependencyInput(id) {
    if (id === 'D1') {
        currentState.path = 'pathExStart';
        currentState.step = 0;
        clearAllHighlights();
        clearHighlight('E', true);
        return;
    }
    if (id === 'D0') {
        currentState.path = 'pathTime';
        currentState.step = 0;
        clearAllHighlights();
        clearHighlight('W', true);
        return;
    }
    currentState.path = 'pathRole';
    currentState.step = 0;
    clearAllHighlights();
    clearHighlight('A', true);
}

function updateUI() {
    clearAllHighlights();
    const currentStep = workflowPaths[currentState.path].sequence[currentState.step];
    clearHighlight(ruleCellsIDs[currentStep], true);
}

function toggleHTMLOption(id, isVisible) {

    const selectorMap = {
        w: 'request-type-select-repeats',    // repeat
        t: 'request-type-select-time',       // timeframe
        a: 'request-type-select-amount',     // amount
        g: 'request-type-select-group',      // role/group
        d: 'request-type-select-dependency', // dependency
        e: 'request-type-select-exception',  // exception
    };

    const selectorKey = id[0].toLowerCase();
    let selectorName = selectorMap[selectorKey];

    if (!selectorName) {
        console.error(`Cannot find a selector for the given ID: "${id}".`);
        return;
    }

    if (id[0] === id[0].toLowerCase()) {
        selectorName = `ex-${selectorName}`;
    }

    const selectElement = document.getElementById(selectorName);
    if (!selectElement) {
        console.error(`Dropdown with selector name "${selectorName}" not found.`);
        return;
    }

    const option = selectElement.querySelector(`option[value="${id}"]`);
    if (option) {
        option.disabled = !isVisible;
        console.log(`Option with id "${id}" in "${selectorName}" is now ${isVisible ? "enabled" : "disabled"}.`);
    } else {
        console.warn(`Option with id "${id}" not found in "${selectorName}".`);
    }
}

export function toggleExceptionTable(isActive) {
    const exceptionTable = document.querySelector('.rule-table:nth-of-type(2)');
    if (exceptionTable) {
        exceptionTable.classList.toggle('inactive', !isActive);
    } else {
        console.warn("Exception table not found.");
    }
}

function checkException(id, mainCondition, exceptionCondition) {
    switch (id) {
        case "E0": // No exception
            return mainCondition;
        case "E1": // AND condition
            return mainCondition && exceptionCondition;
        case "E2": // OR condition
            return mainCondition || exceptionCondition;
        case "E3": // BUT: override if conditions differ
            return mainCondition === exceptionCondition ? mainCondition : exceptionCondition;
        case "E4": // EXCEPT: prioritize exception if true
            return exceptionCondition ? exceptionCondition : mainCondition;
        case "E5": // NOT MORE THAN (inverse logic)
            return exceptionCondition ? mainCondition : exceptionCondition;
        case "E6": // NOT LESS THAN (similar inverse logic)
            return exceptionCondition ? mainCondition : exceptionCondition;
    }
    return true; // Default: main condition stands if no match
}

export { workflowPaths, clearAllHighlights, clearHighlight };
