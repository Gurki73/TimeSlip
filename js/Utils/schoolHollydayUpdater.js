const DATA_DIR = '../data/schoolHolidays';

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

export async function GetSchoolHoliday(api,state, year) {
  const filePath = `data/schoolHolidays/${state}_${year}_holidays.csv`;

  console.log(' school holliday loader api ==> ' + api);
  // if (await csvExists(filePath)) {
  //   return await readCSV(filePath);
  // }
    try {
    
    const data = await api.getSchoolHolidays(`DE-${state}`, year);

    // Map data according to API response structure
    return data.map(item => ({
      name: item.name,
      startDate: item.startDate,
      endDate: item.endDate
    }));
  } catch (error) {
    console.error('Failed to fetch or save data:', error);
    return [];
  }
}

