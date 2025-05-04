let roles = [];
let allRoles = [];

async function loadRoleData(api) {
    let homeKey = 'home';
    const relativePath = 'data/role.csv';

    // Step 1: Check localStorage for client-defined folder
    const clientPath = localStorage.getItem('clientDefinedDataFolder');
    if (clientPath) {
        homeKey = clientPath;
    }

    try {
        // Step 2: Ask main process if the folder+file exists
        const exists = await api.invoke('check-path', {
            homeKey,
            relativePath
        });

        if (exists) {
            // Step 3a: Load real user data via IPC
            const fileData = await api.invoke('load-data', {
                homeKey,
                relativePath
            });
            parseCSV(fileData);
        } else {
            // Step 3b: Fallback to static sample
            console.warn('Using fallback sample data for roles.');
            await loadSampleRoleData(); // uses fetch
        }
    } catch (error) {
        console.error('Failed loading role data:', error);
        await loadSampleRoleData(); // fail-safe
    }
}


async function loadSampleRoleData() {
    try {
        console.log(" load static sample roles from sample");
        const response = await fetch('data/role.csv');
        const data = await response.text();
        parseCSV(data);
    } catch (error) {
        console.warn('Error loading role data:', error);
        throw error;
    }
}

function parseCSV(data) {
    const rows = data.split('\n');

    allRoles = rows.slice(1).map(row => {
        const [name, colorIndex, emoji] = row.split(',');
        return {
            name: name?.trim(),
            colorIndex: colorIndex?.trim(),
            emoji: emoji?.trim()
        };
    });
    roles = allRoles.filter(role => role.name && role.name !== '?');
}

async function generateRoleCSV(api) {
    const csvHeader = 'name,colorIndex,emoji';
    const csvContent = [
        csvHeader,
        ...allRoles.map(role => `${role.name || '?'},${role.colorIndex || 0},${role.emoji || '❓'}`)
    ].join('\n');

    const uniquePathName = generateUniqueFileName(); // Generate unique file name
    const uniqueFileName = 'role.csv';
    try {
        await api.saveCSV(uniquePathName, uniqueFileName, csvContent);
        console.log('File saved successfully');
    } catch (err) {
        console.warn('Error saving file:', err);
    }
}

function generateUniqueFileName() {

    const baseURL = window.location.origin;
    const pathname = window.location.pathname.split('/');
    const folderPath = pathname.slice(1, -1).join('/');

    const uniquePath = folderPath ? `${folderPath}/data/` : `data/`;
    return uniquePath;
}

export { loadSampleRoleData as loadRoleData, roles, allRoles, generateRoleCSV };
