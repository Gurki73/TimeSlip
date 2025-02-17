export const appDictionary = {
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
        },
        "t?": {
            "text": "*[Zeitraum]*",
            "artikel": "der",
            "plural": true,
            "abkürzung": null,
            "beispiel": "Platzhalter",
            "cases": {
                "nominative": {
                    "singular": "der Zeitraum",
                    "plural": "die Zeiträume"
                },
                "accusative": {
                    "singular": "den Zeitraum",
                    "plural": "die Zeiträume"
                },
                "dative": {
                    "singular": "dem Zeitraum",
                    "plural": "den Zeiträumen"
                },
                "genitive": {
                    "singular": "des Zeitraums",
                    "plural": "der Zeiträume"
                }
            },
            "gender": "maskulin"
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