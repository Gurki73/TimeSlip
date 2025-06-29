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


function parseToCSV(data) {
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
  let homeKey = localStorage.getItem('clientDefinedDataFolder') || 'home';
  const relativePath = `schoolHolidays/${state}_${year}_holidays.csv`;
  console.log("Try to load school holidays from client folder: ", relativePath);
  try {
    const fileData = await api.loadCSV(homeKey, relativePath);

    if (fileData) {
      console.log('✅ Loaded role data from', homeKey, relativePath);
      console.log("file data ==> ", fileData);
      parseToCSV(fileData);
    } else {
      console.log("no school holiday data recived");
    }
  } catch (error) {
    console.error('❌ Failed to load school holidays:', error);
  }
}

export async function apiHealthCheck(api, url = 'https://openholidaysapi.org/healthcheck') {
  console.log("performing health check for: ", url);
  const result = await api.healthCheck(url);
  return result;
}

export async function DownloadSchoolHoliday(api, state, year) {
  return await api.getSchoolHolidays(state, year); // invokes IPC
}

// 📂 Loads local data from disk
export async function LoadSchoolHoliday(api, state, year) {
  const homeKey = localStorage.getItem('clientDefinedDataFolder') || 'home';
  const relativePath = `schoolHolidays/${state}_${year}_holidays.csv`;
  return await api.loadCSV(homeKey, relativePath);
}