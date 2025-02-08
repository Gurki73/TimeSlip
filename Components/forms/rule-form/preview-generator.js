const appDictionary = {
    "w": {
        "w1": { "text": "jeden", "typ": "Adverb", "beispiel": "jeden Montag" },
        "w2": { "text": "niemals", "typ": "Adverb", "beispiel": "niemals im Monat" },
        "w3": { "text": "pro", "typ": "Präposition", "beispiel": "einmal pro Woche" }
    },
    "t": {
        "t2": {
            "text": ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
            "artikel": "der",
            "plural": true,
            "abkürzung": ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
            "beispiel": "Montag, Dienstag und Mittwoch"
        },
        "t3": {
            "text": "Woche",
            "artikel": "die",
            "plural": true,
            "abkürzung": null,
            "beispiel": "jede Woche",
            "cases": {
                "nominative": {
                    "singular": "die Woche",
                    "plural": "die Wochen"
                },
                "accusative": {
                    "singular": "die Woche",
                    "plural": "die Wochen"
                },
                "dative": {
                    "singular": "der Woche",
                    "plural": "den Wochen"
                },
                "genitive": {
                    "singular": "der Woche",
                    "plural": "der Wochen"
                }
            },
            "gender": "feminine"
        },
        "t4": {
            "text": "Monat",
            "artikel": "der",
            "plural": true,
            "abkürzung": null,
            "beispiel": "jeden Monat",
            "cases": {
                "nominative": {
                    "singular": "der Monat",
                    "plural": "die Monate"
                },
                "accusative": {
                    "singular": "den Monat",
                    "plural": "die Monate"
                },
                "dative": {
                    "singular": "dem Monat",
                    "plural": "den Monaten"
                },
                "genitive": {
                    "singular": "des Monats",
                    "plural": "der Monate"
                }
            },
            "gender": "masculine"
        },
        "t5": {
            "text": "Abwesenheit",
            "artikel": "die",
            "plural": true,
            "abkürzung": null,
            "beispiel": "Dienstreise, Urlaub",
            "cases": {
                "nominative": {
                    "singular": "die Abwesenheit",
                    "plural": "die Abwesenheiten"
                },
                "accusative": {
                    "singular": "die Abwesenheit",
                    "plural": "die Abwesenheiten"
                },
                "dative": {
                    "singular": "der Abwesenheit",
                    "plural": "den Abwesenheiten"
                },
                "genitive": {
                    "singular": "der Abwesenheit",
                    "plural": "der Abwesenheiten"
                }
            },
            "gender": "feminine"
        }
    },
    "a": {
        "a1": { "text": "ungefähr $(zahl1)", "typ": "Zahl" },
        "a2": { "text": "alle", "typ": "Quantor" },
        "a3": { "text": "keiner", "typ": "Quantor" },
        "a4": { "text": "zwischen $(zahl1) und $(zahl2)", "typ": "Zahl" },
        "a5": { "text": "maximal $(zahl1)", "typ": "Zahl" },
        "a6": { "text": "minimal $(zahl1)", "typ": "Zahl" },
        "a7": { "text": "genau $(zahl1)", "typ": "Zahl" },
        "a8": { "text": "$(zahl1) Prozent", "typ": "Zahl" }
    },
    "g": {
        "g0": { "text": "$(aufgabe)", "typ": "Nomen" },
        "g1": { "text": "$(rolle1) und $(rolle2)", "typ": "Kombination", "beispiel": "Arzt und Krankenschwester" },
        "g2": { "text": "$(rolle1) oder $(rolle2)", "typ": "Alternative", "beispiel": "Arzt oder Ersthelfer" }
    },
    "d": {
        "d0": { "text": "muss anwesend sein", "typ": "Regel", "beispiel": "Ein Arzt muss anwesend sein" },
        "d1": { "text": "muss abwesend sein", "typ": "Regel", "beispiel": "Kein Ausbilder muss abwesend sein" },
        "d2": { "text": "braucht $(zahl1)", "typ": "Regel", "beispiel": "Ein Koch braucht 2 Kellner" },
        "d3": { "text": "hilft $(zahl1)", "typ": "Regel", "beispiel": "Eine Krankenschwester hilft 3 Ärzten" },
        "d4": { "text": "Verhältnis: Für $(zahl1) Rolle(n) je $(zahl2)", "typ": "Regel", "beispiel": "Für 3 Fahrer je 2 Kommissionierer" }
    },
    "e": {
        "e0": { "text": "", "typ": "keine Ausnahme", "beispiel": "Keine Ausnahme" },
        "e1": { "text": "und", "typ": "Verknüpfung", "beispiel": "Bedingungen im Hauptsatz und Nebensatz müssen erfüllt sein" },
        "e2": { "text": "oder", "typ": "Verknüpfung", "beispiel": "Bedingungen im Hauptsatz oder Nebensatz müssen erfüllt sein" },
        "e3": { "text": "aber", "typ": "Verknüpfung", "beispiel": "Wenn die Bedingung im Nebensatz erfüllt ist, ist der Hauptsatz ungültig." },
        "e4": { "text": "außer", "typ": "Verknüpfung", "beispiel": "Wenn die Bedingung im Nebensatz erfüllt ist, ist der Hauptsatz ungültig." },
        "e5": { "text": "aber nicht mehr als", "typ": "Limitation", "beispiel": "Es gibt maximal 5 Aufgaben" },
        "e6": { "text": "aber nicht weniger als", "typ": "Limitation", "beispiel": "Es gibt mindestens 3 Aufgaben" }
    }
};

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

