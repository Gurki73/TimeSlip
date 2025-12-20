export function keyToBools(key) {

    switch (key) {
        case 'never': return { early: false, day: false, late: false };
        case 'early': return { early: true, day: false, late: false };
        case 'day': return { early: false, day: true, late: false };
        case 'late': return { early: false, day: false, late: true };
        case 'two': return { early: true, day: false, late: true };
        case 'earlyDay': return { early: true, day: true, late: false };
        case 'lateDay': return { early: false, day: true, late: true };
        case 'full': return { early: true, day: true, late: true };
        case 'shool': return { early: false, day: false, late: false };
        case 'school': return { early: false, day: false, late: false };

        default:
            console.warn(`Unknown shift key: ${key}`);
            console.trace();
            return { early: false, day: false, late: false };
    }
}


export function boolsToKey({ early, day, late }) {
    if (!early && !day && !late) return 'never';
    if (early && !day && !late) return 'early';
    if (!early && day && !late) return 'day';
    if (!early && !day && late) return 'late';
    if (early && !day && late) return 'two';
    if (early && day && !late) return 'earlyDay';
    if (!early && day && late) return 'lateDay';
    if (early && day && late) return 'full';
    // (should never reach here)
    throw new Error(`Invalid shift booleans: ${early},${day},${late}`);
}