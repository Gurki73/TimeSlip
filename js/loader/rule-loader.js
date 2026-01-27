// js/loader/rule-loader.js
import { loadFile, saveFile } from './loader.js'; // your existing loader API

const RULE_FOLDER = 'rules';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1200;

let rules = [];       // evaluated (usable) rules
let allRules = [];    // raw rule objects loaded

// ----------------- Public API -----------------
export async function loadRuleData(api, attempt = 1) {
  if (!api) {
    console.error('[rule-loader] window.api not available');
    return [];
  }

  let homeKey = localStorage.getItem('dataMode') || 'auto';

  if (homeKey === 'sample') return loadSampleRuleData();

  try {
    // Attempt to load an index file first (optional). If not present, fallback to sample list.
    const listPath = `${RULE_FOLDER}/index.json`;
    const indexContent = await loadFile(api, 'ruleset', listPath, async () => { });
    const files = parseIndexOrSampleList(indexContent);

    const loaded = [];
    for (const rel of files) {
      const data = await loadFile(api, 'ruleset', rel, null);
      if (!data) {
        console.warn('[rule-loader] missing rule file', rel);
        continue;
      }
      const parsed = parseRuleJSON(data);
      const fixed = sanitizeRule(parsed);
      loaded.push(fixed);
    }

    allRules = loaded.map(r => ({ ...r })); // raw list
    rules = allRules.filter(r => r && r.main); // quick filter
    console.log(`✅ Loaded ${rules.length} rules`);
    return [...allRules];

  } catch (err) {
    console.warn(`❌ Failed to load rules (attempt ${attempt})`, err);
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      return await loadRuleData(api, attempt + 1);
    } else {
      console.error('⚠️ Max retries reached. Loading sample rules.');
      const sample = await loadSampleRuleData();
      allRules = sample;
      rules = allRules.filter(r => r && r.main);
      return [...allRules];
    }
  }
}

export async function loadSampleRuleList() {
  return JSON.stringify([
    "rule_sample_001.json",
    "rule_sample_002.json",
    "rule_sample_003.json",
    "rule_sample_004.json",
    "rule_sample_005.json",
    "rule_sample_006.json",
    "rule_sample_007.json",
    "rule_sample_008.json",
    "rule_sample_009.json",
    "rule_sample_010.json",
    "rule_sample_011.json",
    "rule_sample_012.json",
  ]);
}

function parseIndexOrSampleList(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    // if it's a string with newlines, map to array
    return raw.split('\n').map(l => l.trim()).filter(Boolean);
  }
  return [];
}

