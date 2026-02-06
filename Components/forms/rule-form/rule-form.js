// Components\forms\rule-form\rule-form.js
import { loadRoleData, loadTeamnames } from '../../../js/loader/role-loader.js';
import { loadOfficeDaysData } from '../../../js/loader/calendar-loader.js';
import { runLiveSanity, runRuleTest } from './ruleChecker.js';
import { toggleExceptionTable, updateWizard } from './ruleFlowWizzard.js';
import { createHelpButton } from '../../../js/Utils/helpPageButton.js';
import { createWindowButtons } from '../../../js/Utils/minMaxFormComponent.js';
import { createBranchSelect } from '../../../js/Utils/branch-select.js';
import { getShiftSymbol } from '../../../js/Utils/globalIcons.js';
import { blocks, createRuleFromBlueprint, ruleToBlueprint } from "./buildingBlocks.js";
import { translateCurrentRule, translateExistingRules, renderRoleSpan } from "./translatorHuman.js";
import { updateRulesPreview } from "./translatorMachine.js";
import { loadRuleData, saveRuleData, deleteRule as deleteRuleFromDisk, getAllRules } from '../../../js/loader/rule-loader.js';
import { createSaveButton } from '../../../js/Utils/saveButton.js';
import { confirmAction } from '../../../js/Utils/conformation-dialog.js'
// temporary
import { getCell, getSelect } from './ruleDomAdapter.js';
const _getElementById = document.getElementById.bind(document);
// en temporary

const INPUT_BINDINGS = [
    // main table
    { key: 'W', handler: handleTopCellNumberInput },
    { key: 'T', handler: handleTopCellTimeFrame },
    { key: 'A', handler: handleTopCellNumberInput },
    { key: 'G', handler: handleTopCellRoles },
    { key: 'D', handler: handleTopCellDependency },
    { key: 'E', handler: handleTopCellException },

    // exception table
    { key: 'w', handler: handleTopCellNumberInput },
    { key: 't', handler: handleTopCellTimeFrame },
    { key: 'a', handler: handleTopCellNumberInput },
    { key: 'g', handler: handleTopCellRoles },
    { key: 'd', handler: handleTopCellDependency },
];

const SVG_NS = "http://www.w3.org/2000/svg";
const map = {
    W: "repeat",
    T: "timeframe",
    A: "amount",
    G: "group",
    D: "dependency",
    E: "exception"
};

const defaultBlueprint = {
    repeat: "W0",
    timeframe: "T0",
    amount: "A1",
    group: "G0",
    dependency: "D0",
    exception: "E0",
    isMain: true
};

const defaultRules = [
    `Über den Fight Club wird nicht gesprochen.`,
    `ÜBER DEN FIGHT CLUB WIRD AUF KEINEN FALL GESPROCHEN.`,
    `Wenn jemand „Stopp“ sagt, schlaff wird oder aufgibt, ist der Kampf vorbei.`
];

let rulesScrollbox;
let teamnames = ["Blau", "Grün", "Rot", "Schwarz", "Azubi"];
let cachedRoles = [];
let ruleOfficeDays;
let api;
let eventDelegationInitialized = false;
let ruleForEditing = {};
let ruleSet = [];
let testPassed = false;
let saveButtonHeader;
let userScrolledUp = false;
let cachedShiftSymbols = 'none';
let lastTestReport = null;

export async function initializeRuleForm(passedApi) {
    api = passedApi;
    if (!api) console.error("API was not passed ==> " + api);

    try {
        ruleOfficeDays = await loadOfficeDaysData(api);
        cachedRoles = await loadRoleData(api);
        ruleSet = await loadRuleData(api);
        teamnames = await loadTeamnames(api);
        if (!Array.isArray(cachedRoles)) {
            console.warn("Roles is not an array, initializing empty array");
            cachedRoles = [];
        }

        if (cachedRoles.length < 1) await loadRoleData(api);

    } catch (error) {
        console.error('Error during initialization:', error);
        return; // Stop execution if loading fails
    }

    const formContainer = document.getElementById('form-container');
    if (!formContainer) {
        console.error('Form container not found');
        return;
    }

    formContainer.innerHTML = '';

    try {
        const response = await fetch('Components/forms/rule-form/rule-form.html');
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const formContent = await response.text();
        formContainer.innerHTML = formContent;

    } catch (err) {
        console.error(`Loading rule form failed: ${err}`);
        return;
    }

    if (document.readyState === 'loading') {
        await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
    }


    rulesScrollbox = document.getElementById("rules-scrollbox");

    if (rulesScrollbox) {
        rulesScrollbox.addEventListener("scroll", () => {
            const threshold = 40; // px from bottom to consider "at bottom"
            const atBottom =
                rulesScrollbox.scrollHeight - rulesScrollbox.scrollTop - rulesScrollbox.clientHeight < threshold;

            userScrolledUp = !atBottom;
        });
    }

    cachedShiftSymbols = localStorage.getItem('shiftSymbols');

    ruleForEditing = createRuleFromBlueprint(defaultBlueprint);
    console.log("rule for edeting:", ruleForEditing);
    translateCurrentRule(ruleForEditing, cachedRoles);

    updateDivider("bg-rules");

    initSaveButtons();
    initTestButton();

    document.getElementById("expand-rules-btn")?.addEventListener("click", () => {
        scrollRulesToBottomIfAllowed(true);
    });


    translateExistingRules(ruleSet, cachedRoles, teamnames);
    scrollRulesToBottomIfAllowed();

    initializeInputFunctions();
    handleTopCellRoles('G0');
    handleTopCellNumberInput('A1');
    handleTopCellDependency('D0');

    initEventDelegation();
    //initVisibilityChecker();
    drawRuleLine();


    // temporary 
    const tableContainer = document.getElementById('table-container');

    function getScopedElementById(id) {
        if (!tableContainer) {
            console.warn('Table container not found');
            return null;
        }

        // Use querySelector with ID, scoped to container
        const el = tableContainer.querySelector(`#${id}`);

        if (!el) console.warn('[MISSING RULE DOM]', id);
        return el;
    }
    // end temporary

}

function initTestButton() {
    const testBtn = document.getElementById("test-rule");

    if (!testBtn) {
        console.warn(" test and analize btn not foun in dom ");
        return;
    }

    testBtn.removeEventListener("click", onTestRuleClick);
    testBtn.addEventListener("click", onTestRuleClick);

    testPassed = false;

}

function initSaveButtons() {
    updateSaveButtonState();
}

function updateSaveButtonState() {
    const saveBtn = document.getElementById("save-rule");

    if (!saveBtn) return;

    saveBtn.disabled = !testPassed;
    saveBtn.setAttribute(
        "aria-disabled",
        String(!testPassed)
    );
}

function saveRule() {
    console.log("Saving rule…");
}

function announceStatus(message) {
    const live = document.getElementById("typing-text");
    if (live) live.textContent = `> ${message}`;
}

