// Components\forms\rule-form\ruleChecker.js
import { runSolver, runSolverPerShift } from './solver.js';
import { updateRulesPreview } from './translatorMachine.js';
import { ensureCalendarReady, computeAttendanceForRange } from '../../calendar/calendar.js';
import { loadRuleData } from '../../../js/loader/rule-loader.js';
import { loadRoleData } from '../../../js/loader/role-loader.js';

const SHIFTS_PER_DAY = 3;
const ROLE_COUNT = 14;

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

let cachedRoleNames = null;

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
        const block = getDraftBlock(ruleDraft, key);
        if (!isBlockSelected(block, key)) missingMandatory.push(key);
    });

    const secondaryKeys = ['w', 't', 'a', 'g', 'd'];
    secondaryKeys.forEach(key => {
        if (!mandatory[key]) return;
        const block = getDraftBlock(ruleDraft, key);
        if (!isBlockSelected(block, key)) missingMandatory.push(key);
    });

    const forbidden = scanForForbidden(ruleDraft);

    const blocking = missingMandatory.length > 0 || forbidden.length > 0;

    return { blocking, missingMandatory, forbidden };
}

function isBlockSelected(block, shortKey = '') {
    if (!block) return false;
    if (block.id == null) return false;

    const upperKey = String(shortKey).toUpperCase();
    if (upperKey === 'G' || upperKey === 'D') return true;

    const id = String(block.id);
    if (id.length < 2) return false;
    return id[1] !== '0';
}

function getDraftBlock(ruleDraft, shortKey) {
    if (!ruleDraft || !shortKey) return null;

    const blockMap = {
        W: 'repeat',
        T: 'timeframe',
        A: 'amount',
        G: 'group',
        D: 'dependency',
        E: 'exception'
    };

    const mappedKey = blockMap[String(shortKey).toUpperCase()];
    if (!mappedKey) return null;

    const isMain = String(shortKey) === String(shortKey).toUpperCase();
    const scope = isMain ? 'main' : 'secondary';
    return ruleDraft?.[scope]?.[mappedKey] ?? null;
}


function deriveMandatory(ruleDraft) {
    const mandatory = { ...BASE_MANDATORY };

    // --- Core blocks always mandatory ---
    mandatory.A = true;
    mandatory.G = true;
    mandatory.D = true;

    // --- Exceptions E ---
    const mainException = getDraftBlock(ruleDraft, 'E');
    const hasSecondaryCondition = Boolean(mainException && mainException.id !== 'E0');
    if (hasSecondaryCondition) {
        mandatory.A = true;
        mandatory.G = true;
        mandatory.D = true;
    }

    // --- T/W dynamic dependency ---
    const WSelected = isBlockSelected(getDraftBlock(ruleDraft, 'W'), 'W');
    const wSelected = isBlockSelected(getDraftBlock(ruleDraft, 'w'), 'w');

    mandatory.T = WSelected; // T mandatory if W selected
    mandatory.t = hasSecondaryCondition && wSelected; // t mandatory if secondary W selected

    // Secondary blocks are only mandatory when exception table is active.
    mandatory.w = hasSecondaryCondition;
    mandatory.a = hasSecondaryCondition;
    mandatory.g = hasSecondaryCondition;
    mandatory.d = hasSecondaryCondition;

    return mandatory;
}

function createEmptyWeekCube() {
    return Array.from({ length: 7 }, () =>
        Array.from({ length: SHIFTS_PER_DAY }, () =>
            Array(ROLE_COUNT).fill(0)
        )
    );
}

