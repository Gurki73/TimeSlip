// js/excel/excelTemplate.js
import fs from 'fs';
import path from 'path';
import { app, dialog, shell } from 'electron';
import XLSX from 'xlsx';

const CLIENT_BASE = path.join(app.getPath('home'), 'mitarbeiterKalender', 'clientData');

function resolveClient(rel) {
    return path.join(CLIENT_BASE, rel);
}

function headerStyle() {
    return {
        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
        fill: { fgColor: { rgb: "4F81BD" } },
        alignment: { horizontal: "center", vertical: "center" }
    };
}

export function buildTemplateFile(outputPath, lookups = {}) {
    const wb = XLSX.utils.book_new();

    // Employees header
    const empHeader = [
        "id", "name", "emoji", "mainRoleIndex", "sec.RoleIndex", "tert.RoleIndex",
        "avail.DaysOff", "rem.DaysOff", "overtime",
        "mon", "tue", "wed", "thu", "fri", "sat", "sun",
        "roleSplitMain", "roleSplitSecondary", "roleSplitTertiary",
        "startDate", "endDate", "birthday", "birthMonth"
    ];
    const empSheet = XLSX.utils.aoa_to_sheet([empHeader]);
    empSheet['!cols'] = empHeader.map(h => ({ wch: Math.max(10, h.length + 4) }));
    empHeader.forEach((h, i) => {
        const addr = XLSX.utils.encode_col(i) + "1";
        empSheet[addr] = empSheet[addr] || { t: "s", v: h };
        empSheet[addr].s = headerStyle();
    });

    // VacationRequests header
    const reqHeader = [
        "id", "employeeID", "vacationType", "start", "end", "shift",
        "requesterMSG", "approverMSG", "status", "decisionDate", "requestedAt"
    ];
    const reqSheet = XLSX.utils.aoa_to_sheet([reqHeader]);
    reqSheet['!cols'] = reqHeader.map(h => ({ wch: Math.max(12, h.length + 6) }));
    reqHeader.forEach((h, i) => {
        const addr = XLSX.utils.encode_col(i) + "1";
        reqSheet[addr] = reqSheet[addr] || { t: "s", v: h };
        reqSheet[addr].s = headerStyle();
    });

    // Lookups sheet
    const lookupsSheetRows = [];

    // Roles
    lookupsSheetRows.push(["roles_index", "role_name", "emoji", "colorIndex"]);
    (lookups.roles || []).forEach((r, idx) => lookupsSheetRows.push([idx, r.name || "", r.emoji || "", r.colorIndex || ""]));
    lookupsSheetRows.push([]);

    // Flat emojis
    lookupsSheetRows.push(["emojis"]);
    (lookups.emojisFlat || []).forEach(e => lookupsSheetRows.push([e]));
    lookupsSheetRows.push([]);

    // Vacation types
    lookupsSheetRows.push(["vacationTypes"]);
    (lookups.vacationTypes || []).forEach(v => lookupsSheetRows.push([v]));
    lookupsSheetRows.push([]);

    // Shift types
    lookupsSheetRows.push(["shiftTypes"]);
    (lookups.shiftTypes || []).forEach(s => lookupsSheetRows.push([s]));
    lookupsSheetRows.push([]);

    // Day choices
    lookupsSheetRows.push(["dayChoices"]);
    (lookups.dayChoices || []).forEach(d => lookupsSheetRows.push([d]));

    const lookupSheet = XLSX.utils.aoa_to_sheet(lookupsSheetRows);
    lookupSheet['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 6 }, { wch: 8 }];

    XLSX.utils.book_append_sheet(wb, empSheet, "Employees");
    XLSX.utils.book_append_sheet(wb, reqSheet, "VacationRequests");
    XLSX.utils.book_append_sheet(wb, lookupSheet, "__LOOKUPS");

    XLSX.writeFile(wb, outputPath);
    return outputPath;
}

export function buildTemplateToDownloads() {
    // Load roles and emojis from client folder if present
    const rolesPath = resolveClient('role-data/role.csv');
    const emojisPath = resolveClient('custom-data/emojis.json');

    const roles = [];
    if (fs.existsSync(rolesPath)) {
        const raw = fs.readFileSync(rolesPath, 'utf8').trim().split('\n');
        raw.forEach(line => {
            const parts = line.split(',');
            roles.push({ name: parts[0] || '', colorIndex: parts[1] || '', emoji: parts[2] || '' });
        });
    }

    let emojisFlat = [];
    if (fs.existsSync(emojisPath)) {
        try {
            const content = JSON.parse(fs.readFileSync(emojisPath, 'utf8'));
            if (content && content.categories) Object.values(content.categories).forEach(arr => emojisFlat.push(...arr));
            if (content.assignments && content.assignments.employee) emojisFlat.push(...content.assignments.employee);
            emojisFlat = Array.from(new Set(emojisFlat));
        } catch (e) {
            console.warn("Failed to parse emojis.json", e);
        }
    }

    const lookups = {
        roles,
        emojisFlat,
        vacationTypes: ["vac", "spe", "otc", "but", "hom", "sho", "sik", "par", "unp"],
        shiftTypes: ["morning", "afternoon", "full"],
        dayChoices: ["early", "late", "full", "never", "prep", "school"]
    };

    // Save to downloads with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `staff-template-${timestamp}.xlsx`;
    const outputPath = path.join(app.getPath('downloads'), fileName);

    buildTemplateFile(outputPath, lookups);

    // Ask user if they want to open
    dialog.showMessageBox({
        type: 'info',
        buttons: ['Open Now', 'Cancel'],
        title: 'Excel Template Created',
        message: `Template saved to Downloads as ${fileName}. Open now?`
    }).then(result => {
        if (result.response === 0) shell.openPath(outputPath);
    }).catch(err => {
        console.error("Error showing dialog:", err);
    });

    return outputPath;
}