function onTestRuleClick(e) {
    e.preventDefault();

    lastTestReport = null;
    updateSaveButtonState();

    runRuleTest().then(report => {
        lastTestReport = report;
        updateSaveButtonState();

        announceStatus(
            report.errors.length === 0
                ? "Regeltest erfolgreich."
                : "Regeltest fehlgeschlagen."
        );
    });
}

function onSaveRuleClick(event) {
    event.preventDefault();

    if (!testPassed) {
        announceStatus("Regel muss zuerst erfolgreich getestet werden.");
        return;
    }

    saveRule();
    announceStatus("Regel gespeichert.");
}


function scrollRulesToBottomIfAllowed(force = false) {
    const box = document.getElementById("rules-scrollbox");
    if (!box) return;

    if (force || !userScrolledUp) {
        box.scrollTop = box.scrollHeight;
    }
}


function updateDivider(className) {
    const divider = document.getElementById('horizontal-divider-box');
    divider.innerHTML = '';

    const leftGap = document.createElement('div');
    leftGap.className = 'left-gap';

    const h2 = document.createElement('h2');
    h2.id = 'role-form-title';
    h2.className = 'sr-only';
    h2.innerHTML = `<span class="noto">🕸</span> Anwesentheit Regeln <span class="noto">🕷️</span>`;

    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'form-buttons';

    const helpBtn = createHelpButton('chapter-employees');
    helpBtn.setAttribute('aria-label', 'Hilfe öffnen für Rollen-Formular');

    const branchSelect = createBranchSelect({
        onChange: (val) => {
            console.log('Branch changed to:', val);
        }
    });

    saveButtonHeader = createSaveButton({ onSave: () => onSaveRuleClick });

    const windowBtns = createWindowButtons(); // your new min/max buttons

    buttonContainer.append(saveButtonHeader.el, helpBtn, branchSelect, windowBtns);

    divider.append(leftGap, h2, buttonContainer);
}

function validateRule(ruleObject) {
    console.log("validate rule ", ruleObject);
}

function showFailurePopup(myError) {
    console.log(myError);
}

async function saveRuleButtonHandler() {
    try {
        const ruleObj = collectRuleFromForm();

        // run local validation (reuse your loader.validateRule if exposed)
        const { valid, errors } = validateRule(ruleObj); // you can import validateRule or call through api

        if (!valid) {
            // show errors in visible UI area
            showFailurePopup(`Regel hat Validierungsfehler: ${errors.join(', ')}`);
            return;
        }

        // generate human preview (already sticky)
        const human = generateFullHumanSentence(ruleObj, cachedRoles);
        // call main to estimate violations across some sample (e.g. next 30 days)
        // calendarContextSample should be an object you create from current calendar view or a summary
        const calendarContextSample = { slot: 'day', counts: {/* per role counts sample */ } };

        // ask main for estimate (synchronous-ish)
        const results = await window.rulesApi.testRule(ruleObj, calendarContextSample, 'day');
        // results could be { violated: true/false, details: {...}, sampleRate: 0.76 }
        let message = `Vorschau: ${human}\n\nErgebnis: ${results.violated ? 'Verletzt' : 'OK'}`;
        if (typeof results.sampleRate === 'number') {
            message += `\nErwartete Verletzungsrate: ${(results.sampleRate * 100).toFixed(0)}%`;
        }

        // confirm
        if (!confirm(`${message}\n\nRegel speichern?`)) return;

        // sanitize id for filename
        ruleObj.id = safeId(ruleObj.id || `rule_${Date.now()}`);
        const ret = await saveRuleData(api, ruleObj);
        if (ret && ret.success) {
            showSuccess('Regel gespeichert');
            ruleSet = await loadRuleData(api);
            translateExistingRules(ruleSet, cachedRoles);
            scrollRulesToBottomIfAllowed();

        } else {
            showFailure('Speichern fehlgeschlagen');
            console.error('saveRuleData returned', ret);
        }

    } catch (err) {
        console.error('Save rule failed', err);
        showFailure('Unbekannter Fehler beim Speichern');
    }
}

