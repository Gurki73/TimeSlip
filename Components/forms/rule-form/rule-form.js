import { loadRoleData } from '../../../js/loader/role-loader.js';
import { loadOfficeDaysData } from '../../../js/loader/calendar-loader.js';
// import { resetRule, initVisibilityChecker } from './ruleChecker.js';
import { toggleExceptionTable, updateWizard, clearHighlights } from './ruleFlowWizzard.js';
import { createHelpButton } from '../../../js/Utils/helpPageButton.js';
import { createWindowButtons } from '../../../js/Utils/minMaxFormComponent.js';
import { createBranchSelect } from '../../../js/Utils/branch-select.js';
import { createSaveAllButton, saveAll } from '../../../js/Utils/saveAllButton.js';
import { blocks, createRuleFromBlueprint } from "./buildingBlocks.js";
import { translateCurrentRule, translateExistingRules } from "./translatorHuman.js";
import { updateRulesPreview } from "./translatorMachine.js";
import { loadRuleData, saveRuleData } from '../../../js/loader/rule-loader.js';

let cachedRoles = [];
let ruleOfficeDays;
let api;
let eventDelegationInitialized = false;
let ruleForEdeting = {};
let ruleSet = [];
let testPassed = false;

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
export async function initializeRuleForm(passedApi) {
    api = passedApi;
    if (!api) console.error("API was not passed ==> " + api);

    try {
        ruleOfficeDays = await loadOfficeDaysData(api);
        cachedRoles = await loadRoleData(api);
        ruleSet = await loadRuleData(api);

        if (!Array.isArray(cachedRoles)) {
            console.warn("Roles is not an array, initializing empty array");
            cachedRoles = [];
        }

        if (cachedRoles.length < 1) await loadRoleData(api);

    } catch (error) {
        console.error('Error during initialization:', error);
        return; // Stop execution if loading fails
    }

    console.log("-cached roles ", cachedRoles);
    console.log("-cached rules", ruleSet);

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

    ruleForEdeting = createRuleFromBlueprint(defaultBlueprint);
    console.log("rule for edeting:", ruleForEdeting);
    translateCurrentRule(ruleForEdeting, cachedRoles);

    updateDivider("bg-rules");

    initSaveButtons();

    translateExistingRules(ruleSet, cachedRoles);

    initializeInputFunctions();
    handleTopCellRoles('G0');
    handleTopCellNumberInput('A1');
    handleTopCellDependency('D0');

    initEventDelegation();
    //initVisibilityChecker();
}

