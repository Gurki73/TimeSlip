import { loadFile, saveFile } from './loader.js';
import { Role } from './role.js';

const folderPath = "role-data";
let roles = [];
let allRoles = [];
const MAX_RETRIES = 4;
const RETRY_DELAY_MS = 1500;
let attempt = 1;

let teams = {
    blue: "Team Erfahrung",
    green: "Kreative squat ",
    red: "rotes Kolektive",
    black: "schwarze Bande",
    azubi: "Ausbildung" // never renamed
};

// ----------------- TEAMNAMES -----------------

const teamFile = 'teamnames.csv';
const defaultTeams = ['Team Blau', 'Team Grün', 'Team Rot', 'Team Schwarz'];
const sampleTeams = ['KüchenCrew', 'GästeFront', 'Büro', 'ungenutzt'];

let teamnames = {
    blue: defaultTeams[0],
    green: defaultTeams[1],
    red: defaultTeams[2],
    black: defaultTeams[3],
    azubi: 'Ausbildung'
};

export async function loadRoleData(api) {
    if (!api) {
        console.error('[role-loader.js] window.api not available');
        return;
    }

    let homeKey = localStorage.getItem('dataMode') || 'auto';
    const fileName = 'role.csv';
    let relativePath = folderPath + '/' + fileName;

    if (homeKey === 'sample') {
        return loadSampleRoleData(true);
    }

    const clientDataFolder = localStorage.getItem('clientDefinedDataFolder');
    if (clientDataFolder) homeKey = "client";

    try {
        const fileData = await loadFile(api, homeKey, relativePath, loadSampleRoleData);
        const parsedData = parseCSV(fileData);
        return parsedData;
    } catch (error) {
        // ... rest of error handling
    }
}

export async function loadSampleRoleData(showSample) {
    const clientDataFolder = localStorage.getItem('clientDefinedDataFolder');
    if (clientDataFolder && !showSample) {
        return (
            "name,colorIndex,emoji\n" +
            [
                { name: '?', colorIndex: '0', emoji: '⊖' },
                { name: '?', colorIndex: '1', emoji: '⊖' },
                { name: '?', colorIndex: '2', emoji: '⊖' },
                { name: '?', colorIndex: '3', emoji: '⊖' },
                { name: '?', colorIndex: '4', emoji: '⊖' },
                { name: '?', colorIndex: '5', emoji: '⊖' },
                { name: '?', colorIndex: '6', emoji: '⊖' },
                { name: '?', colorIndex: '7', emoji: '⊖' },
                { name: '?', colorIndex: '8', emoji: '⊖' },
                { name: '?', colorIndex: '9', emoji: '⊖' },
                { name: '?', colorIndex: '10', emoji: '⊖' },
                { name: '?', colorIndex: '11', emoji: '⊖' },
                { name: '?', colorIndex: '12', emoji: '⊖' },
                { name: 'Azubi', colorIndex: '13', emoji: '✏️' }
            ]
                .map(role => `${role.name},${role.colorIndex},${role.emoji}`)
                .join('\n')
        );
    }

    else {
        try {
            const response = await fetch('samples/role.csv');
            if (!response.ok) throw new Error('Sample CSV fetch failed');
            const data = await response.text();
            return parseCSV(data);
        } catch (error) {
            console.error('❌ Error loading sample role data:', error);
            throw error;
        }
    }
}

// ----------------- Parse -----------------
export function parseCSV(data) {
    const rows = data.split('\n').map(row => row.trim()).filter(Boolean);

    allRoles = rows.slice(1).map(row => {
        const [name, colorIndex, emoji] = row.split(',').map(cell => cell.trim());
        return { name, colorIndex, emoji };
    });

    roles = allRoles.filter(role => role.name && role.name !== '?');

    return roles;
}

export async function saveRoleData(api) {
    const csvHeader = 'name,colorIndex,emoji';
    const csvContent = [
        csvHeader,
        ...allRoles.map(role => `${role.name || '?'},${role.colorIndex || 0},${role.emoji || '⊖'}`)
    ].join('\n');

    try {
        const savedPath = await saveFile(api, folderPath, 'role.csv', csvContent);
    } catch (err) {
        console.error('✗ Error saving role data:', err);
    }
}

export async function getAllRoles(api) {
    allRoles = [];
    await loadRoleData(api);
    return allRoles;
}

// ----------------- Load -----------------
export async function loadTeamnames(api) {
    const dataMode = localStorage.getItem('dataMode') || 'auto';
    const clientDataFolder = localStorage.getItem('clientDefinedDataFolder');
    const relativePath = `${folderPath}/${teamFile}`;
    const homeKey = clientDataFolder ? 'client' : dataMode;

    try {
        // Try to load existing CSV
        const fileData = await loadFile(api, homeKey, relativePath, loadSampleTeamnames);
        if (!fileData) throw new Error('Empty teamnames file');

        const parsed = parseTeamnames(fileData);
        teamnames = parsed;
        return teamnames;

    } catch (error) {
        console.warn('⚠️ Failed to load teamnames, using fallback:', error);

        // if we’re explicitly in “sample” mode, return sample data
        if (dataMode === 'sample') {
            console.info('→ Using sample teamnames (KüchenCrew, GästeFront, Büro, ungenutzt)');
            return parseTeamnames(sampleTeams.join('\n'));
        }

        // otherwise return normal defaults
        console.info('→ Using default teamnames (Team Blau, Team Grün, Team Rot, Team Schwarz)');
        return parseTeamnames(defaultTeams.join('\n'));
    }
}


// ----------------- Save -----------------
export async function saveTeamnames(api, newTeams = teamnames) {
    // Create CSV (simple one-name-per-line)
    const csvContent = [
        'blue,green,red,black',
        `${newTeams.blue},${newTeams.green},${newTeams.red},${newTeams.black}`
    ].join('\n');

    try {
        const savedPath = await saveFile(api, folderPath, teamFile, csvContent);
        console.log('💾 Teamnames saved:', savedPath);
    } catch (err) {
        console.error('✗ Error saving teamnames:', err);
    }
}

// ----------------- Parse -----------------
export function parseTeamnames(data) {
    const lines = data.split('\n').map(l => l.trim()).filter(Boolean);

    // if CSV has headers
    if (lines.length > 1 && lines[0].includes(',')) {
        const [, row] = lines;
        const [blue, green, red, black] = row.split(',').map(s => s.trim());
        return {
            blue: blue || defaultTeams[0],
            green: green || defaultTeams[1],
            red: red || defaultTeams[2],
            black: black || defaultTeams[3],
            azubi: 'Ausbildung'
        };
    }

    // fallback if simple list of names
    const [blue, green, red, black] = lines;
    return {
        blue: blue || defaultTeams[0],
        green: green || defaultTeams[1],
        red: red || defaultTeams[2],
        black: black || defaultTeams[3],
        azubi: 'Ausbildung'
    };
}

// ----------------- Sample fallback -----------------
export async function loadSampleTeamnames() {
    try {
        const data = sampleTeams.join('\n');
        return data;
    } catch (err) {
        console.error('❌ Failed to load sample teamnames:', err);
        return defaultTeams.join('\n');
    }
}