function safeId(raw) {
    return String(raw || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_\-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function showSuccess(msg) {
    console.log(" test ==> succus :", msg);
}

function showFailure(msg) {
    console.log(" test ==> failure", msg);
}

export function populateFormFromRule(rule, { setEditorState = true } = {}) {
    if (!rule || !rule.main) return;

    const condition = rule.secondary || rule.condition || {};

    const isBlockId = (value) => /^[WTAGDE]\d+$/i.test(String(value).replace(/\s+/g, ''));

    const normalizeType = (typeOrId, fallback, isSecondary) => {
        if (!typeOrId) return fallback;
        const t = String(typeOrId).trim();
        if (isBlockId(t)) {
            return isSecondary ? t.toLowerCase() : t.toUpperCase();
        }
        const head = t.charAt(0);
        const normHead = isSecondary ? head.toLowerCase() : head.toUpperCase();
        return normHead + t.slice(1);
    };

    const pickTypeId = (block, fallback, isSecondary) => {
        if (!block) return fallback;
        if (block.id && isBlockId(block.id)) {
            return isSecondary ? String(block.id).toLowerCase() : String(block.id).toUpperCase();
        }
        return normalizeType(block.type, fallback, isSecondary);
    };

    const dispatch = (el, type) => {
        if (!el) return;
        el.dispatchEvent(new Event(type, { bubbles: true }));
    };

    const setSelect = (key, value) => {
        const sel = getSelect(key);
        if (!sel) return;
        sel.value = value;
        dispatch(sel, 'change');
    };

    const fillNumberCell = (key, amountObj) => {
        const cell = getCell(key);
        if (!cell) return;
        const inputs = cell.querySelectorAll('input[type="number"]');
        if (!inputs.length) return;
        const bottom =
            amountObj?.bottom ?? amountObj?.number ?? amountObj?.details?.bottom ?? null;
        const top =
            amountObj?.top ?? amountObj?.details?.top ?? null;
        if (inputs.length >= 1 && bottom != null) inputs[0].value = bottom;
        if (inputs.length >= 2 && top != null) inputs[1].value = top;
        inputs.forEach(input => dispatch(input, 'input'));
    };

    const fillTimeframe = (key, timeframeObj, typeValue) => {
        const cell = getCell(key);
        if (!cell) return;

        if (typeValue.toLowerCase() === 't1') {
            const sel = cell.querySelector('select');
            const shift =
                timeframeObj?.shifts?.[0] ??
                timeframeObj?.details?.shifts?.[0] ??
                timeframeObj?.value ??
                null;
            if (sel && shift != null) {
                sel.value = String(shift);
                dispatch(sel, 'change');
            }
            return;
        }

        if (typeValue.toLowerCase() === 't2') {
            const days =
                timeframeObj?.days ??
                timeframeObj?.details?.days ??
                [];
            const checkboxes = cell.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                const idx = Number(cb.dataset.index);
                cb.checked = Array.isArray(days) && days.includes(idx);
                dispatch(cb, 'change');
            });
        }
    };

    const fillGroup = (key, groupObj, typeValue) => {
        const cell = getCell(key);
        if (!cell) return;
        const roles = groupObj?.roles ?? groupObj?.details?.roles ?? [];

        if (String(typeValue).toLowerCase() === 'g0') {
            const sel = cell.querySelector('select');
            if (sel && Array.isArray(roles) && roles.length) {
                sel.value = String(roles[0]);
                dispatch(sel, 'change');
            }
            return;
        }

        const checkboxes = cell.querySelectorAll('input[type="checkbox"]');
        if (!checkboxes.length) return;
        checkboxes.forEach(cb => {
            const val = cb.dataset.index ?? cb.value;
            cb.checked = Array.isArray(roles) && roles.map(String).includes(String(val));
            dispatch(cb, 'change');
        });
    };

    const fillDependency = (key, depObj) => {
        const cell = getCell(key);
        if (!cell) return;
        const inputs = cell.querySelectorAll('input[type="number"]');
        const bottom =
            depObj?.bottom ?? depObj?.numerator ?? depObj?.details?.bottom ?? null;
        const top =
            depObj?.top ?? depObj?.denominator ?? depObj?.details?.top ?? null;
        if (inputs.length >= 1 && bottom != null) inputs[0].value = bottom;
        if (inputs.length >= 2 && top != null) inputs[1].value = top;
        inputs.forEach(input => dispatch(input, 'input'));

        const sel = cell.querySelector('select');
        const roles = depObj?.roles ?? depObj?.details?.roles ?? [];
        if (sel && Array.isArray(roles) && roles.length) {
            sel.value = String(roles[0]);
            dispatch(sel, 'change');
        }
    };

    // --- main selects ---
    const mainRepeat = pickTypeId(rule.main.repeat, 'W0', false);
    const mainTime = pickTypeId(rule.main.timeframe, 'T0', false);
    const mainAmount = pickTypeId(rule.main.amount, 'A1', false);
    const mainGroup = pickTypeId(rule.main.group, 'G0', false);
    const mainDep = pickTypeId(rule.main.dependency, 'D0', false);
    const mainEx = pickTypeId(rule.main.exception, 'E0', false);

    setSelect('W', mainRepeat);
    setSelect('T', mainTime);
    setSelect('A', mainAmount);
    setSelect('G', mainGroup);
    setSelect('D', mainDep);
    setSelect('E', mainEx);

    // --- secondary selects ---
    const secRepeat = pickTypeId(condition.repeat, 'w0', true);
    const secTime = pickTypeId(condition.timeframe, 't0', true);
    const secAmount = pickTypeId(condition.amount, 'a1', true);
    const secGroup = pickTypeId(condition.group, 'g0', true);
    const secDep = pickTypeId(condition.dependency, 'd0', true);

    setSelect('w', secRepeat);
    setSelect('t', secTime);
    setSelect('a', secAmount);
    setSelect('g', secGroup);
    setSelect('d', secDep);

    // --- fill main details ---
    fillNumberCell('W', rule.main.repeat);
    fillNumberCell('A', rule.main.amount);
    fillTimeframe('T', rule.main.timeframe, mainTime);
    fillGroup('G', rule.main.group, mainGroup);
    fillDependency('D', rule.main.dependency);

    // --- fill secondary details ---
    fillNumberCell('w', condition.repeat);
    fillNumberCell('a', condition.amount);
    fillTimeframe('t', condition.timeframe, secTime);
    fillGroup('g', condition.group, secGroup);
    fillDependency('d', condition.dependency);

    if (setEditorState) {
        ruleForEditing = { ...rule };
        translateCurrentRule(ruleForEditing, cachedRoles);
        scrollRulesToBottomIfAllowed();
    }

    console.log("new rule populated");
}

// robust delegated handler (replace existing)
export function handleDelegatedChange(event) {
    const el = event.target;
    if (!el) return;

    // support inputs/selects/checkbox groups with data-block attribute fallback
    const blockId = el.dataset.blockId || (el.id ? el.id.split('-')[0] : null);
    const inputID = el.dataset.inputId || (el.id ? el.id.split('-')[1] || 'value' : 'value');

    if (!blockId) {
        // ignore unrelated fields
        return;
    }

    // Build a normalized input object
    const inputObj = {
        id: blockId,
        inputID,
        // numbers stored on data attributes or on numeric input types
        number1: el.dataset.number1 ? Number(el.dataset.number1) : null,
        number2: el.dataset.number2 ? Number(el.dataset.number2) : null,
        // prefer explicit dataset payloads for complex data (checkbox groups set .dataset.selection)
        value: null,
        words: null
    };

    // Checkbox groups (multiple values)
    if (el.type === 'checkbox') {
        const parent = el.closest('.inputRow') || el.closest('tbody') || el.parentElement;
        const boxes = parent ? parent.querySelectorAll('input[type="checkbox"]') : [el];
        inputObj.value = Array.from(boxes).filter(b => b.checked).map(b => b.dataset.index ?? b.value);
    } else if (el.tagName === 'SELECT') {
        // multi-select supported through dataset.multiple flag
        if (el.multiple) {
            inputObj.value = Array.from(el.selectedOptions).map(o => o.value);
        } else {
            inputObj.value = el.value;
        }
    } else if (el.type === 'number') {
        inputObj.number1 = Number(el.value) || 0;
        inputObj.value = inputObj.number1;
    } else {
        inputObj.value = el.value;
    }

    handleInput(inputObj);
}


function initEventDelegation() {
    if (eventDelegationInitialized) return;

    const container = document.getElementById('rule-form-container');
    if (!container) return console.warn('Container not found');

    container.addEventListener('change', handleDelegatedChange);
    eventDelegationInitialized = true;
}
function resetInput() {
    console.log("reset rule button was pressed");

    resetRule();
    toggleExceptionTable(false);

    document.querySelectorAll('.rule-table thead select').forEach(select => {
        select.selectedIndex = 0;
        select.dispatchEvent(new Event('change'));
    });
}

