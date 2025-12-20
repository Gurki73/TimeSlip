// src/data/requests.js
import { loadFile, saveFile } from './loader.js';
import { refundReservedDays } from '../../Components/forms/request-form/request-form.js';

/* ---------- Sanitize text input ---------- */
function sanitizeTextField(str) {
    if (!str) return '';
    return str
        .replace(/,/g, '‚')       // comma → single low-9 quote
        .replace(/"/g, '“')       // double quote → left quote
        .replace(/'/g, '’')       // single quote → apostrophe
        .replace(/\\/g, '⧵')      // backslash → unicode
        .replace(/\r?\n/g, ' ')   // remove newlines
        .trim();
}

/* ---------- CSV Parsing ---------- */
function parseRequestsCSV(data) {
    const rows = data.split('\n').filter(r => r.trim() !== '');
    if (rows.length <= 1) return [];

    const headers = rows[0].split(',');
    const hasEffectiveDays = headers.includes('effectiveDays');

    return rows.slice(1).map(row => {
        const cells = row.split(',');

        const [
            id, employeeID, vacationType, start, end, shift,
            requesterMSG, approverMSG, status, decisionDate, requestedAt,
            effectiveDays // optional (may be undefined)
        ] = cells;

        return {
            id: id.trim(),
            employeeID: parseInt(employeeID.trim(), 10),
            vacationType: vacationType.trim(),
            start: start.trim(),
            end: end.trim(),
            shift: shift.trim(),
            requesterMSG: sanitizeTextField(requesterMSG),
            approverMSG: sanitizeTextField(approverMSG),
            status: status.trim(),
            decisionDate: decisionDate.trim(),
            requestedAt: requestedAt.trim(),
            effectiveDays: hasEffectiveDays && effectiveDays !== undefined ? parseInt(effectiveDays.trim(), 10) : null
        };
    });
}

/* ---------- CSV Serialization ---------- */
function serializeRequestsCSV(requests) {
    const header = 'id,employeeID,vacationType,start,end,shift,requesterMSG,approverMSG,status,decisionDate,requestedAt,effectiveDays';

    const lines = requests.map(r =>
        [
            r.id,
            r.employeeID,
            r.vacationType,
            r.start,
            r.end,
            r.shift,
            sanitizeTextField(r.requesterMSG),
            sanitizeTextField(r.approverMSG),
            r.status,
            r.decisionDate,
            r.requestedAt,
            r.effectiveDays ?? '' // empty if not yet calculated
        ].join(',')
    );

    return [header, ...lines].join('\n');
}


export async function loadRequests(api, year) {

    let availableFiles = [];
    try {
        availableFiles = await getAvailableRequestFiles(api);
    } catch (err) {
        console.warn(`⚠️ Could not fetch available request files:`, err);
    }

    const clientDataFolder = localStorage.getItem('clientDefinedDataFolder');
    const clientFolderExists = availableFiles.length > 0 || (clientDataFolder);

    if (!clientFolderExists) {
        const homeKey = localStorage.getItem('dataMode') || 'auto';
        if (homeKey === 'sample') {
            const sampleData = await loadSampleRequests();
            return sampleData;
        } else {
            return [];
        }
    }

    const requestedFile = availableFiles.find(f => f.year === year);

    if (requestedFile) {
        // ✅ File exists → load and parse
        try {
            const fileData = await loadFile(api, 'client', `requests/${requestedFile.year}_requests.csv`, () => loadSampleRequests());
            const parsedData = parseRequestsCSV(fileData);
            return parsedData;
        } catch (err) {
            console.warn(`❌ Failed to load request data for year ${year}:`, err);
            return [];
        }
    } else {
        return [
            {
                info: `Noch keine Anträge für ${year} gestellt`,
            },
        ];
    }
}

/* ---------- Load fallback sample ---------- */
async function loadSampleRequests() {

    const samplePath = './samples/requests/sampleRequests.csv';
    try {
        const response = await fetch(samplePath);
        if (!response.ok) {
            console.warn(`⚠️ Sample request file not found: ${samplePath}`);
            return [];
        }
        const data = await response.text();
        return data;
    } catch (error) {
        console.warn(`❌ Error loading sample request data:`, error);
        return [];
    }
}

export async function appendRequest(api, year, request) {
    const folderPath = 'requests/';
    const fileName = `${year}_requests.csv`;


    console.log(" new request", request, year);

    try {
        const existing = await loadFile(api, 'client', `requests/${year}_requests.csv`);
        let requests = existing ? parseRequestsCSV(existing) : [];

        requests.push(request);

        const csv = serializeRequestsCSV(requests);

        console.log(" request as cvs: ", csv);

        await saveFile(api, folderPath, fileName, csv);
    } catch (err) {
        console.error(`❌ Error appending request to ${fileName}:`, err);
        throw err;
    }
}

export async function updateRequest(api, id, changes, year) {

    if (!year) {
        console.error(`❌ Cannot update request: Missing or invalid year`);
        return;
    }
    const folderPath = 'requests/';
    const fileName = `${year}_requests.csv`;

    try {
        const fileData = await loadFile(api, 'client', `requests/${year}_requests.csv`);;
        if (!fileData) {
            console.warn(`❌ Request file not found: ${fileName}`);
            return;
        }

        let requests = parseRequestsCSV(fileData);
        const index = requests.findIndex(r => String(r.id) === String(id));

        if (index === -1) {
            console.warn(`❌ Request with ID ${id} not found in ${fileName}`);
            return;
        }

        requests[index] = { ...requests[index], ...changes };
        const csv = serializeRequestsCSV(requests);

        await saveFile(api, folderPath, fileName, csv);
    } catch (err) {
        console.error(`❌ Error updating request ${id}:`, err);
    }
}

export async function saveRequests(api, year, requests) {
    const folderPath = 'requests';
    const fileName = `/${year}_requests.csv`;
    const csv = serializeRequestsCSV(requests);

    try {
        const savedDir = await saveFile(api, folderPath, fileName, csv);
        if (savedDir) {
            localStorage.setItem('clientDefinedDataFolder', savedDir);
        } else {
            console.warn(`⚠️ Failed to save requests file: ${fileName}`);
        }
    } catch (err) {
        console.error(`❌ Error saving requests file ${fileName}:`, err);
        throw err;
    }
}
function getRequestFileName(year) {
    const validYear = year && !isNaN(year) ? year : new Date().getFullYear();
    return `${validYear}_requests.csv`;
}

/* ---------- Optional: fetch available yearly files ---------- */
export async function getAvailableRequestFiles(api) {
    try {
        const filePaths = await api.getRequestFiles();
        return filePaths
            .map(fp => {
                const fileName = fp.split('/').pop();
                const match = fileName.match(/(\d{4})_requests\.csv/);
                if (!match) return null;
                const [_, year] = match;
                return { year: parseInt(year, 10), filePath: fp };
            })
            .filter(Boolean)
            .sort((a, b) => a.year - b.year);
    } catch (error) {
        console.warn('🚨 Error fetching request files:', error);
        return [];
    }
}

export async function storeApproval(api, requestId, approverMSG = null, decision = null, year) {

    try {
        // Load the request first to locate the correct file (month/year)
        const allFiles = await getAvailableRequestFiles(api);
        let foundRequest = null;

        for (const f of allFiles) {
            const requests = await loadRequests(api, year);
            const r = requests.find(r => r.id === requestId);
            if (r) {
                foundRequest = { request: r, year: f.year, month: f.month };
                break;
            }
        }

        if (!foundRequest) {
            console.error(`❌ Request with ID ${requestId} not found in any file`);
            return;
        }

        const changes = {};

        if (approverMSG !== null && approverMSG !== undefined) {
            changes.approverMSG = sanitizeTextField(approverMSG);
        }

        if (decision === "approved" || decision === "rejected") {
            changes.status = decision;
            changes.decisionDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
        }
        await updateRequest(api, requestId, changes, year);
        if (decision === "rejected") {
            await refundReservedDays(api, foundRequest.request);
        }
    } catch (err) {
        console.error(`❌ Error updating request ${requestId}:`, err);
    }
}
