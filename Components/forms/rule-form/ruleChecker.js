// Components\forms\rule-form\ruleChecker.js

const SHIFTS_PER_DAY = 3;

const BASE_MANDATORY = {
    W: false,
    T: false,
    A: true,
    G: true,
    D: true,
    E: false,

    // secondary defaults
    w: false,
    t: false,
    a: false,
    g: false,
    d: false,
};

const FORBIDDEN_PAIRS = {
    // T0 = empty; T1 = shift;  T2 = Day;  T3 = week; T5 = absence
    // W0 = empty; W1 = always, W2 = Xor;  W3 = only; W4 = per 
    T_W: [['T1', 'W2'], ['T3', 'W2'], ['T5', 'W2'], ['T3', 'W3'], ['T5', 'W3'],
    ['T1', 'W4'], ['T2', 'W4'], ['T5', 'W4']],
    W_T: [['W2', 'T1'], ['W2', 'T3'], ['W2', 'T5'], ['W3', 'T3'], ['W3', 'T5'],
    ['W4', 'T1'], ['W4', 'T2'], ['W4', 'T5']],
};

/**
 * @typedef {Object} LiveSanityResult
 * @property {boolean} blocking - true if mandatory fields are missing
 * @property {string[]} missingMandatory - list of missing mandatory block keys
 * @property {string[]} forbidden - list of block keys that are forbidden
 */

export function runLiveSanity(ruleDraft) {
    const mandatory = deriveMandatory(ruleDraft);
    const missingMandatory = [];

    const mainKeys = ['W', 'T', 'A', 'G', 'D', 'E'];
    mainKeys.forEach(key => {
        if (!mandatory[key]) return;
        const block = ruleDraft.main?.[key];
        if (!isBlockSelected(block)) missingMandatory.push(key);
    });

    const secondaryKeys = ['w', 't', 'a', 'g', 'd'];
    secondaryKeys.forEach(key => {
        if (!mandatory[key]) return;
        const block = ruleDraft.secondary?.[key];
        if (!isBlockSelected(block)) missingMandatory.push(key);
    });

    const forbidden = scanForForbidden(ruleDraft);

    const blocking = missingMandatory.length > 0 || forbidden.length > 0;

    return { blocking, missingMandatory, forbidden };
}

function isBlockSelected(block) {
    if (!block) return false;
    if (!block.id) return false;

    return isBlockSelected(block);
}


function hasBlock(ruleDraft, key) {
    const main = ruleDraft.main?.[key];
    const secondary = ruleDraft.secondary?.[key];
    return !!(main || secondary);
}

function deriveMandatory(ruleDraft) {
    const mandatory = { ...BASE_MANDATORY };

    // --- Core blocks always mandatory ---
    mandatory.A = true;
    mandatory.G = true;
    mandatory.D = true;

    // --- Exceptions E ---
    if (ruleDraft.main?.E && ruleDraft.main.E.value !== 'E0') {
        mandatory.A = true;
        mandatory.G = true;
        mandatory.D = true;
    }

    // --- T/W dynamic dependency ---
    const WSelected = ruleDraft.main?.W ? ruleDraft.main.W.id[1] !== '0' : false;
    const wSelected = ruleDraft.secondary?.w ? ruleDraft.secondary.w.id[1] !== '0' : false;

    mandatory.T = WSelected; // T mandatory if W selected
    mandatory.t = wSelected; // t mandatory if w selected

    // --- Optional: mirror secondary blocks if main is mandatory ---
    if (mandatory.A) mandatory.a = true;
    if (mandatory.G) mandatory.g = true;
    if (mandatory.D) mandatory.d = true;

    return mandatory;
}


function isMandatorySatisfied(ruleDraft, key) {
    const scope = key === key.toUpperCase() ? "main" : "secondary";
    const semanticKey = mapKeyToSemantic(key); // e.g. G → group

    const block = ruleDraft?.[scope]?.[semanticKey];
    return isBlockSelected(block);
}

