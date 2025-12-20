import { loadFile, saveFile } from '../loader/loader.js';

const DATA_DIR = '../schoolHolidays';

const waitForAPI = () => {
  return new Promise((resolve) => {
    const checkAPI = () => {
      if (window.api) {
        resolve(window.api);
      } else {
        setTimeout(checkAPI, 10);
      }
    };
    checkAPI();
  });
};

(async () => {
  const api = await waitForAPI();
  // Now safely use `api` here
})();


export function parseToCSV(data) {
  const header = 'Holiday Name,Start Date,End Date\n';
  const rows = data.map(holiday =>
    `${holiday.name[0].text},${holiday.startDate},${holiday.endDate}`
  ).join('\n');

  return header + rows;
}

async function csvExists(filePath) {
  try {
    const response = await fetch(filePath, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

async function readCSV(filePath) {
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error('Failed to fetch file');
    }

    const content = await response.text();
    return content
      .split('\n')
      .slice(1)  // Skip header
      .filter(line => line)
      .map(line => {
        const [name, startDate, endDate] = line.split(',').map(item => item.trim());
        return { name, startDate, endDate };
      });
  } catch (err) {
    console.error('Failed to read CSV:', err);
    return [];
  }
}

export async function GetSchoolHoliday(api, state, year) {
  if (state === 'XX') {
    return [];
  }
  homeKey: "client";
  const relativePath = `schoolHolidays/${state}_${year}_holidays.csv`;

  try {
    const fileData = await api.loadCSV('client', relativePath);
    if (fileData) {
      return fileData;
    } else {
      return [];
    }
  } catch (error) {
    console.warn('❌ Failed to load school holidays:', error);
    return [];
  }
}

export function parseSchoolHolidayCsv(csvString, year) {
  if (!csvString || typeof csvString !== "string") return [];

  const lines = csvString.trim().split(/\r?\n/);
  const headers = lines.shift().split(',').map(h => h.trim().toLowerCase());

  const holidays = lines.map(line => {
    const cols = line.split(',').map(c => c.trim());
    const obj = {};
    headers.forEach((h, i) => obj[h] = cols[i]);

    // --- Normalize name ---
    let name = obj['holiday name'] || obj['name'] || 'Unbekannt';
    name = shortenHolidayName(name);

    return {
      name,
      startDate: obj['start date'] || '',
      endDate: obj['end date'] || ''
    };
  });

  // --- Filter by relevant year ---
  const validHolidays = holidays.filter(h => {
    const startY = new Date(h.startDate).getFullYear();
    const endY = new Date(h.endDate).getFullYear();
    return startY === year || endY === year;
  });

  // --- Add emoji for season ---
  return validHolidays.map(h => ({
    ...h,
    emoji: getSeasonEmoji(h.startDate)
  }));
}

function shortenHolidayName(name) {
  // Remove the word "ferien" (case-insensitive) and trim spaces
  name = name.replace(/ferien/gi, '').trim();

  // Replace common patterns to be more compact
  name = name
    .replace(/\bWeihnachts\b/i, 'Weihnachten')
    .replace(/\bOster\b/i, 'Ostern')
    .replace(/\bSommer\b/i, 'Sommer')
    .replace(/\bHerbst\b/i, 'Herbst')
    .replace(/\bWinter\b/i, 'Winter')
    .replace(/\bPfingst\b/i, 'Pfingsten');

  // Capitalize first letter
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function getSeasonEmoji(dateStr) {
  const d = new Date(dateStr);
  const m = d.getMonth() + 1;
  if (m >= 12 || m <= 2) return '❄️'; // Winter
  if (m >= 3 && m <= 5) return '🌹'; // Spring
  if (m >= 6 && m <= 8) return '☀️'; // Summer
  return '🍁'; // Autumn
}



export async function apiHealthCheck(api, url = 'https://openholidaysapi.org/healthcheck') {
  const result = await api.healthCheck(url);
  return result;
}

export async function DownloadSchoolHoliday(api, state, year) {
  const result = await api.getSchoolHolidays(state, year);
  if (!result) {
    HTMLFormControlsCollection.log(result);
    return [];
  }

  // Handle possible wrapped format
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.data)) return result.data;
  if (result.success && Array.isArray(result.payload)) return result.payload;

  console.warn("⚠️ Unexpected format from getSchoolHolidays:", result);
  return [];
}



export async function LoadSchoolHoliday(api, state, year) {
  const homeKey = 'client';
  const relativePath = `schoolHolidays/${state}_${year}_holidays.csv`;

  // Load cached file, fallback = empty array
  const fileData = await loadFile(api, homeKey, relativePath, async () => []);
  return fileData;
}