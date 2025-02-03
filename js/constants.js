// constants.js
export const SELECTORS = {
    MAIN: {
        REPEAT: '#request-type-select-repeats',
        TIME: '#request-type-select-time',
        AMOUNT: '#request-type-select-amount',
        GROUP: '#request-type-select-group',
        DEPENDENCY: '#request-type-select-dependency',
        EXCEPTION: '#request-type-select-exception'
    },
    EXCEPTION: {
        REPEAT: '#ex-request-type-select-repeats',
        TIME: '#ex-request-type-select-time',
        AMOUNT: '#ex-request-type-select-amount',
        GROUP: '#ex-request-type-select-group',
        DEPENDENCY: '#ex-request-type-select-dependency'
    }
};

export const RULE_RELATIONS = [
    { id: 'd0', forbidden: ['t4'], mandatory: ['exception'], warning: 'contradiction' },
    { id: 'd1', forbidden: ['t4'], mandatory: [], warning: 'unnecessary' },
    { id: 't4', forbidden: ['d0', 'd1'], mandatory: ['repeats'], warning: 'contradiction' },
];

export const EXCEPTION_TEXTS = {
    E0: ' - - - ',
    E1: 'und',
    E2: 'oder',
    E3: 'aber',
    E4: 'außer',
    E5: 'aber nicht mehr als',
    E6: 'aber nicht weniger',
};