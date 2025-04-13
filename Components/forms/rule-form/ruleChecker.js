import { roles } from "../../../js/loader/role-loader.js";
import { toggleExceptionTable } from "./ruleFlowWizzard.js";
import { getTotalEmployeesByRole } from "../../../js/loader/employee-loader.js";
import { updateMachineRule } from "./machineReadableRules.js";

const newRule = {
    "W": { "id": "W0", "number1": 0, "number2": Infinity },
    "T": { "id": "T0", "words": [] },
    "A": { "id": "A0", "number1": 0, "number2": Infinity },
    "G": { "id": "G0", "words": [] },
    "D": { "id": "D0", "number1": 0, "words": [] },
    "E": { "id": "E0" },
    "w": { "id": "w0", "number1": 0, "number2": Infinity },
    "t": { "id": "t0", "words": [] },
    "a": { "id": "a0", "number1": 0, "number2": Infinity },
    "g": { "id": "g0", "words": [] },
    "d": { "id": "d0", "number1": 1, "words": [] }
};

const ruleRelations = [
    { id: 'd0', forbidden: ['t4'], mandatory: ['exception'], warning: 'contradiction' },
    { id: 'd1', forbidden: ['t4'], mandatory: [], warning: 'unnecessary' },
    { id: 't4', forbidden: ['d0', 'd1'], mandatory: ['repeats'], warning: 'contradiction' },
];

const warnings = [];

let currentRule = {};

export function initVisibilityChecker() {
    // Assuming you have a function to handle visibility control
    const checker = document.getElementById('visibility-checker');
    if (checker) {
        checker.addEventListener('change', toggleSaveButtonVisibility);
    }
}

function toggleSaveButtonVisibility(event) {
    const saveButton = document.getElementById('save-rule-button');
    if (saveButton) {
        // Assuming checker controls visibility logic
        saveButton.style.display = event.target.checked ? 'block' : 'none';
    }
}

export function resetRule() {
    console.log(" inout object was reset");
    currentRule = JSON.parse(JSON.stringify(newRule));
    warnings.length = 0;
    updateMachineRule(currentRule);
}

export function loadRule(ruleData) {
    if (!ruleData || typeof ruleData !== "object") {
        console.error("Invalid rule data provided.");
        return;
    }
    currentRule = JSON.parse(JSON.stringify(ruleData));

    warnings.length = 0; // Clear warnings from previous rule
    console.log("Rule loaded:", currentRule);
}


function checkTimeframe(currentDay, startDay, endDay) {

    return currentDay < startDay && currentDay > endDay
}

function checkShift(currentShift, shift) {
    const incompatibleShifts = {
        morning: ['afternoon'],
        afternoon: ['morning'],
    };
    return !incompatibleShifts[currentShift]?.includes(shift);
}

function checkDependencies(id, role1, role2, ratio1, ratio2) {

    switch (id.toLowerCase()) {
        case "d0": // anwesend
            return role1 > 0;
        case "d1": // abwesend
            return role1 < 1;
        case "d2": // braucht
            // return role2 > ratio * role1;
            break;
        case "d3": // hilft
            // return role1 < ratio * role1;
            break;
        case "d4": // im Verhältnis 🧩
            return role1 * ratio1 < role2 * ratio2;
    }
}

export function checkInput(inputObject) {
    const category = inputObject.id[0];

    updateCurrentRule(category, inputObject);
    checkRuleConsistency();
    showWarnings();

    console.log("Current Rule:", currentRule);

    return { ...currentRule };
}


function updateCurrentRule(category, inputObject) {
    if (!currentRule[category]) {
        console.warn(`Unknown category: ${category}`);
        return;
    }

    currentRule[category].id = inputObject.id;

    // 🔹 Handle rules that only update words
    if (["t2", "T2"].includes(inputObject.id)) {
        currentRule[category].words = inputObject.words;
        return;
    }

    // 🔹 Handle rules that update both numbers and words
    if (["w3", "W3"].includes(inputObject.id)) {
        currentRule[category].words = inputObject.words;
        currentRule[category].number1 = inputObject.number1;
        checkNumberInput(inputObject.id, inputObject.number1);
        return;
    }

    // 🔹 Handle "A" or "a" followed by specific numbers
    if (["a", "A"].includes(inputObject.id[0]) && "14568".includes(inputObject.id[1])) {
        currentRule[category].words = inputObject.words;
        if (["a", "A"].includes(inputObject.id[0]) && "14568".includes(inputObject.id[1])) {
            currentRule[category].words = inputObject.words;

            if (inputObject.id.length > 2 && inputObject.id[2] === "-") {
                if (inputObject.id[3] === "1") currentRule[category].number1 = inputObject.number1;
                if (inputObject.id[3] === "2") currentRule[category].number2 = inputObject.number2;

                inputObject.id = inputObject.id.substring(0, inputObject.id.length - 2);
            } else {
                currentRule[category].number1 = inputObject.number1;
            }

            checkNumberInput(inputObject.id, inputObject.number1);
            return;
        }
        checkNumberInput(inputObject.id, inputObject.number1);
        return;
    }

    if (["d2", "D2", "d3", "D3"].includes(inputObject.id)) {
        currentRule[category].number1 = inputObject.number1;
        checkNumberInput(inputObject.id, inputObject.number1);
        return;
    }

    if (["d4", "D4", "a3", "A3"].includes(inputObject.id)) {
        Object.assign(currentRule[category], {
            words: inputObject.words,
            number1: inputObject.number1,
            number2: inputObject.number2
        });
        checkNumberInput(inputObject.id, inputObject.number1);
        checkNumberInput(inputObject.id, inputObject.number2);
        return;
    }

    // 🔹 Handle Group-based Rules (G)
    if (["g0", "G0"].includes(inputObject.id)) {
        currentRule[category].words = inputObject.words.length > 0 ? inputObject.words[0] : roles[0];
        return;
    }

    if (["g1", "G1", "G2", "G3"].includes(inputObject.id)) {
        currentRule[category].words = inputObject.words.length > 1
            ? inputObject.words
            : [inputObject.words.length > 0 ? inputObject.words[0] : roles[0]];
        return;
    }
}

