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

    if (inputObject.T !== 'T5' && inputObject.t !== 't5') {
        return createRegularRule(inputObject);
    } else {
        return createIrregularRule(inputObject);
    }
}

function createIrregularRule(inputObject) {
    irregularRule = { id: inputObject.T, note: "Irregular rule placeholder" };
    return irregularRule;
}

function createRegularRule(inputObject) {
    const regularRule = {
        W: { id: inputObject.W.id, repeats: inputObject.W.number1 ?? 0 },
        T: { id: inputObject.T.id, level: 'daily', days: [{ day: "mo", shift: "full" }] },
        A: {
            id: inputObject.A.id,
            bottomLimit: inputObject.A.number1 ?? 0,
            upperLimit: inputObject.A.number2 ?? Infinity
        },
        G: {
            id: inputObject.G.id,
            roles: [0, 1, 2],
            isAnd: true
        },
        D: {
            id: inputObject.D.id,
            level: 'daily',
            days: [{ day: "mo", shift: "full" }],
            secondaryRoles: [0, 1, 2],
            isAnd: true,
            Ratio: 1
        },
        E: { id: inputObject.E.id },

        w: { id: inputObject.w.id, repeats: inputObject.w.number1 ?? 0 },
        t: { id: inputObject.t.id, level: 'daily', days: [{ day: "mo", shift: "full" }] },
        a: {
            id: inputObject.a.id,
            bottomLimit: inputObject.a.number1 ?? 0,
            upperLimit: inputObject.a.number2 ?? Infinity
        },
        g: {
            id: inputObject.g.id,
            roles: [0, 1, 2],
            isAnd: true
        },
        d: {
            id: inputObject.d.id,
            level: 'daily',
            days: [{ day: "mo", shift: "full" }],
            secondaryRoles: [0, 1, 2],
            isAnd: true,
            Ratio: 1
        }
    };
    return regularRule;
}


function handleSave() {
    console.log("Save button clicked!");
}