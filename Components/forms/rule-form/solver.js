/*
SOLVER DISCLAIMER:

⚠️ This solver is NOT a full scheduling engine.
- Its only purpose is to reduce blinking / spammy warnings by performing minor, safe reassignments.
- It does not know real employees or candidate preferences.
- Moves are simulated on "role hats" only.
- Imperfect solutions are acceptable; the main goal is to avoid warning noise.
- Safety-first: the solver must never violate hard demand constraints.

Think of the solver as a warning reducer, not a scheduler.
*/

/*
runSolverPerShift(attendanceByShift, rules)
│
├─> runSolver({ timeframe, attendance, rules, options })
│    └─> solveShift({ timeframe, attendance, rules, options })
│         ├─> buildStaticDemand(rules.static, timeframe)       // builds hard minimum/maximum per role
│         ├─> feasibilityCheck(attendance, staticDemand)       // pre-solve feasibility gate
│         ├─> shrinkFlexDemand(rules.flexible, attendanceClone, timeframe)  // computes flexible demand
│         │    └─> extractFlexibleDemand(rule, attendanceClone, timeframe)
│         │         ├─> workloadDemand(rule, attendance)
│         │         ├─> capacityDemand(rule, attendance)
│         │         ├─> presenceDemand(rule, attendance)
│         │         └─> supervisionDemand(rule, attendance)
│         ├─> mergeDemand(staticDemand, flexDemand)           // computes effective demand
│         ├─> computeRoleFlexibility(attendanceClone, effectiveDemand)
│         ├─> rankRolesByPriority(roleStatus)
│         └─> attemptMove(targetRole, effectiveDemand)
│              └─> replaceRoleInCloneAttendance(attendanceClone, donorRoleId, fromRank, targetRoleId, toRank)
│
├─> cloneAttendance(attendance)                                // used for safe trial moves
├─> createEmptyDemand(roleCount)                                // used by buildStaticDemand / shrinkFlexDemand
└─> sumRoles(attendance, roleIds)                               // used in flexible demand computations
*/

/*
SOLVER BLACK-BOX CONTRACT

SolverInput = {
  timeframe: 'early' | 'day' | 'late',

  attendance: AttendanceMatrix, (per shift)
  AttendanceMatrix = number[roleId][rank] = rank: 0 = main, 1 = secondary, 2 = tertiary

  rules: {
    static: Rule[],     // TOTAL / hard constraints
    flexible: Rule[]    // workload, capacity, supervision, etc.
  },

  options?: {
    maxSteps?: number,
    allowEmergency?: boolean
  }
}

SolverResult = {
  status: 'ok' | 'infeasible' | 'unsolved',

  demand: {   //  { min: number, max: number } 
    static: Demand[],
    effective: Demand[]
  },

  feasibility: FeasibilityResult[], // { roleId: number, feasible: boolean }
  ? roleStatus: RoleStatus[], // {roleId: number,main: number,deficit: number,surplus: number,slackMin: number,slackMax: number}
  moves: SolverMove[], SolverMove = {
  from: {
    roleId: number,
    rank: 0 | 1 | 2
  },
  to: {
    roleId: number,
    rank: 0 | 1 | 2
  },
  reason: 'deficit' | 'surplus' | 'capacity' | 'workload'
}

  finalAttendance: AttendanceMatrix
  Warnings: 
     a) Overstuffed ${count} to much ${roleID.name}
     b) understuffes not enough of ${roleID.name}, missing ${count} 
}

*/

/**
 * Terminology:
 * - Employees wear exactly ONE role hat at a time (main)
 * - Secondary / tertiary represent alternative hats they COULD wear
 * - Solver moves hats, not people
 */

export function runSolverPerShift(attendanceByShift, rules) {
    return {
        early: runSolver({
            timeframe: 'early',
            attendance: attendanceByShift.early,
            rules
        }),
        day: runSolver({
            timeframe: 'day',
            attendance: attendanceByShift.day,
            rules
        }),
        late: runSolver({
            timeframe: 'late',
            attendance: attendanceByShift.late,
            rules
        })
    };
}


export function runSolver(input) {
    const {
        timeframe,
        attendance,
        rules,
        options = {}
    } = input;

    return solveShift({
        timeframe,
        attendance,
        rules,
        options
    });
}

