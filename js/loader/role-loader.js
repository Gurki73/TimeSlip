let roles = [];
let allRoles = [];

async function loadRoleData(api) {
    let homeKey = localStorage.getItem('clientDefinedDataFolder') || 'home';
    const relativePath = 'role.csv';
    try {
        const fileData = await api.loadCSV(homeKey, relativePath);

        if (fileData) {
            parseCSV(fileData);
        } else {
            console.warn('⚠️ No role data found, using sample fallback.');
            await loadSampleRoleData();
        }
    } catch (error) {
        console.error('❌ Failed to load role data:', error);
        await loadSampleRoleData();
    }
}

async function loadSampleRoleData() {
    try {
        const response = await fetch('samples/role.csv');
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

export async function saveRoleData(api) {
    const csvHeader = 'name,colorIndex,emoji';
    const csvContent = [
        csvHeader,
        ...allRoles.map(role => `${role.name || '?'},${role.colorIndex || 0},${role.emoji || '❓'}`)
    ].join('\n');

    // Use the cached folder key or default to 'home'
    const folderKey = localStorage.getItem('clientDefinedDataFolder') || 'home';
    const filename = 'role.csv';

    try {
        const savedDirectory = await api.saveCSV(folderKey, filename, csvContent);
        if (savedDirectory) {
            console.log('☑ CSV saved successfully to:', savedDirectory);
            // Update localStorage with the saved path
            localStorage.setItem('clientDefinedDataFolder', savedDirectory);
        } else {
            console.warn('⚠ Failed to save CSV file.', savedDirectory);
        }
    } catch (err) {
        console.error('✗ Error saving role data:', err);
    }
}


// TODO: Add fullscreen preference in local storage (or settings cache)sl


export { loadRoleData, roles, allRoles };
