/**
 * COMMIT PATH
 * -----------
 * - Builds and MUTATES the global machineRuleset
 * - Used by:
 *   • calendar rendering
 *   • day-of-request recommendations
 *   • loading rules from storage
 *
 * ❌ MUST NOT be used for:
 *   • testing
 *   • preview
 *   • sanity checks
 *   • rule creation UX
 */

const desiredRuleFormat = {
    id: 0,
    conditionLink: '',
    dominantCondition: {
        timeframeSlots: [], //number[] | string[],
        timeframeLogicOperator: 'AND' | 'OR' | 'EXACT' | 'CORRUPT',
        timeframeThreshold: null, // number | null,  // only for EXACT
        subjectRoles: [],
        referenceRoles: [],
        roleLogicOperator: '',
        lowerLimit: 0,
        upperLimit: Infinity,
    },
    submissiveCondition: {
        timeframeSlots: [], //number[] | string[],
        timeframeLogicOperator: 'AND' | 'OR' | 'EXACT' | 'CORRUPT',
        timeframeThreshold: null, // number | null,  // only for EXACT
        subjectRoles: [],
        referenceRoles: [],
        roleLogicOperator: '',
        lowerLimit: 0,
        upperLimit: Infinity,
    }
}

const DAY_UNIVERSE = [0, 1, 2, 3, 4, 5, 6];
const SHIFT_UNIVERSE = ['early', 'day', 'late'];
const SPECIAL_UNIVERSE = ['BUSINESS', 'PTO', 'SCHOOL', 'UNPLANED'];


let machineRuleset = {};

function invertTimeslots(timeslots, universe) {
    return universe.filter(slot => !timeslots.includes(slot));
}

function mapThresholdToOperator(repeatId, threshold) {
    switch (repeatId) {
        case 'w0': case 'w1': case 'w2': return 'AND';
        case 'w3': case 'w4': return 'EXACT';
        default: return 'CORRUPT';
    }
}

function createRuleset(ruleset) {

    if (!ruleset) ruleset = {};

    if (!ruleset.weekly) ruleset.weekly = [];
    if (!ruleset.daily) ruleset.daily = [];
    if (!ruleset.shiftly) ruleset.shiftly = [];
    if (!ruleset.special) ruleset.special = [];
    if (!ruleset.corrupted) ruleset.corrupted = [];

    return ruleset;
}

function createAlwaysTrue() {
    return {
        timeframeSlots: [0, 1, 2, 3, 4, 5, 6],
        timeframeLogicOperator: 'OR',
        subjectRoles: [],
        referenceRoles: [],
        roleLogicOperator: 'TOTAL',
        lowerLimit: 0,
        upperLimit: Infinity,
    }
}

function translateToMachineRules(inputRule, id) {
    const rules = [];

    // always create the positive rule
    const positiveRule = translateToMachine(inputRule, id);
    if (positiveRule) {
        rules.push(positiveRule);
    }

    // check for ONLY (W3)
    const hasOnly =
        inputRule?.main?.repeat?.id === 'W3' ||
        inputRule?.secondary?.repeat?.id === 'W3';

    if (!hasOnly) {
        return rules;
    }

    // create negative rule
    const negativeRule = createNegativeOnlyRule(inputRule, id);
    if (negativeRule) {
        rules.push(negativeRule);
    }

    return rules;
}


