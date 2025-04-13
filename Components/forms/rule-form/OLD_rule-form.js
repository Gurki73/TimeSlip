import { roles as rolesPromise } from '../../../js/loader/role-loader.js';
import { loadOfficeDaysData } from '../../../js/loader/calendar-loader.js';
import { checkInput, resetRule, initVisibilityChecker } from './ruleChecker.js';
import { toggleExceptionTable, updateWizzard } from './ruleFlowWizzard.js';
import { updateMachineRule, initMachineRule } from './machineReadableRules.js';
import { updateHumanRule } from './humanReadableRules.js';

let ruleRoles;
let ruleOfficeDays;
let api;

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
    toggleExceptionTable(false);
    initializeInputFunctions();
    createRoles('G0');
    createNumberInput('A1');
    createDependency('D0');
    updateEventListener();
    initMachineRule();
    initVisibilityChecker();
}


function initializeInputFunctions() {

    const mainRepeatSelect = document.getElementById('request-type-select-repeats');
    mainRepeatSelect.addEventListener('change', (event) => createNumberInput(event.target.value));

    const mainTimeSelect = document.getElementById('request-type-select-time');
    mainTimeSelect.addEventListener('change', (event) => createTimeFrame(event.target.value));

    const mainAmountSelect = document.getElementById('request-type-select-amount');
    mainAmountSelect.addEventListener('change', (event) => createNumberInput(event.target.value));

    const mainGroupSelect = document.getElementById('request-type-select-group');
    mainGroupSelect.addEventListener('change', (event) => createRoles(event.target.value));

    const mainDependicySelect = document.getElementById('request-type-select-dependency');
    mainDependicySelect.addEventListener('change', (event) => createDependency(event.target.value));

    const mainExceptionSelect = document.getElementById('request-type-select-exception');
    mainExceptionSelect.addEventListener('change', (event) => createException(event.target.value));

    const exRepeatSelect = document.getElementById('ex-request-type-select-repeats');
    exRepeatSelect.addEventListener('change', (event) => createNumberInput(event.target.value));

    const exTimeSelect = document.getElementById('ex-request-type-select-time');
    exTimeSelect.addEventListener('change', (event) => createTimeFrame(event.target.value));

    const exAmountSelect = document.getElementById('ex-request-type-select-amount');
    exAmountSelect.addEventListener('change', (event) => createNumberInput(event.target.value));

    const exGroupSelect = document.getElementById('ex-request-type-select-group');
    exGroupSelect.addEventListener('change', (event) => createRoles(event.target.value));

    const exDependencySelect = document.getElementById('ex-request-type-select-dependency');
    exDependencySelect.addEventListener('change', (event) => createDependency(event.target.value));
}

function createDependency(id) {

    const dependencyElement = document.createElement('div');
    const input1 = document.createElement('input');
    input1.type = 'number';
    input1.classList.add('noto', 'rule-number-input');
    input1.value = 1;
    input1.id = id + '-1';

    const input2 = document.createElement('input');
    input2.type = 'number';
    input2.classList.add('noto', 'rule-number-input')
    input2.value = 2;
    input2.id = id + '-2';

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

    let inputObject = { "id": id, "number1": 0, "number2": 0, "words": [] };

    switch (id.toLowerCase()) {
        case "d0": // anwesend
            label.innerHTML = 'anwesend';
            dependencyElement.append(label);
            handleInput(inputObject);
            break;

        case "d1": // abwesend
            label.innerHTML = 'abwesend';
            dependencyElement.append(label);
            handleInput(inputObject);
            break;

        case "d2": // braucht
            label.innerHTML = 'braucht';
            inputObject.number1 = input1.value;
            inputObject.words = [dependencyRoleSelection.value];
            handleInput(inputObject);
            dependencyElement.append(input1, label, dependencyRoleSelection);
            break;

        case "d3": // hilft
            label.innerHTML = 'hilft';
            inputObject.number1 = input1.value;
            inputObject.words = [dependencyRoleSelection.value];
            handleInput(inputObject);
            dependencyElement.append(input1, label, dependencyRoleSelection);
            break;

        case "d4": // im Verhältnis 🧩
            label.innerHTML = ' <= 🧩 ';
            inputObject.number1 = input1.value;
            inputObject.number2 = input2.value;
            inputObject.words = [dependencyRoleSelection.value];
            handleInput(inputObject);
            dependencyElement.append(label, input1, dependencyRoleSelection, input2);
            break;

        default:
            console.error("no match for dependency rule " + id);
            return;
    }
}


function createTimeFrame(id) {

    let inputObject = { "id": id, "number1": 0, "number2": 0, "words": [] };
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
                workdayCheckbox.id = `workday-${workday.id}`;
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
            handleInput(inputObject);
            break;
        case 't4':
            timeFrameElement.innerHTML = 'Monat';
            checkInput(id, 'Monat');
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
                checkbox.id = id + '-' + index;

                const label = document.createElement('label');
                label.htmlFor = checkbox.id;
                label.style = "max-height: 1.5rem;";
                label.textContent = reason;
                label.classList.add('reason-label', 'noto');

                reasonRow.appendChild(checkbox);
                reasonRow.appendChild(label);
                outOfOfficeElement.appendChild(reasonRow);

                checkboxes.push(checkbox);

                // Listen for checkbox changes
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
    updateEventListener();
}