function initSaveButtons() {
    const testBtn = document.getElementById("test-rule");
    const saveBtn = document.getElementById("save-rule");

    if (!testBtn || !saveBtn) return;

    // Remove existing listeners (safe even if none exist)
    testBtn.removeEventListener("click", onTestRuleClick);
    saveBtn.removeEventListener("click", onSaveRuleClick);

    // Attach fresh listeners
    testBtn.addEventListener("click", onTestRuleClick);
    saveBtn.addEventListener("click", onSaveRuleClick);

    // Initial UX state
    testPassed = false;
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

function runRuleTest() {

    const newMachineRule = updateRulesPreview([ruleForEdeting]);
    console.log("new machine rule:", newMachineRule);

    return new Promise((resolve, reject) => {
        // async validation logic here
        Math.random() > 0.3 ? resolve() : reject();
    });
}

function saveRule() {
    console.log("Saving rule…");
}

function announceStatus(message) {
    const live = document.getElementById("typing-text");
    if (live) live.textContent = `> ${message}`;
}

function onTestRuleClick(event) {
    event.preventDefault();

    testPassed = false;
    updateSaveButtonState();

    runRuleTest()
        .then(() => {
            testPassed = true;
            updateSaveButtonState();
            announceStatus("Regeltest erfolgreich.");
        })
        .catch(() => {
            testPassed = false;
            updateSaveButtonState();
            announceStatus("Regeltest fehlgeschlagen.");
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


function updateDivider(className) {
    const divider = document.getElementById('horizontal-divider');
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
    // --- New global window buttons ---
    const windowBtns = createWindowButtons(); // your new min/max buttons

    // Compose: add branchSelect, helpBtn, saveBtn, then windowBtns
    buttonContainer.append(branchSelect, helpBtn, windowBtns);

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
            // reload rules and repopulate list
            ruleSet = await loadRuleData(api);
            translateExistingRules(ruleSet, cachedRoles);
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

export function populateFormFromRule(rule) {
    if (!rule || !rule.main) return;
    // set selects
    document.getElementById('request-type-select-repeats').value = rule.main.repeat?.type || 'W0';
    document.getElementById('request-type-select-time').value = rule.main.timeframe?.type || 'T0';
    document.getElementById('request-type-select-amount').value = rule.main.amount?.type || 'A1';
    document.getElementById('request-type-select-group').value = rule.main.group?.type || 'G0';
    document.getElementById('request-type-select-dependency').value = rule.main.dependency?.type || 'D0';
    document.getElementById('request-type-select-exception').value = rule.main.exception?.type || 'E0';

    // trigger handlers to construct the dynamic inputs (they will call handleInput)
    handleTopCellNumberInput(document.getElementById('request-type-select-amount').value);
    handleTopCellTimeFrame(document.getElementById('request-type-select-time').value);
    handleTopCellRoles(document.getElementById('request-type-select-group').value);
    handleTopCellDependency(document.getElementById('request-type-select-dependency').value);
    handleTopCellException(document.getElementById('request-type-select-exception').value);

    // now fill cell values for numbers / days / roles
    // amount bottom/top
    const amountCell = document.getElementById('amount-cell');
    if (rule.main.amount) {
        const bottoms = rule.main.amount.bottom ?? rule.main.amount.number ?? null;
        const tops = rule.main.amount.top ?? null;
        // find inputs inside amountCell (we created them earlier in handleTopCellNumberInput)
        const inputs = amountCell.querySelectorAll('input[type="number"]');
        if (inputs.length === 1 && bottoms != null) inputs[0].value = bottoms;
        if (inputs.length === 2) {
            if (bottoms != null) inputs[0].value = bottoms;
            if (tops != null) inputs[1].value = tops;
        }
    }

    // timeframe T2 days checkbox selection
    if (rule.main.timeframe?.type === 'T2') {
        const days = rule.main.timeframe.days || [];
        const checkboxContainer = document.getElementById('time-cell');
        Array.from(checkboxContainer.querySelectorAll('input[type="checkbox"]')).forEach(cb => {
            const idx = Number(cb.dataset.index);
            cb.checked = days.includes(idx);
            cb.dispatchEvent(new Event('change'));
        });
    }

    // group roles: select the role option that corresponds to rule.main.group.roles[0]
    const groupCell = document.getElementById('task-cell');
    const roleSel = groupCell?.querySelector('select');
    if (roleSel && Array.isArray(rule.main.group?.roles) && rule.main.group.roles.length) {
        // match by cachedRoles colorIndex or fallback to index
        const target = rule.main.group.roles[0];
        const foundIndex = cachedRoles.findIndex(r => String(r.colorIndex) === String(target));
        if (foundIndex >= 0) {
            roleSel.value = String(foundIndex);
            roleSel.dispatchEvent(new Event('change'));
        }
    }

    // keep editor state
    ruleForEdeting = { ...rule };
    translateCurrentRule(ruleForEdeting, cachedRoles);
    console.log(" new rule");
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
    let dependencyCell;
    if (id[0] === id[0].toLowerCase()) {
        dependencyCell = document.getElementById('ex-dependency-cell');
    } else {
        dependencyCell = document.getElementById('dependency-cell');
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

            const shiftSelection = document.createElement('select');
            shiftSelection.classList.add('role-select', 'noto');

            existingShifts.forEach((shift, index) => {
                const shiftOption = document.createElement('option');

                let emoji = '🍴';
                let name = 'Tag';
                let val = 'day';

                if (shift === 'early') {
                    emoji = '🐓';
                    name = 'Früh/';
                    val = 'early';
                }
                if (shift === 'late') {
                    emoji = '🌜';
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
                        const handler = handleCheckboxChangeWithNeighbors(container, 't2');
                        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
                        checkboxes.forEach(cb => cb.addEventListener('change', handler));
                    },
                    { idPrefix: `T2-checkbox}` }
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
                '🚕🏠 dienstlich',
                '🏖️⚖️🎁 frei',
                '⛄🌱🌺☀️🎃 Schulferien',
                '💉🧸💸 verhindert'
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
    let timeCell;
    if (id[0] === id[0].toLowerCase()) {
        timeCell = document.getElementById('ex-time-cell');
    } else {
        timeCell = document.getElementById('time-cell');
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
        label.style.marginLeft = '5px';
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
                    const handler = handleCheckboxChangeWithNeighbors(container, id, cb =>
                        cachedRoles.find(r => r.colorIndex === cb.dataset.colorIndex)
                    );
                    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
                    checkboxes.forEach(cb => cb.addEventListener('change', handler));
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
            inputObject.id = "G0";
            inputObject.type = "group";
            inputObject.words = selectedOption.dataset.name;
            inputObject.value = selectedOption.value;
            inputObject.details = { roles: [selectedOption.value] };
            handleInput(inputObject);

            updateShiftSelectColor(singleRoleSelection);
        });
        roleElement.appendChild(singleRoleSelection);
    }

    let roleCell;
    if (id[0] === id[0].toLowerCase()) {
        roleCell = document.getElementById('ex-task-cell');
    } else {
        roleCell = document.getElementById('task-cell');
    }

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

    const exceptionCell = document.getElementById('exception-cell');
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

    const firstChar = id[0];
    let numberCell;
    switch (firstChar) {
        case 'A':
            numberCell = document.getElementById('amount-cell');
            break;
        case 'a':
            numberCell = document.getElementById('ex-amount-cell');
            break;
        case 'W':
            numberCell = document.getElementById('repeat-cell');
            break;
        case 'w':
            numberCell = document.getElementById('ex-repeat-cell');
            break;
        default:
            console.error(id + " unkown number selector");
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

        const inputObject = {
            id: blockId,
            inputID: "topCell",
            words: selectedNames
        };

        handleInput(inputObject);
    };
}

function collectRuleFromForm() {
    // Collect the top-level selects
    const repeatSelect = document.getElementById('request-type-select-repeats');
    const timeSelect = document.getElementById('request-type-select-time');
    const amountSelect = document.getElementById('request-type-select-amount');
    const groupSelect = document.getElementById('request-type-select-group');
    const depSelect = document.getElementById('request-type-select-dependency');
    const exSelect = document.getElementById('request-type-select-exception');

    // Helper to read the "cell" contents we create dynamically
    const readCell = (cellId) => {
        const cell = document.getElementById(cellId);
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
        const days = readCell('time-cell') || [];
        main.timeframe.days = Array.isArray(days) ? days.map(Number) : [];
    } else if (main.timeframe.type === 'T1') {
        // shift selection: stored as dataset.name or option value
        const cell = document.getElementById('time-cell');
        const sel = cell?.querySelector('select');
        if (sel) main.timeframe.shifts = [sel.value];
    }

    // amount details
    const amtCell = document.getElementById('amount-cell');
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
    const groupCell = document.getElementById('task-cell');
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
    const depCell = document.getElementById('dependency-cell');
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
        id: ruleForEdeting.id || `rule_${Date.now()}`,
        created: ruleForEdeting.created || Date.now(),
        updated: Date.now(),
        main,
        condition: condition
    };

    return ruleObj;
}

export function handleInput(inputObj) {
    console.groupCollapsed("handle input object");
    console.log(inputObj);

    const id = inputObj.id;
    if (!id || !blocks[id]) {
        console.warn("Invalid block id:", id, inputObj);
        console.groupEnd();
        return;
    }

    // --- determine scope (MAIN vs SECONDARY) ---
    const firstChar = id.charAt(0);
    const isMain = firstChar === firstChar.toUpperCase();
    const scope = isMain ? "main" : "secondary";

    // --- map block prefix to rule key ---
    const key = map[firstChar.toUpperCase()];
    if (!key) {
        console.warn("Unknown prefix:", firstChar, id);
        console.groupEnd();
        return;
    }

    // --- initialize rule skeleton ---
    if (!ruleForEdeting.id) ruleForEdeting.id = "ui-rule";
    if (!ruleForEdeting.main) ruleForEdeting.main = {};
    if (!ruleForEdeting.secondary) ruleForEdeting.secondary = {};

    // --- exceptions only allowed on MAIN ---
    if (key === "exception" && scope === "secondary") {
        console.warn("Secondary exceptions are not allowed:", id);
        console.groupEnd();
        return;
    }

    // --- attach block to correct branch ---
    const block = blocks[id];
    ruleForEdeting[scope][key] = block;

    const target = ruleForEdeting[scope][key];
    if (!target) {
        console.warn("Failed to attach block:", scope, key);
        console.groupEnd();
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

    // --- dynamic wizard update ---
    clearHighlights();
    updateWizard(id);

    console.trace("Trace for Updated ruleForEdeting", ruleForEdeting);
    console.groupEnd();

    // --- translations remain as-is ---
    const humanOK = translateCurrentRule(ruleForEdeting, cachedRoles);

    const debug = document.getElementById("debug-output");
    if (debug) {
        debug.textContent =
            `Human: ${humanOK ? "✅ OK" : "⚠️ Error"}\n\n`;
    }
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