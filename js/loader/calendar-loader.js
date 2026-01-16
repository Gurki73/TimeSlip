import { boolsToKey } from '../../Components/forms/calendar-form/calendar-form-utils.js';
import { loadFile, saveFile } from './loader.js';

const sampleCompanyHolidays = {};
let companyHolidays = {};
let bridgeDayState = {};
let officeDays = [];
let state = '';

function parsePublicHolidaysCSV(csvText) {
    const lines = csvText.trim().split('\n').filter(line => line.trim());
    const header = lines[0].split(',').map(h => h.trim().toLowerCase());

    if (!header.includes('id') || !header.includes('isopen')) {
        throw new Error('CSV header must include "id" and "isOpen" columns');
    }

    return lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim());
        const record = {};
        header.forEach((colName, i) => (record[colName] = cols[i]));
        const isOpenRaw = record.isopen.toLowerCase();
        return { id: record.id, isOpen: ['true', 'yes', '1'].includes(isOpenRaw) };
    });
}

function serializePublicHolidaysCSV(data) {
    const header = ['id', 'isOpen'];
    const lines = data.map(({ id, isOpen }) => `${id},${isOpen}`);
    return [header.join(','), ...lines].join('\n');
}

export async function loadPublicHolidaysSimple(api) {
    try {
        const csvText = await loadFile(api, 'client', 'calendar/publicHolidays.csv', () => '');
        return csvText ? parsePublicHolidaysCSV(csvText) : [];
    } catch (err) {
        console.warn('Failed to load public holidays, using empty:', err);
        return [];
    }
}

export async function savePublicHolidaysSimple(api, data) {
    const csv = serializePublicHolidaysCSV(data);
    await saveFile(api, 'calendar', 'publicHolidays.csv', csv);
}



//#region Office Days
let prilimaryOfficeDays = [];
let lastOnboardingState = null;

const defaultOfficeDays = ['full', 'full', 'full', 'full', 'full', 'never', 'never'];
const gastro = ['never', 'afternoon', 'full', 'full', 'full', 'full', 'full'];

export async function loadOfficeDaysData(api, isOnboarding = false) {
    if (isOnboarding) {
        return defaultOfficeDays;
    }

    if (prilimaryOfficeDays.length > 0 && lastOnboardingState === isOnboarding)
        return prilimaryOfficeDays;

    lastOnboardingState = isOnboarding;

    const folderPath = 'calendar';
    const fileName = 'officeDays.csv';

    try {
        const fileData = await loadFile(api, 'client', 'calendar/officeDays.csv', async () => {
            console.warn('⚠️ No office data found, using default sample');
            return gastro.join(','); // optional: return as CSV string if parseOfficeDaysCSV expects that
        });

        const result = parseOfficeDaysCSV(fileData);

        if (result.length < 1) {
            console.warn('⚠️ Parsed office data is empty, using default gastro values');
            return defaultOfficeDays;
        }

        return result;
    } catch (err) {
        console.warn('❌ Error loading office days data:', err);
        return defaultOfficeDays;
    }
}

//#region Bridge Days
function parseBridgeDaysCSV(csvText) {
    if (!csvText) return [];

    const lines = csvText.trim().split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());
    if (!header.includes('id') || !header.includes('isopen')) {
        console.warn('⚠️ BridgeDays CSV missing expected header id,isOpen');
        return [];
    }

    return lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim());
        const record = {};
        header.forEach((colName, i) => (record[colName] = cols[i]));
        const isOpenRaw = record.isopen.toLowerCase();
        return { id: record.id, isOpen: ['true', 'yes', '1'].includes(isOpenRaw) };
    });
}

function serializeBridgeDaysCSV(dataArray) {
    const header = ['id', 'isOpen'];
    const lines = dataArray.map(({ id, isOpen }) => `${id},${isOpen}`);
    return [header.join(','), ...lines].join('\n');
}

