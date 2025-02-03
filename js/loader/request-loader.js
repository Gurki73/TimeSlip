async function loadRequests(year, month) {

    try {
        const response = await fetch(`data/requests/${year}_${month}_requests.csv`);
        if (!response.ok) {
            // console.warn(`🚨 File not found: ${year}-${month}, returning empty array.`);
            return [];
        }
        const data = await response.text();
        return parseRequestsCSV(data);
    } catch (error) {
        // console.warn(`Error loading requests for ${year}-${month}:`);
        return [];
    }
}

function parseRequestsCSV(data) {
    const rows = data.split('\n').filter(row => row.trim() !== '');
    return rows.slice(1).map(row => {
        const [id, employeeID, vacationType, start, end, shift, requesterMSG, approverMSG, status, decisionDate, requestedAt] = row.split(',');
        return {
            id: id.trim(),
            employeeID: employeeID.trim(),
            vacationType: vacationType.trim(),
            start: start.trim(),
            end: end.trim(),
            shift: shift.trim() === 'true',
            requesterMSG: requesterMSG.trim(),
            approverMSG: approverMSG.trim(),
            status: status.trim(),
            decisionDate: decisionDate.trim(),
            requestedAt: requestedAt.trim()
        };
    });
}

async function appendRequestToCSV(api, request) {
    const year = request.start.split('-')[0];
    const month = request.start.split('-')[1];
    const fileName = `${year}_${month}_requests.csv`;
    const filePath = `data/requests/${fileName}`;

    const csvHeader = 'id,employeeID,vacationType,start,end,shift,requesterMSG,approverMSG,status,decisionDate,requestedAt';
    const csvRow = `${request.id},${request.employeeID},${request.vacationType},${request.start},${request.end},${request.shift},${request.requesterMSG},${request.approverMSG},${request.status},${request.decisionDate},${request.requestedAt}`;

    let fileContent = '';

    try {
        const response = await fetch(filePath);
        fileContent = await response.text();
    } catch (error) {
        console.warn(`File ${fileName} not found, creating a new one.`);
    }

    let csvContent = fileContent.trim() ? `${fileContent.trim()}\n${csvRow}` : `${csvHeader}\n${csvRow}`;

    try {
        const folderPath = 'data/requests';
        await api.saveCSV(folderPath, fileName, csvContent);
        console.log(`Request appended successfully to ${fileName}`);
    } catch (err) {
        console.warn(`Error saving ${fileName}:`, err);
        throw err;
    }
}

async function updateRequest(api, id, changes) {
    const { year, month } = changes.start
        ? { year: changes.start.split('-')[0], month: changes.start.split('-')[1] }
        : {};

    if (!year || !month) {
        console.error("Cannot update request: Missing year/month");
        return;
    }

    const fileName = `${year}_${month}_requests.csv`; // Fixed filename

    try {
        const response = await fetch(`data/requests/${fileName}`);
        if (!response.ok) throw new Error(`File not found: ${fileName}`);

        let data = await response.text();
        let rows = data.split('\n');

        const index = rows.findIndex(row => row.startsWith(id));
        if (index === -1) throw new Error('Request not found in file');

        let existing = parseRequestsCSV(rows.join('\n')).find(r => r.id === id);
        let updated = { ...existing, ...changes };

        rows[index] = `${updated.id},${updated.employeeID},${updated.vacationType},${updated.start},${updated.end},${updated.shift},${updated.requesterMSG},${updated.approverMSG},${updated.status},${updated.decisionDate},${updated.requestedAt}`;

        await api.saveCSV(`data/requests/`, fileName, rows.join('\n'));
        console.log(`✅ Request ${id} updated successfully`);
    } catch (err) {
        console.warn(`🚨 Error updating request ${id}:`, err);
        throw err;
    }
}

async function getAvailableRequestFiles(api) {
    console.log("📂 Fetching available request files...");
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(today.getMonth() - 1);

    try {
        const filePaths = await api.getRequestFiles();
        const validFiles = [];

        for (const filePath of filePaths) {
            const fileName = filePath.split("/").pop(); // Extract filename
            const match = fileName.match(/(\d{4})_(\d{2})_requests\.csv/);

            if (match) {
                const [_, year, month] = match;
                const fileDate = new Date(parseInt(year), parseInt(month) - 1);

                if (fileDate >= lastMonth) {
                    validFiles.push({ year: parseInt(year), month: parseInt(month), filePath });
                }
            }
        }

        return validFiles.sort((a, b) => new Date(a.year, a.month - 1) - new Date(b.year, b.month - 1));
    } catch (error) {
        console.warn("🚨 Error fetching request files:", error);
        return [];
    }
}

export { loadRequests, appendRequestToCSV, updateRequest, getAvailableRequestFiles };
