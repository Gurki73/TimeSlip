let regularRule = {};
let irregularRule = {};


export function initMachineRule() {
    // Add event listener to the save button
    const saveButton = document.getElementById("save-rule-button");
    if (saveButton && !saveButton.hasAttribute("data-listener")) {
        saveButton.addEventListener("click", handleSave);
        saveButton.setAttribute("data-listener", "true");
    }
}

export function updateMachineRule(inputObject) {
    irregularRule = {};
    regularRule = {};
    // what if one condition is regular but the other not?
    if (inputObject.T !== 'T5' && inputObject.t !== 't5') {
        return createRegularRule(inputObject);
    } else {
        return createIrregularRule(inputObject);
    }
}

function createIrregularRule(inputObject) {
    /*
    irregular rules are applies when no regular shedule (month, week, day or shift is applied)
    but for situation like homeOffice or tradeSchool

    checkpoint ? not from calendar but from requests
    roles?
    limits?
    */

    irregularRule = { id: inputObject.T, note: "Irregular rule placeholder" };
    return irregularRule;
}

function createRegularRule(inputObject) {
    /*
    Regular rules applies for normal shedule, not for absent roles

    - when to check? month, week, day(s), shift(s), none , all
    - what to count? roles, in or outof office, role to role
    - how many? limits 
    - which logic for second condition?

    ==> two simular checks (condition 1) (logic operator) (condition 2)
    ==> checkpoints (month, week, day(s), shifts)
    ==> if rolr to role check, create a limit for second role based on first role and only check second role simular to standart check
    ==> limits for groups, always as range
    */
    const machineRule = {
        "condition1": {
            isRegular: true,
            checkpoint: [],
            flagType: "daily",
            upperLimit: Infinity,
            bottomLimit: 0,
            leadingRoles: [],
            followingRoles: [],
        },
        "logicOperator": "none",
        "condition2": {
            isRegular: true,
            checkpoint: [],
            flagType: "daily",
            upperLimit: Infinity,
            bottomLimit: 0,
            leadingRoles: [],
            followingRoles: [],
        }
    };
    return regularRule;
}


function handleSave() {
    console.log("Save button clicked!");
}