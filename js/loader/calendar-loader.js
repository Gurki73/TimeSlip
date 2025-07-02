const sampleCompanyHolidays = {};

let companyHolidays = {};
let officeDays = [];
let state = '';

async function loadCalendarData(api, year) {

    if (!api) {
        console.error('❌ window.api is not available in calendarLoader.js');
        return;
    }

    try {
        await Promise.all([
            loadCompanyHolidayData(api, year),
            (officeDays = await loadOfficeDaysData(api))
        ]);
    } catch (error) {
        console.error('Error loading calendar data:', error);
    }
    state = loadStateData();
    companyHolidays = [{ startDay: 2, startMonth: 1, endDay: 3, endMonth: 1 }];
}

//# region office days
let prilimaryOfficeDays = [];

const onboarding = ['full', 'never', 'never', 'full', 'full', 'full', 'full',];
const gastro = ['never', 'afternoon', 'full', 'full', 'full', 'full', 'full',];
const health = ['full', 'full', 'morning', 'full', 'full', 'never', 'never'];
const office = ['full', 'full', 'full', 'full', 'full', 'never', 'never'];
const logistics = ['full', 'full', 'full', 'full', 'full', 'full', 'never',];
const industrial = ['full', 'full', 'full', 'full', 'full', 'never', 'never'];
const hospitality = ['full', 'full', 'full', 'full', 'full', 'full', 'full'];
const shop = ['full', 'full', 'full', 'full', 'full', 'full', 'never', 'shop'];

async function loadOfficeDaysData(api, isOnboarding = false) {
    if (prilimaryOfficeDays.length > 0) {
        return prilimaryOfficeDays;
    }

    // 💡 Override with onboarding data
    if (isOnboarding) {
        console.log('🎓 Onboarding mode detected — using onboarding office days');
        prilimaryOfficeDays = onboarding;
        return prilimaryOfficeDays;
    }

    let homeKey = localStorage.getItem('clientDefinedDataFolder') || 'home';
    const relativePath = 'officeDays.csv';

    try {
        const fileData = await api.loadCSV(homeKey, relativePath);

        if (fileData) {
            console.log('✅ Loaded office days data from', homeKey, relativePath);
            return parseOfficeDaysCSV(fileData);
        } else {
            console.warn('⚠️ No office data found, using sample fallback.');
            prilimaryOfficeDays = gastro;
            return prilimaryOfficeDays;
        }
    } catch (error) {
        console.warn('❌ Failed to load office day data:', error);
        prilimaryOfficeDays = gastro;
        return prilimaryOfficeDays;
    }
}

export function setBranch(branch) {
    switch (branch) {
        case 'gastro':
            prilimaryOfficeDays = gastro;
            break;
        case 'health':
            prilimaryOfficeDays = office;
            break;
        case 'office':
            prilimaryOfficeDays = office;
            break;
        case 'logistics':
            prilimaryOfficeDays = logistics;
            break;
        case 'industrial':
            prilimaryOfficeDays = industrial;
            break;
        case 'hospitality':
            prilimaryOfficeDays = hospitality;
            break;
        case 'shop':
            prilimaryOfficeDays = shop;
            break
        default:
            prilimaryOfficeDays = onboarding;
            break;

    }
    return prilimaryOfficeDays;
}

export function updateOfficeDays(day, key) {

    prilimaryOfficeDays[day] = key;
}

function parseOfficeDaysCSV(data) {
    const rows = data.split('\n').map(row => row.trim()).filter(row => row);

    if (rows.length < 2) {
        console.warn('Office Days CSV is empty or missing data.');
        return;
    }
    const officeDaysRow = rows[1].split(',').map(day => day.trim());
    if (officeDaysRow.length !== 7) {
        console.error(`Office Days CSV does not have exactly 7 days. Found: ${officeDaysRow.length}`, officeDaysRow);
        return;
    }
    officeDays = officeDaysRow;
    return officeDays;
}
//# endregion 

function loadStateData() {

    const localState = localStorage.getItem('selectedState');
    if (localState) {
        console.log('Loaded state from localStorage: ', localState);
        return localState;
    }
    // Fallback to default
    const defaultState = 'NW'; // Nordrhein-Westfalen
    console.warn(`No state found. Falling back to default: ${defaultState}`);
    localStorage.setItem('selectedState', defaultState);
    return defaultState;
}

function saveStateData(currentState) {
    const trimmedState = currentState.trim();

    state = trimmedState;
    // Save to localStorage
    localStorage.setItem('selectedState', trimmedState);
    console.log('Saved state to localStorage: ', state);

}

function createCompanyHolidaySamples() {
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;

    sampleCompanyHolidays[currentYear] = [
        {
            startDate: new Date(`${currentYear}-10-10`),
            endDate: new Date(`${currentYear}-10-10`)
        },
        {
            startDate: new Date(`${currentYear}-07-22`),
            endDate: new Date(`${currentYear}-07-26`)
        },
        {
            startDate: new Date(`${currentYear}-12-26`),
            endDate: new Date(`${currentYear}-12-31`)
        }
    ];

    sampleCompanyHolidays[nextYear] = [
        {
            startDate: new Date(`${nextYear}-01-01`),
            endDate: new Date(`${nextYear}-01-09`)
        }
    ];
}