function solveShift({ timeframe, attendance, rules, options = {} }) {
    const maxSteps = options.maxSteps ?? 10;
    const allowEmergency = options.allowEmergency ?? false;

    /*
    ⚠️ SOLVER DISCLAIMER:
    - This solver is NOT a full scheduling engine.
    - Its main goal is to reduce blinking/spammy warnings by performing safe, minimal reassignments of role "hats".
    - It does NOT know real employees or preferences.
    - Imperfect solutions are acceptable; safety first: never violate staticDemand.
    */

    const staticDemand = buildStaticDemand(rules.static, timeframe);
    const feasibility = feasibilityCheck(attendance, staticDemand);
    const infeasibleRoles = feasibility.filter(r => !r.feasible);

    if (infeasibleRoles.length) {
        return {
            status: 'infeasible',
            demand: { static: staticDemand, effective: null },
            feasibility,
            roleStatus: null,
            moves: [],
            finalAttendance: attendance,
            warnings: infeasibleRoles.map(r => `Role ${r.roleId} cannot be satisfied`)
        };
    }

    let attendanceClone = cloneAttendance(attendance);
    let moves = [];
    let steps = 0;

    const attemptMove = (targetRole, effectiveDemand) => {
        for (let fromRank = 0; fromRank < 3; fromRank++) {
            for (let toRank = 0; toRank < 3; toRank++) {
                if (!allowEmergency && toRank === 2) continue;

                for (let donorRoleId = 0; donorRoleId < attendanceClone.length; donorRoleId++) {
                    if (donorRoleId === targetRole.roleId) continue;

                    const donorStatus = computeRoleFlexibility(attendanceClone, effectiveDemand)[donorRoleId];
                    if (!donorStatus || donorStatus.slackMin <= 0) continue;

                    const trialClone = replaceRoleInCloneAttendance(
                        cloneAttendance(attendanceClone),
                        donorRoleId, fromRank,
                        targetRole.roleId, toRank
                    );

                    const trialStatus = computeRoleFlexibility(trialClone, effectiveDemand);
                    const allValid = trialStatus.every(rs =>
                        rs.total + rs.slackMax >= effectiveDemand[rs.roleId].min &&
                        rs.total - rs.slackMin <= effectiveDemand[rs.roleId].max
                    );

                    if (allValid) {
                        attendanceClone = trialClone;
                        moves.push({
                            from: { roleId: donorRoleId, rank: fromRank },
                            to: { roleId: targetRole.roleId, rank: toRank },
                            reason: targetRole.deficit > 0 ? 'deficit' : 'surplus'
                        });
                        return true;
                    }
                }
            }
        }
        return false;
    };

    while (steps++ < maxSteps) {
        const flexDemand = shrinkFlexDemand(rules.flexible, attendanceClone, timeframe);
        const effectiveDemand = mergeDemand(staticDemand, flexDemand);

        const roleStatus = computeRoleFlexibility(attendanceClone, effectiveDemand);
        const targetRole = rankRolesByPriority(roleStatus).find(r => r.deficit > 0 || r.surplus > 0);
        if (!targetRole) break;

        if (!attemptMove(targetRole, effectiveDemand)) break;
    }

    const finalRoleStatus = computeRoleFlexibility(
        attendanceClone,
        mergeDemand(staticDemand, shrinkFlexDemand(rules.flexible, attendanceClone, timeframe))
    );

    if (!moves.length) console.info(`[Solver] No safe moves found for "${timeframe}".`);
    else console.info(`[Solver] Committed ${moves.length} safe moves for "${timeframe}".`);

    const effectiveDemand = mergeDemand(staticDemand, shrinkFlexDemand(rules.flexible, attendanceClone, timeframe));
    const warnings = finalRoleStatus
        .filter(r => r.deficit > 0)
        .map(r => `Role ${r.roleId} remains underfilled: missing ${r.deficit}`);

    return {
        status: moves.length > 0 ? 'ok' : 'unsolved',
        demand: { static: staticDemand, effective: effectiveDemand },
        feasibility,
        roleStatus: finalRoleStatus,
        moves,
        finalAttendance: attendanceClone,
        warnings
    };
}

export function mergeAttendance(summedAttendance, detailedAttendance) {
    // Safeguard: check both are arrays
    if (!Array.isArray(summedAttendance) || !Array.isArray(detailedAttendance)) {
        console.warn('⚠️ mergeAttendance: One or both arguments are not arrays', { summedAttendance, detailedAttendance });
        return;
    }

    // Safeguard: check expected length
    const expectedLength = 14;
    if (summedAttendance.length !== expectedLength) {
        console.warn(`⚠️ mergeAttendance: summedAttendance length mismatch(expected ${expectedLength})`, summedAttendance);
        return;
    }
    if (detailedAttendance.length !== expectedLength) {
        console.warn(`⚠️ mergeAttendance: detailedAttendance length mismatch(expected ${expectedLength})`, detailedAttendance);
        return;
    }

    // Merge values safely
    for (let i = 0; i < expectedLength; i++) {
        if (!Array.isArray(detailedAttendance[i]) || !Array.isArray(summedAttendance[i])) {
            console.warn(`Invalid attendance at index ${i}`, detailedAttendance[i]);
            continue;
        }
        for (let j = 0; j < 3; j++) {
            summedAttendance[i][j] += detailedAttendance[i][j] ?? 0;
        }
    }

}


