import { Role } from './role.js';

let roles = [];
let allRoles = [];


export async function loadRoleData(api) {
    if (!api) {
        console.error('[role-loader.js] window.api not available');
        console.trace(); // 🔎 shows which function called this
        return;
    }

    const homeKey = localStorage.getItem('clientDefinedDataFolder') || 'home';
    const relativePath = 'role.csv';

    try {
        const fileData = await api.loadCSV(homeKey, relativePath);

        if (fileData) {
            parseCSV(fileData);
            console.log(`✅ Loaded role data from ${homeKey}/${relativePath}`);
        } else {
            console.warn(`⚠️ No role data found at ${homeKey}/${relativePath}, using sample fallback.`);
            await loadSampleRoleData();
        }
    } catch (error) {
        console.error('❌ Failed to load role data:', error);
        await loadSampleRoleData();
    }
}

export async function loadSampleRoleData() {
    try {
        const response = await fetch('samples/role.csv');
        if (!response.ok) throw new Error('Sample CSV fetch failed');
        const data = await response.text();
        parseCSV(data);
        console.log('✅ Loaded sample role data');
    } catch (error) {
        console.error('❌ Error loading sample role data:', error);
        throw error;
    }
}

export function parseCSV(data) {
    const rows = data.split('\n').map(row => row.trim()).filter(Boolean);

    allRoles = rows.slice(1).map(row => {
        const [name, colorIndex, emoji] = row.split(',').map(cell => cell.trim());
        return { name, colorIndex, emoji };
    });

    roles = allRoles.filter(role => role.name && role.name !== '?');
}


export async function saveRoleData(api) {
    const csvHeader = 'name,colorIndex,emoji';
    const csvContent = [
        csvHeader,
        ...allRoles.map(role => `${role.name || '?'},${role.colorIndex || 0},${role.emoji || '❓'}`)
    ].join('\n');

    const folderKey = localStorage.getItem('clientDefinedDataFolder') || 'home';
    const filename = 'role.csv';

    try {
        const savedDirectory = await api.saveCSV(folderKey, filename, csvContent);
        if (savedDirectory) {
            console.log('☑ CSV saved successfully to:', savedDirectory);
            localStorage.setItem('clientDefinedDataFolder', savedDirectory);
        } else {
            console.warn('⚠ Failed to save CSV file.', savedDirectory);
        }
    } catch (err) {
        console.error('✗ Error saving role data:', err);
    }
}

export { roles, allRoles };
