import { appDictionary } from "./dicctionary.js";

function applyTypingEffect(element) {
    if (!element) return;

    const text = cleanUpText(element.textContent); // Clean up before displaying
    element.textContent = '';

    let i = 0;
    const typingSpeed = 10; // Adjusted speed
    const interval = setInterval(() => {
        element.textContent += text[i];
        i++;
        if (i >= text.length) clearInterval(interval);
    }, typingSpeed);
}

function getLimitText(bottom, upper) {
    if (bottom === Infinity && upper === 0) return "niemals";
    if (bottom === 0 && upper === Infinity) return ""; // always – no need to say anything
    if (bottom === 0 && upper !== Infinity) return `höchstens ${upper}`;
    if (bottom !== Infinity && upper === Infinity) return `mindestens ${bottom}`;
    if (bottom === upper) return `genau ${bottom}`;
    if (bottom < upper) return `mindestens ${bottom} und höchstens ${upper}`;

    // Fallback: invalid config (e.g., bottom > upper)
    return `⚠️ Ungültige Grenzwerte: mindestens ${bottom}, höchstens ${upper}`;
}

export function updateHumanRule(machineRuleObject) {
    const humanTextField = document.getElementById('typing-text');
    if (!humanTextField) return;

    const humanRule = parseAndMap(machineRuleObject).join(' ');

    humanTextField.innerHTML = humanRule || '⚠️ No rule found!';
    applyTypingEffect(humanTextField);
}

function replaceNumbers(text, item) {
    if (!text || !item) return text;

    return text
        .replace("AVERAGE_COUNT", 0.5 * (parseFloat(item.lowerLimit) + parseFloat(item.upperLimit)))
        .replace("UPPER_LIMIT", parseFloat(item.upperLimit))
        .replace("LOWER_LIMIT", parseFloat(item.lowerLimit))
        .replace("REPEAT_COUNT", parseFloat(item.repeats)) // Fix: Cast to number
        .replace("SECONDARY_ROLE_COUNT", item.secondaryRoles ? item.secondaryRoles.length : "")
        .replace("PRIMARY_ROLE_COUNT", item.roles ? item.roles.length : "");
}

function parseAndMap(inputObj) {
    return Object.values(inputObj).map(item => {
        const id = item.id;
        const prefix = id.charAt(0).toLowerCase();
        const dictEntry = appDictionary[prefix]?.[id.toLowerCase()];

        if (!dictEntry) {
            return "";
        }

        let text = dictEntry.text;

        return replaceNumbers(text, item);
    });
}



function cleanUpText(text) {
    return text.replace(/\s+/g, ' ').trim();
}