/*
function initializeInputFunctions() {

    const mainRepeatSelect = document.getElementById('request-type-select-repeats');
    mainRepeatSelect.addEventListener('change', (event) => handleTopCellNumberInput(event.target.value));

    const mainTimeSelect = document.getElementById('request-type-select-time');
    mainTimeSelect.addEventListener('change', (event) => handleTopCellTimeFrame(event.target.value));

    const mainAmountSelect = document.getElementById('request-type-select-amount');
    mainAmountSelect.addEventListener('change', (event) => handleTopCellNumberInput(event.target.value));

    const mainGroupSelect = document.getElementById('request-type-select-group');
    mainGroupSelect.addEventListener('change', (event) => handleTopCellRoles(event.target.value));

    const mainDependicySelect = document.getElementById('request-type-select-dependency');
    mainDependicySelect.addEventListener('change', (event) => handleTopCellDependency(event.target.value));

    const mainExceptionSelect = document.getElementById('request-type-select-exception');
    mainExceptionSelect.addEventListener('change', (event) => handleTopCellException(event.target.value));

    const exRepeatSelect = document.getElementById('ex-request-type-select-repeats');
    exRepeatSelect.addEventListener('change', (event) => handleTopCellNumberInput(event.target.value));

    const exTimeSelect = document.getElementById('ex-request-type-select-time');
    exTimeSelect.addEventListener('change', (event) => handleTopCellTimeFrame(event.target.value));

    const exAmountSelect = document.getElementById('ex-request-type-select-amount');
    exAmountSelect.addEventListener('change', (event) => handleTopCellNumberInput(event.target.value));

    const exGroupSelect = document.getElementById('ex-request-type-select-group');
    exGroupSelect.addEventListener('change', (event) => handleTopCellRoles(event.target.value));

    const exDependencySelect = document.getElementById('ex-request-type-select-dependency');
    exDependencySelect.addEventListener('change', (event) => handleTopCellDependency(event.target.value));

}
*/

function initializeInputFunctions() {
    INPUT_BINDINGS.forEach(({ key, handler }) => {
        const select = getSelect(key);

        if (!select) {
            console.warn(`[rule-form] Select not found for key "${key}"`);
            return;
        }

        select.addEventListener('change', event => {
            handler(event.target.value);
        });
    });
}


function handleTopCellDependency(id) {

    const dependencyElement = document.createElement('div');
    const input1 = document.createElement('input');
    input1.type = 'number';
    input1.classList.add('noto', 'rule-number-input');
    input1.value = 1;
    input1.min = 1;
    input1.max = 50;
    input1.id = id + '-number1';

    let inputObject2 = {
        id: id,
        inputID: "topCell",
        number1: parseFloat(input1.value) || 0,
    };

    input1.addEventListener('input', () => {
        inputObject2.details = { bottom: parseFloat(input1.value) || 0 };
        handleInput(inputObject2);
    });

    const input2 = document.createElement('input');
    input2.type = 'number';
    input2.classList.add('noto', 'rule-number-input')
    input2.value = 2;
    input2.id = id + '-number2';

    const label = document.createElement('span');

    const dependencyRoleSelection = document.createElement('select');
    dependencyRoleSelection.classList.add('role-select', 'noto');
    dependencyRoleSelection.id = id + '-roleSelect';
    dependencyRoleSelection.addEventListener('change', function () {

        const selectedOption = dependencyRoleSelection.options[dependencyRoleSelection.selectedIndex];
        inputObject.words = selectedOption.dataset.name;
        inputObject.value = selectedOption.value;
        // inputObject.details.roles = [selectedOption.value];
        handleInput(inputObject);

        updateShiftSelectColor(dependencyRoleSelection);
    });

    if (!Array.isArray(cachedRoles)) cachedRoles = [];
    cachedRoles.forEach(role => {
        if (!role || typeof role.colorIndex === 'undefined') return;
    });

    cachedRoles.forEach((role, index) => {
        if (['⊖', 'keine', '?', 'name'].includes(role.name)) return;

        const dependencyRoleOption = document.createElement('option');
        const roleColor = getComputedStyle(document.body).getPropertyValue(
            `--role-${role.colorIndex}-color`
        );
        dependencyRoleOption.style.backgroundColor = roleColor;
        dependencyRoleOption.innerHTML = `${role.emoji} ⇨ ${role.name}`;
        dependencyRoleOption.title = role.name;
        dependencyRoleOption.value = index;

        dependencyRoleSelection.appendChild(dependencyRoleOption);

    });

    let inputObject = {
        id: id,
        inputID: "topCell",
        number1: parseFloat(input1.value) || 0,
        number2: parseFloat(input2.value) || 0,
        value: "",
        words: [dependencyRoleSelection.value]
    };

    [input1, input2].forEach(input => {
        input.addEventListener('input', () => {
            inputObject.number1 = parseFloat(input1.value) || 0;
            inputObject.number2 = parseFloat(input2.value) || 0;
            handleInput(inputObject);
        });
    });

    dependencyRoleSelection.addEventListener('change', () => {
        inputObject.words = [dependencyRoleSelection.value];
        handleInput(inputObject);
    });

    switch (id.toLowerCase()) {
        case "d0": // anwesend
            label.innerHTML = 'anwesend';
            dependencyElement.append(label);
            break;

        case "d2": // braucht
            label.innerHTML = 'braucht';
            inputObject.number1 = input1.value;
            inputObject.words = [dependencyRoleSelection.value];
            dependencyElement.append(label, input1, dependencyRoleSelection);
            break;

        case "d3": // hilft
            label.innerHTML = 'hilft';
            inputObject.number1 = input1.value;
            inputObject.words = [dependencyRoleSelection.value];
            dependencyElement.append(label, input1, dependencyRoleSelection);
            break;

        case "d4": // im Verhältnis 🧩
            label.innerHTML = ' <= 🧩 ';
            inputObject.number1 = input1.value;
            inputObject.number2 = input2.value;
            inputObject.words = [dependencyRoleSelection.value];
            dependencyElement.append(label, dependencyRoleSelection, input1, input2);
            break;

        default:
            console.warn("no match for dependency rule " + id);
            return;
    }
    const firstChar = id[0];
    const keyMap = { 'D': 'D', 'd': 'd' };
    const key = keyMap[firstChar];

    if (!key) return console.error(`Unknown dependency key for id ${id}`);

    const dependencyCell = getCell(key);
    if (!dependencyCell) {
        console.warn(`Cell not found for dependency key "${key}"`);
        return;
    }

    dependencyCell.innerHTML = '';
    dependencyCell.appendChild(dependencyElement);
    handleInput(inputObject);
}

