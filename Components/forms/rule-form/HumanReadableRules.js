import { appDictionary } from "./dicctionary.js";

export function getDictionaryEntry(category, id) {
    return appDictionary[category]?.[id] || null;
}

export function applyGrammaticalContext(config, currentStep) {
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

function getArticle(nextStep, article) {
    return null;
}

export function inflectPhrase(role, dependency) {
    const article = role.metadata.article;
    return `${article} ${role.value} ${dependency.value}`;
}

export function inflectTemporal(repetition, time) {
    const base = repetition.value.includes('pro') ? 'pro' : '';
    return `${repetition.value} ${base} ${time.metadata.case}`;
}

export function getAbbreviation(wordObj) {
    return wordObj.abkürzung ? wordObj.abkürzung.join(', ') : wordObj.text;
}

export function getCase(wordObj, kasus) {
    return wordObj.fälle[kasus];
}