function createEmptyWeekCube(roleCount) {
    return Array.from({ length: 7 }, () =>
        Array.from({ length: SHIFTS_PER_DAY }, () =>
            Array(roleCount).fill(0)
        )
    );
}

function createWeekCube(attendanceByRole, roleCount) {
    const cube = createEmptyWeekCube(roleCount);

    for (let role = 0; role < roleCount; role++) {
        const roleData = attendanceByRole[role] || [];
        for (let day = 0; day < 7; day++) {
            const shifts = roleData[day] || [0, 0, 0];
            for (let s = 0; s < SHIFTS_PER_DAY; s++) {
                cube[day][s][role] = shifts[s];
            }
        }
    }

    return cube;
}

function sumRuleInCube(condition, cube) {
    let total = 0;

    condition.timeframeSlots.forEach(day => {
        for (let s = 0; s < SHIFTS_PER_DAY; s++) {
            condition.subjectRoles.forEach(role => {
                total += cube[day][s][role] || 0;
            });
        }
    });

    return total;
}

function evaluateCondition(condition, cube) {
    const total = sumRuleInCube(condition, cube);
    const violations = [];

    if (condition.lowerLimit != null && total < condition.lowerLimit) {
        violations.push({
            type: 'TOO_FEW',
            total,
            limit: condition.lowerLimit
        });
    }

    if (condition.upperLimit != null && total > condition.upperLimit) {
        violations.push({
            type: 'TOO_MANY',
            total,
            limit: condition.upperLimit
        });
    }

    return violations;
}

async function updateOfficeDays(api) {
    if (!api) console.error("API was not passed ==> " + api);

    let openOfficeDays = {};

    try {
        openOfficeDays = await loadOfficeDaysData(api);
        if (!Array.isArray(cachedRoles)) {
            console.warn("Roles is not an array, initializing empty array");
            cachedRoles = [];
        }
    } catch (error) {
        console.error('Error during initialization:', error);
        return;
    }
}
async function updateEmployeeShedule(api) {
    if (!api) console.error("API was not passed ==> " + api);

    let employeeShedule = {};
}

async function updateRequests(api) {
    if (!api) console.error("API was not passed ==> " + api);
    let requestList = [];

    constcurrentYear = Date.getFullYear();


}

function evaluateRule(rule, cube) {
    const { dominantCondition, submissiveCondition, conditionLink } = rule;

    const dom = evaluateCondition(dominantCondition, cube);
    const sub = submissiveCondition
        ? evaluateCondition(submissiveCondition, cube)
        : [];

    switch (conditionLink) {
        case 'SINGLE':
            return dom;

        case 'AND':
            return [...dom, ...sub];

        case 'OR':
            return dom.length && sub.length ? [...dom, ...sub] : [];

        case 'UNLESS':
            return sub.length === 0 ? dom : [];

        default:
            return dom;
    }
}

function evaluateRuleset(rules, cube) {
    return rules.flatMap(rule => evaluateRule(rule, cube));
}

function startOfISOWeek(date) {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
}

function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}

function dateKey(date) {
    return date.toISOString().slice(0, 10);
}

function getISOWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    return (
        1 +
        Math.round(
            ((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
        )
    );
}

function collectDayAttendance(requests, dayFacts) {
    const attendance = {};

    if (!dayFacts?.isOfficeOpen) return attendance;

    requests.forEach(({ roleIndex, shift }) => {
        if (!dayFacts.openShifts[shift]) return;

        attendance[roleIndex] ??= [0, 0, 0];

        const idx = shift === 'early' ? 0 : shift === 'day' ? 1 : 2;
        attendance[roleIndex][idx]++;
    });

    return attendance;
}

function buildWeeklyAttendanceCubes(
    from,
    to,
    requestsByDate,
    dayFactsByDate,
    roleCount
) {
    const weeks = [];
    let cursor = startOfISOWeek(from);

    while (cursor <= to) {
        const weekStart = new Date(cursor);
        const cube = createEmptyWeekCube(roleCount);

        for (let d = 0; d < 7; d++) {
            const date = addDays(weekStart, d);
            const key = dateKey(date);

            const dayAttendance = collectDayAttendance(
                requestsByDate[key] || [],
                dayFactsByDate[key]
            );

            Object.entries(dayAttendance).forEach(([role, shifts]) => {
                for (let s = 0; s < SHIFTS_PER_DAY; s++) {
                    cube[d][s][role] += shifts[s];
                }
            });
        }

        weeks.push({
            weekNumber,
            from,
            to,
            cube,
            daysMeta: Array.from({ length: 7 }, (_, i) =>
                dateKey(addDays(weekStart, i))
            )

        });

        cursor = addDays(cursor, 7);
    }

    return weeks;
}

function _normalizeCondition(condition) {

    return {
        weekdays: [0, 1, 2],
        shifts: ['early'],
        specials: [],
        roleScope: {
            subjects: [2, 4, 7],
            references: []
        },
        limits: {
            min: 2,
            max: 5,
            unit: 'WEEK' | 'DAY' | 'SHIFT'
        }
    }
}

function _evaluateConditionOnWeek(condition, weekCube) {
    return {
        violations: [
            {
                unit: 'DAY',
                key: 'Wednesday',
                count: 3,
                limit: 2
            }
        ]
    }
}

function _summarizeViolations(violations, weeksCount) {
    return {
        severity: 'LOW' | 'MEDIUM' | 'HIGH',
        ratio: 0.31,
        breakdown: {
            Wednesday: 16 / 52
        }
    };
}

export function runCalendarRuleCheck(weeklyCubes, ruleset) {
    const results = [];

    weeklyCubes.forEach(week => {
        ruleset.forEach(rule => {
            const violations = evaluateRule(rule, week.cube);

            if (violations.length > 0) {
                results.push({
                    ruleId: rule.id,
                    weekNumber: week.weekNumber,
                    violations
                });
            }
        });
    });

    return results;
}


export function runRulePreview(rule, weeklyCubes) {

    switch (rule.timeslot) {
        case 'weekly':
            return weeklyStatistics;
        case 'daily':
            return dailyStatistics;
        case 'shiftly':
            return shiftlyStatistics;
        case 'special':
            return specialStatistics;
        default: return err;
    }
}

export function runRequestRuleCheck(startDate, endDate, requests) {
    // intentionally empty – implemented later
    return [];
}

export function runRuleTest() {
    const newMachineRule = updateRulesPreview([ruleForEditing]);
    console.log("new machine rule:", newMachineRule);

    return new Promise(resolve => {
        const ok = Math.random() > 0.3;

        resolve({
            ok,
            errors: ok ? [] : [
                {
                    type: "RANDOM_FAILURE",
                    message: "Zufälliger Testfehler 🤡",
                    source: "self"
                }
            ],
            warnings: ok ? [] : [
                {
                    type: "RANDOM_WARNING",
                    message: "Das ist nur ein Platzhalter",
                    source: "self"
                }
            ]
        });
    });
}

function scanForForbidden(ruleDraft) {
    const forbidden = [];

    Object.values(FORBIDDEN_PAIRS).forEach(pairs => {
        pairs.forEach(([first, second]) => {
            // Look through main and secondary blocks for exact match
            const allBlocks = [
                ...(ruleDraft.main ? Object.values(ruleDraft.main) : []),
                ...(ruleDraft.secondary ? Object.values(ruleDraft.secondary) : [])
            ];

            const firstSelected = allBlocks.find(b => b?.id === first);
            const secondSelected = allBlocks.find(b => b?.id === second);

            if (firstSelected && secondSelected) {
                forbidden.push(`${first} + ${second}`);
            }
        });
    });

    return forbidden;
}
