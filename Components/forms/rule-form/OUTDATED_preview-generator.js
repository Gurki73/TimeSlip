import { appDictionary } from "./dicctionary.js"

const ruleCellsIDs = {

    W: ["repead-header", "repeat-cell"],
    T: ["time-header", "time-cell"],
    A: ["amount-header", "amount-cell"],
    G: ["task-header", "task-cell"],
    D: ["dependency-header", "dependency-cell"],
    E: ["exception-header", "exception-cell"],
    w: ["ex-repeat-header", "ex-repeat-cell"],
    t: ["ex-time-hedaer", "ex-time-cell"],
    a: ["ex-amount-header", "ex-amount-cell"],
    g: ["ex-task-header", "ex-task-cell"],
    d: ["ex-dependency-header", "ex-dependency-cell"],
}

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

let W = '', T = '', A = '', G = '', D = '', E = '';
let w = '', t = '', a = '', g = '', d = '';

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

export function updateHumanRule(id, rawValue = null) {
    const currentConfig = workflowPaths[currentState.path];
    const currentStep = currentConfig.sequence[currentState.step];

    console.log("config:" + currentConfig + "   step:" + currentStep);

    console.log("full id:" + id + "     short id:" + id[0]);

    if (id[0] !== currentStep) {
        console.warn(`Unexpected input ${id} for step ${currentStep}`);
        // return;
    }

    const category = id[0];

    normalizeValue(id);
    const entry = getDictionaryEntry(id[0].toLowerCase(), id);
    if (entry) {
        currentState.context[category] = {
            value,
            metadata: {
                case: entry.cases?.nominative,
                article: entry.artikel,
                plural: entry.plural
            }
        };

        applyGrammaticalContext(currentConfig, currentStep);
    }
    moveToNextStep(currentConfig);
    updateUI();
}

function getDictionaryEntry(category, id) {
    console.log(category, id);
    return appDictionary[category]?.[id]?.text || null;
}

function applyGrammaticalContext(config, currentStep) {
    const requirements = config.requirements[currentStep];
    const nextStep = config.sequence[currentState.step + 1];

    if (requirements?.case) {
        currentState.context[nextStep].metadata.case = requirements.case;
    }

    if (requirements?.article) {
        currentState.context[nextStep].metadata.article =
            getArticle(nextStep, requirements.article);
    }
}

function moveToNextStep(config) {
    currentState.step++;
    if (currentState.step >= config.sequence.length) {
        currentState.path = 'exceptions';
        currentState.step = 0;
    }
}

function getArticle(nextStep, article) {
    return null;
}

function checkDependencyInput(id) {
    if (id === 'D1') {
        currentState.step = 0;
        currentState.path = 'pathExStart';
        clearAllHighlights();
        clearHighlight('E', true);
        return;
    }
    if (id = 'D0') {
        currentState.path = 'pathTime';
        currentState.step = 0;
        clearAllHighlights();
        clearHighlight('W', true);
        return;
    }
    currentState.path = 'pathRole';
    currentState.step = 0;
    clearAllHighlights();
    clearHighlight('A');
    return;
}

function buildHumanReadable() {
    const parts = [];
    console.log("parts:" + parts)
    const { main, exceptions } = currentState.context;

    if (!main) {
        console.log("no main rule found :" + main);
        return null;
    }

    if (main.G && main.D) {
        parts.push(inflectPhrase(main.G, main.D));
    }
    if (main.T && main.W) {
        parts.push(inflectTemporal(main.W, main.T));
    }
    if (main.A) {
        // parts.push(inflectQuantifier(main.A));
    }

    if (exceptions.E && exceptions.g) {
        // parts.push(` ${exceptions.E.value} ${inflectException(exceptions.g)}`);
    }

    return parts.join(' ').replace(/\s+/g, ' ');
}

function inflectPhrase(role, dependency) {
    const article = role.metadata.article;
    const subject = `${article} ${role.value}`;
    return `${subject} ${dependency.value}`;
}

function inflectTemporal(repetition, time) {
    const caseForm = time.metadata.case;
    const base = repetition.value.includes('pro') ? 'pro' : '';
    return `${repetition.value} ${base} ${getInflectedNoun(time, caseForm)}`;
}

function getInflectedNoun(entry, caseForm) {
    const { text, plural } = entry.metadata;
    const form = entry.metadata.cases[caseForm][plural ? 'plural' : 'singular'];
    return `${entry.metadata.article} ${form}`;
}

function updateUI() {
    clearAllHighlights();
    const currentStep = workflowPaths[currentState.path].sequence[currentState.step];
    clearHighlight(ruleCellsIDs[currentStep], true);

    const humanText = buildHumanReadable();
    document.getElementById('typing-text').textContent =
        humanText || '> 🏗️ Start scheduling...';
    applyTypingEffect();
}


function writeHumanRule() {
    const humanTextField = document.getElementById('typing-text');

    // Anpassung der Zeiträume
    const periodText = appDictionary.Zeiträume.T1.text.join(', '); // Beispiel: "Montag, Dienstag, Mittwoch"
    const periodArtikel = appDictionary.Zeiträume.T1.artikel; // z.B. "der"
    const periodPlural = appDictionary.Zeiträume.T1.plural ? "n" : ""; // Für Plural hinzufügen
    const periodBeispiel = appDictionary.Zeiträume.T1.beispiel; // Beispiel: "Montag, Dienstag und Mittwoch"

    // Beachte die Fälle: z.B. für Genitiv oder Akkusativ bei Verwendung von Zeiträumen
    let selectedCase = "nominativ"; // Beispiel, könnte dynamisch ausgewählt werden
    const periodCase = appDictionary.Zeiträume.T1.fälle[selectedCase];

    // Beispiel: "jede Woche" für den Fall der Woche, in Genitiv oder Dativ könnte es anders lauten
    const periodFormatted = periodArtikel + " " + periodText + " " + periodCase; // z.B. "der Montag" oder "die Woche"

    // Setze die finale Ausgabe zusammen
    const humanText = `
        ${W} ${T} ${A} ${G} ${D} ${E}
        ${w} ${t} ${a} ${g} ${d} ${periodFormatted}
    `.trim().replace(/\s+/g, ' ');

    // Ausgabe im HTML
    humanTextField.innerHTML = humanText || '&gt; <span class="blinking-cursor noto">🏗️</span>';
    applyTypingEffect(humanTextField);
}