function translateToMachine(inputRule, id = 'test') {
    if (!inputRule) return null;

    // console.log("input rule", inputRule);

    if (!inputRule.main) {
        console.error("No main condition inside a rule");
        return;
    }

    // Normalize main condition locally
    const main = {
        ...inputRule.main,
        exception: {
            ...(inputRule.main?.exception ?? {}),
            id: inputRule.main?.exception?.id ?? 'E0'
        }
    };

    // Normalize secondary safely
    const secondary = inputRule.secondary ? normalizeCondition(inputRule.secondary) : null;

    const safeCreateCondition = (cond) => createCondition(cond ?? null);

    let conditionLink = '';
    let _dominant = createAlwaysTrue();
    let _submissive = createAlwaysTrue();

    switch (main.exception.id) {
        case 'E0':
            _dominant = safeCreateCondition(main);
            conditionLink = 'SINGLE';
            break;
        case 'E1':
            _dominant = safeCreateCondition(main);
            _submissive = safeCreateCondition(secondary);
            conditionLink = 'AND';
            break;
        case 'E2':
            _dominant = safeCreateCondition(main);
            _submissive = safeCreateCondition(secondary);
            conditionLink = 'OR';
            break;
        case 'E3':
        case 'E4':
        case 'E5':
        case 'E6':
            _dominant = safeCreateCondition(secondary);
            _submissive = safeCreateCondition(main);
            conditionLink = 'UNLESS';
            break;
        default:
            _dominant = safeCreateCondition(secondary);
            _submissive = safeCreateCondition(main);
            conditionLink = 'CORRUPT';
            break;
    }

    return {
        id: String(id),
        dominantCondition: _dominant,
        submissiveCondition: _submissive,
        conditionLink,
    };
}

function createNegativeOnlyRule(inputRule, id) {
    const cloned = structuredClone(inputRule);

    // determine which condition has ONLY
    const target =
        cloned.main?.repeat?.id === 'W3'
            ? cloned.main
            : cloned.secondary;

    if (!target) return null;

    const normalized = normalizeCondition(target);
    const universe = pickUniverse(normalized.timeframe.id);

    const slots = normalized.timeframe.details.slots ?? [];
    const inverted = invertTimeslots(slots, universe);

    // replace slots
    target.timeframe.details.slots = inverted;

    // convert ONLY → EXACT 0
    target.repeat = {
        id: 'W4',
        details: { number: 0 }
    };

    // ⚠️ reuse your existing logic
    return translateToMachine(cloned, id);
}


function pickUniverse(timeframeId) {
    switch (timeframeId) {
        case 't1': return SHIFT_UNIVERSE;
        case 't5': return SPECIAL_UNIVERSE;
        default: return DAY_UNIVERSE;
    }
}


function createCondition(condition) {
    if (!condition) return createAlwaysTrue(); // fallback

    // Helper: safe lowercase
    const safeId = (obj) => (obj?.id ?? "").toLowerCase();
    const safeDetails = (obj) => obj?.details ?? {};

    // --- Timeframe / Repeat ---
    const repeatId = safeId(condition.repeat) || "w0";
    const timeframeId = safeId(condition.timeframe) || "t0";

    // console.log(repeatId, timeframeId);

    let timeframeSlots = [0, 1, 2, 3, 4, 5, 6];
    let timeframeThreshold = 0;

    switch (repeatId) {
        case "w0":
        case "w1":
            if (["t1", "t2"].includes(timeframeId)) {
                timeframeSlots = [].concat(safeDetails(condition.timeframe).days || []);
            }
        case "w2":
            timeframeThreshold = 1;
            break;
        case "w3": // ONLY
            timeframeThreshold = 0;
            if (["t1", "t2"].includes(timeframeId)) {
                timeframeSlots = [].concat(safeDetails(condition.timeframe).days || []);
            } else {
                timeframeThreshold = -1;
            }
            break;
        case "w4": // EXACT X
            timeframeThreshold = safeDetails(condition.repeats).number ?? 0;
            break;
        default:
            timeframeThreshold = -1;
            break;
    }

    // --- Role handling ---
    let subjectRoles = [];
    let referenceRoles = [];
    let roleLogicOperator = "total";

    let dependencyId = safeId(condition.dependencies);
    const groupDetails = safeDetails(condition.group ?? condition.groups);

    if (dependencyId === "d0") { // presence
        roleLogicOperator = "total";
        subjectRoles = groupDetails.roles ?? [];
    } else if (dependencyId === "d2") { // needs
        subjectRoles = safeDetails(condition.dependencies).role ?? [];
        referenceRoles = groupDetails.roles ?? [];
    } else if (dependencyId === "d3") { // helps
        referenceRoles = safeDetails(condition.dependencies).role ?? [];
        subjectRoles = groupDetails.roles ?? [];
    } else {
        roleLogicOperator = "corrupt";
    }

    // --- Ratio / Limits ---
    let ratioType = "total";
    let lowerLimit = 0;
    let upperLimit = Infinity;
    const amountId = safeId(condition.amount);

    if (roleLogicOperator === "total") {
        const amountDetails = safeDetails(condition.amount);
        switch (amountId) {
            case "a1": // approximately
                lowerLimit = Math.max(1, Math.floor(0.9 * (amountDetails.bottom ?? 0)));
                upperLimit = Math.ceil(1.1 * (amountDetails.top ?? 0));
                break;
            case "a3": // between
                lowerLimit = Math.round(amountDetails.bottom ?? 0);
                upperLimit = Math.round(amountDetails.top ?? 0);
                break;
            case "a4": // max
                lowerLimit = 0;
                upperLimit = Math.round(amountDetails.top ?? Infinity);
                break;
            case "a5": // min
                lowerLimit = Math.round(amountDetails.bottom ?? 0);
                upperLimit = Infinity;
                break;
            case "a8": // exact
                lowerLimit = upperLimit = Math.round(amountDetails.bottom ?? 0);
                break;
            default:
                lowerLimit = upperLimit = -1;
                break;
        }
    } else { // ratio checks
        const groupAggregation = (condition.group?.id ?? "g0").toLowerCase();
        dependencyId = (condition.dependency?.id ?? "d0").toLowerCase();
        // console.log(dependencyId, groupAggregation);
        if (dependencyId === "d2") { // needs
            ratioType = ["g0", "g1"].includes(groupAggregation) ? 'WORKLOAD' : 'PRESENCE';
        } else if (dependencyId === "d3") { // helps
            ratioType = ["g0", "g1"].includes(groupAggregation) ? 'CAPACITY' : 'SUPERVISION';
        } else {
            ratioType = "corrupt";
        }
        // console.log(ratioType);
    }

    return {
        timeframeSlots,
        timeframeLogicOperator: mapThresholdToOperator(repeatId, timeframeThreshold),
        timeframeThreshold: timeframeThreshold,
        subjectRoles,
        referenceRoles,
        roleLogicOperator,
        ratioType,
        ratio: safeDetails(condition.dependencies).number ?? 0,
        lowerLimit,
        upperLimit,
    };
}