function createEmptyDemand(roleCount = 14) {
    return Array(roleCount)
        .fill(null)
        .map(() => ({ min: 0, max: Infinity }));
}

function shrinkDemand(ruleset, timeframeSlot) {

    /**
     * TEMP / STATIC-ONLY DEMAND REDUCTION
     *
     * This function currently:
     * - builds STATIC demand only
     * - does NOT consider attendance
     * - is NOT used by the solver loop
     *
     * Do NOT call this from solveShift().
     * Kept for experimentation / future refactor.
     */

    const staticDemand = createEmptyDemand();

    const flexDemand = createEmptyDemand(); // filled later
    const effectiveDemand = mergeDemand(staticDemand, flexDemand);

    ruleset.forEach(rule => {
        const demands = extractTotalDemand(rule.dominantCondition, timeframeSlot);
        if (!demands) return;

        demands.forEach(({ roleId, min, max }) => {
            staticDemand[roleId].min = Math.max(staticDemand[roleId].min, min);
            staticDemand[roleId].max = Math.min(staticDemand[roleId].max, max);

            if (staticDemand[roleId].min > staticDemand[roleId].max) {
                throw new Error(`Impossible static demand for role ${roleId}`);
            }
        });
    });

    // staticDemand = buildStaticDemand(ruleset, timeframeSlot);
    // flexDemand = shrinkFlexDemand(flexRules, attendance, timeframeSlot);

    return { staticDemand, flexDemand };
}

function extractTotalDemand(condition, timeframeSlot) {

    if (!condition) return null;
    if (condition.roleLogicOperator !== "TOTAL") return null;
    if (!condition.subjectRoles || condition.subjectRoles.length === 0) return null;
    if (!condition.timeframeSlots.includes(timeframeSlot)) return null;

    return condition.subjectRoles.map(roleId => ({
        roleId,
        min: condition.lowerLimit ?? 0,
        max: condition.upperLimit ?? Infinity
    }));
}

function extractFlexibleDemand(rule, attendance, timeframeSlot) {
    if (!rule.appliesToTimeframe(timeframeSlot)) return null;

    switch (rule.type) {
        case 'WORKLOAD':
            return workloadDemand(rule, attendance);

        case 'CAPACITY':
            return capacityDemand(rule, attendance);

        case 'PRESENCE':
            return presenceDemand(rule, attendance);

        case 'SUPERVISION':
            return supervisionDemand(rule, attendance);

        default:
            return null;
    }
}

function shrinkFlexDemand(flexRules, attendance, timeframeSlot, roleCount = 14) {
    const flexDemand = createEmptyDemand(roleCount);

    flexRules.forEach(rule => {
        const deltas = extractFlexibleDemand(rule, attendance, timeframeSlot);
        if (!deltas) return;

        deltas.forEach(({ roleId, min, max }) => {
            if (min !== undefined) {
                flexDemand[roleId].min = Math.max(flexDemand[roleId].min, min);
            }
            if (max !== undefined) {
                flexDemand[roleId].max = Math.min(flexDemand[roleId].max, max);
            }
        });
    });

    return flexDemand;
}


function workloadDemand(rule, attendance) {
    const subjectCount = sumRoles(attendance, rule.subjectRoles);
    if (subjectCount === 0) return null;

    const required = Math.ceil(subjectCount / rule.ratio);

    return rule.targetRoles.map(roleId => ({
        roleId,
        min: required
    }));
}

function capacityDemand(rule, attendance) {
    const helpers = sumRoles(attendance, rule.helperRoles);
    const capacity = helpers * rule.capacityPerHelper;

    return rule.targetRoles.map(roleId => ({
        roleId,
        max: capacity
    }));
}

function presenceDemand(rule, attendance) {
    const subjectsExist = sumRoles(attendance, rule.subjectRoles) > 0;
    if (!subjectsExist) return null;

    return rule.targetRoles.map(roleId => ({
        roleId,
        min: rule.requiredMin ?? 1
    }));
}

function supervisionDemand(rule, attendance) {
    const supervisors = sumRoles(attendance, rule.supervisorRoles);
    const max = supervisors * rule.supervisionCapacity;

    return rule.targetRoles.map(roleId => ({
        roleId,
        max
    }));
}