function getAbbreviation(wordObj) {
    return wordObj.abkürzung ? wordObj.abkürzung.join(', ') : wordObj.text;
}

function getCase(wordObj, kasus) {
    return wordObj.fälle[kasus]; // z.B. "des Monats"
}


function getCaseForWord(word) {
    // Hier könnte eine Logik hinzukommen, die den Kasus basierend auf dem Kontext auswählt
    if (word === 'Montag' || word === 'Woche') {
        return "nominativ"; // Beispiel, könnte auch dynamisch ermittelt werden
    }
    return "akkusativ"; // Standard
}

function applyTypingEffect(element) {

    console.log("element:" + element);
    if (!element) return null;

    const text = element.textContent;
    element.textContent = '';

    let i = 0;
    const typingSpeed = 50; // Adjust speed as needed (ms per character)
    const interval = setInterval(() => {
        element.textContent += text[i];
        i++;
        if (i >= text.length) clearInterval(interval);
    }, typingSpeed);
}

function normalizeValue(id, rawValue = null) {

    switch (true) {
        case ["t0", "T0", "E0", "w0", "W0"].includes(id):
            handleIgnoreCases(id);
            return null;

        /** ✅ Single Known Words */
        case ["d0", "D0", "d1", "D1", "t1", "T1", "t3", "T3", "T4", "t4", "t5", "T5",
            "E1", "E2", "E3", "E4", "E5", "E6", "w1", "W1", "W2", "w2", "A0", "a0", "A2", "a2"].includes(id):
            return rawValue; // Keep as a simple string

        /** 🔢 Number + Known Word + Unknown (Array Role) */
        case ["d2", "D2", "d3", "D3"].includes(id):
            return parseNumberAndArray(rawValue);

        /** 🔢 Number + Number + Known Word + Unknown Role (Array) */
        case ["d4", "D4", "a3", "A3"].includes(id):
            return parseTwoNumbersAndArray(rawValue);

        /** 📝 Known Word Array */
        case ["t2", "T2"].includes(id):
            return rawValue.split(" "); // Convert to an array

        /** 🔢 Number + Known Word */
        case ["w3", "W3", "a1", "A1", "a4", "A4", "A5", "a5", "a6", "A6", "a8", "A8"].includes(id):
            return parseNumberAndWord(rawValue);
            we
        /** ❓ Single Unknown Word */
        case ["g0", "G0"].includes(id):
            return { type: "unknown", value: rawValue };

        /** ❓ Array of Unknown Words */
        case ["g1", "G1", "G2", "G3"].includes(id):
            return rawValue.split(" ").map(word => ({ type: "unknown", value: word }));

        /** ❓ Default Fallback */
        default:
            return rawValue;
    }
}

function updateMandatoryInputs(id, isIgnored) {
    if (id.startsWith("E")) {
        if (isIgnored) {
            // If any "E" is ignored, lowercase "g", "a", and "d" become mandatory
            mandatoryInputs.add("g");
            mandatoryInputs.add("a");
            mandatoryInputs.add("d");
        } else {
            // If any "E" is selected, remove lowercase "g", "a", "d" from mandatory
            mandatoryInputs.delete("g");
            mandatoryInputs.delete("a");
            mandatoryInputs.delete("d");
        }
    }

    if (id === "E0" && !isIgnored) {
        // If "E0" is selected again, make sure other Es don’t force extra mandatory fields
        mandatoryInputs.delete("g");
        mandatoryInputs.delete("a");
        mandatoryInputs.delete("d");
    }

    if (id === "w0") {
        if (isIgnored) {
            // If lowercase "w" (repeats) is ignored, also ignore lowercase "t" (timeframe)
            mandatoryInputs.delete("w");
            mandatoryInputs.delete("t");
        } else {
            // If lowercase "w" is chosen, both w and t are required
            mandatoryInputs.add("w");
            mandatoryInputs.add("t");
        }
    }
}

function handleIgnoreCaseForTimeframe(id, rawValue) {
    // Timeframe-related IDs to ignore
    const timeframeIds = ['t1', 'T1', 't2', 'T3', 'T4', 'T5'];

    if (rawValue.length === 0 && timeframeIds.includes(id)) {
        // Remove repeats related to this timeframe ID
        cancelRepeats(id);
        return { type: "ignore", value: [] };
    }

    // If no specific timeframe logic applies, just handle the ignore case
    return { type: "ignore", value: [] };
}

function cancelRepeats(id) {
    // Logic to cancel repeats. This could involve clearing state or resetting specific variables.
    console.log(`Cancelling repeats for ${id}`);
    // Example: clear repeated value in state or reset repeat flag
    // resetStateRepeats(id);
}

function handleIgnoreCases(id) {

    switch (id) {
        case "t0":
            t = '';
            w = '';
            break;
        case "T0":
            T = '';
            W = '';
            break;
        case "E0":
            E = '';
            w = '';
            t = '';
            a = '';
            g = '';
            d = '';
            break;
        case "w0":
            t = '';
            w = '';
            break;
        case "W0":
            T = '';
            W = '';
            break;
    }
    writeHumanRule();
}