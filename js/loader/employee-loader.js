import { loadFile, saveFile } from './loader.js';

const folderPath = 'employees';
let employees = [];

const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 1500;

export async function loadEmployeeData(api, attempt = 1) {
    if (!api) {
        console.error('[employee-loader.js] window.api not available');
        return;
    }

    let homeKey = localStorage.getItem('dataMode') || 'auto';
    const fileName = 'employee.csv';
    const clientDataFolder = localStorage.getItem('clientDefinedDataFolder');

    if (clientDataFolder) homeKey = 'client';

    try {
        const fileData = await loadFile(api, homeKey, `${folderPath}/${fileName}`, loadSampleEmployeeData, true);

        const loadedEmployeeData = typeof fileData === 'string'
            ? parseCSV(fileData)
            : Array.isArray(fileData)
                ? fileData
                : [];

        return loadedEmployeeData;
    } catch (error) {
        console.warn(`❌ Failed to load employee data (attempt ${attempt}):`, error);

        if (attempt < MAX_RETRIES) {
            console.warn(`⏳ Retrying in ${RETRY_DELAY_MS / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            await loadEmployeeData(api, attempt + 1);
        } else {
            console.error('⚠️ Max retries reached. return empty array');
            return [];
        }
    }
}



async function loadSampleEmployeeData() {
    try {
        const response = await fetch('samples/employee.csv');
        if (!response.ok) throw new Error('Sample CSV fetch failed');

        const data = await response.text();

        const parsedData =
            typeof data === 'string'
                ? parseCSV(data)
                : Array.isArray(data)
                    ? data
                    : [];

        return parsedData;
    } catch (error) {
        console.error('❌ Error loading sample employee data:', error);
        return []; // safe empty array fallback
    }
}

// ----------------- Parse CSV -----------------
function parseCSV(data) {
    if (!data) return [];
    const rows = data.split('\n').map(row => row.trim()).filter(Boolean);

    const employees = rows.slice(1).map(row => {
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
            shifts: { mon, tue, wed, thu, fri, sat, sun }
        };
    }).filter(emp => emp.personalEmoji !== '🗑️');

    return employees;
}


export function getDeletedEmployees() {
    return employees.filter(e => e.personalEmoji === '🗑️');
}

export async function saveEmployeeData(api, csvContent) {
    const fileName = 'employee.csv';
    try {
        const savedPath = await saveFile(api, folderPath, fileName, csvContent);
        if (savedPath) {
            // savedPath is full path to file; store the containing folder so the rest of your code works
            const folder = savedPath ? savedPath.replace(new RegExp(`/${fileName}$`), '') : null;
            if (folder) localStorage.setItem('clientDefinedDataFolder', folder);
        } else {
            console.warn('⚠ Failed to save employee data.');
        }
    } catch (err) {
        console.error('❌ Error saving employee data:', err);
        throw err;
    }
}

export function getTotalEmployeesByRole(roleID) {
    if (!roleID) return -99; return employees.reduce((count, emp) => {
        if (emp.mainRoleIndex === roleID) count += emp.roleSplitMain;
        if (emp.secondaryRoleIndex === roleID) count += emp.roleSplitSecondary;
        if (emp.tertiaryRoleIndex === roleID) count += emp.roleSplitTertiary;
        return count;
    }, 0) * 0.1; // Convert split ratio to fraction
}

export async function storeEmployeeChange(api, employeeData, action = "update") {
    if (!api) {
        console.error("[storeEmployeeChange] window.api not available");
        return;
    }

    // load current employees (array)
    let employeeBefore = await loadEmployeeData(api);
    if (!Array.isArray(employeeBefore)) employeeBefore = [];

    // ensure we have an id
    if (!employeeData.id) {
        employeeData.id = Date.now();
    }

    if (action === "delete") {
        employeeData.personalEmoji = "🚮";
        employeeData.endDate = new Date().toISOString().split("T")[0];
        action = "update"; // treat as update for saving
    }

    const existingIndex = employeeBefore.findIndex(emp => String(emp.id) === String(employeeData.id));

    if (existingIndex >= 0) {
        // update existing record
        if (action === "update" || action === "delete") {
            employeeBefore[existingIndex] = {
                ...employeeBefore[existingIndex],
                ...employeeData
            };
        } else if (action === "create") {
            // unlikely: id collides — overwrite to keep deterministic
            employeeBefore[existingIndex] = { ...employeeBefore[existingIndex], ...employeeData };
        }
    } else {
        // Not found
        if (action === "create") {
            // add new employee
            employeeBefore.push(employeeData);
            console.log(`➕ Added new employee id=${employeeData.id}`);
        } else if (action === "update") {
            // update requested but not found → fall back to adding as new (safer), but log clearly
            console.warn(`⚠ Employee with ID ${employeeData.id} not found for update — adding as new.`);
            employeeBefore.push(employeeData);
        } else {
            // other actions (shouldn't reach here)
            console.warn(`⚠ Unknown action "${action}" for employee id=${employeeData.id}. Adding as new by default.`);
            employeeBefore.push(employeeData);
        }
    }

    // Convert and save
    const employeeCSV = convertEmployeesToCSV(employeeBefore);
    try {
        await saveEmployeeData(api, employeeCSV);
        // Update in-memory `employees` array if you use it locally
        employees = employeeBefore;
    } catch (err) {
        console.error("❌ Failed to save employee changes:", err);
    }
}

export function convertEmployeesToCSV(employees = []) {
    // Define your column order and header string
    const headers = [
        "id",
        "name",
        "personalEmoji",
        "mainRoleIndex",
        "secondaryRoleIndex",
        "tertiaryRoleIndex",
        "availableDaysOff",
        "remainingDaysOff",
        "overtime",
        "mon",
        "tue",
        "wed",
        "thu",
        "fri",
        "sat",
        "sun",
        "roleSplitMain",
        "roleSplitSecondary",
        "roleSplitTertiary",
        "startDate",
        "endDate",
        "birthday",
        "birthMonth"
    ];

    const csvHeader = headers.join(",");

    const csvRows = employees.map(emp => {
        // Extract workdays, or default to 'never' for each day
        const workDays = Array.isArray(emp.workDays)
            ? emp.workDays
            : ["never", "never", "never", "never", "never", "never", "never"];

        // Build row according to header order
        const rowValues = [
            emp.id ?? "",
            sanitize(emp.name),
            emp.personalEmoji ?? "",
            emp.mainRoleIndex ?? "",
            emp.secondaryRoleIndex ?? "",
            emp.tertiaryRoleIndex ?? "",
            emp.availableDaysOff ?? "",
            emp.remainingDaysOff ?? "",
            emp.overtime ?? "",
            workDays[0] ?? "never",
            workDays[1] ?? "never",
            workDays[2] ?? "never",
            workDays[3] ?? "never",
            workDays[4] ?? "never",
            workDays[5] ?? "never",
            workDays[6] ?? "never",
            emp.roleSplitMain ?? "",
            emp.roleSplitSecondary ?? "",
            emp.roleSplitTertiary ?? "",
            emp.startDate ?? "",
            emp.endDate ?? "",
            emp.birthday ?? "",
            emp.birthMonth ?? ""
        ];

        // Escape commas, quotes, and newlines safely
        return rowValues.map(safeCSVValue).join(",");
    });

    return [csvHeader, ...csvRows].join("\n");
}

// Escape quotes and commas properly
function safeCSVValue(value) {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`; // escape double quotes
    }
    return str;
}

// Ensure no stray template placeholders
function sanitize(str) {
    if (!str) return "";
    return String(str).replace(/^\$\{|\}$/g, ""); // e.g. "${employee.name}" → "employee.name"
}

export function filterEmployeesByEndDate(employees) {
    const today = new Date();
    return employees.filter(emp => {
        if (!emp.endDate) return true; // assume ongoing
        const end = new Date(emp.endDate);
        return end >= today;
    });
}


export function filterEmployeesByMonthYear(employees, month, year) {
    return employees.filter(emp => {
        if (!emp.startDate || !emp.endDate) return false;
        const start = new Date(emp.startDate);
        const end = new Date(emp.endDate);
        const current = new Date(year, month - 1); // JS month is 0-based
        return start <= current && end >= current;
    });
}

export function checkEmployeesEndingToday(employees) {
    const todayStr = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
    return employees.filter(emp => emp.endDate === todayStr);
}



