import { getDictionaryEntry, applyGrammaticalContext } from "./dicctionary";

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

export function updateWizzard(id, rawValue = null) {
    const currentConfig = workflowPaths[currentState.path];
    const currentStep = currentConfig.sequence[currentState.step];

    if (id[0] !== currentStep) {
        console.warn(`Unexpected input ${id} for step ${currentStep}`);
    }

    const category = id[0];

    normalizeValue(id);
    const entry = getDictionaryEntry(id[0].toLowerCase(), id);
    if (entry) {
        currentState.context[category] = { value, metadata: entry.metadata };
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

export { workflowPaths, clearAllHighlights, clearHighlight };