export async function loadSampleRuleData() {

  console.log(" LOAD SAMPLE RULE DATA ");
  try {
    // try fetch the sample files bundled with the app
    const sampleIndex = await loadSampleRuleList();
    const files = parseIndexOrSampleList(sampleIndex);
    const sampleRules = [];
    for (const rel of files) {
      try {
        const normalized = rel.replace(/^rules\//, '');
        const resp = await fetch(`samples/rules/${normalized}`);
        if (!resp.ok) throw new Error('sample fetch failed');
        const text = await resp.text();
        const parsed = parseRuleJSON(text);
        sampleRules.push(sanitizeRule(parsed));
      } catch (e) {
        console.warn('⚠️ sample rule missing', rel, e);
      }
    }
    return sampleRules;
  } catch (err) {
    console.error('❌ Error loading sample rules:', err);
    return [];
  }
}

// ----------------- Parse / Sanitize / Validate -----------------
export function parseRuleJSON(input) {
  if (!input) return null;

  if (typeof input === 'object') {
    return deepClone(input);
  }

  try {
    const parsed = JSON.parse(input);

    // sanity: must be plain object
    if (!parsed || Array.isArray(parsed)) return null;

    return parsed;
  } catch {
    return null;
  }
}

export function sanitizeRule(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const now = Date.now();
  const id = raw.id ?? (`rule_${now}`);

  // shallow clone and defaults
  const r = {
    id: String(id),
    created: raw.created || now,
    updated: raw.updated || now,
    main: raw.main || {},
    condition: raw.condition || {}
  };

  // Ensure each block exists with minimal defaults
  r.main.repeat = r.main.repeat || { type: 'W0', details: { bottom: 1, top: 1 } };
  r.main.timeframe = r.main.timeframe || { type: 'T0', details: { days: [] } };
  r.main.amount = r.main.amount || { type: 'A1', details: { bottom: 1, top: 1 } };
  r.main.group = r.main.group || { type: 'G0', roles: [] };
  r.main.dependency = r.main.dependency || { type: 'D0', details: { roles: [], top: 1, bottom: 1 } };
  r.main.exception = r.main.exception || { type: 'E0' };

  // condition defaults
  const c = r.condition;
  r.condition.repeat = c.repeat || { type: 'w0', details: { bottom: 1, top: 1 } };
  r.condition.timeframe = c.timeframe || { type: 't0', details: { days: [] } };
  r.condition.amount = c.amount || { type: 'a1', details: { bottom: 1, top: 1 } };
  r.condition.group = c.group || {
    type: 'g0', details: { roles: [] }
  };
  r.condition.dependency = c.dependency || { type: 'd0', details: { roles: [], top: 1, bottom: 1 } };

  // normalize numeric fields
  const nfix = (obj) => {
    if (!obj) return;
    if (obj.bottom == null) obj.bottom = 1;
    if (obj.top == null) obj.top = obj.bottom;
  };
  nfix(r.main.amount);
  nfix(r.condition.amount);

  // ensure arrays
  if (!Array.isArray(r.main.timeframe.days)) r.main.timeframe.days = [];
  if (!Array.isArray(r.main.group.roles)) r.main.group.roles = [];
  if (!Array.isArray(r.main.dependency.roles)) r.main.dependency.roles = [];
  if (!Array.isArray(r.condition.group.roles)) r.condition.group.roles = [];

  return r;
}

export function validateRule(rule) {
  const errors = [];
  if (!rule || typeof rule !== 'object') {
    errors.push('rule must be an object');
    return { valid: false, errors };
  }
  if (!rule.id) errors.push('missing id');
  // amount bottom/top sanity
  const am = rule.main.amount;
  if (!am || typeof am.bottom !== 'number' || typeof am.top !== 'number') {
    errors.push('amount bottom/top must be numbers');
  } else if (am.bottom < 0 || am.top < 0) {
    errors.push('amount limits must be >= 0');
  } else if (am.bottom > am.top) {
    errors.push('amount.bottom must be <= amount.top');
  }
  // group roles
  if (!Array.isArray(rule.main.group.roles)) errors.push('group.roles must be array');
  // dependency denom/numer sanity
  const dep = rule.main.dependency;
  if (dep && (dep.denominator === 0 || dep.denominator == null)) {
    errors.push('dependency denominator must be non-zero');
  }
  return { valid: errors.length === 0, errors };
}

// ----------------- Save / Delete -----------------
export async function saveRuleData(api, ruleObj) {
  if (!api) {
    console.error('[rule-loader] window.api not available');
    return null;
  }

  // sanitize & validate before save
  const fixed = sanitizeRule(ruleObj);
  const { valid, errors } = validateRule(fixed);
  if (!valid) {
    console.warn('[rule-loader] rule validation failed', errors);
    // try to auto-fix minor things — but abort on structural issues
    return { success: false, errors };
  }
  const id = safeId(fixed.id);
  const filename = `${RULE_FOLDER}/${id}.json`;
  const content = JSON.stringify(fixed, null, 2);

  function safeId(str) {
    return String(str)
      .replace(/[^a-zA-Z0-9_\-]/g, '_')
      .replace(/_+/g, '_');
  }

  try {
    const saved = await saveFile(api, RULE_FOLDER, `${fixed.id}.json`, content);
    console.log('💾 Rule saved:', saved);
    return { success: !!saved, path: saved, rule: fixed };
  } catch (err) {
    console.error('✗ Error saving rule:', err);
    return { success: false, error: err };
  }
}

export async function deleteRule(api, id) {
  // We assume saveFile has a delete helper in main; if not, add IPC handler in preload/main
  try {
    const full = `${RULE_FOLDER}/${id}.json`;
    if (!api) throw new Error('no api');
    // send delete request through a channel 'rules:delete' implemented in preload/main
    if (typeof api.invoke === 'function') {
      const res = await api.invoke('rules:delete', full);
      return res;
    }
    return { success: false, error: 'delete not implemented in api' };
  } catch (err) {
    console.error('✗ deleteRule failed', err);
    return { success: false, error: err.message };
  }
}

// ----------------- Accessors -----------------
export function getRules() {
  return rules.map(r => ({ ...r }));
}
export function getAllRules() {
  return allRules.map(r => ({ ...r }));
}
