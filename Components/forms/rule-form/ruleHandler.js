const newRule = {
    "W": { "id": "...", "bottomLimit": "int"    , "upperLimit" : "int" },
    "T": { "id": "...", "startDay"   : "string" , "endDay"     : "string", "shift" : "string" },
    "A": { "id": "...", "bottomLimit": "int"    , "upperLimit" : "int" },
    "G": { "id": "...", "isAnd"      : "bool"   , "group"      : "array" },
    "D": { "id": "...", "value"      : "..."    , "extra"      : "..." },
    "E": { "id": "..." },  
    "w": { "id": "...", "bottomLimit": "int"    , "upperLimit" : "int" },
    "t": { "id": "...", "startDay"   : "string" , "endDay"     : "string", "shift" : "string" },
    "a": { "id": "...", "bottomLimit": "int"    , "upperLimit" : "int" },
    "g": { "id": "...", "isAnd"      : "bool"   , "group"      : "array" },
    "d": { "id": "...", "ratio1"     : "int"    , "ratio2"     : "int" }
};

function checkNumber(value1, value2, bottomLimit, upperLimit) {

    return value1 >= bottomLimit && value1 <= upperLimit;
}

function checkGroup (value, inputArray, isAnd) {

    if (isAnd === 'and') {
        return inputArray.every(item => value.includes(item));
    } else {
        return inputArray.some(item => value.includes(item));
    }
    return true;
}

function checkException(id, mainCondition, exceptionCondition) {
    switch (id) {
        case "E0": // No exception
            return mainCondition;
        case "E1": // AND condition
            return mainCondition && exceptionCondition;
        case "E2": // OR condition
            return mainCondition || exceptionCondition;
        case "E3": // BUT: override if conditions differ
            return mainCondition === exceptionCondition ? mainCondition : exceptionCondition;
        case "E4": // EXCEPT: prioritize exception if true
            return exceptionCondition ? exceptionCondition : mainCondition;
        case "E5": // NOT MORE THAN (inverse logic)
            return exceptionCondition ? mainCondition : exceptionCondition;
        case "E6": // NOT LESS THAN (similar inverse logic)
            return exceptionCondition ? mainCondition : exceptionCondition;
    }
    return true; // Default: main condition stands if no match
}

function checkTimeframe( currentDay, startTime, endDay) {

    return currentDay < startDay && currentDay > endDay 
}

function checkShift ( curentShift, shift) {
    
    if ( curentShift === 'morning' ) {
        if ( shift !== 'afternoon') return true;
        return false;
    }

    if ( curentShift === 'afternoon' ) {
        if ( shift !== 'morning') return true;
        return false;
    }
    return true
}

function checkDependencys( id, role1, role2, ratio1, ratio2) {
    
    switch (id.toLowerCase()) {
    case "d0": // anwesend
        return role1 > 0;
    case "d1": // abwesend
        return role1 < 1;
    case "d2": // braucht
        return role2 > ratio * role1;
    case "d3": // hilft
        return role1 < ratio *role1;
    case "d4": // im Verhältnis 🧩
        return role1 * ratio1 < role2 *ratio2;
    }
}

