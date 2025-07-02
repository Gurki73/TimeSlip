export let employees = [];

export async function loadEmployeeData(api) {

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

export async function saveEmployeeData(api, employeeData) {
    const folderKey = localStorage.getItem('clientDefinedDataFolder') || 'home';
    const filename = 'employee.csv';

    const csvHeader = 'id,name,personalEmoji,mainRoleIndex,secondaryRoleIndex,tertiaryRoleIndex,availableDaysOff,remainingDaysOff,overtime,mon,tue,wed,thu,fri,sat,sun,roleSplitMain,roleSplitSecondary,roleSplitTertiary,startDate,endDate,birthday,birthMonth';

    const csvContent = [
        csvHeader,
        ...employeeData.map(emp => {
            const workDays = emp.workDays || ['never', 'never', 'never', 'never', 'never', 'never', 'never'];
            return [
                emp.id ?? '',
                emp.name,
                emp.personalEmoji,
                emp.mainRoleIndex ?? '',
                emp.secondaryRoleIndex ?? '',
                emp.tertiaryRoleIndex ?? '',
                emp.availableDaysOff ?? 0,
                emp.remainingDaysOff ?? 0,
                emp.overtime ?? 0,
                ...workDays,
                emp.roleSplitMain ?? 0,
                emp.roleSplitSecondary ?? 0,
                emp.roleSplitTertiary ?? 0,
                emp.startDate ?? '',
                emp.endDate ?? '',
                emp.birthday ?? '',
                emp.birthMonth ?? ''
            ].join(',');
        })
    ].join('\n');

    try {
        const savedDir = await api.saveCSV(folderKey, filename, csvContent);
        if (savedDir) {
            console.log('Employee data saved successfully.');
            localStorage.setItem('clientDefinedDataFolder', savedDir);
        } else {
            console.warn('Failed to save employee data.');
        }
    } catch (error) {
        console.error('Error saving employee data:', error);
        throw error;
    }
}