function feasibilityCheck(attendance, staticDemand) {

    /*
      - Feasibility (pre-solve)	total = main + secondary + emergency
      - Demand satisfaction	main only
      - Reassignment source	secondary → emergency → main
      - Slack calculation	main vs min/max
      */


    /**
   * Hard feasibility gate.
   *
   * Uses TOTAL headcount (including secondary / tertiary)
   * to determine if a solution is even theoretically possible.
   *
   * Runs BEFORE solver.
   */

    return attendance.map((roleData, roleId) => {
        const hatSupply = roleData.reduce((s, v) => s + v, 0);
        const min = staticDemand[roleId]?.min ?? 0;

        return {
            roleId,
            feasible: hatSupply >= min
        };
    });
}


function sumAttendance(role) {
    if (!Array.isArray(role)) return 0;
    let total = 0;
    role.forEach(count => {
        total += count;
    });
    return total;
}

function sumTotalPerRole(attendance) {
    /**
   * Returns TOTAL headcount per role:
   * main + secondary + tertiary
   *
   * Used ONLY for feasibility checks.
   * Must NOT be used for demand satisfaction.
   */

    if (!Array.isArray(attendance)) return [];

    return attendance.map(role => {
        if (!Array.isArray(role)) return 0;
        return role.reduce((sum, count) => sum + (count ?? 0), 0);
    });
}

function cloneAttendance(attendance) {
    if (!Array.isArray(attendance)) return [];

    return attendance.map(role => {
        if (!Array.isArray(role)) return [0, 0, 0];
        return [...role]; // shallow copy is enough since inner arrays are primitive numbers
    });
}

function replaceRoleInCloneAttendance(cloneAttendance, oldRoleID, oldRoleRank, newRoleId, newRoleRank) {

    if (!Array.isArray(cloneAttendance[oldRoleID]) || !Array.isArray(cloneAttendance[newRoleId])) return cloneAttendance;
    if (cloneAttendance[oldRoleID][oldRoleRank] < 1) return cloneAttendance;

    cloneAttendance[oldRoleID][oldRoleRank] -= 1;
    cloneAttendance[newRoleId][newRoleRank] += 1;

    return cloneAttendance;
}

function computeRoleFlexibility(cloneAttendance, demand) {

    /**
   * Computes role status relative to demand.
   *
   * IMPORTANT:
   * - Uses MAIN count only (assigned employees)
   * - Secondary / tertiary are NOT counted as fulfilling demand
   * - SlackMin = how many MAIN employees can leave safely
   */


    if (!Array.isArray(cloneAttendance)) return [];

    return cloneAttendance.map((roleData, roleId) => {
        if (!Array.isArray(roleData)) roleData = [0, 0, 0];

        const mainCount = roleData[0]; // only main / NOT total attendance
        const hatSupply = roleData[0] + roleData[1] + roleData[2];

        const min = demand[roleId]?.min ?? 0;
        const max = demand[roleId]?.max ?? Infinity;

        const deficit = Math.max(min - mainCount, 0);   // how many needed to reach min
        const surplus = Math.max(mainCount - max, 0);   // how many exceed max

        const slackMin = Math.max(mainCount - min, 0);  // how much can safely leave
        const slackMax = Math.max(max - mainCount, 0);  // how much can safely add

        return { roleId, total: mainCount, deficit, surplus, slackMin, slackMax };
    });
}

/**
 * Rank roles by solver priority.
 *
 * This function does NOT decide moves.
 * It only defines the order in which roles should receive attention.
 *
 * Priority philosophy:
 * 1) Understaffing is always worse than overstaffing
 * 2) Larger violations matter more than smaller ones
 * 3) When equally bad, roles with less flexibility (tight slack) must be handled first
 *
 * Input:
 *   roleStatusArray = [
 *     {
 *       roleId,
 *       deficit,   // how many employees are missing to reach demand.min
 *       surplus,   // how many employees exceed demand.max
 *       slackMin,  // how many employees could safely leave this role
 *       slackMax   // how many employees could safely be added to this role
 *     }
 *   ]
 *
 * Output:
 *   Same objects, sorted by solver attention priority (highest first)
 */