export async function loadBridgeDays(api) {
    try {
        const csvText = await loadFile(api, 'client', 'calendar/bridgeDays.csv', () => '');
        const parsed = parseBridgeDaysCSV(csvText);
        bridgeDayState = Object.fromEntries(parsed.map(({ id, isOpen }) => [id, isOpen]));
        return parsed;
    } catch (err) {
        console.warn('Failed to load bridge days, returning empty:', err);
        return [];
    }
}

export async function saveBridgeDaysSimple(api, dataArray) {
    const csv = serializeBridgeDaysCSV(dataArray);
    await saveFile(api, 'calendar', 'bridgeDays.csv', csv);
}
//#endregion


export function setBranch(branch) {
    switch (branch) {
        case 'gastro': prilimaryOfficeDays = gastro; break;
        case 'health': prilimaryOfficeDays = office; break;
        case 'office': prilimaryOfficeDays = office; break;
        case 'logistics': prilimaryOfficeDays = logistics; break;
        case 'industrial': prilimaryOfficeDays = industrial; break;
        case 'hospitality': prilimaryOfficeDays = hospitality; break;
        case 'shop': prilimaryOfficeDays = shop; break;
        default: prilimaryOfficeDays = onboarding; break;
    }
    return prilimaryOfficeDays;
}

export function updateOfficeDays(day, key) {
    prilimaryOfficeDays[day] = key;
}

function parseOfficeDaysCSV(data) {
    if (!data) return [];
    const rows = data.split('\n').map(r => r.trim()).filter(r => r);
    if (rows.length < 2) return [];
    const officeDaysRow = rows[1].split(',').map(d => d.trim());
    officeDays = officeDaysRow.length === 7 ? officeDaysRow : [];
    return officeDays;
}
//#endregion

//#region Company Holidays
function createCompanyHolidaySamplesCSV() {
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;

    const samples = [
        { startDate: `${currentYear}-10-10`, endDate: `${currentYear}-10-10` },
        { startDate: `${currentYear}-07-22`, endDate: `${currentYear}-07-26` },
        { startDate: `${currentYear}-12-26`, endDate: `${currentYear}-12-31` },
        { startDate: `${nextYear}-01-01`, endDate: `${nextYear}-01-09` },
    ];

    // Turn array into CSV string
    const csvHeader = 'startDate,endDate';
    const csvBody = samples.map(s => `${s.startDate},${s.endDate}`);
    const csvString = [csvHeader, ...csvBody].join('\n');

    return csvString;
}

function serializeCompanyHolidaysCSV(data) {
    const header = ['startDate', 'endDate'];
    const lines = data.map(({ startDate, endDate }) => `${startDate},${endDate}`);
    return [header.join(','), ...lines].join('\n');
}

export async function saveCompanyHolidaysSimple(api, data) {
    const csv = serializeCompanyHolidaysCSV(data);
    await saveFile(api, 'calendar', 'companyHolidays.csv', csv);
}

function loadSampleCompanyHolidaysData(year) {

    if (Object.keys(sampleCompanyHolidays).length === 0) return createCompanyHolidaySamplesCSV();
    return sampleCompanyHolidays[year] || [];
}

export async function loadCompanyHolidayData(api, year) {
    const dataMode = localStorage.getItem('dataMode') || 'auto';

    // 1️⃣ Sample mode → always return sample data
    if (dataMode === 'sample') {
        const csv = createCompanyHolidaySamplesCSV();
        return parseCompanyHolidaysCSV(csv);
    }

    // 2️⃣ Client mode → load real file
    const folderPath = 'calendar/companyHolidays';
    const fileName = `${year}.csv`;

    try {
        const fileData = await loadFile(
            api,
            'client',
            `${folderPath}/${fileName}`,
            async () => createCompanyHolidaySamplesCSV()
        );

        if (!fileData || fileData.trim() === '') {
            console.warn(`⚠️ No company holiday file found for ${year}, returning empty array`);
            return [];
        }

        const holidays = parseCompanyHolidaysCSV(fileData);

        if (!holidays || holidays.length === 0) {
            console.warn(`⚠️ Parsed empty holidays for ${year}`);
            return [];
        }

        return holidays;

    } catch (err) {
        console.error(`❌ Failed to load company holidays for ${year}:`, err);
        return [];
    }
}