export function updateHumanRule(id, value) {
    const currentConfig = workflowPaths[currentState.path];
    const currentStep = currentConfig.sequence[currentState.step];

    // Validate input matches expected step
    if (id[0] !== currentStep) {
        console.warn(`Unexpected input ${id} for step ${currentStep}`);
        // return;
    }

    // Update context with inflection data
    const category = id[0];
    const entry = getDictionaryEntry(id[0].toLowerCase(), id);
    currentState.context[category] = {
        value,
        metadata: {
            case: entry.cases?.nominative, // Default case
            article: entry.artikel,
            plural: entry.plural
        }
    };

    // Apply grammatical rules
    applyGrammaticalContext(currentConfig, currentStep);

    // Progress workflow
    moveToNextStep(currentConfig);
    updateUI();
}

function getDictionaryEntry(category, id) {
    return appDictionary.category.id.text;
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

function checkDependencyInput(id) {
    if (id === 'D1') {
        currentStep = 0;
        currentPath = pathExStart;
        clearAllHighlights();
        clearHighlight('E', true);
        return;
    }
    if (id = 'D0') {
        currentPath = pathTime;
        currentStep = 0;
        clearAllHighlights();
        clearHighlight('W', true);
        return;
    }
    currentPath = pathRole;
    currentStep = 0;
    clearAllHighlights();
    clearHighlight('A');
    return;
}

function buildHumanReadable() {
    const parts = [];
    const { main, exceptions } = currentState.context;

    // Main clause construction
    if (main.G && main.D) {
        parts.push(inflectPhrase(main.G, main.D));
    }
    if (main.T && main.W) {
        parts.push(inflectTemporal(main.W, main.T));
    }
    if (main.A) {
        parts.push(inflectQuantifier(main.A));
    }

    // Exception handling
    if (exceptions.E && exceptions.g) {
        parts.push(` ${exceptions.E.value} ${inflectException(exceptions.g)}`);
    }

    return parts.join(' ').replace(/\s+/g, ' ');
}

// Grammar helper functions
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
    clearHighlights();
    const currentStep = workflowPaths[currentState.path].sequence[currentState.step];
    highlightElement(ruleCellsIDs[currentStep]);

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
    const text = element.textContent; // Get the current content
    element.textContent = ''; // Clear it for the typing effect

    // Simulate typing one character at a time
    let i = 0;
    const typingSpeed = 50; // Adjust speed as needed (ms per character)
    const interval = setInterval(() => {
        element.textContent += text[i];
        i++;
        if (i >= text.length) clearInterval(interval);
    }, typingSpeed);
}