function rankRolesByPriority(roleStatusArray) {
    return [...roleStatusArray].sort((a, b) => {

        // ─────────────────────────────────────────────
        // 1️⃣ Understaffed roles first
        // Roles missing people are more critical than any other issue
        // Example: deficit 2 must be fixed before deficit 1
        // ─────────────────────────────────────────────
        if (a.deficit !== b.deficit) {
            return b.deficit - a.deficit;
        }

        // ─────────────────────────────────────────────
        // 2️⃣ Overstaffed roles next
        // Costly but less critical than understaffing
        // Larger surplus should be handled before smaller surplus
        // ─────────────────────────────────────────────
        if (a.surplus !== b.surplus) {
            return b.surplus - a.surplus;
        }

        // ─────────────────────────────────────────────
        // 3️⃣ Tie-breaker: flexibility (slack)
        // Slack represents how freely the solver can move employees
        //
        // Tight roles (low slack) are risky:
        //   → few or no safe moves possible
        // Wide slack roles are flexible:
        //   → solver can rearrange without breaking constraints
        //
        // Therefore:
        //   less slack = higher priority
        // ─────────────────────────────────────────────
        const slackA = a.slackMin + a.slackMax;
        const slackB = b.slackMin + b.slackMax;

        return slackA - slackB;
    });
}

function mergeDemand(staticDemand, flexDemand) {
    return staticDemand.map((stat, roleId) => {
        const flex = flexDemand[roleId] ?? { min: 0, max: Infinity };

        const min = Math.max(stat.min, flex.min);
        const max = Math.min(stat.max, flex.max);

        if (min > max) {
            throw new Error(`Impossible demand after merge for role ${roleId}`);
        }

        return { min, max };
    });
}

/*
function solveAttendance(attendance, staticDemand, maxSteps = 5) {

    // once per shift (hard gate)
    const feasibility = feasibilityCheck(attendance, staticDemand);

    let steps = 0;
    while (steps < maxSteps) {
        steps++;

        // once per shift (hard gate)
        const feasibility = feasibilityCheck(attendance, staticDemand);
        // dynamic
        const flexDemand = shrinkFlexDemand(flexRules, attendance, timeframeSlot);

        // intersection only — flex never relaxes
        const effectiveDemand = mergeDemand(staticDemand, flexDemand);

        // solver always reasons against effectiveDemand
        const roleStatus = computeRoleFlexibility(attendance, effectiveDemand);

        // rank, simulate, commit...
    }

}
*/
export function createEmptyAttendance(roleCount = 14) {
    return Array(roleCount).fill(null).map(() => [0, 0, 0]);
}

function buildStaticDemand(ruleset, timeframeSlot) {
    const staticDemand = createEmptyDemand();

    ruleset.forEach(rule => {
        const demands = extractTotalDemand(rule.dominantCondition, timeframeSlot);
        if (!demands) return;

        demands.forEach(({ roleId, min, max }) => {
            staticDemand[roleId].min = Math.max(staticDemand[roleId].min, min);
            staticDemand[roleId].max = Math.min(staticDemand[roleId].max, max);

            if (staticDemand[roleId].min > staticDemand[roleId].max) {
                throw new Error(`Impossible static demand for role ${roleId}`);
            }
        });
    });

    return staticDemand;
}

function sumRoles(attendance, roleIds) {
    return roleIds.reduce((sum, roleId) => {
        const roleData = attendance[roleId] || [0, 0, 0];
        return sum + roleData.reduce((s, v) => s + v, 0);
    }, 0);
}


// -------------------- RULE CHECKS --------------------
// ===================================================
// we dont try to solve for weekly rule Violations 
// or handle and special situations
// in case of weekly or special checks we return ruleID warnings
// ===================================================


export function checkRulesForSpecial(specialName, shiftAttendance) {
    // console.log(`✅ Checking shift: ${shiftName}`);
    // console.table(shiftAttendance);
    // later: return violations array
}

// Check all weekly rules against weeklyAttendance
export function checkRulesForWeek(weeklyAttendance, machineRuleSet) {
    const violations = [];

    if (!machineRuleSet || !machineRuleSet.weekly) return;
    machineRuleSet.weekly.forEach(rule => {
        const roles = rule.dominantCondition.subjectRoles || [];
        const min = rule.dominantCondition.lowerLimit ?? 0;
        const max = rule.dominantCondition.upperLimit ?? Infinity;

        // Sum attendance across all days for relevant roles
        let total = 0;
        roles.forEach(roleName => {
            const roleData = weeklyAttendance[roleName] || [0, 0, 0];
            total += roleData.reduce((sum, val) => sum + val, 0);
        });

        if (total < min) {
            violations.push({
                icon: "🚨",
                title: `Zu wenige ${roles.join(", ")} in der Woche: ${total} von min.${min}`
            });
        }

        if (total > max) {
            violations.push({
                icon: "⚠️",
                title: `Zu viele ${roles.join(", ")} in der Woche: ${total} von max.${max}`
            });
        }
    });

    return violations;
}
