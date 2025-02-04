const appDictionary = {
    "Wiederholungen": {
        "W1": { "text": "jeden", "typ": "Adverb", "beispiel": "jeden Montag" },
        "W2": { "text": "niemals", "typ": "Adverb", "beispiel": "niemals im Monat" },
        "W3": { "text": "pro", "typ": "Präposition", "beispiel": "einmal pro Woche" }
    },
    "Zeiträume": {
        "T1": {
            "text": ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"],
            "artikel": "der",
            "plural": true,
            "abkürzung": ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
            "beispiel": "Montag, Dienstag und Mittwoch"
        },
        "T2": {
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
        "T3": {
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
        "T4": {
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
    "Anzahl": {
        "A1": { "text": "ungefähr $(zahl1)", "typ": "Zahl" },
        "A2": { "text": "alle", "typ": "Quantor" },
        "A3": { "text": "keiner", "typ": "Quantor" },
        "A4": { "text": "zwischen $(zahl1) und $(zahl2)", "typ": "Zahl" },
        "A5": { "text": "maximal $(zahl1)", "typ": "Zahl" },
        "A6": { "text": "minimal $(zahl1)", "typ": "Zahl" },
        "A7": { "text": "genau $(zahl1)", "typ": "Zahl" },
        "A8": { "text": "$(zahl1) Prozent", "typ": "Zahl" }
    },
    "Aufgaben": {
        "G0": { "text": "$(aufgabe)", "typ": "Nomen" },
        "G1": { "text": "$(rolle1) und $(rolle2)", "typ": "Kombination", "beispiel": "Arzt und Krankenschwester" },
        "G2": { "text": "$(rolle1) oder $(rolle2)", "typ": "Alternative", "beispiel": "Arzt oder Ersthelfer" }
    },
    "Abhängigkeiten": {
        "D0": { "text": "muss anwesend sein", "typ": "Regel", "beispiel": "Ein Arzt muss anwesend sein" },
        "D1": { "text": "muss abwesend sein", "typ": "Regel", "beispiel": "Kein Ausbilder muss abwesend sein" },
        "D2": { "text": "braucht $(zahl1)", "typ": "Regel", "beispiel": "Ein Koch braucht 2 Kellner" },
        "D3": { "text": "hilft $(zahl1)", "typ": "Regel", "beispiel": "Eine Krankenschwester hilft 3 Ärzten" },
        "D4": { "text": "Verhältnis: Für $(zahl1) Rolle(n) je $(zahl2)", "typ": "Regel", "beispiel": "Für 3 Fahrer je 2 Kommissionierer" }
    },
    "Ausnahmen": {
        "E0": { "text": "", "typ": "keine Ausnahme", "beispiel": "Keine Ausnahme" },
        "E1": { "text": "und", "typ": "Verknüpfung", "beispiel": "Bedingungen im Hauptsatz und Nebensatz müssen erfüllt sein" },
        "E2": { "text": "oder", "typ": "Verknüpfung", "beispiel": "Bedingungen im Hauptsatz oder Nebensatz müssen erfüllt sein" },
        "E3": { "text": "aber", "typ": "Verknüpfung", "beispiel": "Wenn die Bedingung im Nebensatz erfüllt ist, ist der Hauptsatz ungültig." },
        "E4": { "text": "außer", "typ": "Verknüpfung", "beispiel": "Wenn die Bedingung im Nebensatz erfüllt ist, ist der Hauptsatz ungültig." },
        "E5": { "text": "aber nicht mehr als", "typ": "Limitation", "beispiel": "Es gibt maximal 5 Aufgaben" },
        "E6": { "text": "aber nicht weniger als", "typ": "Limitation", "beispiel": "Es gibt mindestens 3 Aufgaben" }
    }
};



// Declare variables for each rule component
let W = '', T = '', A = '', G = '', D = '', E = '';
let w = '', t = '', a = '', g = '', d = '';

export function updateHumanRule(id, string) {
    // Update the appropriate rule part
    switch (id[0]) {
        case 'W': W = string; break;
        case 'T': T = string; break;
        case 'A': A = string; break;
        case 'G': G = string; break;
        case 'D': D = string; break;
        case 'E': E = string; break;
        case 'w': w = string; break;
        case 't': t = string; break;
        case 'a': a = string; break;
        case 'g': g = string; break;
        case 'd': d = string; break;
        default:
            console.warn(`Unrecognized rule ID: ${id}`);
            return;
    }

    // Rewrite the human-readable rule after an update
    writeHumanRule();
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


