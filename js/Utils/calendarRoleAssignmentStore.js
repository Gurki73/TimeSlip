const STORAGE_KEY = 'calendar-role-assignment-plans-v1';
const STORAGE_VERSION = 1;
const MAX_PLAN_COUNT = 5000;

function readStore() {
    if (typeof localStorage === 'undefined') return null;

    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if (parsed?.version !== STORAGE_VERSION || !parsed.plans || typeof parsed.plans !== 'object') {
            return { version: STORAGE_VERSION, plans: {} };
        }
        return parsed;
    } catch (error) {
        console.warn('[Calendar][Assignments] Could not read saved plans:', error);
        return { version: STORAGE_VERSION, plans: {} };
    }
}

export function loadCalendarRoleAssignmentPlan(key, signature) {
    const store = readStore();
    if (!store || !key || typeof signature !== 'string') return null;

    const plan = store.plans[key];
    if (plan?.signature !== signature || !Array.isArray(plan.assignments)) return null;
    return plan.assignments;
}

export function saveCalendarRoleAssignmentPlan(key, signature, assignments) {
    if (typeof localStorage === 'undefined' || !key || typeof signature !== 'string' || !Array.isArray(assignments)) {
        return false;
    }

    const store = readStore() || { version: STORAGE_VERSION, plans: {} };
    store.plans[key] = {
        signature,
        assignments,
        updatedAt: Date.now()
    };

    const planKeys = Object.keys(store.plans);
    if (planKeys.length > MAX_PLAN_COUNT) {
        planKeys
            .sort((left, right) => (store.plans[left]?.updatedAt ?? 0) - (store.plans[right]?.updatedAt ?? 0))
            .slice(0, planKeys.length - MAX_PLAN_COUNT)
            .forEach(planKey => delete store.plans[planKey]);
    }

    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
        return true;
    } catch (error) {
        console.warn('[Calendar][Assignments] Could not save plans:', error);
        return false;
    }
}