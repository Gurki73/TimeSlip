// js/excel/excelExport.js
import fs from 'fs';
import path from 'path';
import { app, dialog, shell } from 'electron';
import XLSX from 'xlsx';
import { buildTemplateToDownloads } from './excelTemplate.js';

const CLIENT_BASE = path.join(app.getPath('home'), 'mitarbeiterKalender', 'clientData');

function resolveClient(rel) {
    return path.join(CLIENT_BASE, rel);
}

function readCsvAsRows(filePath) {
    if (!fs.existsSync(filePath)) return [];
    const text = fs.readFileSync(filePath, 'utf8').trim();
    if (!text) return [];
    return text.split('\n').map(l => l.split(','));
}

function collectAllRequests() {
    const folder = resolveClient('requests');
    if (!fs.existsSync(folder)) return [];
    const rows = [];
    const files = fs.readdirSync(folder);
    files.forEach(f => {
        if (f.endsWith('_requests.csv') || f.endsWith('requests.csv')) {
            rows.push(...readCsvAsRows(path.join(folder, f)));
        }
    });
    return rows;
}

export async function exportExcelFile() {
    try {
        // Read CSVs
        const employees = readCsvAsRows(resolveClient('employees/employee.csv'));
        const requests = collectAllRequests();

        // Build template as base using new backend function
        const tmpTemplatePath = buildTemplateToDownloads(); // returns path in Downloads
        const wb = XLSX.readFile(tmpTemplatePath, { cellStyles: true });

        // Fill Employees sheet
        const empSheet = wb.Sheets['Employees'];
        const empHeader = XLSX.utils.sheet_to_json(empSheet, { header: 1, range: 0 })[0];
        const empAoa = [empHeader, ...employees];
        wb.Sheets['Employees'] = XLSX.utils.aoa_to_sheet(empAoa);

        // Fill Requests sheet
        const reqSheet = wb.Sheets['VacationRequests'];
        const reqHeader = XLSX.utils.sheet_to_json(reqSheet, { header: 1, range: 0 })[0];
        const reqAoa = [reqHeader, ...requests];
        wb.Sheets['VacationRequests'] = XLSX.utils.aoa_to_sheet(reqAoa);

        // Save dialog
        const defaultName = `kalender-export-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Excel exportieren',
            defaultPath: path.join(app.getPath('downloads'), defaultName),
            filters: [{ name: 'Excel', extensions: ['xlsx'] }]
        });

        if (canceled) return;

        XLSX.writeFile(wb, filePath);

        // Prompt to open
        const { response } = await dialog.showMessageBox({
            type: 'info',
            buttons: ['Open Now', 'Cancel'],
            title: 'Excel Export Completed',
            message: `Export saved as ${path.basename(filePath)}. Open now?`
        });

        if (response === 0) shell.openPath(filePath);

    } catch (err) {
        console.error("exportExcelFile error:", err);
        dialog.showErrorBox('Excel Export Fehler', String(err));
    }
}
