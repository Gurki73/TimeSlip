import { checkRulesForDay, checkRulesForWeek } from "../../Components/calendar/calendar";

// js/eval/rule-eval-utils.js
export function dayHasVacationType(dayObj, wantedTypes = []) {
    // dayObj example: { date: '2025-11-15', absenceTypes: ['ferie','sick'] }
    if (!dayObj || !Array.isArray(wantedTypes) || wantedTypes.length === 0) return false;
    const present = dayObj.absenceTypes || [];
    return wantedTypes.some(t => present.includes(t));
}

/**
 * simulatePeriodValidation(rule, startDateIso, endDateIso, staffingProvider)
 * staffingProvider(dateIso) => attendance structure for that date (by role index)
 * Returns array of violations found in the period
 */
export async function simulatePeriodValidation(rule, startIso, endIso, staffingProvider) {
    const violations = [];
    const start = new Date(startIso);
    const end = new Date(endIso);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateIso = d.toISOString().slice(0, 10);
        const attendance = await staffingProvider(dateIso); // { roleIndex: [morning, day, late] }
        // reuse your checkRulesForDay logic here (you said it's already in place)
        const dayIndex = d.getDay() === 0 ? 6 : d.getDay() - 1; // map Sun→6, Mon→0
        const dayViolations = checkRulesForDay(dayIndex, attendance); // assumes this function is globally available
        if (Array.isArray(dayViolations) && dayViolations.length) {
            violations.push({ date: dateIso, violations: dayViolations });
        }
    }
    return violations;
}