function handleTopCellTimeFrame(id) {

    let inputObject = {
        "id": id,
        "inputID": "topCell",
        "value": null
    };
    const timeFrameElement = document.createElement('div');

    switch (id.toLowerCase()) {
        case 't0':
            timeFrameElement.innerHTML = '...';
            break;
        case 't1': { // shift
            const existingShifts = ['day', 'early', 'late'];
            const cachedZodiacStyle = localStorage.getItem('zodiacStyle') || 'none';
            const shiftSelection = document.createElement('select');
            shiftSelection.classList.add('role-select', 'noto');

            existingShifts.forEach((shift, index) => {
                const shiftOption = document.createElement('option');
                if (!cachedShiftSymbols) cachedShiftSymbols = 'none';
                const shiftSymbolDay = getShiftSymbol('day', cachedShiftSymbols);
                const shiftSymbolEarly = getShiftSymbol('early', cachedShiftSymbols);
                const shiftSymbolLate = getShiftSymbol('late', cachedShiftSymbols);
                let emoji = `${shiftSymbolDay}`
                let name = 'Tag';
                let val = 'day';

                if (shift === 'early') {
                    emoji = `${shiftSymbolEarly}`
                    name = 'Früh/';
                    val = 'early';
                }
                if (shift === 'late') {
                    emoji = `${shiftSymbolLate}`
                    name = 'Spät';
                    val = 'late';
                }

                shiftOption.innerHTML = `${emoji} ⇨ ${name}`;
                shiftOption.title = name;
                shiftOption.value = val;
                shiftOption.dataset.name = name;
                shiftOption.id = id + '-' + (index + 1);
                shiftSelection.appendChild(shiftOption);
            });

            updateShiftSelectColor(shiftSelection);

            shiftSelection.addEventListener('change', function () {
                const selectedOption = shiftSelection.options[shiftSelection.selectedIndex];
                inputObject.words = selectedOption.dataset.name;
                inputObject.value = selectedOption.value;
                handleInput(inputObject);

                updateShiftSelectColor(shiftSelection);
            });

            timeFrameElement.appendChild(shiftSelection);
            break;
        }

        case 't2': {
            const ruleWorkdays = [];
            const ruleWorkdayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

            ruleOfficeDays.forEach((item, index) => {
                if (item === 'never') return;

                let name = ruleWorkdayNames[index];
                if (item === 'morning') name += ' (früh)';
                else if (item === 'afternoon') name += ' (spät)';

                ruleWorkdays.push({ name, index }); // store index for later mapping
            });

            if (ruleWorkdays.length < 1) {
                const workdayLabel = document.createElement('label');
                workdayLabel.style = "margin-left: 5px;";
                workdayLabel.textContent = 'Bitte Öffnungzeiten festlegen';
                timeFrameElement.appendChild(workdayLabel);
            } else {
                createCheckboxGroup(
                    "days",
                    ruleWorkdays,           // items to display
                    timeFrameElement,       // parent container
                    (container) => {
                        const handler = handleCheckboxChangeWithNeighbors(container, id);
                        handler();
                    },
                    { idPrefix: `${id}-checkbox` }
                );
            }
            break;
        }
        case 't3':
            timeFrameElement.innerHTML = 'Woche';
            break;
        case 't4':
            timeFrameElement.innerHTML = 'Monat';
            break;
        case 't5': {
            const outOfOfficeElement = document.createElement('div');
            const outOfOfficeReasons = [
                'dienstlich',
                'frei',
                'Schulferien',
                'unvorhergesehen'
            ];

            const checkboxes = [];

            outOfOfficeReasons.forEach((reason, index) => {
                const reasonRow = document.createElement('div');
                reasonRow.style = 'display: flex; align-items: center; gap: 8px;';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.classList.add('reason-checkbox');
                checkbox.id = id + '-checkbox-' + index;

                const label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.style = "max-height: 1.5rem;";
                label.textContent = reason;
                label.classList.add('reason-label', 'noto');

                reasonRow.appendChild(checkbox);
                reasonRow.appendChild(label);
                outOfOfficeElement.appendChild(reasonRow);
                outOfOfficeElement.classList.add('checkbox-grid');
                checkboxes.push(checkbox);

                const handler = handleCheckboxChangeWithNeighbors(outOfOfficeElement, 't5');
                checkboxes.forEach(cb => cb.addEventListener('change', handler));
            });

            timeFrameElement.appendChild(outOfOfficeElement);

            function updateOutOfOfficeString() {
                const selectedReasons = checkboxes
                    .filter(cb => cb.checked)
                    .map(cb => {
                        const index = parseInt(cb.id.split('-').pop());
                        return outOfOfficeReasons[index].replace(/[^a-zA-ZäöüÄÖÜß\s]/g, '').trim(); // Remove emojis
                    });

                const finalString = selectedReasons.join(', ');
                inputObject.words = [finalString];
                handleInput(inputObject);
            }
            break;
        }
        default:
            console.error(" time frame identifyer " + id + " not identified");
            return;
    }
    const keyMap = {
        'T': 'T',
        't': 't',
    };
    const firstChar = id[0];
    const key = keyMap[firstChar];

    if (!key) return console.error(id + " unknown time frame selector");

    const timeCell = getCell(key); // getCell handles main vs ex table
    if (!timeCell) {
        console.warn(`Cell not found for key "${key}"`);
        return;
    }

    timeCell.innerHTML = '';
    timeCell.appendChild(timeFrameElement);
    handleInput(inputObject);
}

function updateShiftSelectColor(select) {
    const value = select.value;
    select.classList.remove('rule-form-shift-early', 'rule-form-shift-day', 'rule-form-shift-late');

    switch (value) {
        case 'morning':
            select.classList.add('rule-form-shift-early');
            break;
        case 'full':
            select.classList.add('rule-form-shift-day');
            break;
        case 'afternoon':
            select.classList.add('rule-form-shift-late');
            break;
    }
}

function drawRuleLine() {

    console.log("[drawRuleLine]");
    const svg = document.getElementById("rule-lines");
    svg.innerHTML = "";

    const a = document.getElementById("rule-main-E-th")?.getBoundingClientRect();
    const b = document.getElementById("space-between-tables")?.getBoundingClientRect();
    const c = document.getElementById("rule-ex-w-th")?.getBoundingClientRect();
    const container = document.getElementById("rule-diagram")?.getBoundingClientRect();

    if (!a || !b || !c || !container) return;

    const startX = a.right - container.left;
    const startY = a.top + a.height / 2 - container.top;

    const midX1 = startX + 32; // 2rem
    const midY = b.top + b.height / 2 - container.top;

    const endX = c.left - container.left;
    const endY = c.top + c.height / 2 - container.top;

    const midX2 = endX - 32;

    const d = `
    M ${startX} ${startY}
    L ${midX1} ${startY}
    L ${midX1} ${midY}
    L ${midX2} ${midY}
    L ${midX2} ${endY}
    L ${endX} ${endY}
  `;

    // Base line (static)
    const base = document.createElementNS(SVG_NS, "path");
    base.id = "rule-line-base";
    base.setAttribute("d", d);

    // Flow line (animated dots)
    const flow = document.createElementNS(SVG_NS, "path");
    flow.id = "rule-line-flow";
    flow.setAttribute("d", d);

    svg.append(base, flow);
}


function createCheckboxGroup(type, items, parent, onChange, options = {}) {
    const container = document.createElement('div');
    container.classList.add('checkbox-grid');

    items.forEach((item, index) => {
        const wrapper = document.createElement('div');
        wrapper.classList.add('checkbox-item');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `${options.idPrefix || 'chk'}-${item.name}`;

        if (item.index != null) checkbox.dataset.index = item.index;
        if (item.colorIndex != null) checkbox.dataset.colorIndex = item.colorIndex;
        if (item.name) checkbox.dataset.name = item.name;

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.style.marginLeft = '0.05rem';
        label.style.paddingRight = '0.1rem';
        label.textContent = item.name;

        wrapper.appendChild(checkbox);
        wrapper.appendChild(label);
        container.appendChild(wrapper);
        checkbox.addEventListener('change', () => onChange(container, type));
    });

    parent.appendChild(container);
    return container;
}