function sumRuleInCube(condition, cube) {
    let total = 0;
    // console.log("[RuleCheck] Evaluating cube", cube);
    // Normalize subject roles to numeric indices. Accept numbers, numeric strings,
    // and strings containing digits (e.g. "R10") so multi-digit roles are handled.
    const rawSubjectRoles = Array.isArray(condition.subjectRoles)
        ? condition.subjectRoles
        : condition.subjectRoles
            ? [condition.subjectRoles]
            : [];

    const subjectRoles = rawSubjectRoles
        .map(r => {
            if (r == null) return null;
            if (typeof r === 'number' && Number.isFinite(r)) return Number(r);
            const m = String(r).match(/-?\d+/);
            if (!m) return null;
            const n = Number(m[0]);
            return Number.isFinite(n) ? n : null;
        })
        .filter(roleIdx => Number.isInteger(roleIdx) && roleIdx >= 0 && roleIdx < ROLE_COUNT);

    const timeframeSlots = Array.isArray(condition.timeframeSlots)
        ? condition.timeframeSlots
        : [];

    timeframeSlots.forEach(day => {

        let roleTotals = {};

        for (let s = 0; s < SHIFTS_PER_DAY; s++) {
            subjectRoles.forEach(role => {

                const value = cube?.[day]?.[s]?.[role] ?? 0;

                total += value;
                roleTotals[role] = (roleTotals[role] || 0) + value;

            });
        }

        /* focus debug output
        console.log("[RuleCheck][DayRoleTotals]", {
            day,
            chef: roleTotals[1] ?? 0,
            reception: roleTotals[9] ?? 0,
            allRoles: roleTotals,
            runningTotal: total
        });
        */
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

function parseDateLocal(dateInput) {
    if (dateInput instanceof Date) return new Date(dateInput);
    if (typeof dateInput === 'string') {
        const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) {
            const [, year, month, day] = match;
            return new Date(Number(year), Number(month) - 1, Number(day));
        }
    }
    return normalizeDateInput(dateInput);
}

function buildDayLabels(weekStart, dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
    const start = parseDateLocal(weekStart);
    if (!start || Number.isNaN(start.getTime())) return dayNames;

    return dayNames.map((dayName, idx) => {
        const date = addDays(start, idx);
        return `${dayName} [${date.getDate()}]`;
    });
}

function dateKey(date) {
    const d = new Date(date);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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

    const attendance = Array.from({ length: ROLE_COUNT }, () => [0, 0, 0]);

    if (!dayFacts?.isOfficeOpen) return attendance;

    requests.forEach(({ roleIndex, shift }) => {
        const rIdx = Number(roleIndex);
        if (!Number.isInteger(rIdx) || rIdx < 0 || rIdx >= ROLE_COUNT) return;
        if (!dayFacts.openShifts[shift]) return;

        const idx = shift === 'early' ? 0 : shift === 'day' ? 1 : 2;
        attendance[rIdx][idx]++;
    });

    return attendance;
}

export async function runRequestRuleCheck(startDate, endDate, requests, options = {}) {
    const start = normalizeDateInput(startDate);
    const end = normalizeDateInput(endDate);

    if (!start || !end || start > end) {
        return {
            ok: false,
            failures: [],
            skipped: [],
            summary: { totalFailures: 0, totalSkipped: 0, byScope: {} },
            meta: {
                startDate: startDate ?? null,
                endDate: endDate ?? null,
                error: 'INVALID_DATE_RANGE'
            }
        };
    }

    let {
        machineRuleset = null,
        uiRules = null,
        employees = [],
        includePending = true,
        dayFactsByDate = null,
        shiftMode = 'all',
        attendanceByDate = null,
        roles = [],
        roleNames = null,
        useSolver = true
    } = options;

    if (!uiRules) {
        const loaderApi = (typeof window !== 'undefined' && window.api) ? window.api : null;
        uiRules = await loadRuleData(loaderApi);
        cachedRoleNames = await loadRoleData(loaderApi).then(roles => roles.map(role => role.name));
    }

    const activeUiRules = Array.isArray(uiRules) ? getActiveRules(uiRules) : null;
    const ruleset = machineRuleset || (Array.isArray(activeUiRules) ? updateRulesPreview(activeUiRules) : null);
    if (!ruleset) {
        return {
            ok: false,
            failures: [],
            skipped: [],
            summary: { totalFailures: 0, totalSkipped: 0, byScope: {} },
            meta: {
                startDate: dateKey(start),
                endDate: dateKey(end),
                error: 'NO_RULESET'
            }
        };
    }

    const requestsByDate = buildRequestsByDate(
        requests,
        start,
        end,
        employees,
        { includePending, shiftMode }
    );

    const rulesetForCheck = {
        ...ruleset,
        context: {
            requestsByDate,
            dayFactsByDate,
            roleCount: ROLE_COUNT,
            attendanceByDate,
            roleNames: resolveRoleNames({ roleNames, roles, employees })
        }
    };

    return executeRuleset(rulesetForCheck, start, end, useSolver);
}

export function executeRulechecker(startDate, endDate, requests, options = {}) {
    return runRequestRuleCheck(startDate, endDate, requests, options)
}

function normalizeRuleset(ruleset) {
    if (Array.isArray(ruleset)) {
        return {
            weekly: ruleset,
            daily: [],
            shiftly: [],
            special: [],
            corrupted: []
        };
    }

    return {
        weekly: Array.isArray(ruleset?.weekly) ? ruleset.weekly : [],
        daily: Array.isArray(ruleset?.daily) ? ruleset.daily : [],
        shiftly: Array.isArray(ruleset?.shiftly) ? ruleset.shiftly : [],
        special: Array.isArray(ruleset?.special) ? ruleset.special : [],
        corrupted: Array.isArray(ruleset?.corrupted) ? ruleset.corrupted : []
    };
}

export function normalizeDateInput(dateInput) {
    if (!dateInput) return null;
    const d = dateInput instanceof Date ? new Date(dateInput) : new Date(dateInput);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(0, 0, 0, 0);
    return d;
}

function createEmptyAttendanceMatrix() {
    return Array.from({ length: ROLE_COUNT }, () => [0, 0, 0]);
}

function normalizeAttendanceByDate(attendanceByDate) {
    if (!attendanceByDate || typeof attendanceByDate !== 'object') return attendanceByDate;
    const normalized = {};
    Object.entries(attendanceByDate).forEach(([key, dayMatrix]) => {
        const row = Array.from({ length: ROLE_COUNT }, (_, i) => [0, 0, 0]);
        if (Array.isArray(dayMatrix)) {
            for (let r = 0; r < Math.min(dayMatrix.length, ROLE_COUNT); r++) {
                const cell = dayMatrix[r];
                if (Array.isArray(cell)) {
                    row[r][0] = Number.isFinite(cell[0]) ? Number(cell[0]) : 0;
                    row[r][1] = Number.isFinite(cell[1]) ? Number(cell[1]) : 0;
                    row[r][2] = Number.isFinite(cell[2]) ? Number(cell[2]) : 0;
                }
            }
        }
        normalized[key] = row;
    });
    return normalized;
}

function normalizeDayFacts(dayFacts) {
    if (dayFacts && typeof dayFacts === 'object') return dayFacts;
    return {
        isOfficeOpen: true,
        openShifts: { early: true, day: true, late: true }
    };
}

function buildAttendanceByDate(
    startDate,
    endDate,
    requestsByDate,
    dayFactsByDate
) {
    const attendanceByDate = {};
    let cursor = new Date(startDate);
    let guard = 0;

    while (cursor <= endDate && guard++ < 370) {
        const key = dateKey(cursor);
        const dayFacts = normalizeDayFacts(dayFactsByDate?.[key]);
        const requests = requestsByDate?.[key] || [];
        const attendance = createEmptyAttendanceMatrix();

        const dayAttendance = collectDayAttendance(requests, dayFacts);
        Object.entries(dayAttendance).forEach(([roleId, shifts]) => {
            const idx = Number(roleId);
            if (!attendance[idx]) return;
            for (let s = 0; s < SHIFTS_PER_DAY; s++) {
                attendance[idx][s] += shifts[s] ?? 0;
            }
        });

        attendanceByDate[key] = attendance;
        cursor = addDays(cursor, 1);
    }

    return attendanceByDate;
}

/*
function buildWeeklyCubesFromAttendance(
    startDate,
    endDate,
    attendanceByDate
) {
    const weeks = [];
    let cursor = startOfISOWeek(startDate);
    let guard = 0;

    while (cursor <= endDate && guard++ < 60) {
        const weekStart = new Date(cursor);
        const cube = createEmptyWeekCube();

        for (let d = 0; d < 7; d++) {
            const date = addDays(weekStart, d);
            const key = dateKey(date);
            const attendance = attendanceByDate[key];
            if (!Array.isArray(attendance)) continue;

            // console.log("[RuleCheck] dayAttendance", key, attendance);

            for (let role = 0; role < ROLE_COUNT; role++) {
                for (let s = 0; s < SHIFTS_PER_DAY; s++) {
                    cube[d][s][role] += attendance?.[role]?.[s] ?? 0;
                }
            }
        }

        weeks.push({
            weekNumber: getISOWeekNumber(weekStart),
            weekStart: dateKey(weekStart),
            weekEnd: dateKey(addDays(weekStart, 6)),
            cube
        });

        cursor = addDays(cursor, 7);
    }

    return weeks;
}
*/

function extractContext(ruleset) {
    const context = ruleset?.context || ruleset?._context || {};

    return {
        roleCount: ROLE_COUNT,
        requestsByDate: context.requestsByDate || {},
        dayFactsByDate: context.dayFactsByDate || {},
        attendanceByDate: context.attendanceByDate || null,
        attendanceByShift: context.attendanceByShift || null,
        roleNames: normalizeRoleNames(context.roleNames) || getRoleNamesFromRoles(context.roles),
        solverRules: context.solverRules || ruleset?.solverRules || null,
        solverInput: context.solverInput || null
    };
}

function createSolverRulesFromMachineRules(normalizedRules) {
    const rules = [];
    const buckets = [
        normalizedRules?.shiftly,
        normalizedRules?.daily,
        normalizedRules?.weekly,
        normalizedRules?.special
    ];

    buckets.forEach(bucket => {
        if (!Array.isArray(bucket)) return;
        bucket.forEach(rule => {
            const cond = rule?.dominantCondition;
            const roleOp = String(cond?.roleLogicOperator || '').toUpperCase();
            const slots = cond?.timeframeSlots;
            if (roleOp !== 'TOTAL') return;
            if (!Array.isArray(cond?.subjectRoles) || cond.subjectRoles.length < 1) return;
            if (!Array.isArray(slots)) return;
            const hasShiftSlots = slots.some(slot => typeof slot === 'string');
            if (!hasShiftSlots) return;
            rules.push(rule);
        });
    });

    return { static: rules, flexible: [] };
}

function aggregateAttendanceByShift(attendanceByDate) {
    if (!attendanceByDate || typeof attendanceByDate !== 'object') return null;
    const shiftTotals = {
        early: createEmptyAttendanceMatrix(ROLE_COUNT),
        day: createEmptyAttendanceMatrix(ROLE_COUNT),
        late: createEmptyAttendanceMatrix(ROLE_COUNT)
    };
    const shiftByIndex = ['early', 'day', 'late'];

    Object.values(attendanceByDate).forEach(dayMatrix => {
        if (!Array.isArray(dayMatrix)) return;
        for (let roleId = 0; roleId < ROLE_COUNT; roleId++) {
            for (let shiftIdx = 0; shiftIdx < SHIFTS_PER_DAY; shiftIdx++) {
                const shiftName = shiftByIndex[shiftIdx];
                const mainCount = dayMatrix?.[roleId]?.[shiftIdx] ?? 0;
                if (mainCount <= 0) continue;
                shiftTotals[shiftName][roleId][0] += mainCount;
            }
        }
    });

    return shiftTotals;
}

function summarizeFailures(failures, skipped) {
    const byScope = {};
    failures.forEach(f => {
        byScope[f.scope] = (byScope[f.scope] || 0) + 1;
    });

    return {
        totalFailures: failures.length,
        totalSkipped: skipped.length,
        byScope
    };
}

export function executeRuleset(
    ruleset,
    startDate,
    endDate,
    useSolver = true
) {
    const normalizedRules = normalizeRuleset(ruleset);
    const start = normalizeDateInput(startDate);
    const end = normalizeDateInput(endDate);

    if (!start || !end || start > end) {
        return {
            ok: false,
            failures: [],
            skipped: [],
            summary: { totalFailures: 0, totalSkipped: 0, byScope: {} },
            meta: {
                startDate: startDate ?? null,
                endDate: endDate ?? null,
                error: 'INVALID_DATE_RANGE'
            }
        };
    }

    const context = extractContext(ruleset);
    if (cachedRoleNames && !context.roleNames) {
        context.roleNames = cachedRoleNames;
    }

    const attendanceByDate = context.attendanceByDate ||
        buildAttendanceByDate(
            start,
            end,
            context.requestsByDate,
            context.dayFactsByDate,
            ROLE_COUNT
        );

    // Normalize any externally provided attendanceByDate so each day has ROLE_COUNT rows
    const normalizedAttendanceByDate = normalizeAttendanceByDate(attendanceByDate);

    const weeks = buildWeeklyCubesFromAttendance(start, end, normalizedAttendanceByDate, context.roleNames);
    const failures = [];
    const skipped = [];
    let solverResult = null;

    if (useSolver) {
        try {
            if (context.solverInput) {
                console.info('[RuleChecker][Solver] Running `runSolver` with explicit solver input.');
                solverResult = runSolver(context.solverInput);
            } else {
                const fallbackAttendanceByShift = context.attendanceByShift ||
                    aggregateAttendanceByShift(normalizedAttendanceByDate);
                const fallbackSolverRules = context.solverRules || createSolverRulesFromMachineRules(normalizedRules);
                const hasRules = Array.isArray(fallbackSolverRules?.static) && fallbackSolverRules.static.length > 0;

                if (fallbackAttendanceByShift && hasRules) {
                    console.info('[RuleChecker][Solver] Running `runSolverPerShift` with derived attendance/rules.');
                    solverResult = runSolverPerShift(fallbackAttendanceByShift, fallbackSolverRules);
                } else {
                    const reason = hasRules ? 'NO_ATTENDANCE_BY_SHIFT' : 'NO_SHIFT_AWARE_SOLVER_RULES';
                    console.info(`[RuleChecker][Solver] Skipped (${reason}).`);
                    skipped.push({
                        scope: 'solver',
                        reason
                    });
                }
            }
        } catch (error) {
            console.warn('[RuleChecker][Solver] Execution failed:', error);
            skipped.push({
                scope: 'solver',
                reason: 'SOLVER_FAILED',
                details: String(error)
            });
        }
    }

    weeks.forEach(week => {
        normalizedRules.weekly.forEach(rule => {
            const slots = rule?.dominantCondition?.timeframeSlots || [];
            const slotsAreNumbers = slots.every(slot => typeof slot === 'number');
            if (!slotsAreNumbers) {
                skipped.push({
                    ruleId: rule.id,
                    scope: 'weekly',
                    weekNumber: week.weekNumber,
                    reason: 'UNSUPPORTED_TIMEFRAME_SLOTS'
                });
                return;
            }

            const violations = evaluateRule(rule, week.cube);
            if (!violations.length) return;

            violations.forEach(v => {
                failures.push({
                    ruleId: rule.id,
                    scope: 'weekly',
                    weekNumber: week.weekNumber,
                    weekStart: week.weekStart,
                    weekEnd: week.weekEnd,
                    type: v.type,
                    total: v.total,
                    limit: v.limit,
                    subjectRoles: rule?.dominantCondition?.subjectRoles || []
                });
            });
        });
    });
    let cursor = new Date(start);
    let guard = 0;
    while (cursor <= end && guard++ < 370) {
        const dayIndex = (cursor.getDay() + 6) % 7;
        const key = dateKey(cursor);
        const dayAttendance = normalizedAttendanceByDate[key] || createEmptyAttendanceMatrix(ROLE_COUNT);

        normalizedRules.daily.forEach(rule => {
            const slots = rule?.dominantCondition?.timeframeSlots || [];
            const slotsAreNumbers = slots.every(slot => typeof slot === 'number');
            if (!slotsAreNumbers) {
                skipped.push({
                    ruleId: rule.id,
                    scope: 'daily',
                    date: key,
                    reason: 'UNSUPPORTED_TIMEFRAME_SLOTS'
                });
                return;
            }

            if (slots.length > 0 && !slots.includes(dayIndex)) return;

            const dayCube = createEmptyWeekCube(ROLE_COUNT);
            for (let role = 0; role < ROLE_COUNT; role++) {
                for (let s = 0; s < SHIFTS_PER_DAY; s++) {
                    dayCube[dayIndex][s][role] = dayAttendance?.[role]?.[s] ?? 0;
                }
            }

            const violations = evaluateRule(rule, dayCube);
            if (!violations.length) return;

            violations.forEach(v => {
                failures.push({
                    ruleId: rule.id,
                    scope: 'daily',
                    date: key,
                    weekdayIndex: dayIndex,
                    type: v.type,
                    total: v.total,
                    limit: v.limit,
                    subjectRoles: rule?.dominantCondition?.subjectRoles || []
                });
            });
        });

        const shiftTypes = ['early', 'day', 'late'];
        normalizedRules.shiftly.forEach(rule => {
            const slots = rule?.dominantCondition?.timeframeSlots || [];
            const shiftSlots = slots.filter(slot => shiftTypes.includes(slot));
            if (!shiftSlots.length) return;

            shiftSlots.forEach(shiftType => {
                const shiftIndex = shiftTypes.indexOf(shiftType);
                const shiftCube = createEmptyWeekCube(ROLE_COUNT);
                for (let role = 0; role < ROLE_COUNT; role++) {
                    shiftCube[0][0][role] = dayAttendance?.[role]?.[shiftIndex] ?? 0;
                }

                const shiftRule = {
                    ...rule,
                    dominantCondition: {
                        ...rule.dominantCondition,
                        timeframeSlots: [0]
                    },
                    submissiveCondition: rule.submissiveCondition
                        ? { ...rule.submissiveCondition, timeframeSlots: [0] }
                        : rule.submissiveCondition
                };
                const violations = evaluateRule(shiftRule, shiftCube);
                violations.forEach(v => {
                    failures.push({
                        ruleId: rule.id,
                        scope: 'shiftly',
                        date: key,
                        weekdayIndex: dayIndex,
                        shiftType,
                        type: v.type,
                        total: v.total,
                        limit: v.limit,
                        subjectRoles: rule?.dominantCondition?.subjectRoles || []
                    });
                });
            });
        });

        cursor = addDays(cursor, 1);
    }

    if (normalizedRules.special.length) {
        normalizedRules.special.forEach(rule => {
            skipped.push({
                ruleId: rule.id,
                scope: 'special',
                reason: 'NOT_IMPLEMENTED'
            });
        });
    }

    const summary = summarizeFailures(failures, skipped);

    return {
        ok: failures.length === 0,
        failures,
        skipped,
        summary,
        meta: {
            startDate: dateKey(start),
            endDate: dateKey(end),
            useSolver,
            roleCount: ROLE_COUNT
        },
        solver: solverResult
    };

    const weeksLog = buildWeeklyCubesFromAttendance(start, end, normalizedAttendanceByDate);

    // 🔍 AUTO-LOG WEEK 2 FOR DEBUGGING
    if (weeksLog.length >= 2) {
        logWeek2Simple(weeksLog); // Quick compact version
        // OR for detailed view:
        // autoLogWeek2(weeks, {
        //     roleNames: Array.from({ length: ROLE_COUNT }, (_, i) => `Role${i}`),
        //     shiftNames: ['Early', 'Day', 'Late'],
        //     showZeros: false
        // });
    }
}

export function runRuleTest(ruleDraft, existingRules = [], options = {}) {
    return runRuleChecks({ ruleDraft, existingRules, ...options });
}

export function runRuleChecks({
    ruleDraft,
    existingRules = [],
    includeInactive = false,
    attendanceByDate = null,
    attendanceStart = null,
    attendanceEnd = null
} = {}) {
    const errors = [];
    const warnings = [];

    if (!ruleDraft) {
        return {
            ok: false,
            errors: ['RULE_MISSING'],
            warnings: [],
            details: { self: null, duplicates: [], conflicts: [] }
        };
    }

    const self = runLiveSanity(ruleDraft);
    if (self.missingMandatory.length) {
        errors.push(`MISSING_BLOCKS: ${self.missingMandatory.join(', ')}`);
    }
    if (self.forbidden.length) {
        errors.push(`FORBIDDEN_COMBOS: ${self.forbidden.join(', ')}`);
    }

    const previewRuleset = updateRulesPreview([ruleDraft]);
    const newMachineRules = flattenRuleset(previewRuleset);
    if (!newMachineRules.length) {
        warnings.push('RULE_TRANSLATION_EMPTY');
    }

    const activeExisting = includeInactive
        ? Array.isArray(existingRules) ? existingRules : []
        : getActiveRules(existingRules);
    const existingRuleset = updateRulesPreview(activeExisting);
    const existingMachineRules = flattenRuleset(existingRuleset);

    const duplicates = findDuplicateRules(newMachineRules, existingMachineRules);
    const conflicts = findPotentialConflicts(newMachineRules, existingMachineRules);
    const delta = buildDeltaReport(newMachineRules, existingMachineRules);

    if (duplicates.length) {
        warnings.push(`DUPLICATE_RULES: ${duplicates.length}`);
    }
    if (conflicts.length) {
        warnings.push(`POTENTIAL_CONFLICTS: ${conflicts.length}`);
    }
    if (delta?.newRules) {
        warnings.push(`DELTA_NEW_RULES: ${delta.newRules}`);
    }
    if (delta?.duplicates) {
        warnings.push(`DELTA_DUPLICATES: ${delta.duplicates}`);
    }
    if (delta?.conflicts) {
        warnings.push(`DELTA_CONFLICTS: ${delta.conflicts}`);
    }

    const futureStart = normalizeDateInput(attendanceStart);
    const futureEnd = normalizeDateInput(attendanceEnd);
    if (attendanceByDate && futureStart && futureEnd && futureStart <= futureEnd) {

        const rulesetForCheck = {
            ...previewRuleset,
            context: {
                ...(previewRuleset?.context || {}),
                attendanceByDate,
                roleCount: ROLE_COUNT
            }
        };

        const futureStats = executeRuleset(rulesetForCheck, futureStart, futureEnd, true);
        if (!futureStats.ok && Array.isArray(futureStats.failures)) {
            warnings.push(`FUTURE_VIOLATIONS: ${futureStats.failures.length}`);
        }
    }

    return {
        ok: errors.length === 0,
        errors,
        warnings,
        details: {
            self,
            duplicates,
            conflicts,
            delta,
            future: (attendanceByDate && futureStart && futureEnd)
                ? { start: dateKey(futureStart), end: dateKey(futureEnd) }
                : null
        }
    };
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

function getActiveRules(rules) {
    if (!Array.isArray(rules)) return [];
    return rules.filter(r => !r?._deleted && !r?.isAsleep);
}

function flattenRuleset(ruleset) {
    if (!ruleset || typeof ruleset !== 'object') return [];
    const weekly = Array.isArray(ruleset.weekly) ? ruleset.weekly : [];
    const daily = Array.isArray(ruleset.daily) ? ruleset.daily : [];
    const shiftly = Array.isArray(ruleset.shiftly) ? ruleset.shiftly : [];
    const special = Array.isArray(ruleset.special) ? ruleset.special : [];
    return [
        ...weekly.map(r => ({ scope: 'weekly', rule: r })),
        ...daily.map(r => ({ scope: 'daily', rule: r })),
        ...shiftly.map(r => ({ scope: 'shiftly', rule: r })),
        ...special.map(r => ({ scope: 'special', rule: r }))
    ];
}

function normalizeArray(arr) {
    if (!Array.isArray(arr)) return [];
    return [...arr].map(String).sort();
}

function ruleSignature(machineRule, scope) {
    const dom = machineRule?.dominantCondition ?? {};
    const sub = machineRule?.submissiveCondition ?? {};

    const base = {
        scope,
        conditionLink: machineRule?.conditionLink ?? '',
        dominant: {
            timeframeSlots: normalizeArray(dom.timeframeSlots),
            timeframeLogicOperator: dom.timeframeLogicOperator ?? '',
            subjectRoles: normalizeArray(dom.subjectRoles),
            referenceRoles: normalizeArray(dom.referenceRoles),
            roleLogicOperator: dom.roleLogicOperator ?? '',
            lowerLimit: dom.lowerLimit ?? null,
            upperLimit: dom.upperLimit ?? null
        },
        submissive: {
            timeframeSlots: normalizeArray(sub.timeframeSlots),
            timeframeLogicOperator: sub.timeframeLogicOperator ?? '',
            subjectRoles: normalizeArray(sub.subjectRoles),
            referenceRoles: normalizeArray(sub.referenceRoles),
            roleLogicOperator: sub.roleLogicOperator ?? '',
            lowerLimit: sub.lowerLimit ?? null,
            upperLimit: sub.upperLimit ?? null
        }
    };

    return JSON.stringify(base);
}

function findDuplicateRules(newRules, existingRules) {
    const existingSignatures = new Set(
        existingRules.map(({ scope, rule }) => ruleSignature(rule, scope))
    );

    return newRules
        .map(({ scope, rule }) => ({
            scope,
            rule,
            signature: ruleSignature(rule, scope)
        }))
        .filter(item => existingSignatures.has(item.signature));
}

function findPotentialConflicts(newRules, existingRules) {
    const conflicts = [];

    newRules.forEach(({ scope, rule }) => {
        const dom = rule?.dominantCondition ?? {};
        const slots = normalizeArray(dom.timeframeSlots);
        const roles = normalizeArray(dom.subjectRoles);

        existingRules.forEach(other => {
            if (other.scope !== scope) return;
            const otherDom = other.rule?.dominantCondition ?? {};
            const otherSlots = normalizeArray(otherDom.timeframeSlots);
            const otherRoles = normalizeArray(otherDom.subjectRoles);

            const sameFrame =
                slots.join(',') === otherSlots.join(',') &&
                roles.join(',') === otherRoles.join(',') &&
                (dom.timeframeLogicOperator ?? '') === (otherDom.timeframeLogicOperator ?? '');

            if (!sameFrame) return;

            const limitsDiffer =
                (dom.lowerLimit ?? null) !== (otherDom.lowerLimit ?? null) ||
                (dom.upperLimit ?? null) !== (otherDom.upperLimit ?? null);

            if (limitsDiffer) {
                conflicts.push({
                    scope,
                    ruleId: rule?.id ?? '',
                    otherRuleId: other.rule?.id ?? '',
                    note: 'LIMIT_MISMATCH'
                });
            }
        });
    });

    return conflicts;
}

function buildDeltaReport(newRules, existingRules) {
    if (!Array.isArray(newRules) || !Array.isArray(existingRules)) {
        return { newRules: 0, duplicates: 0, conflicts: 0 };
    }

    const duplicates = findDuplicateRules(newRules, existingRules);
    const conflicts = findPotentialConflicts(newRules, existingRules);
    const uniqueCount = Math.max(0, newRules.length - duplicates.length);

    return {
        newRules: uniqueCount,
        duplicates: duplicates.length,
        conflicts: conflicts.length
    };
}

function buildRequestsByDate(requests, startDate, endDate, employees, options = {}) {
    const { includePending = true, shiftMode = 'all' } = options;
    const ALL_SHIFTS = ['early', 'day', 'late'];
    const result = {};
    if (!Array.isArray(requests)) return result;

    const roleByEmployeeId = new Map();
    if (Array.isArray(employees)) {
        employees.forEach(emp => {
            const id = emp?.id ?? emp?.employeeID ?? emp?.employeeId;
            const roleIndex = Number(emp?.mainRoleIndex ?? emp?.roleIndex);
            if (id != null && Number.isFinite(roleIndex)) {
                roleByEmployeeId.set(String(id), roleIndex);
            }
        });
    }

    const pushEntry = (dateKeyStr, roleIndex, shift) => {
        if (!result[dateKeyStr]) result[dateKeyStr] = [];
        result[dateKeyStr].push({ roleIndex, shift });
    };

    const normalizeShift = (shiftValue) => {
        if (shiftValue === 'early' || shiftValue === 'day' || shiftValue === 'late') return [shiftValue];
        if (shiftValue === true || shiftValue === 'full' || shiftValue === 'all') return ALL_SHIFTS;
        if (shiftValue === 'half') return ['day'];
        if (shiftMode === 'day') return ['day'];
        return ALL_SHIFTS;
    };

    requests.forEach(req => {
        if (!req || !req.start || !req.end) return;
        if (req.status === 'rejected') return;
        if (!includePending && req.status === 'pending') return;

        const roleIndex = Number(req.roleIndex ?? roleByEmployeeId.get(String(req.employeeID)));
        if (!Number.isFinite(roleIndex)) return;

        const start = normalizeDateInput(req.start);
        const end = normalizeDateInput(req.end);
        if (!start || !end) return;

        const clampStart = start < startDate ? startDate : start;
        const clampEnd = end > endDate ? endDate : end;
        const shifts = normalizeShift(req.shift);

        let cursor = new Date(clampStart);
        let guard = 0;
        while (cursor <= clampEnd && guard++ < 370) {
            const key = dateKey(cursor);
            shifts.forEach(shift => pushEntry(key, roleIndex, shift));
            cursor = addDays(cursor, 1);
        }
    });

    return result;
}

let errorCount = 0;
const MAX_ERRORS = 5;

export async function computeRequestDelta(requests, newRequest, options = {}) {

    if (errorCount >= MAX_ERRORS) {
        return null; // fully silent after limit
    }

    const {
        extraRequests = [],
        uiRules,
        employees,
        roles = [],
        roleNames = null
    } = options;

    if (!Array.isArray(requests)) {
        console.warn(
            "[computeRequestDelta] requests is not an array:",
            requests
        );
        errorCount++;
        return null;
    }

    if (!newRequest) {
        console.warn(
            "[computeRequestDelta] newRequest missing"
        );
        errorCount++;
        return null;
    }

    // The What-If comparison is deliberately limited to
    // the date range of the new request.
    const range = {
        start: normalizeDateInput(newRequest.start),
        end: normalizeDateInput(newRequest.end)
    };

    if (!range.start || !range.end || range.start > range.end) {
        return {
            baselineStats: {
                ok: false,
                failures: []
            },
            futureStats: {
                ok: false,
                failures: []
            },
            added: [],
            removed: [],
            unchanged: []
        };
    }

    const normalizedExtraRequests =
        Array.isArray(extraRequests)
            ? extraRequests
            : [];

    const baselineExtraRequests =
        normalizedExtraRequests.filter(
            req => req?.id !== newRequest?.id
        );

    const futureExtraRequests = [
        ...baselineExtraRequests,
        newRequest
    ].filter(Boolean);

    // 1️⃣ Build baseline attendance
    //    without the new request.
    let baselineAttendanceByDate = null;
    let futureAttendanceByDate = null;

    const calendarReady =
        await ensureCalendarReady(api);

    if (calendarReady) {
        baselineAttendanceByDate =
            await computeAttendanceForRange(
                range.start,
                range.end,
                {
                    extraRequests:
                        baselineExtraRequests
                }
            );

        futureAttendanceByDate =
            await computeAttendanceForRange(
                range.start,
                range.end,
                {
                    extraRequests:
                        futureExtraRequests
                }
            );
    }

    // 2️⃣ Baseline:
    //    existing requests only.
    const baselineStats =
        await executeRulechecker(
            range.start,
            range.end,
            requests,
            {
                uiRules,
                employees,
                roles,
                roleNames,
                includePending: true,
                attendanceByDate:
                    baselineAttendanceByDate
            }
        );

    // 3️⃣ Future:
    //    existing requests + new request.
    const futureRequests = [
        ...requests,
        newRequest
    ];

    const futureStats =
        await executeRulechecker(
            range.start,
            range.end,
            futureRequests,
            {
                uiRules,
                employees,
                roles,
                roleNames,
                includePending: true,
                attendanceByDate:
                    futureAttendanceByDate
            }
        );

    // 4️⃣ Compute delta for each violation key.
    const mapFailures = (arr) =>
        new Map(
            arr.map(f => [
                `${f.ruleId}_${f.scope}_${f.date ?? f.weekNumber}_${f.subjectRoles.join(',')}`,
                f
            ])
        );

    const baselineMap =
        mapFailures(baselineStats.failures);

    const futureMap =
        mapFailures(futureStats.failures);

    const delta = [];

    const allKeys = new Set([
        ...baselineMap.keys(),
        ...futureMap.keys()
    ]);

    allKeys.forEach(key => {
        const baseline =
            baselineMap.get(key);

        const future =
            futureMap.get(key);

        const baselineTotal =
            baseline?.total ?? 0;

        const futureTotal =
            future?.total ?? 0;

        const diff =
            futureTotal - baselineTotal;

        if (diff !== 0) {
            delta.push({
                key,
                baselineTotal,
                futureTotal,
                delta: diff,
                type:
                    future?.type ??
                    baseline?.type ??
                    'UNKNOWN'
            });
        }
    });

    console.log(
        "baseline failures:",
        baselineStats.failures
    );

    console.log(
        "future failures:",
        futureStats.failures
    );

    console.log(
        "delta:",
        delta
    );

    return {
        baselineStats,
        futureStats,
        delta
    };
}

// Add this function to your file (after createEmptyWeekCube function)

/**
 * Log the attendance cube in a beautiful, collapsible format for debugging
 * @param {Array} cube - 7x3x14 cube array [day][shift][role]
 * @param {string} label - Optional label for the log
 * @param {Object} options - Logging options
 */
export function logCube(cube, label = 'Attendance Cube', options = {}) {
    const {
        roleNames = normalizeRoleNames(cachedRoleNames) || null, // Use cached by default
        shiftNames = ['Early', 'Day', 'Late'],
        dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        showZeros = false,
        maxRolesToShow = 14
    } = options;

    if (!cube || !Array.isArray(cube) || cube.length !== 7) {
        console.warn('[logCube] Invalid cube structure - expected 7 days');
        return;
    }

    const SHIFTS_PER_DAY = cube[0]?.length || 3;
    const ROLE_COUNT = cube[0]?.[0]?.length || 14;

    // Build role labels
    const roleLabels = roleNames || Array.from({ length: ROLE_COUNT }, (_, i) => `Role ${i}`);

    console.groupCollapsed(`📊 ${label} (${cube.length} days × ${SHIFTS_PER_DAY} shifts × ${ROLE_COUNT} roles)`);

    // Calculate statistics
    let totalAssignments = 0;
    let dayTotals = [];
    let shiftTotals = Array(SHIFTS_PER_DAY).fill(0);
    let roleTotals = Array(ROLE_COUNT).fill(0);
    let emptyDays = [];
    let maxDayTotal = 0;
    let minDayTotal = Infinity;

    cube.forEach((day, dayIdx) => {
        let dayTotal = 0;
        day.forEach((shift, shiftIdx) => {
            if (Array.isArray(shift)) {
                shift.forEach((value, roleIdx) => {
                    const val = Number(value) || 0;
                    totalAssignments += val;
                    dayTotal += val;
                    shiftTotals[shiftIdx] += val;
                    if (roleIdx < ROLE_COUNT) {
                        roleTotals[roleIdx] += val;
                    }
                });
            }
        });
        dayTotals.push(dayTotal);
        if (dayTotal === 0) emptyDays.push(dayIdx);
        maxDayTotal = Math.max(maxDayTotal, dayTotal);
        minDayTotal = Math.min(minDayTotal, dayTotal);
    });

    // Summary
    console.log('📈 Summary:', {
        'Total Assignments': totalAssignments,
        'Average per Day': (totalAssignments / 7).toFixed(2),
        'Max Day Total': maxDayTotal,
        'Min Day Total': minDayTotal === Infinity ? 0 : minDayTotal,
        'Empty Days': emptyDays.length ? emptyDays.map(d => dayNames[d] || `Day${d}`).join(', ') : 'None',
        'Total Shifts': shiftTotals.map((s, i) => `${shiftNames[i] || `Shift${i}`}: ${s}`).join(' | ')
    });

    // Per day breakdown (collapsible)
    cube.forEach((day, dayIdx) => {
        const dayTotal = dayTotals[dayIdx];
        const isDayEmpty = dayTotal === 0;
        const dayName = dayNames[dayIdx] || `Day ${dayIdx}`;

        const groupLabel = `${dayName} | Total: ${dayTotal} assignments ${isDayEmpty ? '⚠️ EMPTY' : ''}`;
        console.groupCollapsed(groupLabel);

        // Per shift breakdown within day
        day.forEach((shift, shiftIdx) => {
            const shiftName = shiftNames[shiftIdx] || `Shift ${shiftIdx}`;
            const shiftTotal = Array.isArray(shift) ? shift.reduce((sum, v) => sum + (Number(v) || 0), 0) : 0;

            if (shiftTotal === 0 && !showZeros) {
                console.log(`  ${shiftName}: ${shiftTotal} assignments (empty)`);
                return;
            }

            // Show roles with non-zero values
            const roleEntries = [];
            if (Array.isArray(shift)) {
                shift.forEach((value, roleIdx) => {
                    const val = Number(value) || 0;
                    if (val > 0 || showZeros) {
                        const roleLabel = roleLabels[roleIdx] || `Role ${roleIdx}`;
                        roleEntries.push(`${roleLabel}: ${val}`);
                    }
                });
            }

            if (roleEntries.length === 0) {
                console.log(`  ${shiftName}: ${shiftTotal} assignments (all zero)`);
            } else {
                console.log(`  ${shiftName} (${shiftTotal} assignments):`, {
                    roles: roleEntries.join(', ')
                });
                // Show as table for easier reading
                if (roleEntries.length > 0 && roleEntries.length <= 10) {
                    console.log('    ──────────────────────────');
                    roleEntries.forEach(entry => console.log(`    ${entry}`));
                }
            }
        });

        // Matrix view for compact reading
        if (dayTotal > 0) {
            console.log('📋 Compact Matrix:');
            const matrix = day.map((shift, shiftIdx) => {
                const shiftName = (shiftNames[shiftIdx] || `S${shiftIdx}`).padEnd(6);
                const roles = Array.isArray(shift) ?
                    shift.map((v, i) => {
                        const val = Number(v) || 0;
                        return val > 0 || showZeros ? `${val}` : '·';
                    }).join(' ') : '';
                return `${shiftName} | ${roles}`;
            });
            console.log(matrix.join('\n'));
        }

        // Show total breakdown
        console.log(`📊 Day Total: ${dayTotal} assignments (${((dayTotal / totalAssignments) * 100).toFixed(1)}% of total)`);

        console.groupEnd();
    });

    // Role totals summary
    console.log('📊 Role Totals:');
    const roleSummary = roleTotals.map((total, idx) => {
        const roleLabel = roleLabels[idx] || `Role ${idx}`;
        const percentage = totalAssignments > 0 ? ((total / totalAssignments) * 100).toFixed(1) : '0.0';
        const bar = '█'.repeat(Math.round((total / (Math.max(...roleTotals) || 1)) * 20));
        return `${roleLabel.padEnd(10)}: ${total.toString().padStart(4)} (${percentage}%) ${bar}`;
    });
    console.log(roleSummary.join('\n'));

    // Shift totals summary
    console.log('📊 Shift Totals:');
    shiftTotals.forEach((total, idx) => {
        const shiftName = shiftNames[idx] || `Shift ${idx}`;
        const percentage = totalAssignments > 0 ? ((total / totalAssignments) * 100).toFixed(1) : '0.0';
        const bar = '█'.repeat(Math.round((total / (Math.max(...shiftTotals) || 1)) * 20));
        console.log(`  ${shiftName.padEnd(10)}: ${total.toString().padStart(4)} (${percentage}%) ${bar}`);
    });

    // Day totals summary
    console.log('📊 Day Totals:');
    dayTotals.forEach((total, idx) => {
        const dayName = dayNames[idx] || `Day ${idx}`;
        const percentage = totalAssignments > 0 ? ((total / totalAssignments) * 100).toFixed(1) : '0.0';
        const bar = '█'.repeat(Math.round((total / (Math.max(...dayTotals) || 1)) * 20));
        const status = total === 0 ? ' ⚠️ EMPTY' : '';
        console.log(`  ${dayName.padEnd(10)}: ${total.toString().padStart(4)} (${percentage}%) ${bar}${status}`);
    });

    // Sanity checks
    console.group('✅ Sanity Checks');
    const checks = [];

    // Check if any day has all zeros
    if (emptyDays.length > 0) {
        checks.push(`⚠️ ${emptyDays.length} days have zero assignments`);
    }

    // Check for NaN or undefined
    let hasInvalidValues = false;
    cube.forEach((day, di) => {
        day.forEach((shift, si) => {
            if (Array.isArray(shift)) {
                shift.forEach((val, ri) => {
                    if (typeof val !== 'number' || isNaN(val)) {
                        hasInvalidValues = true;
                        checks.push(`❌ Invalid value at day ${di}, shift ${si}, role ${ri}: ${val}`);
                    }
                });
            }
        });
    });

    // Check total consistency
    const recalculatedTotal = dayTotals.reduce((a, b) => a + b, 0);
    if (recalculatedTotal !== totalAssignments) {
        checks.push(`⚠️ Total mismatch: ${totalAssignments} vs recalculated ${recalculatedTotal}`);
    }

    if (checks.length === 0) {
        console.log('✅ All sanity checks passed!');
    } else {
        checks.forEach(check => console.log(check));
    }
    console.groupEnd();

    // Corrupt data warning
    if (emptyDays.length > 0 || hasInvalidValues) {
        console.warn('⚠️ Potential data corruption detected in cube!');
    }

    console.groupEnd();
}

// Enhanced version for comparing two cubes
export function compareCubes(cube1, cube2, label1 = 'Cube 1', label2 = 'Cube 2') {
    console.groupCollapsed(`🔍 Comparing ${label1} vs ${label2}`);

    if (!cube1 || !cube2) {
        console.warn('One or both cubes are invalid');
        console.groupEnd();
        return;
    }

    // Check if structures match
    const structureMatch = cube1.length === cube2.length &&
        cube1[0]?.length === cube2[0]?.length &&
        cube1[0]?.[0]?.length === cube2[0]?.[0]?.length;

    if (!structureMatch) {
        console.warn('⚠️ Cube structures do not match!');
        console.log('Cube1 dimensions:', cube1.length, 'x', cube1[0]?.length, 'x', cube1[0]?.[0]?.length);
        console.log('Cube2 dimensions:', cube2.length, 'x', cube2[0]?.length, 'x', cube2[0]?.[0]?.length);
        console.groupEnd();
        return;
    }

    const differences = [];
    let totalDiff = 0;

    cube1.forEach((day, dayIdx) => {
        day.forEach((shift, shiftIdx) => {
            shift.forEach((val, roleIdx) => {
                const v1 = Number(val) || 0;
                const v2 = Number(cube2[dayIdx]?.[shiftIdx]?.[roleIdx]) || 0;
                if (v1 !== v2) {
                    differences.push({
                        day: dayIdx,
                        shift: shiftIdx,
                        role: roleIdx,
                        cube1: v1,
                        cube2: v2,
                        diff: v2 - v1
                    });
                    totalDiff += Math.abs(v2 - v1);
                }
            });
        });
    });

    console.log('📊 Comparison Summary:');
    console.log('  Total differences:', differences.length);
    console.log('  Total absolute difference:', totalDiff);

    if (differences.length > 0) {
        console.group('📋 Difference Details');
        const diffGroups = {};
        differences.forEach(d => {
            const key = `Day ${d.day}, Shift ${d.shift}`;
            if (!diffGroups[key]) diffGroups[key] = [];
            diffGroups[key].push(d);
        });

        Object.entries(diffGroups).forEach(([key, diffs]) => {
            console.groupCollapsed(key);
            diffs.forEach(d => {
                console.log(`  Role ${d.role}: ${d.cube1} → ${d.cube2} (${d.diff > 0 ? '+' : ''}${d.diff})`);
            });
            console.groupEnd();
        });
        console.groupEnd();
    } else {
        console.log('✅ Cubes are identical!');
    }

    // Log both cubes for reference
    console.log('📊 Individual cubes:');
    logCube(cube1, label1);
    logCube(cube2, label2);

    console.groupEnd();
    return { differences, totalDiff };
}

// Add this function to your file near the top with other utilities

/**
 * Auto-log week 2 cube for debugging - call this after building weekly cubeapproveds
 * @param {Array} weeks - Array of week objects with cube data
 * @param {Object} options - Logging options
 */
export function autoLogWeek2(weeks, options = {}) {
    if (!Array.isArray(weeks) || weeks.length < 2) {
        console.warn('[autoLogWeek2] Less than 2 weeks available, cannot log week 2');
        return;
    }

    const week2 = weeks[1];
    if (!week2 || !week2.cube) {
        console.warn('[autoLogWeek2] Week 2 data is invalid');
        return;
    }

    // Use cached role names if available
    const defaultRoleNames = normalizeRoleNames(cachedRoleNames) ||
        Array.from({ length: ROLE_COUNT }, (_, i) => `Role ${i}`);

    const {
        roleNames = defaultRoleNames,
        shiftNames = ['Early', 'Day', 'Late'],
        dayNames = week2.dayLabels || buildDayLabels(week2.weekStart)
    } = options;

    console.log(`📅 AUTO-LOG: Week 2 (Week ${week2.weekNumber || '?'}) - ${week2.weekStart || 'start'} to ${week2.weekEnd || 'end'}`);

    logCube(week2.cube, `Week 2 - ${week2.weekStart || 'start'} to ${week2.weekEnd || 'end'}`, {
        roleNames,
        shiftNames,
        dayNames,
        ...options
    });

    // Quick summary for week 2 vs other weeks
    const totalAssignmentsWeek2 = week2.cube.flat(2).reduce((sum, val) => sum + (Number(val) || 0), 0);
    console.log(`📊 Week 2 Total Assignments: ${totalAssignmentsWeek2}`);

    if (weeks.length > 2) {
        const week1Total = weeks[0].cube.flat(2).reduce((sum, val) => sum + (Number(val) || 0), 0);
        const week3Total = weeks[2].cube.flat(2).reduce((sum, val) => sum + (Number(val) || 0), 0);
        console.log('📊 Comparison:', {
            'Week 1': week1Total,
            'Week 2': totalAssignmentsWeek2,
            'Week 3': week3Total || 'N/A',
            'Week 2 vs Week 1': week1Total > 0 ? `${((totalAssignmentsWeek2 - week1Total) / week1Total * 100).toFixed(1)}% change` : 'N/A'
        });
    }
}

export function buildWeeklyCubesFromAttendance(
    startDate,
    endDate,
    attendanceByDate,
    roleNames = null
) {
    const weeks = [];
    let cursor = startOfISOWeek(startDate);
    let guard = 0;

    // Use cached role names if available, otherwise use provided or default
    const defaultRoleNames = normalizeRoleNames(roleNames) ||
        normalizeRoleNames(cachedRoleNames) ||
        Array.from({ length: ROLE_COUNT }, (_, i) => `Role ${i}`);

    while (cursor <= endDate && guard++ < 60) {
        const weekStart = new Date(cursor);
        const cube = createEmptyWeekCube();

        for (let d = 0; d < 7; d++) {
            const date = addDays(weekStart, d);
            const key = dateKey(date);
            const attendance = attendanceByDate[key];
            if (!Array.isArray(attendance)) continue;

            const dayIndex = (date.getDay() + 6) % 7;

            for (let role = 0; role < ROLE_COUNT; role++) {
                for (let s = 0; s < SHIFTS_PER_DAY; s++) {
                    cube[dayIndex][s][role] += attendance?.[role]?.[s] ?? 0;
                }
            }
        }

        weeks.push({
            weekNumber: getISOWeekNumber(weekStart),
            weekStart: dateKey(weekStart),
            weekEnd: dateKey(addDays(weekStart, 6)),
            dayLabels: buildDayLabels(weekStart),
            cube
        });

        cursor = addDays(cursor, 7);
    }

    // AUTO-LOG WEEK 2 with role names - use cached role names
    if (weeks.length >= 2) {
        try {
            setTimeout(() => {
                autoLogWeek2(weeks, {
                    roleNames: defaultRoleNames,
                    shiftNames: ['Early', 'Day', 'Late'],
                    showZeros: false,
                    maxRolesToShow: 14
                });
            }, 0);
        } catch (error) {
            console.warn('[buildWeeklyCubesFromAttendance] Failed to auto-log week 2:', error);
        }
    }
    return weeks;
}

function normalizeRoleNames(roleNames) {
    if (!Array.isArray(roleNames) || roleNames.length === 0) return null;

    const normalized = Array.from({ length: ROLE_COUNT }, (_, idx) => {
        const label = roleNames[idx];
        // Handle both string and object formats
        if (typeof label === 'string' && label.trim()) {
            return label.trim();
        } else if (label && typeof label === 'object' && label.name) {
            return String(label.name).trim() || `Role ${idx}`;
        }
        return `Role ${idx}`;
    });

    // Return null if all are just "Role X" placeholders (meaning no real names)
    const hasRealNames = normalized.some((name, idx) => name !== `Role ${idx}`);
    return hasRealNames ? normalized : null;
}

function getRoleNamesFromRoles(roles) {
    console.log('[getRoleNamesFromRoles] roles:', roles);
    if (!Array.isArray(roles) || roles.length === 0) return null;

    const roleMap = {};
    roles.forEach((role, idx) => {
        const roleIndex = Number(role?.colorIndex ?? role?.roleIndex ?? role?.index ?? idx);
        const roleName = String(role?.name || role?.roleName || '').trim();
        if (Number.isInteger(roleIndex) && roleIndex >= 0 && roleIndex < ROLE_COUNT && roleName && roleName !== '?') {
            roleMap[roleIndex] = roleName;
        }
    });

    if (Object.keys(roleMap).length === 0) return null;

    const roleNames = [];
    for (let i = 0; i < ROLE_COUNT; i++) {
        roleNames.push(roleMap[i] || `Role ${i}`);
    }

    return roleNames;
}

function getRoleNamesFromEmployees(employees) {
    if (!Array.isArray(employees) || employees.length === 0) return null;

    const roleMap = {};
    employees.forEach(emp => {
        const roleIndex = Number(emp?.mainRoleIndex ?? emp?.roleIndex);
        const roleName = String(emp?.roleName || emp?.mainRole || emp?.role || '').trim();
        if (Number.isInteger(roleIndex) && roleIndex >= 0 && roleIndex < ROLE_COUNT && roleName && roleName !== '?') {
            roleMap[roleIndex] = roleName;
        }
    });

    if (Object.keys(roleMap).length === 0) return null;

    const roleNames = [];
    for (let i = 0; i < ROLE_COUNT; i++) {
        roleNames.push(roleMap[i] || `Role ${i}`);
    }

    return roleNames;
}

function resolveRoleNames({ roleNames = null, roles = [], employees = [] } = {}) {
    return normalizeRoleNames(roleNames) ||
        getRoleNamesFromRoles(roles) ||
        getRoleNamesFromEmployees(employees) ||
        Array.from({ length: ROLE_COUNT }, (_, i) => `Role ${i}`);
}

// Alternative: Add a simple one-liner logging function specifically for week 2
export function logWeek2Simple(weeks) {
    if (!Array.isArray(weeks) || weeks.length < 2) {
        console.warn('Week 2 not available for logging');
        return;
    }

    const week2 = weeks[1];
    if (!week2?.cube) {
        console.warn('Week 2 cube is invalid');
        return;
    }

    console.group(`📊 WEEK 2 CUBE (${week2.weekStart} to ${week2.weekEnd})`);

    // Show day by day totals
    const dayNames = week2.dayLabels || buildDayLabels(week2.weekStart);

    console.log('Day totals:', week2.cube.map((day, i) => {
        const total = day.flat().reduce((sum, v) => sum + (Number(v) || 0), 0);
        return `${dayNames[i] || `Day ${i}`}: ${total}`;
    }).join(' | '));

    // Show shift totals
    const shiftTotals = [0, 0, 0];
    week2.cube.forEach(day => {
        day.forEach((shift, i) => {
            shiftTotals[i] += shift.reduce((sum, v) => sum + (Number(v) || 0), 0);
        });
    });
    console.log('Shift totals:', shiftTotals.map((t, i) => `Shift${i}: ${t}`).join(' | '));

    // Quick matrix view (compact)
    console.log('\nMatrix (Day x Shift):');
    week2.cube.forEach((day, di) => {
        const row = day.map(shift =>
            shift.reduce((sum, v) => sum + (Number(v) || 0), 0)
        );
        console.log(`${dayNames[di] || `Day ${di}`}: [${row.join(', ')}]`);
    });

    console.groupEnd();
}