function loadSampleCompanyHolidaysData(year) {
    // Unlike other loaders, sampleCompanyHolidays are generated in JS
    // because they depend on dynamic years (e.g., current + next).
    // There's no static sample file like 'samples/companyHolidays/{year}.csv'.

    if (Object.keys(sampleCompanyHolidays).length === 0) {
        createCompanyHolidaySamples(); // Only runs once
    }

    return sampleCompanyHolidays[year] || [];
}

async function loadCompanyHolidayData(api, year) {

    const homeKey = localStorage.getItem('clientDefinedDataFolder') || 'home';
    const relativePath = `companyHolidays/${year}.csv`;

    console.log("Try to load company holidays:", relativePath);

    try {
        const fileData = await api.loadCSV(homeKey, relativePath);

        if (fileData) {
            console.log('✅ Loaded company holidays from', homeKey, relativePath);
            const parsed = parseCompanyHolidaysCSV(fileData);
            companyHolidays[year] = parsed;
            return parsed;
        } else {
            console.warn(`⚠️ No file found for year ${year}, falling back to sample.`);
            return loadSampleCompanyHolidaysData(year);

        }
    } catch (error) {
        console.warn(`❌ Error loading ${relativePath}, using sample fallback.`, error);
        return loadSampleCompanyHolidaysData(year);
    }
}

function parseCompanyHolidaysCSV(fileData) {
    const rows = fileData
        .split('\n')
        .slice(1) // skip header
        .map(row => row.trim())
        .filter(Boolean); // skip empty rows

    const holidays = rows.map(row => {
        const [startDateStr, endDateStr] = row.split(',').map(cell => cell.trim());
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr || startDateStr); // fallback to same-day holiday

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            console.warn('⛔ Invalid date in row:', row);
            return null;
        }

        return { startDate, endDate };
    }).filter(Boolean);

    // Sort by startDate ascending
    holidays.sort((a, b) => a.startDate - b.startDate);

    return holidays;
}

function generateCompanyHolidayCSV(companyHolidayArray) {
    const csvHeader = 'startDate,endDate';
    const csvBody = companyHolidayArray.map(period => {
        const start = period.startDate.toISOString().slice(0, 10); // yyyy-mm-dd
        const end = period.endDate.toISOString().slice(0, 10);
        return `${start},${end}`;
    });

    return [csvHeader, ...csvBody].join('\n');
}

async function saveCompanyHolidaysCSV(api, year, holidayData) {
    const csvContent = generateCompanyHolidayCSV(holidayData);

    const homeKey = localStorage.getItem('clientDefinedDataFolder') || 'home';
    const relativePath = `companyHolidays/${year}.csv`;

    try {
        const savedDirectory = await api.saveCSV(homeKey, relativePath, csvContent);
        if (savedDirectory) {
            console.log(`✅ Saved company holidays for ${year} to:`, savedDirectory);
            localStorage.setItem('clientDefinedDataFolder', savedDirectory);
        } else {
            console.warn('⚠️ Failed to save company holiday file.');
        }
    } catch (err) {
        console.error('❌ Error saving company holidays file:', err);
    }
}

//#region Public Holiday
function parsePublicHolidaysCSV(csvText) {
    const lines = csvText.trim().split('\n').filter(line => line.trim());

    const header = lines[0].split(',').map(h => h.trim().toLowerCase());

    if (!header.includes('id') || !header.includes('isopen')) {
        throw new Error('CSV header must include "id" and "isOpen" columns');
    }

    return lines.slice(1).map(line => {
        const cols = line.split(',').map(c => c.trim());
        const record = {};
        header.forEach((colName, i) => {
            record[colName] = cols[i];
        });
        const isOpenRaw = record.isopen.toLowerCase();
        const isOpen = ['true', 'yes', '1'].includes(isOpenRaw);
        return { id: record.id, isOpen };
    });
}

function serializePublicHolidaysCSV(data) {
    const header = ['id', 'isOpen'];
    const lines = data.map(({ id, isOpen }) => `${id},${isOpen}`);
    return [header.join(','), ...lines].join('\n');
}

export async function savePublicHolidays(api, publicHolidays) {
    const folderKey = localStorage.getItem('clientDefinedDataFolder') || 'home';
    const filename = 'publicHolidays.csv';
    try {
        const csvContent = serializePublicHolidaysCSV(publicHolidays); // **serialize**, not parse
        await api.saveCSV(folderKey, filename, csvContent);
        console.log('Public holidays saved successfully.');
    } catch (error) {
        console.error('Error saving public holidays:', error);
    }
}

export async function loadPublicHolidays(api) {
    const folderKey = localStorage.getItem('clientDefinedDataFolder') || 'home';
    const filename = 'publicHolidays.csv';
    try {
        const fileData = await api.loadCSV(folderKey, filename);
        if (fileData) {
            return parsePublicHolidaysCSV(fileData); // **parse**, not serialize
        } else {
            console.warn('No public holidays data found, using default sample.');
            return await loadSamplePublicHolidays();
        }
    } catch (error) {
        console.warn('Failed to load public holidays:', error);
        return await loadSamplePublicHolidays();
    }
}

async function loadSamplePublicHolidays() {
    const response = await fetch('samples/publicHolidays.csv');
    if (!response.ok) {
        throw new Error('Failed to load sample public holidays');
    }
    const csvText = await response.text();
    return parsePublicHolidaysCSV(csvText);
}
//#endregion


export {
    loadCalendarData,
    loadStateData,
    saveStateData,
    loadCompanyHolidayData,
    saveCompanyHolidaysCSV,
    loadOfficeDaysData,
    state,
    officeDays,
};