function parseCompanyHolidaysCSV(fileData) {
    if (!fileData) return [];
    const rows = fileData.split('\n').slice(1).map(r => r.trim()).filter(Boolean);
    const holidays = rows.map(row => {
        const [startDateStr, endDateStr] = row.split(',').map(c => c.trim());
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr || startDateStr);
        return isNaN(startDate) || isNaN(endDate) ? null : { startDate, endDate };
    }).filter(Boolean);
    holidays.sort((a, b) => a.startDate - b.startDate);
    companyHolidays = holidays;
    return holidays;
}

function generateCompanyHolidayCSV(companyHolidayArray) {
    const csvHeader = 'startDate,endDate';

    const csvBody = companyHolidayArray.map(p => {
        const start = (p.startDate instanceof Date)
            ? p.startDate
            : new Date(p.startDate);

        const end = (p.endDate instanceof Date)
            ? p.endDate
            : new Date(p.endDate);

        return `${start.toISOString().slice(0, 10)},${end.toISOString().slice(0, 10)}`;
    });

    return [csvHeader, ...csvBody].join('\n');
}


function calendarStateToCSV(state) {
    const header = 'mo,di,mi,do,fr,sa,so';
    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

    const row = days.map(day => boolsToKey(state[day])).join(',');
    return `${header}\n${row}`;
}

export async function saveOfficeDays(api, calendarState) {
    const folderPath = 'calendar';
    const fileName = 'officeDays.csv';

    console.log(" save office days ", calendarState);

    const csvContent = calendarStateToCSV(calendarState);

    try {
        const savedPath = await saveFile(api, folderPath, fileName, csvContent);
        if (!savedPath) {
            console.warn('⚠️ Failed to save calendar CSV.');
        }
    } catch (err) {
        console.error('❌ Error saving calendar CSV:', err);
    }
}


export async function saveCompanyHolidaysCSV(api, year, holidayData) {
    const folderPath = 'calendar';
    const fileName = `companyHolidays/${year}.csv`;
    const csvContent = generateCompanyHolidayCSV(holidayData);
    await saveFile(api, folderPath, fileName, csvContent);
}
//#endregion

// loadStateData
export async function loadStateData(api) {
    if (!api) throw new Error('API reference missing for loadStateData');
    const homeKey = localStorage.getItem('dataMode') || 'auto';
    if (homeKey === 'sample') return 'NI';

    try {
        const txt = await loadFile(api, 'client', 'calendar/state.txt', null, true);
        if (txt && txt.trim().length === 2) {
            state = txt.trim().toUpperCase();
            return state;
        }
        console.warn('⚠️ Invalid state.txt, falling back to default');
        state = 'XX';
        return state;
    } catch (err) {
        console.error('❌ Error loading state:', err);
        state = 'XX';
        return state;
    }
}

// saveStateData
export async function saveStateData(api, currentState) {
    if (!api) throw new Error('API reference missing for saveStateData');
    try {
        state = currentState.trim().toUpperCase();
        const savedPath = await saveFile(api, 'calendar', 'state.txt', state);
        return savedPath;
    } catch (err) {
        console.error('❌ Error saving state:', err);
        throw err;
    }
}


export async function loadCalendarData(api, year) {
    if (!api) throw new Error('API missing in calendar loader');
    let holidays = [];
    let officeDaysData = [];
    try {
        holidays = await loadCompanyHolidayData(api, year);
        officeDaysData = await loadOfficeDaysData(api);
    } catch (error) {
        console.error('Error loading calendar data:', error);
    }
    const stateValue = loadStateData(api);
    return { holidays, officeDays: officeDaysData, state: stateValue };
}

export { state, officeDays };
