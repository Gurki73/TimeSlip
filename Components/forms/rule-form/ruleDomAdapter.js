// ruleDomAdapter.js

export function getSelect(key) {
    return document.getElementById(resolveId(key, 'select'));
}

export function getCell(key) {
    return document.getElementById(resolveId(key, 'td'));
}

function resolveId(key, part) {
    const scope = key === key.toUpperCase() ? 'main' : 'ex';
    return `rule-${scope}-${key}-${part}`;
}

/**
 * Reset all options in a table (main or ex) to enabled/disabled state
 * @param {string} table - 'main' or 'ex'
 * @param {boolean} isEnabled - default state for all options
 */
export function resetOptions(table = "main", isEnabled = true) {
    const selects = document.querySelectorAll(`#rule-${table}-th select`);
    selects.forEach(select => {
        Array.from(select.options).forEach(option => {
            const isPlaceholder = option.dataset.placeholder === 'true' || option.value === '';
            if (isPlaceholder) {
                option.dataset.isEnabled = 'false';
                option.disabled = true;
                option.style.opacity = '';
                option.style.cursor = '';
                return;
            }
            option.dataset.isEnabled = isEnabled;
            option.disabled = !isEnabled;
            // optional: remove styling override so we can reapply
            option.style.opacity = '';
            option.style.cursor = '';
        });
    });
}

/**
 * Apply validation state to options
 * @param {Object} validationMap - { key: [enabledOptionValues] }
 */
export function applyValidationState(validationMap) {
    // Clear previous state first
    resetOptions('main', true);
    resetOptions('ex', true);

    Object.entries(validationMap).forEach(([key, allowedValues]) => {
        const select = getSelect(key);
        if (!select) return;

        Array.from(select.options).forEach(option => {
            const isPlaceholder = option.dataset.placeholder === 'true' || option.value === '';
            if (isPlaceholder) {
                option.dataset.isEnabled = 'false';
                option.disabled = true;
                option.style.opacity = 0.35;
                option.style.cursor = 'not-allowed';
                return;
            }
            const isEnabled = allowedValues.includes(option.value);
            option.dataset.isEnabled = isEnabled;
            option.disabled = !isEnabled;
            option.style.opacity = isEnabled ? 1 : 0.3;
            option.style.cursor = isEnabled ? 'pointer' : 'not-allowed';
        });
    });
}
