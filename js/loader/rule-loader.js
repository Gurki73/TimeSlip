let rules = [];
let allRules = [];

/**
 * Load rules data from CSV via api or fallback to sample.
 */
export async function loadRuleData(api) {
  if (!api) {
    console.error('[rule-loader.js] window.api not available');
    return;
  }

  const homeKey = localStorage.getItem('clientDefinedDataFolder') || 'home';
  const relativePath = 'rules.csv';

  try {
    const fileData = await api.loadCSV(homeKey, relativePath);

    if (fileData) {
      parseRulesCSV(fileData);
      console.log(`✅ Loaded rule data from ${homeKey}/${relativePath}`);
    } else {
      console.warn(`⚠️ No rule data found at ${homeKey}/${relativePath}, using sample fallback.`);
      await loadSampleRuleData();
    }
  } catch (error) {
    console.error('❌ Failed to load rule data:', error);
    await loadSampleRuleData();
  }
}

/**
 * Load rules sample CSV for fallback.
 */
export async function loadSampleRuleData() {
  try {
    const response = await fetch('samples/rules.csv');
    if (!response.ok) throw new Error('Sample rules CSV fetch failed');
    const data = await response.text();
    parseRulesCSV(data);
    console.log('✅ Loaded sample rules data');
  } catch (error) {
    console.error('❌ Error loading sample rule data:', error);
    throw error;
  }
}

/**
 * Parse rules CSV → rules array.
 * Each rule might look like: id, type, condition1, operator, condition2, description
 */
export function parseRulesCSV(csvData) {
  const rows = csvData.split('\n').map(row => row.trim()).filter(Boolean);

  if (rows.length < 2) {
    console.warn('Rules CSV is empty or missing data.');
    rules = [];
    allRules = [];
    return;
  }

  const header = rows[0].split(',').map(h => h.trim().toLowerCase());

  allRules = rows.slice(1).map(row => {
    const cols = row.split(',').map(cell => cell.trim());
    const record = {};
    header.forEach((colName, i) => {
      record[colName] = cols[i] || '';
    });
    return record;
  });

  rules = allRules.filter(rule => rule.id && rule.id !== '?');
}

/**
 * Convert rules back to CSV.
 */
export function serializeRulesCSV(data) {
  if (!data || data.length === 0) {
    return 'id,type,condition1,operator,condition2,description';
  }

  const header = Object.keys(data[0]);
  const lines = data.map(rule =>
    header.map(h => rule[h] ?? '').join(',')
  );
  return [header.join(','), ...lines].join('\n');
}

/**
 * Save current rules back to CSV via API.
 */
export async function saveRuleData(api) {
  const csvContent = serializeRulesCSV(allRules);

  const folderKey = localStorage.getItem('clientDefinedDataFolder') || 'home';
  const filename = 'rules.csv';

  try {
    const savedDirectory = await api.saveCSV(folderKey, filename, csvContent);
    if (savedDirectory) {
      console.log('☑ Rules CSV saved successfully to:', savedDirectory);
      localStorage.setItem('clientDefinedDataFolder', savedDirectory);
    } else {
      console.warn('⚠ Failed to save rules CSV file.', savedDirectory);
    }
  } catch (err) {
    console.error('✗ Error saving rules data:', err);
  }
}

export { rules, allRules };
