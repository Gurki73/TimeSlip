export function getShiftSymbol(shiftType, cachedShiftSymbols) {
    switch (cachedShiftSymbols) {
        case 'letters':
            return {
                early: 'f:',
                day: 't:',
                late: 's:',
            }[shiftType] || '';

        case 'empty':
            return '';

        case 'emoji':
        default:
            return {
                early: '🐓',
                day: '🍴',
                late: '🌜',
            }[shiftType] || '';
    }
}