function checkNumberInput(id, number) {
    if (isTotalNumber(id)) {
        let roleID;
        if (id[0] === "A") roleID = currentRule.G.words[0];
        if (id[0] === "a") roleID = currentRule.g.words[0];

        const minimum = getTotalEmployeesByRole(roleID);
        if (number < minimum) warnings.push(`🟡 Number for ${id} is too low (Minimum: ${minimum})`);
        return;
    }

    if (number < 0) {
        warnings.push(`🟡 Invalid number for ${id}: Cannot be negative.`);
    }
}

export function isTotalNumber(id) {
    const totalIds = ["w3", "a1", "a3", "a4", "a5", "a8"];  // Absolute numbers
    const relativeIds = ["d2", "d3", "d4", "a6"];  // Ratio-based, includes percentage

    if (totalIds.includes(id.toLowerCase())) return true;
    if (relativeIds.includes(id.toLowerCase())) return false;

    console.warn(`Unknown number type for ID: ${id}`);
    return null;
}

function sortWarnings() {
    warnings.sort(warning => {
        if (warning.includes("🔴")) return -3; // Critical
        if (warning.includes("❌")) return -2; // Contradiction
        if (warning.includes("🟡")) return -1; // Restrictive
        return 0; // Redundant
    });
}


function showWarnings() {
    sortWarnings(); // Sort before displaying

    const ruleCheckCell = document.getElementById("rule-check");
    if (!ruleCheckCell) return;

    ruleCheckCell.innerHTML = ""; // Clear old warnings

    if (warnings.length === 0) {
        ruleCheckCell.innerHTML = "<span style='color:green;'>✅ No issues detected.</span>";
        return;
    }

    const list = document.createElement("ul");
    list.style.padding = "0";
    list.style.margin = "0";

    warnings.forEach(warning => {
        const listItem = document.createElement("li");
        listItem.textContent = warning;
        listItem.style.listStyle = "none";
        listItem.style.fontSize = "0.9em";

        if (warning.includes("🔴")) listItem.style.color = "red";
        if (warning.includes("❌")) listItem.style.color = "orange";
        if (warning.includes("🟡")) listItem.style.color = "goldenrod";
        if (warning.includes("⚪️")) listItem.style.color = "gray";

        list.appendChild(listItem);
    });

    ruleCheckCell.appendChild(list);
}


function validateInput(id) {
    if (!id || typeof id !== 'string') {
        console.error(`Invalid input ID provided: "${id}"`);
        return;
    }

    const inputToCheck = ruleRelations.find(rule => rule.id === id);

    if (!inputToCheck) {
        console.warn(`No rules found for ID: "${id}"`);
        return;
    }
    inputToCheck.forbidden.forEach(option => {

        const optionElement = getOptionByID(option);
        if (optionElement) {
            warnings.push(option.warn);
        } else {
            console.warn(`Option with ID "${option}" not found in the DOM.`);
        }
    });
    console.log(warnings);
}

function getOptionByID(id) {
    if (!id || typeof id !== 'string') {
        console.error(`Invalid ID provided: "${id}"`);
        return null;
    }
    const element = document.getElementById(id);
    return element || null;
}

function validateBasicConstraints(id, rule) {
    // TODO: Ensure required fields exist and are valid
    return true;
}

function validateRelations(id) {
    // TODO: Check rule contradictions or missing dependencies
    return true;
}

function applyExceptions(id) {
    // TODO: Handle exceptions using checkException()
}

export function checkRuleConsistency() {
    warnings.length = 0; // Clear previous warnings

    ruleRelations.forEach(relation => {
        const { id, forbidden, mandatory, warning } = relation;
        const category = id[0];

        if (!currentRule[category] || currentRule[category].id !== id) return;

        // 🔹 Contradictions
        forbidden.forEach(forbiddenId => {
            const forbiddenCategory = forbiddenId[0];
            if (currentRule[forbiddenCategory]?.id === forbiddenId) {
                warnings.push(`❌ Rule ${id} conflicts with ${forbiddenId} (${warning})`);
            }
        });

        // 🔹 Missing Mandatory Rules
        mandatory.forEach(mandatoryId => {
            const mandatoryCategory = mandatoryId[0];
            if (!currentRule[mandatoryCategory] || currentRule[mandatoryCategory].id !== mandatoryId) {
                warnings.push(`🔴 Rule ${id} is missing required rule ${mandatoryId}`);
            }
        });

        // 🔹 Unnecessary & Restrictive Checks
        if (isRuleRedundant(id)) warnings.push(`⚪️ Rule ${id} is redundant.`);
        if (isRuleOverlyRestrictive(id)) warnings.push(`🟡 Rule ${id} is too restrictive.`);
    });
}


function isRuleRedundant(id) {
    // Example: If "manager is on a business trip", we already know "manager is not in office".
    if (id === "d1" && currentRule.d && currentRule.d.id === "d0") {
        return true; // "Absent" is redundant if "Present" rule already exists
    }
    return false;
}

function isRuleOverlyRestrictive(id) {
    // Example: If the rule forces an employee to work **every Saturday** without exceptions.
    if (id === "mandatory_saturday" && getTotalEmployeesByRole("cook") === 1) {
        return true; // The only cook would **never** get a Saturday off
    }
    return false;
}


function testNewRuleInCalendar() { };