export function updateRuleset(storedRuleset) {
    if (!Array.isArray(storedRuleset) || !storedRuleset.length) {
        console.warn('⚠️ No rules provided, using empty ruleset');
        machineRuleset = createRuleset();
        return machineRuleset;
    }

    // console.log("stored ruleset:", storedRuleset);

    machineRuleset = createRuleset(machineRuleset);
    fillRulesetFromUiRules(machineRuleset, storedRuleset);

    return machineRuleset;
}


export function updateRulesPreview(ruleForPreview) {
    const previewRuleset = createRuleset();
    fillRulesetFromUiRules(previewRuleset, ruleForPreview);

    return previewRuleset;
}

function fillRulesetFromUiRules(targetRuleset, storedRuleset) {
    storedRuleset.forEach((uiRule, index) => {
        const machineRules = translateToMachineRules(uiRule, index + 1);

        machineRules.forEach(machineRule => {
            const dominant = machineRule.dominantCondition;
            const slots = dominant.timeframeSlots;
            const op = dominant.timeframeLogicOperator;

            // ---- special / shiftly ----
            if (slots.some(s => SPECIAL_UNIVERSE.includes(s))) {
                targetRuleset.special.push(machineRule);
            }
            else if (slots.some(s => typeof s === "string")) {
                targetRuleset.shiftly.push(machineRule);
            }


            // ---- weekly ----
            if (op === "OR" || op === "EXACT") {
                targetRuleset.weekly.push(machineRule);
            }

            // ---- daily ----
            if (op === "AND") {
                targetRuleset.daily.push(machineRule);
            }
        });
    });

    return targetRuleset;
}

function normalizeCondition(condition) {
    return {
        ...condition,
        timeframe: {
            ...condition.timeframe,
            id: condition.timeframe?.id ?? "T0",
            details: condition.timeframe?.details ?? {},
        },
        repeat: {
            ...condition.repeat,
            id: condition.repeat?.id ?? "W0",
            details: condition.repeat?.details ?? {},
        }
    };
}
