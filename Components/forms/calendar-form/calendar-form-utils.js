export function keyToBools(key) {
    switch (key) {
        case 'never': return { early: false, day: false, late: false };
        case 'morning': return { early: true, day: false, late: false };
        case 'day': return { early: false, day: true, late: false };
        case 'afternoon': return { early: false, day: false, late: true };
        case 'two': return { early: true, day: false, late: true };
        case 'earlyDay': return { early: true, day: true, late: false };
        case 'lateDay': return { early: false, day: true, late: true };
        case 'full': return { early: true, day: true, late: true };
        default:
            throw new Error(`Unknown shift key: ${key}`);
    }
}

export function boolsToKey({ early, day, late }) {
    if (!early && !day && !late) return 'never';
    if (early && !day && !late) return 'morning';
    if (!early && day && !late) return 'day';
    if (!early && !day && late) return 'afternoon';
    if (early && !day && late) return 'two';
    if (early && day && !late) return 'earlyDay';
    if (!early && day && late) return 'lateDay';
    if (early && day && late) return 'full';
    // (should never reach here)
    throw new Error(`Invalid shift booleans: ${early},${day},${late}`);
}