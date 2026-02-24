// js/loader/rule-loader.js
import { loadFile, saveFile } from './loader.js'; // your existing loader API

const RULE_FOLDER = 'rules';
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1200;

let rules = [];       // evaluated (usable) rules
let allRules = [];    // raw rule objects loaded
let rulesMode = null;

export async function loadRuleData(api, attempt = 1) {
  if (!api) {
    console.error('[rule-loader] window.api not available');
    return [];
  }

  const homeKey = localStorage.getItem('dataMode') || 'auto';

  if (homeKey === 'sample') {
    if (rulesMode === 'sample' && rules.length > 0) {
      return [...allRules];
    }

    const sample = await loadSampleRuleData();
    allRules = sample;
    rules = allRules.filter(r => r && r.main);
    rulesMode = 'sample';
    return [...allRules];
  }

  let ruleFiles;
  try {
    ruleFiles = await api.getRuleFiles();
  } catch (err) {
    console.warn('[rule-loader] getRuleFiles failed', err);

    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      return loadRuleData(api, attempt + 1);
    }

    console.error('⚠️ Cannot access rules folder. Falling back to samples.');
    const sample = await loadSampleRuleData();
    allRules = sample;
    rules = allRules.filter(r => r && r.main);
    return [...allRules];
  }

  if (!Array.isArray(ruleFiles) || ruleFiles.length === 0) {
    console.warn('[rule-loader] no rule JSON files found');
    allRules = [];
    rules = [];
    return [];
  }

  const loaded = [];

  for (const filePath of ruleFiles) {
    try {
      const data = await loadFile(api, 'ruleset', filePath, null);
      if (!data) {
        console.warn('[rule-loader] missing rule file', filePath);
        continue;
      }

      const result = parseRuleJSON(data);
      if (!result || !result.ok) {
        console.warn('[rule-loader] parse rejected', filePath, result?.error);
        continue;
      }

      const fixed = sanitizeRule(result.value, filePath);
      if (!fixed || !fixed.main) {
        console.warn('[rule-loader] sanitize rejected', filePath);
        continue;
      }

      loaded.push(fixed);
    } catch (err) {
      console.warn('[rule-loader] failed to process rule file', filePath, err);
    }
  }

  allRules = loaded.map(r => ({ ...r }));
  rules = allRules.filter(r => r && r.main);
  rulesMode = 'client';

  return [...allRules];
}

export async function loadSampleRuleList() {
  return JSON.stringify([
    "rule_sample_001.json",
    "rule_sample_002.json",
    "rule_sample_003.json",
  ]);
}

function parseIndexOrSampleList(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    return raw.split('\n').map(l => l.trim()).filter(Boolean);
  }
  return [];
}

let sampleCache = null;

export async function loadSampleRuleData() {
  if (sampleCache) return [...sampleCache];

  const sampleRules = [];
  try {
    const sampleIndex = await loadSampleRuleList();
    const files = parseIndexOrSampleList(sampleIndex);

    for (const rel of files) {
      try {
        const normalized = rel.replace(/^rules\//, '');
        const resp = await fetch(`samples/rules/${normalized}`);
        if (!resp.ok) throw new Error('sample fetch failed');
        const text = await resp.text();
        const parsed = parseRuleJSON(text);
        if (!parsed.ok) {
          console.warn('⚠️ sample parse failed', rel, parsed.error);
          continue;
        }
        sampleRules.push(sanitizeRule(parsed.value, `rules/${normalized}`));
      } catch (e) {
        console.warn('⚠️ sample rule missing', rel, e);
      }
    }
    sampleCache = sampleRules;
    return [...sampleRules];
  } catch (err) {
    console.error('❌ Error loading sample rules:', err);
    return [];
  }
}

export function parseRuleJSON(input) {
  if (!input) {
    return { ok: false, error: 'empty input' };
  }

  if (typeof input === 'object') {
    return { ok: true, value: deepClone(input) };
  }

  try {
    const parsed = JSON.parse(input);
    if (!parsed || Array.isArray(parsed)) {
      return { ok: false, error: 'rule must be an object' };
    }
    return { ok: true, value: parsed };
  } catch (e) {
    return { ok: false, error: `JSON parse failed: ${e.message}` };
  }
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return h;
}

export function sanitizeRule(raw, sourcePath = null) {
  if (!raw || typeof raw !== 'object') return null;

  const now = Date.now();
  const id =
    raw.id ??
    raw.__sampleId ??
    `sample_${Math.abs(hash(JSON.stringify(raw)))}`;


  // shallow clone and defaults
  const r = {
    id: String(id),
    created: raw.created || now,
    updated: raw.updated || now,
    isAsleep: Boolean(raw.isAsleep ?? false),
    main: raw.main || {},
    condition: raw.condition || {}
  };

  if (sourcePath) r._sourcePath = String(sourcePath);

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
    return { success: !!saved, path: saved, rule: fixed };
  } catch (err) {
    console.error('✗ Error saving rule:', err);
    return { success: false, error: err };
  }
}

export async function deleteRule(api, idOrPath) {
  try {
    const safeId = id => String(id).replace(/[^a-zA-Z0-9_\-]/g, '_').replace(/_+/g, '_');
    const input = String(idOrPath ?? '').trim();
    const isRelativeRulePath = /(^|\/)rules\/.+\.json$/i.test(input);
    const isBareRuleFile = /^rule_.+\.json$/i.test(input);
    const full = isRelativeRulePath
      ? input
      : isBareRuleFile
        ? `${RULE_FOLDER}/${input}`
        : `${RULE_FOLDER}/${safeId(input)}.json`;
    if (!api) throw new Error('no api');
    if (typeof api.deleteRule === 'function') {
      const res = await api.deleteRule(full);
      if (res && typeof res === 'object') return res;
      return { success: Boolean(res), error: res ? null : 'delete failed' };
    }
    if (typeof api.invoke === 'function') {
      const res = await api.invoke('rules:delete', full);
      if (res && typeof res === 'object') return res;
      return { success: Boolean(res), error: res ? null : 'delete failed' };
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
