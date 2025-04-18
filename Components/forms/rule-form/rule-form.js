import { roles as rolesPromise } from '../../../js/loader/role-loader.js';
import { loadOfficeDaysData } from '../../../js/loader/calendar-loader.js';
import { checkInput, resetRule, initVisibilityChecker } from './ruleChecker.js';
import { toggleExceptionTable, updateWizzard } from './ruleFlowWizzard.js';
import { updateMachineRule, initMachineRule } from './machineReadableRules.js';
import { updateHumanRule } from './humanReadableRules.js';

let ruleRoles;
let ruleOfficeDays;
let api;
let eventDelegationInitialized = false;

export async function initializeRuleForm(passedApi) {

    api = passedApi;
    if (!api) console.error(" Api was not passed ==> " + api);

    try {
        const roles = await rolesPromise;
        ruleRoles = roles;
        ruleOfficeDays = await loadOfficeDaysData();
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

    resetRule();
    initializeInputFunctions();
    handleTopCellRoles('G0');
    handleTopCellNumberInput('A1');
    handleTopCellDependency('D0');

    // Switched to using event delegation to avoid stacking anonymous event listeners on each dynamic input element.
    // This ensures scalability and independence from attaching individual listeners to each input.
    // No more manual calls for updating event listeners; they are handled dynamically by the parent container.
    initEventDelegation();
    initMachineRule();

    initVisibilityChecker();
}
function handleDelegatedChange(event) {
    const target = event.target;

    // only inputs inside valid rows
    if (!target.matches('input, select, textarea')) return;
    const row = target.closest('.inputRow') || target.closest('tbody');
    if (!row) return;

    const inputObject = extractInputObjectFromElement(target);
    handleInput(inputObject);
}

function initEventDelegation() {
    if (eventDelegationInitialized) return;

    const container = document.getElementById('rule-form-container');
    if (!container) return;

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

function extractInputObjectFromElement(element) {
    const idParts = element.id.split('-');
    const elementId = idParts[0];
    const inputID = idParts[1];
    const index = idParts.slice(2).join('-');

    let value;
    if (element.type === 'number') {
        value = parseFloat(element.value) || 0;
    } else if (element.tagName === 'SELECT') {
        value = element.value;
    } else if (element.type === 'checkbox') {
        const parent = element.closest('.inputRow') || element.closest('tbody');
        const checkboxes = parent.querySelectorAll(`input[type="checkbox"][name="${element.name}"]`);
        value = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.dataset.day || cb.id || cb.value);
    } else {
        value = element.value;
    }

    return {
        id: elementId,
        inputID: inputID,
        value: value
    };
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

    const resetButton = document.getElementById('reset-rule-button');
    resetButton.addEventListener('click', () => resetInput());
}

function handleTopCellDependency(id) {

    const dependencyElement = document.createElement('div');
    const input1 = document.createElement('input');
    input1.type = 'number';
    input1.classList.add('noto', 'rule-number-input');
    input1.value = 1;
    input1.id = id + '-number1';

    const input2 = document.createElement('input');
    input2.type = 'number';
    input2.classList.add('noto', 'rule-number-input')
    input2.value = 2;
    input2.id = id + '-number2';

    const label = document.createElement('span');

    const dependencyRoleSelection = document.createElement('select');
    dependencyRoleSelection.classList.add('role-select', 'noto');
    dependencyRoleSelection.id = id + '-2';

    ruleRoles.forEach((role, index) => {
        if (['❓', 'keine', '?', 'name'].includes(role.name)) return;

        const dependencyRoleOption = document.createElement('option');
        const roleColor = getComputedStyle(document.documentElement).getPropertyValue(
            `--role-${role.colorIndex}-color`
        );
        dependencyRoleOption.style.backgroundColor = roleColor;
        dependencyRoleOption.innerHTML = `${role.emoji} ⇨ ${role.name}`;
        dependencyRoleOption.title = role.name;
        dependencyRoleOption.value = index;

        dependencyRoleSelection.appendChild(dependencyRoleOption);
    });

    let inputObject = {
        "id": id,
        "inpuID": "topCell",
        "value": null
    };

    switch (id.toLowerCase()) {
        case "d0": // anwesend
            label.innerHTML = 'anwesend';
            dependencyElement.append(label);
            break;

        case "d1": // abwesend
            label.innerHTML = 'abwesend';
            dependencyElement.append(label);
            break;

        case "d2": // braucht
            label.innerHTML = 'braucht';
            inputObject.number1 = input1.value;
            inputObject.words = [dependencyRoleSelection.value];
            dependencyElement.append(input1, label, dependencyRoleSelection);
            break;

        case "d3": // hilft
            label.innerHTML = 'hilft';
            inputObject.number1 = input1.value;
            inputObject.words = [dependencyRoleSelection.value];
            dependencyElement.append(input1, label, dependencyRoleSelection);
            break;

        case "d4": // im Verhältnis 🧩
            label.innerHTML = ' <= 🧩 ';
            inputObject.number1 = input1.value;
            inputObject.number2 = input2.value;
            inputObject.words = [dependencyRoleSelection.value];
            dependencyElement.append(label, input1, dependencyRoleSelection, input2);
            break;

        default:
            console.error("no match for dependency rule " + id);
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
            const existingShifts = ['full', 'morning', 'afternoon'];

            const shiftSelection = document.createElement('select');
            shiftSelection.classList.add('role-select', 'noto');

            existingShifts.forEach(shift => {
                const shiftOption = document.createElement('option');

                let emoji = '🥗';
                let name = 'ganztags';
                let val = 'full';
                let index = 1;

                if (shift === 'morning') {
                    emoji = '☕';
                    name = 'vormittags';
                    val = 'morning';
                    index = 2;
                }
                if (shift === 'afternoon') {
                    emoji = '🫖';
                    name = 'nachmittags';
                    val = 'afternoon';
                    index = 3;
                }

                shiftOption.innerHTML = `${emoji} ⇨ ${name}`;
                shiftOption.title = name;
                shiftOption.value = val;
                shiftOption.dataset.name = name;
                shiftOption.id = id + '-' + index;
                shiftSelection.appendChild(shiftOption);
            });

            shiftSelection.addEventListener('change', function () {
                const selectedOption = shiftSelection.options[shiftSelection.selectedIndex];
                inputObject.words = [selectedOption.dataset.name];
                handleInput(inputObject);
            });

            timeFrameElement.appendChild(shiftSelection);
            break;
        }

        case 't2':
            const ruleWorkdays = [];
            const ruleWorkdayNames = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

            ruleOfficeDays.forEach((item, index) => {
                if (item === 'never') return;

                let name = ruleWorkdayNames[index];
                if (item === 'morning') {
                    name += '(früh)';
                } else if (item === 'afternoon') {
                    name += '(spät)';
                }
                ruleWorkdays.push({ name, id: ruleWorkdayNames[index] });
            });

            const checkboxesContainer = document.createElement('div');
            checkboxesContainer.style = `
                    display: flex; 
                    flex-wrap: wrap; 
                    gap: 10px; 
                    width: 100%; 
                `;

            ruleWorkdays.forEach((workday, index) => {
                const workdayCheck = document.createElement('div');
                workdayCheck.style = `
                        display: flex; 
                        align-items: center; 
                        width: 25%; 
                        padding: 2px; 
                        border: 1px solid #ccc; 
                        border-radius: 6px;
                    `;

                const workdayCheckbox = document.createElement('input');
                workdayCheckbox.type = 'checkbox';
                workdayCheckbox.id = `${id}-checkbox-${workday.id}`;
                workdayCheckbox.dataset.day = workday.name; // Store name in data attribute

                const workdayLabel = document.createElement('label');
                workdayLabel.htmlFor = workdayCheckbox.id;
                workdayLabel.style = "margin-left: 5px;";
                workdayLabel.textContent = workday.name;

                workdayCheck.appendChild(workdayCheckbox);
                workdayCheck.appendChild(workdayLabel);
                checkboxesContainer.appendChild(workdayCheck);

                workdayCheckbox.addEventListener('change', updateSelectedDays);
            });

            timeFrameElement.appendChild(checkboxesContainer);

            function updateSelectedDays() {
                const selectedDays = Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
                    .map(checkbox => checkbox.dataset.day) // Get the day name from data attribute
                    .join('\ ');

                console.log("Selected days:", selectedDays); // Log or update the UI
                handleInput(inputObject);
            }

            break;
        case 't3':
            timeFrameElement.innerHTML = 'Woche';
            break;
        case 't4':
            timeFrameElement.innerHTML = 'Monat';
            break;
        case 't5': {
            const outOfOfficeElement = document.createElement('div');
            const outOfOfficeReasons = [
                '🚕🏠📐 dienstlich',
                '🏖️⚖️🎁 frei',
                '⛄🌱🌺☀️🎃 Schulferien',
                '💉🧸💸 verhindert'
            ];

            const checkboxes = []; // Store references to all checkboxes

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

                checkbox.addEventListener('change', () => {
                    updateOutOfOfficeString();
                });
            });

            timeFrameElement.appendChild(outOfOfficeElement);

            // Function to collect checked values and update the role
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

function handleTopCellRoles(id) {

    const roleElement = document.createElement('div');
    roleElement.classList.add('noto');
    roleElement.style = "display: flex; flex-direction: column; align-items: flex-start;";

    const roleLabel = document.createElement('div');
    roleLabel.classList.add('noto');
    roleLabel.style = "width: 100%; text-align: center; font-size: 1.2em; margin-bottom: 10px;";

    if (['g1', 'g2'].includes(id.toLowerCase())) {
        roleLabel.innerHTML = id.toLowerCase() === 'g1' ? '🧩 <b>und</b> 🧩' : '🧩 <b>oder</b> 🧩';
        roleElement.appendChild(roleLabel);

        const checkboxesContainer = document.createElement('div');
        checkboxesContainer.style = "display: flex; flex-wrap: wrap; gap: 10px;";

        ruleRoles.forEach((role, index) => {
            if (['❓', 'keine', '?', 'name'].includes(role.name)) return;

            const roleCheck = document.createElement('div');
            roleCheck.style = "display: flex; align-items: center; width: 20%; border-radius: 6px;";

            const roleCheckbox = document.createElement('input');
            roleCheckbox.type = 'checkbox';

            // ✅ ID: unique per role + block
            roleCheckbox.id = `${id}-checkbox-${index}`;
            // ✅ Consistent name for grouped checkboxes
            roleCheckbox.name = 'selectedRoles';
            // ✅ Optional: include role label as data
            roleCheckbox.dataset.day = role.name;

            roleCheck.appendChild(roleCheckbox);

            const multiRoleEmoji = document.createElement('mark');
            multiRoleEmoji.classList.add('multiRoleEmoji');
            const roleColor = getComputedStyle(document.documentElement).getPropertyValue(
                `--role-${role.colorIndex}-color`
            );
            roleCheck.style.backgroundColor = roleColor;
            multiRoleEmoji.style.backgroundColor = roleColor;
            multiRoleEmoji.innerHTML = role.emoji;
            multiRoleEmoji.title = role.name;

            roleCheck.appendChild(multiRoleEmoji);
            checkboxesContainer.appendChild(roleCheck);
        });

        roleElement.appendChild(checkboxesContainer);

    } else if (id.toLowerCase() === 'g0') {

        const singleRoleSelection = document.createElement('select');
        singleRoleSelection.classList.add('role-select', 'noto');

        // ✅ Set a unique ID and inputID
        singleRoleSelection.id = `${id}-select`;
        singleRoleSelection.name = 'roleIndicee';

        ruleRoles.forEach((role, index) => {
            if (['❓', 'keine', '?', 'name'].includes(role.name)) return;

            const singleRoleOption = document.createElement('option');
            const roleColor = getComputedStyle(document.documentElement).getPropertyValue(
                `--role-${role.colorIndex}-color`
            );
            singleRoleOption.style.backgroundColor = roleColor;
            singleRoleOption.innerHTML = `${role.emoji} ⇨ ${role.name}`;
            singleRoleOption.title = role.name;
            singleRoleOption.value = index;
            singleRoleSelection.appendChild(singleRoleOption);
        });

        // Initial background color for select
        const firstRole = ruleRoles.find((role) => !['❓', 'keine', '?', 'name'].includes(role.name));
        if (firstRole) {
            const initialColor = getComputedStyle(document.documentElement).getPropertyValue(
                `--role-${firstRole.colorIndex}-color`
            );
            singleRoleSelection.style.backgroundColor = initialColor;
        }

        // Handle style update on change
        singleRoleSelection.addEventListener('change', (event) => {
            const selectedOption = singleRoleSelection.options[singleRoleSelection.selectedIndex];
            singleRoleSelection.style.backgroundColor = selectedOption.style.backgroundColor;
        });

        roleElement.appendChild(singleRoleSelection);
    }

    let roleCell;
    if (id[0] === id[0].toLowerCase()) {
        roleCell = document.getElementById('ex-task-cell');
    } else {
        roleCell = document.getElementById('task-cell');
    }

    roleCell.innerHTML = '';
    roleCell.appendChild(roleElement);
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

    let inputObject = {
        id: id,
        inputID: "topCell",
        value: id
    };

    const exceptionCell = document.getElementById('exception-cell');
    exceptionCell.innerHTML = '';

    const exceptionLabel = document.createElement('div');
    exceptionLabel.classList.add('noto');
    exceptionLabel.innerHTML = exceptionTexts[id] || 'Unbekannte Ausnahme';

    exceptionCell.appendChild(exceptionLabel);

    handleInput(inputObject);
}


function handleTopCellNumberInput(id) {
    const container = document.createElement('div');
    container.classList.add('inputRow');

    const numLabel = document.createElement('span');
    numLabel.classList.add('noto');

    const input1 = document.createElement('input');
    input1.type = 'number';
    input1.classList.add('rule-number-input');
    input1.value = 1; // Default value
    input1.id = id + '-number1';

    const input2 = document.createElement('input');
    input2.type = 'number';
    input2.classList.add('rule-number-input');
    input2.value = 2; // Default value
    input2.id = id + '-number2';

    let inputObject = {
        "id": id,
        "inputID": "topCell",
        "value": null
    };

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
            numLabel.innerHTML = 'niemals';
            container.append(numLabel);
            break;

        case 'w3':
            numLabel.innerHTML = ' x pro 🕒 <i style="color:silver;">(Monat/Woche)</i>';
            container.append(input1, numLabel);
            break;

        case 'a0':
            numLabel.innerHTML = 'alle';
            container.append(numLabel);
            break;

        case ("a1"): // about 🧩
            numLabel.innerHTML = 'ungefähr: ';
            container.append(numLabel, input1);
            break;

        case ("a2"): // no 🧩  
            numLabel.innerHTML = 'keine(r) ';
            container.append(numLabel);
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

        case ("a6"): // percent 🧩
            // numberType = 'ratio';
            numLabel.innerHTML = 'prozent von 🧩';
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
    console.log(' first character from ' + id + " ==> " + firstChar);
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

function handleDynamicInputChange(event) {
    const element = event.target;

    const idParts = element.id.split('-');
    if (idParts.length < 2) {
        console.warn("Invalid ID format:", element.id);
        return;
    }

    const elementId = idParts[0];
    const inputID = idParts[1];
    let index = idParts.slice(2).join('-');

    console.log(`Element ID: ${elementId} | Input ID: ${inputID} | Extra Info: ${index}`);

    let value;

    if (element.type === 'number') {
        value = parseFloat(element.value) || 0;
    } else if (element.tagName === 'SELECT') {
        value = element.value;
    } else if (element.type === 'checkbox') {

        const parentContainer = element.closest('.inputRow') || element.closest('tbody');
        const checkboxes = parentContainer.querySelectorAll(`input[type="checkbox"][name="${element.name}"]`);
        value = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.dataset.day || cb.id || cb.value);
    } else {
        value = element.value;
    }

    const inputObject = {
        id: elementId,
        inputID: inputID,
        value: value
    };

    console.log("Dynamically Constructed Input:", inputObject);
    handleInput(inputObject);
}


function handleInput(inputObject) {
    console.log("Received Input:", inputObject);

    const noSelectionIDs = ['W0', 'T0', 'E0'];
    const mandatoryDefaultIds = ['A0', 'G0', 'D0'];
    const singleLevelIds = ['W1', 'W2', 'T3', 'T4', 'A0', 'A2', 'D0', 'D1', 'E0', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6'];


    // if (singleLevelIds.includes(inputObject.id)) {
    //     console.log("Single-level input detected, processing immediately...");
    // 
    //     processSingleLevelInput(inputObject);
    //     return;
    // }

    const checkedRule = checkInput(inputObject);
    console.log("Checked Rule:", checkedRule);

    const machineRule = updateMachineRule(checkedRule);
    console.log("Machine Rule:", machineRule);

    const humanRule = updateHumanRule(machineRule);
    console.log("Human Rule:", humanRule);

    updateWizzard(inputObject);
    // displayResults(checkedRule, machineRule, humanRule);
}

// function processSingleLevelInput(inputObject) {
//     console.log("Processing single-level input:", inputObject);

// Skip checking & machine conversion → Store directly
// rules[inputObject.id] = inputObject;

// Update UI instantly
// const exceptionCell = document.getElementById('exception-cell');
// exceptionCell.innerHTML = exceptionTexts[inputObject.id] || 'Unbekannte Ausnahme';

// console.log("UI updated:", exceptionCell.innerHTML);
// }

function displayResults(checked, machine, human) {
    document.getElementById("checkedRule").innerText = JSON.stringify(checked, null, 2);
    document.getElementById("machineRule").innerText = JSON.stringify(machine, null, 2);
    document.getElementById("humanRule").innerText = human;
}

