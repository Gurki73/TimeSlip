// js/excel/excelImport.js
import fs from 'fs';
import path from 'path';
import { dialog, app, shell } from 'electron';
import XLSX from 'xlsx';

const CLIENT_BASE = path.join(app.getPath('home'), 'mitarbeiterKalender', 'clientData');

function resolveClient(rel) {
    return path.join(CLIENT_BASE, rel);
}

// Write CSV rows
function writeCsvRows(filePath, rows) {
    const text = rows.map(r => r.map(v => (v === undefined || v === null) ? '' : String(v)).join(',')).join('\n');
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, text, 'utf8');
}

// Sanity check employees
function validateEmployees(empRows, header) {
    const mandatoryFields = ["id", "name", "emoji"];
    const idxMap = mandatoryFields.reduce((acc, field) => {
        const idx = header.indexOf(field);
        if (idx === -1) throw new Error(`Employees sheet missing column: ${field}`);
        acc[field] = idx;
        return acc;
    }, {});

    const seenIds = new Set();
    const validRows = [];

    empRows.forEach((row, i) => {
        const id = row[idxMap.id];
        const name = row[idxMap.name];
        const emoji = row[idxMap.emoji];

        if (!id || !name || !emoji) {
            console.warn(`[import] Skipping employee row ${i + 2} due to missing mandatory fields`);
            return;
        }
        if (seenIds.has(id)) {
            console.warn(`[import] Skipping employee row ${i + 2} due to duplicate ID: ${id}`);
            return;
        }
        seenIds.add(id);
        validRows.push(row);
    });

    return validRows;
}

// Sanity check vacation requests
function validateRequests(reqRows, header) {
    const requiredFields = ["id", "employeeID", "vacationType", "start", "end", "status"];
    const idxMap = requiredFields.reduce((acc, field) => {
        const idx = header.indexOf(field);
        if (idx === -1) throw new Error(`VacationRequests sheet missing column: ${field}`);
        acc[field] = idx;
        return acc;
    }, {});

    const validRows = [];

    reqRows.forEach((row, i) => {
        const startDate = new Date(row[idxMap.start]);
        const endDate = new Date(row[idxMap.end]);
        const status = String(row[idxMap.status] || '').toLowerCase();

        if (status !== 'pending') return; // Only import pending

        if (isNaN(startDate) || isNaN(endDate)) {
            console.warn(`[import] Skipping request row ${i + 2} due to invalid dates`);
            return;
        }

        // Split requests across years if necessary
        const startYear = startDate.getFullYear();
        const endYear = endDate.getFullYear();

        if (startYear === endYear) {
            validRows.push(row);
        } else {
            // Split across years
            const midRowStart = [...row];
            midRowStart[idxMap.end] = `${startYear}-12-31`;
            validRows.push(midRowStart);

            const midRowEnd = [...row];
            midRowEnd[idxMap.start] = `${endYear}-01-01`;
            validRows.push(midRowEnd);
        }
    });

    return validRows;
}

export async function importExcelFile() {
    try {
        // Select file
        const { canceled, filePaths } = await dialog.showOpenDialog({
            title: 'Excel-Datei importieren',
            filters: [{ name: 'Excel', extensions: ['xlsx'] }],
            properties: ['openFile']
        });

        if (canceled || !filePaths || filePaths.length === 0) return;

        const wb = XLSX.readFile(filePaths[0], { cellDates: false, raw: false });

        // Check sheets
        if (!wb.Sheets['Employees'] || !wb.Sheets['VacationRequests']) {
            throw new Error("Die Datei muss die Blätter 'Employees' und 'VacationRequests' enthalten.");
        }

        // Parse employees
        const empAoa = XLSX.utils.sheet_to_json(wb.Sheets['Employees'], { header: 1, defval: '' });
        const empHeader = empAoa[0];
        const empRows = empAoa.slice(1).filter(r => r.some(c => c !== ''));
        const validEmpRows = validateEmployees(empRows, empHeader);

        // Merge employees: append new only
        const empCsvPath = resolveClient('employees/employee.csv');
        const existingEmpRows = fs.existsSync(empCsvPath) ? fs.readFileSync(empCsvPath, 'utf8').split('\n').map(l => l.split(',')) : [];
        const existingIds = new Set(existingEmpRows.map(r => r[0]));
        const mergedEmpRows = [...existingEmpRows, ...validEmpRows.filter(r => !existingIds.has(r[0]))];
        writeCsvRows(empCsvPath, mergedEmpRows);

        // Parse vacation requests
        const reqAoa = XLSX.utils.sheet_to_json(wb.Sheets['VacationRequests'], { header: 1, defval: '' });
        const reqHeader = reqAoa[0];
        const reqRows = reqAoa.slice(1).filter(r => r.some(c => c !== ''));
        const validReqRows = validateRequests(reqRows, reqHeader);

        // Split requests by year and append
        const requestsByYear = {};
        validReqRows.forEach(row => {
            const year = new Date(row[reqHeader.indexOf('start')]).getFullYear();
            if (!requestsByYear[year]) requestsByYear[year] = [];
            requestsByYear[year].push(row);
        });

        Object.entries(requestsByYear).forEach(([year, rows]) => {
            const reqCsvPath = resolveClient(`requests/${year}_requests.csv`);
            const existingRows = fs.existsSync(reqCsvPath) ? fs.readFileSync(reqCsvPath, 'utf8').split('\n').map(l => l.split(',')) : [];
            const mergedRows = [...existingRows, ...rows];
            writeCsvRows(reqCsvPath, mergedRows);
        });

        // Prompt user to open imported folder
        const { response } = await dialog.showMessageBox({
            type: 'info',
            buttons: ['Open Folder', 'Close'],
            title: 'Excel Import Completed',
            message: `Import abgeschlossen. CSV-Dateien aktualisiert. Ordner öffnen?`
        });

        if (response === 0) shell.openPath(resolveClient(''));

    } catch (err) {
        console.error("importExcelFile error:", err);
        dialog.showErrorBox('Excel Import Fehler', String(err));
    }
}
