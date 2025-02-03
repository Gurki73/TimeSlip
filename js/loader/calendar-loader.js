let companyHolidays = [];
let officeDays = [];
let state = '';

async function loadCalendarData() {
    try {
        await Promise.all([
            (state = await loadStateData()),
            loadCompanyHolidaysData(),
            (officeDays = await loadOfficeDaysData())
        ]);
    } catch (error) {
        console.error('Error loading calendar data:', error);
    }
    companyHolidays = [{ startDay: 2, startMonth: 1, endDay: 3, endMonth: 1 }];
}


async function loadStateData() {
    try {
        const response = await fetch('data/state.csv');
        const data = await response.text();
        state = data.split('\n')[1].trim();
    } catch (error) {
        console.error('Error loading state data:', error);
        return null;
    }
    return state;
}

async function loadCompanyHolidaysData() {
    return companyHolidays;
    //try {
    //    const response = await fetch('data/companyHolidays.csv');
    //    const data = await response.text();
    //    parseCompanyHolidaysCSV(data);
    //} catch (error) {
    //    console.error('Error loading company holiday data:', error);
    //}
}

function parseCompanyHolidaysCSV(data) {
    const rows = data.split('\n').slice(1).filter(row => row.trim());
    companyHolidays = rows.map(row => {
        const [startDate, endDate] = row.split(',');
        return {
            startDate: new Date(startDate.trim()),
            endDate: new Date(endDate.trim())
        };
    });
}

async function loadOfficeDaysData() {
    try {
        const response = await fetch('data/officeDays.csv');
        if (!response.ok) {
            throw new Error(`Failed to fetch: ${response.statusText}`);
        }
        const data = await response.text();
        return parseOfficeDaysCSV(data);
    } catch (error) {
        console.error('Error loading office days data:', error);
        return null;
    }
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

async function saveStateData(currentState) {
    const fileContent = `${currentState.trim()}\n`;
    const fileName = 'state.txt';

    try {
        const filePath = await ipcRenderer.invoke('show-save-dialog', fileName);
        if (filePath) {
            await ipcRenderer.invoke('save-file', filePath, fileContent);
        }
    } catch (err) {
        console.error('Error saving state:', err);
    }
}

export { loadCalendarData, loadStateData, saveStateData, state, companyHolidays, loadOfficeDaysData, officeDays }