function handleTopCellRoles(id) {
    const roleElement = document.createElement('div');
    roleElement.classList.add('noto', 'rule-role-element');

    const roleLabel = document.createElement('div');
    roleLabel.classList.add('noto', 'rule-role-label');

    if (!Array.isArray(cachedRoles) || cachedRoles.filter(r => !['⊖', 'keine', '?', 'name'].includes(r.name)).length === 0) {
        roleLabel.textContent = '⚠️ Bitte zuerst Rollen zuweisen!';
        roleElement.appendChild(roleLabel);

    } else if (['g1', 'g2'].includes(id.toLowerCase())) {
        const validRoles = cachedRoles.filter(r => !['⊖', 'keine', '?', 'name'].includes(r.name));

        if (validRoles.length < 2) {
            roleLabel.textContent = '⚠️ Mindestens 2 Rollen nötig für "und/or"';
            roleElement.appendChild(roleLabel);
        } else {
            roleLabel.textContent = id.toLowerCase() === 'g1' ? '🧩 und 🧩' : '🧩 oder 🧩';
            roleElement.appendChild(roleLabel);

            let items = [];
            validRoles.forEach(role => {
                items.push({ name: role.name, index: role.colorIndex });
            })

            createCheckboxGroup(
                'roles',
                items,
                roleElement,
                (container) => {
                    const handler = handleCheckboxChangeWithNeighbors(container, id);
                    handler();
                },
                { idPrefix: `${id}-checkbox` }
            );
        }
    } else if (id.toLowerCase() === 'g0') {
        const singleRoleSelection = document.createElement('select');
        singleRoleSelection.classList.add('role-select', 'noto');
        singleRoleSelection.id = `${id}-select`;
        singleRoleSelection.name = 'roleIndicee';

        const validRoles = cachedRoles.filter(r => !['⊖', 'keine', '?', 'name'].includes(r.name));

        if (validRoles.length === 0) {
            const placeholderOption = document.createElement('option');
            placeholderOption.textContent = '⚠️ Keine Rollen verfügbar';
            placeholderOption.disabled = true;
            placeholderOption.selected = true;
            singleRoleSelection.appendChild(placeholderOption);
        } else {
            validRoles.forEach((role, index) => {
                const singleRoleOption = document.createElement('option');
                const roleColor = getComputedStyle(document.body).getPropertyValue(`--role-${role.colorIndex}-color`);
                singleRoleOption.style.backgroundColor = roleColor;
                singleRoleOption.textContent = `${role.emoji} ⇨ ${role.name}`; // safer than innerHTML
                singleRoleOption.title = role.name;
                singleRoleOption.value = role.colorIndex;
                singleRoleSelection.appendChild(singleRoleOption);
            });

            const firstRole = validRoles[0];
            if (firstRole) {
                const initialColor = getComputedStyle(document.body).getPropertyValue(`--role-${firstRole.colorIndex}-color`);
                singleRoleSelection.style.backgroundColor = initialColor || '';
            }
        }

        singleRoleSelection.addEventListener('change', () => {
            const selectedOption = singleRoleSelection.options[singleRoleSelection.selectedIndex];
            singleRoleSelection.style.backgroundColor = selectedOption.style.backgroundColor;
            const inputObject = {};
            inputObject.id = id;
            inputObject.type = "group";
            inputObject.words = selectedOption.dataset.name;
            inputObject.value = selectedOption.value;
            inputObject.details = { roles: [selectedOption.value] };
            handleInput(inputObject);

            updateShiftSelectColor(singleRoleSelection);
        });
        roleElement.appendChild(singleRoleSelection);
    }

    const isException = id[0] === id[0].toLowerCase();

    const roleCellId = isException
        ? 'rule-ex-g-td'
        : 'rule-main-G-td';

    const roleCell = document.getElementById(roleCellId);

    if (roleCell) {
        roleCell.innerHTML = '';
        roleCell.appendChild(roleElement);
    } else {
        console.warn('Role cell not found for id:', id);
    }
}

function handleTopCellException(id) {
    console.log("Creating exception with ID:", id);

    const exceptionTexts = {
        E0: ' - - - ',
        E1: 'und',
        E2: 'oder',
        E3: 'aber',
        E4: 'außer',
        E5: 'aber nicht mehr als',
        E6: 'aber nicht weniger als',
    };

    const keyMap = { 'E': 'E' };
    const firstChar = id[0];
    const key = keyMap[firstChar];

    if (!key) return console.error(id + " unknown exception selector");

    const exceptionCell = getCell(key); // DOM adapter handles main vs ex table
    if (!exceptionCell) {
        console.warn(`Cell not found for key "${key}"`);
        return;
    }
    exceptionCell.innerHTML = ''; // clear previous
    const exceptionLabel = document.createElement('div');
    exceptionLabel.classList.add('noto');
    exceptionLabel.textContent = exceptionTexts[id] || 'Unbekannte Ausnahme';
    exceptionCell.appendChild(exceptionLabel);

    const inputObject = { id, inputID: "topCell", value: id };
    handleInput(inputObject);

    const tablesContainer = document.getElementById('rule-tables-container');
    toggleExceptionTable(id !== 'E0');

    void tablesContainer.offsetHeight;

    window.dispatchEvent(new Event('resize'));
}

function handleTopCellNumberInput(id) {
    const container = document.createElement('div');
    if (!container) return console.warn('Container not found');
    container.classList.add('inputRow');

    const numLabel = document.createElement('span');
    numLabel.classList.add('noto');

    const input1 = document.createElement('input');
    input1.type = 'number';
    input1.classList.add('rule-number-input');
    input1.value = 1; // Default value
    input1.min = 1;
    input1.max = 50;
    input1.id = id + '-number1';

    const input2 = document.createElement('input');
    input2.type = 'number';
    input2.classList.add('rule-number-input');
    input2.value = 2; // Default value
    input2.min = 1;
    input2.max = 50;
    input2.id = id + '-number2';

    let inputObject = {
        id: id,
        inputID: "topCell",
        number1: parseFloat(input1.value) || 0,
        number2: parseFloat(input2.value) || 0
    };

    [input1, input2].forEach(input => {
        input.addEventListener('input', () => {
            inputObject.number1 = parseFloat(input1.value) || 0;
            inputObject.number2 = parseFloat(input2.value) || 0;
            handleInput(inputObject);
        });
    });

    switch (id.toLowerCase()) {
        case 'w0':
            numLabel.innerHTML = '...';
            container.append(numLabel);
            break;

        case 'w1':
            numLabel.innerHTML = 'jede(n)';
            container.append(numLabel);
            break;
        case 'w2':
            numLabel.innerHTML = 'entweder';
            container.append(numLabel);
            break;

        case 'w3':
            numLabel.innerHTML = 'nur';
            container.append(numLabel);
            break;

        case 'w4':
            numLabel.innerHTML = ' x pro 🕒 <i class="text-info">(Woche)</i>';
            container.append(input1, numLabel);
            break;

        case ("a1"): // about 🧩
            numLabel.innerHTML = 'ungefähr: ';
            container.append(numLabel, input1);
            break;

        case ("a3"): // between 🧩 
            numLabel.innerHTML = 'zwischen: ';
            const andLabel = document.createElement('span');
            andLabel.innerHTML = ' und ';
            input2.value = 3;
            container.append(numLabel, input1, andLabel, input2);
            break;

        case ("a4"): // max 🧩 
            numLabel.innerHTML = 'maximal: ';
            container.append(numLabel, input1);
            break;

        case ("a5"): // min 🧩 
            numLabel.innerHTML = 'minimal: ';
            container.append(numLabel, input1);
            break;

        case ("a8"): // exact 🧩
            numLabel.innerHTML = 'genau: ';
            container.append(numLabel, input1);
            break;
        default:
            console.warn(`Unhandled number input ID: ${id}`);
            break;
    }

    const keyMap = {
        'A': 'A',
        'a': 'a',
        'W': 'W',
        'w': 'w',
    };

    const firstChar = id[0];
    const key = keyMap[firstChar];

    if (!key) return console.error(id + " unknown number selector");

    const numberCell = getCell(key);
    if (!numberCell) {
        console.warn(`Cell not found for key "${key}"`);
        return;
    }

    numberCell.innerHTML = '';
    numberCell.appendChild(container);
    handleInput(inputObject);
}

