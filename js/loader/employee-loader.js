import { loadFile, saveFile } from './loader.js';

const folderPath = 'employees';
let employees = [];

const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 1500;
const SAMPLE_REFERENCE_DATE = "2026-02-26";

export async function loadEmployeeData(api, attempt = 1) {
    if (!api) {
        console.error('[employee-loader.js] window.api not available');
        return [];
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

        return filterActiveEmployees(loadedEmployeeData);
    } catch (error) {
        console.warn(`❌ Failed to load employee data (attempt ${attempt}):`, error);

        if (attempt < MAX_RETRIES) {
            console.warn(`⏳ Retrying in ${RETRY_DELAY_MS / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            return await loadEmployeeData(api, attempt + 1);
        } else {
            console.error('⚠️ Max retries reached. return empty array');
            return [];
        }
    }
}

export async function loadDeletedEmployeeData(api, attempt = 1) {
    if (!api) {
        console.error('[employee-loader.js] window.api not available');
        return [];
    }

    let homeKey = localStorage.getItem('dataMode') || 'auto';
    const fileName = 'employee.csv';
    const clientDataFolder = localStorage.getItem('clientDefinedDataFolder');

    if (clientDataFolder) homeKey = 'client';

    try {
        const fileData = await loadFile(api, homeKey, `${folderPath}/${fileName}`, loadSampleEmployeeData, true);

        const loadedEmployeeData = typeof fileData === 'string'
            ? parseCSV(fileData,)
            : Array.isArray(fileData)
                ? fileData
                : [];

        return filterDeletedEmployees(loadedEmployeeData);
    } catch (error) {
        console.warn(`❌ Failed to load employee data (attempt ${attempt}):`, error);

        if (attempt < MAX_RETRIES) {
            console.warn(`⏳ Retrying in ${RETRY_DELAY_MS / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            return await loadDeletedEmployeeData(api, attempt + 1);
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

        return filterActiveEmployees(
            parsedData.map(e => ({
                ...e,
                startDate: shiftDateByReference(e.startDate),
                endDate: shiftDateByReference(e.endDate)
            }))
        );

    } catch (error) {
        console.error('❌ Error loading sample employee data:', error);
        return []; // safe empty array fallback
    }
}

function parseCSV(data) {
    if (!data) return [];

    const rows = data
        .split('\n')
        .map(row => row.trim())
        .filter(Boolean);

    const normalizeEmployeeShiftKey = (value) => {
        const raw = (value || '').trim();
        if (!raw) return 'never';

        const lower = raw.toLowerCase();
        if (lower === 'full') return 'day'; // legacy employee CSV value

        const allowed = new Set(['never', 'early', 'day', 'late', 'school']);
        if (allowed.has(lower)) return lower;

        console.warn(`[employee-loader] Unknown shift token in employee CSV: "${raw}"`);
        return 'never';
    };

    return rows.slice(1).map(row => {
        const [
            id, name, personalEmoji, mainRoleIndex, secondaryRoleIndex, tertiaryRoleIndex,
            availableDaysOff, remainingDaysOff, overtime,
            mon, tue, wed, thu, fri, sat, sun,
            roleSplitMain, roleSplitSecondary, roleSplitTertiary,
            startDate, endDate, birthday, birthMonth
        ] = row.split(',');

        const normalizedShifts = [mon, tue, wed, thu, fri, sat, sun].map(normalizeEmployeeShiftKey);
        const [shiftMon, shiftTue, shiftWed, shiftThu, shiftFri, shiftSat, shiftSun] = normalizedShifts;

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
            workDays: normalizedShifts,
            roleSplitMain: parseFloat(roleSplitMain) || 0,
            roleSplitSecondary: parseFloat(roleSplitSecondary) || 0,
            roleSplitTertiary: parseFloat(roleSplitTertiary) || 0,
            startDate: startDate || '',
            endDate: endDate || '',
            birthday: birthday || '',
            birthMonth: birthMonth || '',
            shifts: {
                mon: shiftMon,
                tue: shiftTue,
                wed: shiftWed,
                thu: shiftThu,
                fri: shiftFri,
                sat: shiftSat,
                sun: shiftSun
            }
        };
    });
}

export function filterActiveEmployees(employees) {
    return employees.filter(e => e.personalEmoji !== '🗑️');
}

export function filterDeletedEmployees(employees) {
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
        employeeData.personalEmoji = "🗑️";
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
            employeeBefore[existingIndex] = { ...employeeBefore[existingIndex], ...employeeData };
        }
    } else {
        if (action === "create") {
            employeeBefore.push(employeeData);
        } else if (action === "update") {
            console.warn(`⚠ Employee with ID ${employeeData.id} not found for update — adding as new.`);
            employeeBefore.push(employeeData);
        } else {
            console.warn(`⚠ Unknown action "${action}" for employee id=${employeeData.id}. Adding as new by default.`);
            employeeBefore.push(employeeData);
        }
    }

    const employeeCSV = convertEmployeesToCSV(employeeBefore);
    try {
        await saveEmployeeData(api, employeeCSV);
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

function shiftDateByReference(originalDateStr) {
    if (!originalDateStr) return "";
    if (originalDateStr === "2099-12-31") return originalDateStr;
    if (originalDateStr === "0000-00-00") return "";

    const toLocalDate = (str) => {
        const [y, m, d] = str.split("-").map(Number);
        return new Date(y, m - 1, d);
    };

    const reference = toLocalDate(SAMPLE_REFERENCE_DATE);
    const original = toLocalDate(originalDateStr);

    if (isNaN(original)) return originalDateStr;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const delta = original.getTime() - reference.getTime();
    const shifted = new Date(today.getTime() + delta);

    return shifted.toISOString().split("T")[0];
}
