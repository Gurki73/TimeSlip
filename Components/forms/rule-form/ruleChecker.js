const SHIFTS_PER_DAY = 3;

/*
const ruleTestContext = {
    from: Date,
    to: Date,

    roleCount: 14,

    officeDaysByDate: {
        '2025-01-15': {
            isOfficeOpen: true,
            openShifts: { early: true, day: true, late: false }
        }
    },

    requestsByDate: {
        '2025-01-15': [
            { roleIndex: 3, shift: 'early' },
            { roleIndex: 7, shift: 'day' }
        ]
    },

    meta: {
        completeness: 0.82 // optional, future
    }
};
*/

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
