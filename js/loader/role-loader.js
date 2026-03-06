import { loadFile, saveFile } from './loader.js';

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
const sampleTeams = ['KüchenCrew', 'GästeFront', 'Büro', 'Sauberkeit'];

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
        const parsedData = parseCSV(fileData || '');
        return Array.isArray(parsedData) ? parsedData : [];
    } catch (error) {
        console.warn('⚠️ Failed to load role data, using sample fallback:', error);
        try {
            const fallbackData = await loadSampleRoleData(true);
            const parsedFallback = parseCSV(fallbackData || '');
            return Array.isArray(parsedFallback) ? parsedFallback : [];
        } catch (fallbackError) {
            console.error('❌ Role fallback load failed:', fallbackError);
            roles = [];
            allRoles = [];
            return [];
        }
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
        const samplePaths = ['samples/role.csv', 'samples/role-data/role.csv'];
        try {
            for (const samplePath of samplePaths) {
                const response = await fetch(samplePath);
                if (!response.ok) continue;

                const data = await response.text();
                const parsed = parseCSV(data);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            }

            console.warn('⚠️ Sample role CSV not found, using embedded fallback sample roles.');
            return parseCSV(getEmbeddedSampleRoleCSV());
        } catch (error) {
            console.error('❌ Error loading sample role data, using embedded fallback:', error);
            return parseCSV(getEmbeddedSampleRoleCSV());
        }
    }
}

function getEmbeddedSampleRoleCSV() {
    return [
        'name,colorIndex,emoji',
        '?,0,⊖',
        'Koch,1,👨‍🍳',
        'Spüler,2,🧼',
        '?,3,⊖',
        'Kellner,4,💪',
        'Barkeeper,5,🍹',
        'Lieferfahrer,6,🚚',
        'Einkauf,7,🛒',
        'Manager,8,🧑‍💼',
        'Empfang,9,📞',
        '?,10,⊖',
        '?,11,⊖',
        '?,12,⊖',
        'Azubi,13,✏️'
    ].join('\n');
}

// ----------------- Parse -----------------
export function parseCSV(data) {
    if (Array.isArray(data)) {
        allRoles = data.map((role, index) => {
            const normalizedName = typeof role?.name === 'string' ? role.name : '?';
            const normalizedEmoji = typeof role?.emoji === 'string' ? role.emoji : '⊖';
            const rawColorIndex = role?.colorIndex ?? role?.index ?? index;
            return {
                name: normalizedName,
                colorIndex: String(rawColorIndex),
                emoji: normalizedEmoji
            };
        });
        roles = allRoles.filter(role => role.name && role.name !== '?');
        return roles;
    }

    const safeData = typeof data === 'string' ? data : '';
    const rows = safeData.split('\n').map(row => row.trim()).filter(Boolean);

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
            console.info('→ Using sample teamnames (KüchenCrew, GästeFront, Büro, und Sauberkeit)');
            return parseTeamnames(sampleTeams.join('\n'));
        }

        // otherwise return normal defaults
        console.info('→ Using default teamnames (Team Blau, Team Grün, Team Rot, Team Schwarz)');
        return parseTeamnames(defaultTeams.join('\n'));
    }
}

export async function saveTeamnames(api, newTeams = teamnames) {
    const csvContent = [
        'blue,green,red,black',
        `${newTeams.blue},${newTeams.green},${newTeams.red},${newTeams.black}`
    ].join('\n');

    try {
        const savedPath = await saveFile(api, folderPath, teamFile, csvContent);
    } catch (err) {
        console.error('✗ Error saving teamnames:', err);
    }
}

export function parseTeamnames(data) {
    const lines = data.split('\n').map(l => l.trim()).filter(Boolean);

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