function handleCheckboxChangeWithNeighbors(container, blockId) {
    return () => {

        // Get all checked checkboxes inside the container
        const checked = Array.from(
            container.querySelectorAll('input[type="checkbox"]:checked')
        );

        const selectedNames = checked.map(cb => cb.dataset.name);
        const selectedValues = checked.map(cb => cb.dataset.index ?? cb.dataset.colorIndex ?? cb.value);

        const inputObject = {
            id: blockId,
            inputID: "topCell",
            words: selectedNames,
            value: selectedValues
        };

        handleInput(inputObject);
    };
}

function collectRuleFromForm() {
    // Collect the top-level selects
    const repeatSelect = getSelect('W');
    const timeSelect = getSelect('T');
    const amountSelect = getSelect('A');
    const groupSelect = getSelect('G');
    const depSelect = getSelect('D');
    const exSelect = getSelect('E');

    // Helper to read the "cell" contents we create dynamically
    const readCell = (key) => {
        const cell = getCell(key);
        if (!cell) return null;
        // Try to find known inputs inside
        const select = cell.querySelector('select');
        if (select) {
            if (select.multiple) return Array.from(select.selectedOptions).map(o => o.value);
            return select.value;
        }
        const inputs = cell.querySelectorAll('input[type="number"]');
        if (inputs && inputs.length === 1) return Number(inputs[0].value) || 0;
        if (inputs && inputs.length === 2) {
            return { number1: Number(inputs[0].value) || 0, number2: Number(inputs[1].value) || 0 };
        }
        // check checkboxes
        const checked = Array.from(cell.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.dataset.index ?? cb.value);
        if (checked.length) return checked;
        // fallback text
        return cell.textContent.trim() || null;
    };

    // build structured blocks (mirror createRuleFromBlueprint shape)
    const main = {
        repeat: { type: repeatSelect?.value || 'W0' },
        timeframe: { type: timeSelect?.value || 'T0' },
        amount: { type: amountSelect?.value || 'A1' },
        group: { type: groupSelect?.value || 'G0' },
        dependency: { type: depSelect?.value || 'D0' },
        exception: { type: exSelect?.value || 'E0' }
    };

    // Now attach details read from cell content
    // Example: timeframe T2 -> days array
    if (main.timeframe.type === 'T2') {
        const days = readCell('T') || [];
        main.timeframe.days = Array.isArray(days) ? days.map(Number) : [];
    } else if (main.timeframe.type === 'T1') {
        // shift selection: stored as dataset.name or option value
        const cell = readCell('T') || [];
        const sel = cell?.querySelector('select');
        if (sel) main.timeframe.shifts = [sel.value];
    }

    // amount details
    const amtCell = readCell('A');
    const numInputs = amtCell?.querySelectorAll('input[type="number"]') || [];
    if (numInputs.length === 1) {
        main.amount.bottom = Number(numInputs[0].value) || 0;
        main.amount.top = main.amount.bottom;
    } else if (numInputs.length === 2) {
        main.amount.bottom = Number(numInputs[0].value) || 0;
        main.amount.top = Number(numInputs[1].value) || main.amount.bottom;
    } else {
        // fallback: check text nodes
        const txt = amtCell?.textContent?.trim();
        if (txt) main.amount.humanText = txt;
    }

    // group roles -> convert option index to role index stored in cachedRoles
    const groupCell = readCell('G');
    const roleSelect = groupCell?.querySelector('select');
    if (roleSelect) {
        const selIdx = Number(roleSelect.value);
        // if cachedRoles present, map to colorIndex or stored id
        const selectedRole = cachedRoles[selIdx];
        main.group.roles = selectedRole ? [selectedRole.colorIndex ?? selIdx] : [selIdx];
    } else {
        // checkbox multi roles
        const checkedRoles = Array.from(groupCell?.querySelectorAll('input[type="checkbox"]:checked') || []).map(cb => Number(cb.dataset.index ?? cb.value));
        main.group.roles = checkedRoles;
    }

    // dependency detail read (numbers and selected role)
    const depCell = readCell('D');
    if (depCell) {
        const depNum1 = depCell.querySelector('input[type="number"]#D0-number1') || depCell.querySelector('input[type="number"]');
        const depNum2 = depCell.querySelector('input[type="number"]#D0-number2');
        const depSel = depCell.querySelector('select');
        if (depNum1) main.dependency.numerator = Number(depNum1.value) || 1;
        if (depNum2) main.dependency.denominator = Number(depNum2.value) || 1;
        if (depSel) main.dependency.roles = [Number(depSel.value)];
    }

    // condition (exception) block; read from ex-* cells similarly
    const condition = {};
    // you can reuse same pattern for ex- cells if exSelect != E0
    if (exSelect.value !== 'E0') {
        condition.repeat = { type: document.getElementById('ex-request-type-select-repeats')?.value || 'w0' };
        condition.timeframe = { type: document.getElementById('ex-request-type-select-time')?.value || 't0' };
        // fill condition.amount/ group / dependency similarly ...
    }

    // wrap as a rule object
    const ruleObj = {
        id: ruleForEditing.id || `rule_${Date.now()}`,
        created: ruleForEditing.created || Date.now(),
        updated: Date.now(),
        main,
        condition: condition
    };

    return ruleObj;
}

