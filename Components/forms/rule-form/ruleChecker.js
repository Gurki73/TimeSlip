// Components\forms\rule-form\ruleChecker.js
import { runSolver, runSolverPerShift } from './solver.js';
import { updateRulesPreview } from './translatorMachine.js';
import { getRequestRange } from '../request-form/request-form.js';
import { ensureCalendarReady, computeAttendanceForRange } from '../../calendar/calendar.js';
import { loadRuleData } from '../../../js/loader/rule-loader.js';

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

    const id = String(block.id);
    if (id.length < 2) return false;
    return id[1] !== '0';
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


function createEmptyWeekCube(roleCount) {
    return Array.from({ length: 7 }, () =>
        Array.from({ length: SHIFTS_PER_DAY }, () =>
            Array(roleCount).fill(0)
        )
    );
}

function sumRuleInCube(condition, cube) {
    let total = 0;

    // Make sure subjectRoles is always an array
    const subjectRoles = Array.isArray(condition.subjectRoles)
        ? condition.subjectRoles
        : condition.subjectRoles
            ? [condition.subjectRoles]  // wrap single string
            : [];                       // fallback empty array

    const timeframeSlots = Array.isArray(condition.timeframeSlots)
        ? condition.timeframeSlots
        : []; // fallback empty array

    timeframeSlots.forEach(day => {
        for (let s = 0; s < SHIFTS_PER_DAY; s++) {
            subjectRoles.forEach(role => {
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
        roleCount: roleCountOverride = null,
        dayFactsByDate = null,
        shiftMode = 'all',
        attendanceByDate = null,
        useSolver = true
    } = options;

    if (!uiRules) {
        const loaderApi = (typeof window !== 'undefined' && window.api) ? window.api : null;
        uiRules = await loadRuleData(loaderApi);
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

    const roleCount = Number.isFinite(roleCountOverride)
        ? roleCountOverride
        : Array.isArray(employees) && employees.length
            ? Math.max(...employees.map(e => Number(e.mainRoleIndex ?? 0))) + 1
            : 14;

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
            roleCount,
            attendanceByDate
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

function createEmptyAttendanceMatrix(roleCount) {
    return Array.from({ length: roleCount }, () => [0, 0, 0]);
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
    dayFactsByDate,
    roleCount
) {
    const attendanceByDate = {};
    let cursor = new Date(startDate);
    let guard = 0;

    while (cursor <= endDate && guard++ < 370) {
        const key = dateKey(cursor);
        const dayFacts = normalizeDayFacts(dayFactsByDate?.[key]);
        const requests = requestsByDate?.[key] || [];
        const attendance = createEmptyAttendanceMatrix(roleCount);

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

function buildWeeklyCubesFromAttendance(
    startDate,
    endDate,
    attendanceByDate,
    roleCount
) {
    const weeks = [];
    let cursor = startOfISOWeek(startDate);
    let guard = 0;

    while (cursor <= endDate && guard++ < 60) {
        const weekStart = new Date(cursor);
        const cube = createEmptyWeekCube(roleCount);

        for (let d = 0; d < 7; d++) {
            const date = addDays(weekStart, d);
            const key = dateKey(date);
            const attendance = attendanceByDate[key];
            if (!Array.isArray(attendance)) continue;

            for (let role = 0; role < roleCount; role++) {
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

function extractContext(ruleset) {
    const context = ruleset?.context || ruleset?._context || {};

    return {
        roleCount: Number.isFinite(context.roleCount) ? context.roleCount : 14,
        requestsByDate: context.requestsByDate || {},
        dayFactsByDate: context.dayFactsByDate || {},
        attendanceByDate: context.attendanceByDate || null,
        attendanceByShift: context.attendanceByShift || null,
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

function aggregateAttendanceByShift(attendanceByDate, roleCount) {
    if (!attendanceByDate || typeof attendanceByDate !== 'object') return null;
    const shiftTotals = {
        early: createEmptyAttendanceMatrix(roleCount),
        day: createEmptyAttendanceMatrix(roleCount),
        late: createEmptyAttendanceMatrix(roleCount)
    };
    const shiftByIndex = ['early', 'day', 'late'];

    Object.values(attendanceByDate).forEach(dayMatrix => {
        if (!Array.isArray(dayMatrix)) return;
        for (let roleId = 0; roleId < roleCount; roleId++) {
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
    const roleCount = context.roleCount;

    const attendanceByDate = context.attendanceByDate ||
        buildAttendanceByDate(
            start,
            end,
            context.requestsByDate,
            context.dayFactsByDate,
            roleCount
        );

    const weeks = buildWeeklyCubesFromAttendance(start, end, attendanceByDate, roleCount);
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
                    aggregateAttendanceByShift(attendanceByDate, roleCount);
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
        const dayAttendance = attendanceByDate[key] || createEmptyAttendanceMatrix(roleCount);

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

            const dayCube = createEmptyWeekCube(roleCount);
            for (let role = 0; role < roleCount; role++) {
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

        cursor = addDays(cursor, 1);
    }

    if (normalizedRules.shiftly.length) {
        normalizedRules.shiftly.forEach(rule => {
            skipped.push({
                ruleId: rule.id,
                scope: 'shiftly',
                reason: 'NOT_IMPLEMENTED'
            });
        });
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
            roleCount
        },
        solver: solverResult
    };
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
    attendanceEnd = null,
    roleCount: roleCountOverride = null
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
        const derivedRoleCount = Number.isFinite(roleCountOverride)
            ? roleCountOverride
            : deriveRoleCountFromAttendance(attendanceByDate) ?? 14;

        const rulesetForCheck = {
            ...previewRuleset,
            context: {
                ...(previewRuleset?.context || {}),
                attendanceByDate,
                roleCount: derivedRoleCount
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

function deriveRoleCountFromAttendance(attendanceByDate) {
    if (!attendanceByDate || typeof attendanceByDate !== 'object') return null;
    const first = Object.values(attendanceByDate).find(v => Array.isArray(v));
    return Array.isArray(first) ? first.length : null;
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
        if (shiftValue === true || shiftValue === 'half') return ['day'];
        if (shiftMode === 'day') return ['day'];
        return ['early', 'day', 'late'];
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

    const { extraRequests = [], uiRules, employees } = options;

    if (!Array.isArray(requests)) {
        console.warn("[computeRequestDelta] requests is not an array:", requests);
        errorCount++;
        return null;
    }
    if (!newRequest) {
        console.warn("[computeRequestDelta] newRequest missing");
        errorCount++;
        return null;
    }

    if (typeof getRequestRange !== "function") {
        console.error("[computeRequestDelta] getRequestRange not defined");
        errorCount++;
        return null;
    }

    const allRequests = [...requests];
    const range = getRequestRange(allRequests);
    if (!range) return null;

    const normalizedExtraRequests = Array.isArray(extraRequests) ? extraRequests : [];
    const baselineExtraRequests = normalizedExtraRequests.filter(req => req?.id !== newRequest?.id);
    const futureExtraRequests = [...baselineExtraRequests, newRequest].filter(Boolean);

    // 1️⃣ Build baseline attendance (without the new request)
    let baselineAttendanceByDate = null;
    let futureAttendanceByDate = null;
    const calendarReady = await ensureCalendarReady(api);
    if (calendarReady) {
        baselineAttendanceByDate = await computeAttendanceForRange(range.start, range.end, {
            extraRequests: baselineExtraRequests
        });
        futureAttendanceByDate = await computeAttendanceForRange(range.start, range.end, {
            extraRequests: futureExtraRequests
        });
    }

    const baselineStats = await executeRulechecker(range.start, range.end, requests, {
        uiRules,
        employees,
        includePending: true,
        attendanceByDate: baselineAttendanceByDate
    });

    // 2️⃣ Build future attendance (with newRequest)
    const futureRequests = [...requests, newRequest];
    const futureStats = await executeRulechecker(range.start, range.end, futureRequests, {
        uiRules,
        employees,
        includePending: true,
        attendanceByDate: futureAttendanceByDate
    });

    // 3️⃣ Compute delta for each violation key
    const mapFailures = (arr) => new Map(
        arr.map(f => [`${f.ruleId}_${f.scope}_${f.date ?? f.weekNumber}_${f.subjectRoles.join(',')}`, f])
    );

    const baselineMap = mapFailures(baselineStats.failures);
    const futureMap = mapFailures(futureStats.failures);

    const delta = [];
    const allKeys = new Set([...baselineMap.keys(), ...futureMap.keys()]);

    allKeys.forEach(key => {
        const baseline = baselineMap.get(key);
        const future = futureMap.get(key);

        const baselineTotal = baseline?.total ?? 0;
        const futureTotal = future?.total ?? 0;
        const diff = futureTotal - baselineTotal;

        if (diff !== 0) {
            delta.push({
                key,
                baselineTotal,
                futureTotal,
                delta: diff,
                type: future?.type ?? baseline?.type ?? 'UNKNOWN'
            });
        }
    });

    console.log("baseline failures:", baselineStats.failures);
    console.log("future failures:", futureStats.failures);
    console.log("delta:", delta);
    return { baselineStats, futureStats, delta };
}