function createRoles(id) {

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
            roleCheck.style = "display: flex; align-items: center; width: 20%;  border-radius: 6px;"; // Adjust to 20% for 5 items per row

            const roleCheckbox = document.createElement('input');
            roleCheckbox.type = 'checkbox';
            roleCheckbox.id = id + '-' + index;
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
        singleRoleSelection.id = id + '-1';
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

        if (ruleRoles.length > 0) {
            const firstRole = ruleRoles.find((role) => !['❓', 'keine', '?', 'name'].includes(role.name));
            if (firstRole) {
                const initialColor = getComputedStyle(document.documentElement).getPropertyValue(
                    `--role-${firstRole.colorIndex}-color`
                );
                singleRoleSelection.style.backgroundColor = initialColor;
            }
        }

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
    updateEventListener();
}


function createException(id) {

    let inputObject = { "id": id, "number1": 0, "number2": 0, "words": [] };
    const exceptionTexts = {
        E0: ' - - - ',
        E1: 'und',
        E2: 'oder',
        E3: 'aber',
        E4: 'außer',
        E5: 'aber nicht mehr als',
        E6: 'aber nicht weniger',
    };

    if (id !== 'E0') {
        handleInput(inputObject);
    }
    const exceptionElement = document.createElement('div');
    exceptionElement.classList.add('noto');
    exceptionElement.innerHTML = exceptionTexts[id] || 'Unbekannte Ausnahme';

    const exceptionCell = document.getElementById('exception-cell');
    exceptionCell.innerHTML = '';
    exceptionCell.appendChild(exceptionElement);
    updateEventListener();
}

function createNumberInput(id) {

    const container = document.createElement('div');
    container.classList.add('inputRow');

    const numLabel = document.createElement('span');
    numLabel.classList.add('noto');

    const input1 = document.createElement('input');
    input1.type = 'number';
    input1.classList.add('rule-number-input');
    input1.value = 1;
    input1.id = id + '-1';

    const input2 = document.createElement('input');
    input2.type = 'number';
    input2.classList.add('rule-number-input');
    input2.value = 1;
    input2.id = id + '-2';

    let inputObject = {
        "id": id,
        "lowerLimit": parseFloat(input1.value) || 0,
        "upperLimit": parseFloat(input2.value) || Infinity,
        "words": []
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
            checkInput(id, 'keine');
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
    updateEventListener();
    handleInput(inputObject);
}

function updateEventListener() {
    const container = document.getElementById('rule-form-container');

    if (!container) {
        console.error("Error: 'rule-form-container' element not found.");
        return;
    }
    container.removeEventListener('change', handleContainerChange);
    container.addEventListener('change', handleContainerChange);
}

function handleContainerChange(event) {
    const firstTableSelector = '#firstTableSecondSteps input, #firstTableSecondSteps select';
    const secondTableSelector = '#secondTableSecondSteps input, #secondTableSecondSteps select';

    // Ensure the event target is either an input or select inside the two tables
    if (!event.target.matches(`${firstTableSelector}, ${secondTableSelector}`)) return;

    const element = event.target;
    const logMessage = `Element ${element.id} updated: `;

    let parentID = element.id.slice(0, 2); // Assuming this is a parent ID or identifier for the input
    let inputObject = { id: element.id, number1: 0, number2: 0, words: [] };

    switch (true) {
        case (element.type === 'checkbox'):
            console.log(`${logMessage}Checkbox changed to ${element.checked}`);
            inputObject.words = [element.checked ? "checked" : "unchecked"];
            break;

        case (element.tagName === 'SELECT'):
            const selectedOption = element.options[element.selectedIndex];
            if (!selectedOption) return;
            console.log(`${logMessage}Dropdown changed: ${selectedOption.value} - ${selectedOption.title}`);
            inputObject.words = [selectedOption.value];
            break;

        case (element.type === 'number'):
            console.log(`${logMessage}Number input changed to ${element.value}`);

            if (element.id.includes('-2')) {
                inputObject.number2 = parseFloat(element.value) || Infinity;
            } else {
                inputObject.number1 = parseFloat(element.value) || 0;
            }
            break;

        default:
            console.log(`${logMessage}Unhandled element type`);
            return;
    }

    handleInput(inputObject);
}



function handleInput(inputObject) {
    console.log("Received Input:", inputObject);

    const checkedRule = checkInput(inputObject);
    console.log("Checked Rule:", checkedRule);

    const machineRule = updateMachineRule(checkedRule);
    console.log("Machine Rule:", machineRule);

    const humanRule = updateHumanRule(machineRule);
    console.log("Human Rule:", humanRule);

    updateWizzard(inputObject);
    displayResults(checkedRule, machineRule, humanRule);
}

function displayResults(checked, machine, human) {
    document.getElementById("checkedRule").innerText = JSON.stringify(checked, null, 2);
    document.getElementById("machineRule").innerText = JSON.stringify(machine, null, 2);
    document.getElementById("humanRule").innerText = human;
}