export function handleInput(inputObj) {
    console.log(inputObj);

    const id = inputObj.id;
    if (!id || !blocks[id]) {
        console.warn("Invalid block id:", id, inputObj);
        return;
    }

    console.log("[handle input] input Object::", inputObj);

    // --- determine scope (MAIN vs SECONDARY) ---
    const firstChar = id.charAt(0);
    const isMain = firstChar === firstChar.toUpperCase();
    const scope = isMain ? "main" : "secondary";

    // --- map block prefix to rule key ---
    const key = map[firstChar.toUpperCase()];
    if (!key) {
        console.warn("Unknown prefix:", firstChar, id);
        return;
    }

    // --- initialize rule skeleton ---
    if (!ruleForEditing.id) ruleForEditing.id = "ui-rule";
    if (!ruleForEditing.main) ruleForEditing.main = {};
    if (!ruleForEditing.secondary) ruleForEditing.secondary = {};

    // --- exceptions only allowed on MAIN ---
    if (key === "exception" && scope === "secondary") {
        console.warn("Secondary exceptions are not allowed:", id);
        return;
    }

    // --- attach block to correct branch ---
    const block = blocks[id];
    ruleForEditing[scope][key] = block;

    const target = ruleForEditing[scope][key];
    if (!target) {
        console.warn("Failed to attach block:", scope, key);
        return;
    }

    // --- apply input details ---
    switch (key) {
        case "repeat":
            if (!target.details) target.details = {};
            if (inputObj.number1 != null) target.details.bottom = inputObj.number1;
            if (inputObj.number2 != null) target.details.top = inputObj.number2;
            break;

        case "timeframe":
            if (!target.details) target.details = {};
            if (inputObj.words) target.details.days = inputObj.words;
            if (inputObj.value != null) {
                const shifts = Array.isArray(inputObj.value) ? inputObj.value : [inputObj.value];
                target.details.shifts = shifts;
            }
            break;

        case "amount":
            if (!target.details) target.details = {};
            if (inputObj.number1 != null) target.details.bottom = inputObj.number1;
            if (inputObj.number2 != null) target.details.top = inputObj.number2;
            break;

        case "group":
            if (!target.details) target.details = {};
            if (inputObj.value && inputObj.value.length > 0)
                target.details.roles = inputObj.value;
            break;

        case "dependency":
            if (!target.details) target.details = {};
            if (inputObj.words)
                target.details.roles = inputObj.words;
            if (inputObj.details?.bottom != null)
                target.details.bottom = inputObj.details.bottom;
            break;

        case "exception":
            if (!target.details) target.details = {};
            if (inputObj.words)
                target.details.rules = inputObj.words;
            break;

        default:
            console.warn("Unhandled rule key:", key);
    }
    const liveSanityResult = runLiveSanity(ruleForEditing);
    updateWizard(liveSanityResult, inputObj.id);

    // --- translations remain as-is ---
    const humanOK = translateCurrentRule(ruleForEditing, cachedRoles);

    const debug = document.getElementById("debug-output");
    if (debug) {
        debug.textContent =
            `Human: ${humanOK ? "✅ OK" : "⚠️ Error"}\n\n`;
    }

    drawRuleLine();
}

function debounce(fn, wait = 150) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), wait);
    };
}

const updatePreviewDebounced = debounce(() => {
    const rule = collectRuleFromForm();
    translateCurrentRule(rule, cachedRoles);
    const machine = updateRuleset([rule]);
    const debug = document.getElementById('debug-output');
    if (debug) debug.textContent = JSON.stringify(machine, null, 2);
}, 160);

function displayResults(checked, machine, human) {
    document.getElementById("checkedRule").innerText = JSON.stringify(checked, null, 2);
    document.getElementById("machineRule").innerText = JSON.stringify(machine, null, 2);
    document.getElementById("humanRule").innerText = human;
}

function fillRules(rulesArray) {
    const rulesList = document.getElementById('rules-list');
    const template = document.getElementById('rule-item-template');

    rulesList.innerHTML = '';

    rulesArray.forEach((ruleText, index) => {
        const clone = template.content.cloneNode(true);
        const ruleTextEl = clone.querySelector('.rule-text');
        const editBtn = clone.querySelector('.edit-rule');
        const deleteBtn = clone.querySelector('.delete-rule');

        ruleTextEl.textContent = ruleText;
        editBtn.dataset.ruleId = index;
        deleteBtn.dataset.ruleId = index;
        rulesList.appendChild(clone);
    });
}

export function copyRule(ruleView) {
    const rule = ruleView?.rule ?? ruleView;
    if (!rule) {
        console.warn('Copy rule failed: no rule provided', ruleView);
        return;
    }

    console.info('Copy rule into editor:', rule.id);

    const blueprint = ruleToBlueprint(rule, { keepId: false });
    const editorRule = createRuleFromBlueprint(blueprint);

    populateFormFromRule(rule, { setEditorState: false });

    ruleForEditing = editorRule;
    translateCurrentRule(ruleForEditing, cachedRoles);
    scrollRulesToBottomIfAllowed();

    console.info('New rule id:', editorRule.id);
}

export function editRule(ruleView) {
    const rule = ruleView?.rule ?? ruleView;
    if (!rule) {
        console.warn('Edit rule failed: no rule provided', ruleView);
        return;
    }

    console.info('Edit rule:', rule.id);

    const blueprint = ruleToBlueprint(rule, { keepId: true });
    const editorRule = createRuleFromBlueprint(blueprint);

    populateFormFromRule(rule, { setEditorState: false });

    ruleForEditing = editorRule;
    translateCurrentRule(ruleForEditing, cachedRoles);
    scrollRulesToBottomIfAllowed();
}


export async function deleteRule(ruleView) {
    const ok = await confirmAction('Delete this rule?');
    if (!ok) return;

    if (isClientMode()) {
        const res = await deleteRuleFromDisk(api, ruleView.id);
        console.warn('Rule deleted from disk:', res);
        return res;
    }

    // sample mode → blacklist (memory only)
    ruleView.rule._deleted = true;
    console.warn('Rule blacklisted in sample mode:', ruleView.id);
}

export async function awakeRule(ruleView) {
    const rule = { ...ruleView.rule, isAsleep: false, updated: Date.now() };

    if (isClientMode()) {
        return await saveRuleData(window.api, rule);
    }

    updateRuleInMemory(rule);
    console.info('Rule awakened (sample mode)');
}


export async function goAsleep(ruleView) {
    const rule = { ...ruleView.rule, isAsleep: true, updated: Date.now() };

    if (isClientMode()) {
        return await saveRuleData(window.api, rule);
    }

    updateRuleInMemory(rule);
    console.info('Rule put to sleep (sample mode)');
}


export function getDataMode() {
    const mode = localStorage.getItem('dataMode');
    return mode === 'client' ? 'client' : 'sample';
}

export function isClientMode() {
    return getDataMode() === 'client';
}


function updateRuleInMemory(updatedRule) {
    const all = getAllRules();
    const idx = all.findIndex(r => r.id === updatedRule.id);
    if (idx !== -1) {
        all[idx] = { ...updatedRule, updated: Date.now() };
    }
}
