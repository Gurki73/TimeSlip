let employees = [];

async function loadEmployeeData(api) {

    let homeKey = localStorage.getItem('clientDefinedDataFolder') || 'home';
    const relativePath = 'employee.csv';

    try {
        const fileData = await api.loadCSV(homeKey, relativePath);

        if (fileData) {
            parseCSV(fileData);
        } else {
            console.warn('⚠ No employee data found, using sample fallback.');
            await loadSampleEmployeeData();
        }
    } catch (error) {
        console.warn('✗ Failed to load office day data:', error);
        await loadSampleEmployeeData();
    }
}

async function loadSampleEmployeeData() {
    try {
        const response = await fetch('samples/employee.csv');
        const data = await response.text();
        parseCSV(data);
    } catch (error) {
        console.warn('Error loading employee data:', error);
    }
}

function parseCSV(data) {
    const rows = data.split('\n').map(row => row.trim()).filter(row => row);

    employees = rows.slice(1).map(row => {
        const [
            id, name, personalEmoji, mainRoleIndex, secondaryRoleIndex, tertiaryRoleIndex,
            availableDaysOff, remainingDaysOff, overtime,
            mon, tue, wed, thu, fri, sat, sun,
            roleSplitMain, roleSplitSecondary, roleSplitTertiary,
            startDate, endDate, birthday, birthMonth
        ] = row.split(',');

        return {
            id: parseInt(id) || null,
            name: name || '',
            personalEmoji: personalEmoji || '',
            mainRoleIndex: mainRoleIndex ? parseInt(mainRoleIndex) : null,
            secondaryRoleIndex: secondaryRoleIndex ? parseInt(secondaryRoleIndex) : null,
            tertiaryRoleIndex: tertiaryRoleIndex ? parseInt(tertiaryRoleIndex) : null,
            availableDaysOff: parseFloat(availableDaysOff) || 0,
            remainingDaysOff: parseFloat(remainingDaysOff) || 0,
            overtime: parseFloat(overtime) || 0,
            workDays: [mon, tue, wed, thu, fri, sat, sun].map(day => day || 'never'),
            roleSplitMain: parseFloat(roleSplitMain) || 0,
            roleSplitSecondary: parseFloat(roleSplitSecondary) || 0,
            roleSplitTertiary: parseFloat(roleSplitTertiary) || 0,
            startDate: startDate || '',
            endDate: endDate || '',
            birthday: birthday || '',
            birthMonth: birthMonth || '',
            shifts: {
                mon, tue, wed, thu, fri, sat, sun
            }
        };
    }).filter(employee => employee.name && employee.name !== '?');

    employees.sort((a, b) => {
        if (a.mainRoleIndex === null) return 1;
        if (b.mainRoleIndex === null) return -1;
        return a.mainRoleIndex - b.mainRoleIndex;
    });
}

async function generateEmployeeCSV(api) {
    const csvHeader = 'id,name,personalEmoji,mainRoleIndex,secondaryRoleIndex,tertiaryRoleIndex,availableDaysOff,remainingDaysOff,overtime,mon,tue,wed,thu,fri,sat,sun,roleSplitMain,roleSplitSecondary,roleSplitTertiary,startDate,endDate,birthday,birthMonth,shiftMon,shiftTue,shiftWed,shiftThu,shiftFri,shiftSat,shiftSun';

    const csvContent = [
        csvHeader,
        ...employees.map(employee =>
            `${employee.id || ''},${employee.name},${employee.personalEmoji},${employee.mainRoleIndex || ''},${employee.secondaryRoleIndex || ''},${employee.tertiaryRoleIndex || ''},${employee.availableDaysOff},${employee.remainingDaysOff},${employee.overtime},${employee.workDays[0]},${employee.workDays[1]},${employee.workDays[2]},${employee.workDays[3]},${employee.workDays[4]},${employee.workDays[5]},${employee.workDays[6]},${employee.roleSplitMain},${employee.roleSplitSecondary},${employee.roleSplitTertiary},${employee.startDate},${employee.endDate},${employee.birthday},${employee.birthMonth},${employee.shifts.mon || ''},${employee.shifts.tue || ''},${employee.shifts.wed || ''},${employee.shifts.thu || ''},${employee.shifts.fri || ''},${employee.shifts.sat || ''},${employee.shifts.sun || ''}`
        )
    ].join('\n');

    const uniquePathName = generateUniqueFileName(); // Generate unique path
    const uniqueFileName = 'employee.csv';

    try {
        await api.saveCSV(uniquePathName, uniqueFileName, csvContent);
    } catch (err) {
        console.warn('Error saving employee data:', err);
    }
}

function generateUniqueFileName() {
    const pathname = window.location.pathname.split('/');
    const folderPath = pathname.slice(1, -1).join('/');

    return folderPath ? `${folderPath}/` : `data/`;
}

export function getTotalEmployeesByRole(roleID) {

    if (roleID === 0 || !roleID) return -99;

    let roleCount = 0;

    if (!employees || employees.length === 0) return 0; // Safe check

    employees.forEach(emp => {
        if (emp.mainRoleIndex === roleID) roleCount += emp.roleSplitMain;
        if (emp.secondaryRoleIndex === roleID) roleCount += emp.roleSplitSecondary;
        if (emp.tertiaryRoleIndex === roleID) roleCount += emp.roleSplitTertiary;
    });

    return roleCount * 0.1; // Convert split ratio to fraction
}




export { loadEmployeeData, employees, generateEmployeeCSV };
