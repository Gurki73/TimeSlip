import { loadRoleData } from '../../js/loader/role-loader.js';
import { loadEmployeeData, filterEmployeesByMonthYear } from '../../js/loader/employee-loader.js';
import { loadStateData, loadCompanyHolidayData, loadOfficeDaysData, loadBridgeDays, loadPublicHolidaysSimple } from '../../js/loader/calendar-loader.js';
import { getHolidayDetails, nonOfficialHolidays, monthNames, getAllHolidaysForYear } from '../../js/Utils/holidayUtils.js';
import { updateStateFlag } from '../../js/Utils/flagUtils.js';
import { getZodiac } from '../../js/Utils/zodiacs.js';
import { getShiftSymbol } from '../../js/Utils/globalIcons.js';
import { loadRequests } from '../../js/loader/request-loader.js';
import { keyToBools } from '../forms/calendar-form/calendar-form-utils.js';
import { checkOnboardingState } from '../../js/Utils/onboarding.js';
import { globalRefresh } from '../../js/renderer.js';
import { renderEmployees } from '../legend/legend.js';
import { loadRuleData } from '../../js/loader/rule-loader.js';
import { updateRuleset } from '../forms/rule-form/translatorMachine.js';
import { runSolver as runSolver, runSolverPerShift, mergeAttendance, checkRulesForWeek, checkRulesForSpecial, createEmptyAttendance } from '../forms/rule-form/solver.js';
import { executeRuleset } from '../forms/rule-form/ruleChecker.js';


let currentMonthIndex;
let currentYear;
let calendarEmployees = [];
let calendarRoles = [];
let weeks;
let isInOffice;
let currentState;
let officeDays = [];
let bridgeDays = [];
let schoolHolidays = [];
let publicHolidays = [];
let allPublicHolidays = [];
let companyHolidays = [];
let cachedApi = null;
let rulesetMonth = [], rulesetWeek = [], rulesetDay = [], rulesetShift = [];
let machineRuleSet = [];
let cachedZodiacStyle = "none";
let cachedShiftSymbols = "letters";
let calendarDataReady = false;
let calendarRenderSeq = 0;
let roleNameByIndex = new Map();

function rebuildRoleNameCache(roles = []) {
  roleNameByIndex = new Map();
  if (!Array.isArray(roles)) return;

  roles.forEach((role, idx) => {
    const name = String(role?.name || '').trim();
    if (!name || name === '?') return;

    const colorIndex = Number(role?.colorIndex);
    if (Number.isInteger(colorIndex) && colorIndex >= 0) {
      roleNameByIndex.set(colorIndex, name);
    }
    if (!roleNameByIndex.has(idx)) {
      roleNameByIndex.set(idx, name);
    }
  });
}

async function loadCalendarData(api) {
  if (!api) {
    console.error('❌ window.api is not available in calendar.js');
    return false;
  }

  cachedApi = api;
  const { isOnboarding, dataFolder } = await checkOnboardingState(api);

  if (!currentYear) currentYear = new Date().getFullYear();

  try {
    const [_roles, _employees, _officeDaysData, _companyHolidays, _bridgeDays, _publicHolidays, _ruleset] = await Promise.all([
      loadRoleData(api),
      loadEmployeeData(api),
      loadOfficeDaysData(api, isOnboarding),
      loadCompanyHolidayData(api, currentYear),
      loadBridgeDays(api),
      loadPublicHolidaysSimple(api),
      loadRuleData(api),
    ]);

    calendarRoles = _roles;
    rebuildRoleNameCache(calendarRoles);
    currentState = await loadStateData(api);
    officeDays = _officeDaysData;
    calendarEmployees = _employees;
    companyHolidays = _companyHolidays;
    publicHolidays = _publicHolidays;
    allPublicHolidays = getAllHolidaysForYear(currentYear, currentState);
    bridgeDays = normalizeBridgedays(_bridgeDays);
    machineRuleSet = updateRuleset(_ruleset) || [];

    cachedZodiacStyle = localStorage.getItem('zodiacStyle') || 'none';
    cachedShiftSymbols = localStorage.getItem('shiftSymbols') || 'letters';

    isInOffice = localStorage.getItem('presenceState') || true;
    const colorTheme = localStorage.getItem('colorTheme');
    const zoomFactor = localStorage.getItem('zoomFactor');
    const clientDefinedDataFolder = localStorage.getItem('clientDefinedDataFolder');
    const autoSaveEnabled = localStorage.getItem('autoSaveEnabled') === 'true';

    window.dispatchEvent(new CustomEvent('autoSaveChanged', { detail: { enabled: autoSaveEnabled } }));
    calendarDataReady = true;
    return true;
  } catch (error) {
    console.warn('❌ Error loading initial calendar data:', error);
    return false;
  }
}

export async function initializeCalendar(api) {
  const ok = await loadCalendarData(api);
  if (!ok) return;
  setupCalendarEnvironment();
}

export async function ensureCalendarReady(api) {
  if (calendarDataReady && cachedApi) return true;
  return await loadCalendarData(api);
}

function normalizeBridgedays(bridgeDayData) {
  const filteredBridgeDays = bridgeDayData.filter(bd => bd && bd.isOpen === false);
  const closedBridgeDayIds = filteredBridgeDays.map(bd => bd.id);
  const bridgeDays = [];

  closedBridgeDayIds.forEach(cbd => {
    const dateStr = cbd.replace('bridge-', '');
    const parsedDate = new Date(dateStr);

    if (!isNaN(parsedDate)) {
      bridgeDays.push(parsedDate);
    } else {
      console.warn('⚠️ Could not parse bridge day:', cbd);
    }
  });
  return bridgeDays;
}

export async function initializeCalendarFromData({
  passedRoles = [],
  passedEmployees = [],
  passedOfficeDays = {},
  passedCompanyHolidays = [],
  passedSchoolHolidays = [],
  passedBridgeDays = []
}) {
  try {
    calendarRoles = passedRoles;
    calendarEmployees = passedEmployees;
    officeDays = passedOfficeDays;
    currentYear = new Date().getFullYear();
    // optionally store holidays in global or local state
    companyHolidays = passedCompanyHolidays;
    schoolHolidays = passedSchoolHolidays;
    bridgeDays = passedBridgeDays;

    setupCalendarEnvironment();

    const colorTheme = localStorage.getItem('colorTheme');
    const zoomFactor = localStorage.getItem('zoomFactor');

    const cacheDump = {
      colorTheme: colorTheme ?? 'default (light)',
      zoomFactor: zoomFactor ?? 'default (1.0)',
      dataSource: 'external',
    };
  } catch (error) {
    console.error('❌ Error initializing calendar with provided data:', error);
  }
}

function setupCalendarEnvironment() {
  applyRuleWarnings(null);
  initializeCalendarData();
  createCalendarNavigation();
  updateCalendarDisplay();
  registerCalendarJumpEntryPoints();
}


function initializeCalendarData() {
  const currentDate = new Date();
  currentMonthIndex = currentDate.getMonth() + 1;
  currentYear = currentDate.getFullYear();
}

function applyCalendarStyles() {
  const calendarContainer = document.querySelector('.calendar-container');
  if (!calendarContainer) return;

  const totalCols = 8.5;
  const shrinkCells = officeDays.filter(day => day === 'never').length + 1;
  const regularCells = totalCols - shrinkCells; // Exclude KW column

  const shrinkWidthPercent = 5; // e.g., 5% for closed days
  const remainingWidthPercent = 100 - (shrinkWidthPercent * shrinkCells);
  const regularWidthPercent = remainingWidthPercent / regularCells;

  calendarContainer.style.setProperty('--regular-width', `${regularWidthPercent}%`);
  calendarContainer.style.setProperty('--shrink-width', `${shrinkWidthPercent}%`);
}

export function setDateRemote(year, month = currentMonthIndex) {
  currentYear = year;
  currentMonthIndex = month;
  updateCalendarDisplay();
}

export function updateCalendarDisplay() {
  generateAndRenderCalendar(currentMonthIndex, currentYear);
  document.getElementById('calendar-month').textContent = monthNames[currentMonthIndex];
  document.getElementById('calendar-year').textContent = currentYear;

  // Trigger fade animation via class toggle
  const feedback = document.getElementById('calendar-feedback');
  if (!feedback) return;

  feedback.classList.add('active');

  setTimeout(() => {
    feedback.classList.remove('active');
  }, 1700); // fade out after 700ms

}

function formatISODate(date) {
  if (!(date instanceof Date)) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateInput(input) {
  if (!input) return null;

  if (input instanceof Date) {
    return new Date(input.getFullYear(), input.getMonth(), input.getDate());
  }

  if (typeof input === 'string') {
    // prefer YYYY-MM-DD without timezone shift
    const parts = input.split('-').map(Number);
    if (parts.length === 3 && parts.every(n => Number.isFinite(n))) {
      const [y, m, d] = parts;
      if (m >= 1 && m <= 12) return new Date(y, m - 1, d);
    }
    const parsed = new Date(input);
    if (!isNaN(parsed)) return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    return null;
  }

  if (typeof input === 'object') {
    const y = Number(input.year);
    const mRaw = Number(input.month);
    const d = Number(input.day);
    if (Number.isFinite(y) && Number.isFinite(mRaw) && Number.isFinite(d)) {
      const m = (mRaw >= 1 && mRaw <= 12) ? mRaw - 1 : mRaw; // accept 0-11 or 1-12
      if (m >= 0 && m <= 11) return new Date(y, m, d);
    }
  }

  return null;
}

function clearCalendarJumpHighlights() {
  document.querySelectorAll('.day-column.jump-target, .day-column.jump-range, .day-column.jump-range-start, .day-column.jump-range-end')
    .forEach(el => {
      el.classList.remove('jump-target', 'jump-range', 'jump-range-start', 'jump-range-end');
    });
}

function waitForCalendarRender(targetYear, targetMonth, timeoutMs = 900) {
  return new Promise(resolve => {
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      document.removeEventListener('calendar-ready', onReady);
      resolve();
    };

    const onReady = (e) => {
      if (e?.detail?.year === targetYear && e?.detail?.month === targetMonth) {
        finish();
      }
    };

    document.addEventListener('calendar-ready', onReady);
    setTimeout(finish, timeoutMs);
  });
}

export async function jumpToDate(dateInput, options = {}) {
  const target = parseDateInput(dateInput);
  if (!target) {
    console.warn('[calendar] jumpToDate: invalid date input', dateInput);
    return false;
  }

  const monthSheet = document.getElementById('calendar-month-sheet');
  if (!monthSheet) {
    console.warn('[calendar] jumpToDate: calendar not ready');
    return false;
  }

  if (options.clear !== false) clearCalendarJumpHighlights();

  const targetYear = target.getFullYear();
  const targetMonth = target.getMonth();

  if (currentYear !== targetYear || currentMonthIndex !== targetMonth) {
    currentYear = targetYear;
    currentMonthIndex = targetMonth;
    updateCalendarDisplay();
    await waitForCalendarRender(targetYear, targetMonth);
  }

  const iso = formatISODate(target);
  const cell = iso ? document.querySelector(`.day-column[data-date="${iso}"]`) : null;
  if (!cell) {
    console.warn('[calendar] jumpToDate: day cell not found', iso);
    return false;
  }

  cell.classList.add('jump-target');
  try {
    cell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  } catch (err) {
    // scrollIntoView can fail in older environments; ignore
  }

  return true;
}

export async function jumpToRange(startInput, endInput, options = {}) {
  const start = parseDateInput(startInput);
  const end = parseDateInput(endInput);
  if (!start || !end) {
    console.warn('[calendar] jumpToRange: invalid date input', startInput, endInput);
    return false;
  }

  const startTime = start.getTime();
  const endTime = end.getTime();
  const rangeStart = startTime <= endTime ? start : end;
  const rangeEnd = startTime <= endTime ? end : start;

  const focus = options.focus === 'end' ? rangeEnd : rangeStart;
  await jumpToDate(focus, { clear: options.clear });

  const rangeStartIso = formatISODate(rangeStart);
  const rangeEndIso = formatISODate(rangeEnd);
  if (!rangeStartIso || !rangeEndIso) return false;

  const cells = document.querySelectorAll('.day-column[data-date]');
  cells.forEach(cell => {
    const dateStr = cell.dataset.date;
    if (!dateStr) return;
    if (dateStr >= rangeStartIso && dateStr <= rangeEndIso) {
      cell.classList.add('jump-range');
      if (dateStr === rangeStartIso) cell.classList.add('jump-range-start');
      if (dateStr === rangeEndIso) cell.classList.add('jump-range-end');
    }
  });

  return true;
}

function registerCalendarJumpEntryPoints() {
  if (window.__calendarJumpRegistered) return;
  window.__calendarJumpRegistered = true;

  window.calendarJump = window.calendarJump || {};
  window.calendarJump.toDate = jumpToDate;
  window.calendarJump.toRange = jumpToRange;
  window.calendarJump.clear = clearCalendarJumpHighlights;

  document.addEventListener('calendar-jump', (e) => {
    const detail = e?.detail || {};
    jumpToDate(detail.date || detail, detail);
  });

  document.addEventListener('calendar-jump-range', (e) => {
    const detail = e?.detail || {};
    jumpToRange(detail.start, detail.end, detail);
  });
}


function generateAndRenderCalendar(newMonthIndex, newYear) {
  applyCalendarStyles();
  weeks = generateCalendar(newMonthIndex, newYear);
  renderCalendarMonth(weeks);

  requestAnimationFrame(() => {
    document.dispatchEvent(
      new CustomEvent('calendar-ready', {
        detail: { month: newMonthIndex, year: newYear }
      })
    );
  });
}


function generateCalendar(month, year) {
  const firstDay = new Date(year, month, 1);
  const firstDayOfWeek = (firstDay.getDay() + 6) % 7; // Shift Sunday (0) to Monday (0)
  const lastDay = new Date(year, month + 1, 0);
  const totalDays = lastDay.getDate();

  const weeks = [];
  let currentWeek = [];
  let weekNumber = getWeekNumber(firstDay);
  let currentState;

  for (let i = 0; i < firstDayOfWeek; i++) {
    currentWeek.push('');
  }

  for (let day = 1; day <= totalDays; day++) {
    currentWeek.push(day);
    if (currentWeek.length === 7) {
      weeks.push({ weekNumber, days: [...currentWeek] });
      currentWeek = [];
      weekNumber++;
    }
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push('');
    }
    weeks.push({ weekNumber, days: [...currentWeek] });
  }

  return weeks;
}

export function setOfficeStatus(isInOffice) {

  localStorage.setItem('presenceState', isInOffice);
  generateAndRenderCalendar(currentMonthIndex, currentYear);
}

export function createPresenceSelector({
  id = 'presence-selector',
  defaultValue = true, // true = present
  mode = 'radio',     // 'toggle' or 'radio'
  onChange
} = {}) {
  const container = document.createElement('div');
  container.id = id;
  container.classList.add('presence-selector');

  const STATE_KEY = 'presenceState'; // stores true/false for in-office
  // read saved state (string 'true' / 'false') and convert to boolean
  isInOffice = localStorage.getItem(STATE_KEY);
  isInOffice = (isInOffice === null) ? defaultValue : (isInOffice === 'true');

  function persistAndNotify(value) {
    isInOffice = !!value;
    localStorage.setItem(STATE_KEY, String(isInOffice));
    if (typeof onChange === 'function') onChange(isInOffice);
    window.dispatchEvent(new CustomEvent('presenceChanged', { detail: { isInOffice } }));
  }

  function buildToggle() {
    const btn = document.createElement('button');
    btn.className = 'toggle-attendance';
    // set role/aria
    btn.setAttribute('role', 'switch');
    btn.setAttribute('aria-checked', String(isInOffice));

    const refresh = () => {
      btn.textContent = isInOffice ? 'Anwesend' : 'Abwesend';
      btn.classList.toggle('present', isInOffice);
      btn.classList.toggle('absent', !isInOffice);
      btn.setAttribute('aria-checked', String(isInOffice));
    };
    refresh();

    btn.addEventListener('click', () => {
      persistAndNotify(!isInOffice);
      refresh();
    });

    return btn;
  }

  function buildRadioGroup() {
    const wrapper = document.createElement('div');
    wrapper.className = 'presence-radio-group';

    const inId = `${id}-in`;
    const outId = `${id}-out`;

    const labelIn = document.createElement('label');
    labelIn.classList.add('label-like');
    const radioIn = document.createElement('input');
    radioIn.type = 'radio';
    radioIn.name = `${id}-presence`;
    radioIn.id = inId;
    radioIn.value = 'in';
    radioIn.checked = isInOffice;
    labelIn.appendChild(radioIn);
    labelIn.appendChild(document.createTextNode('Anwesend'));

    const labelOut = document.createElement('label');
    labelOut.classList.add('label-like');
    const radioOut = document.createElement('input');
    radioOut.type = 'radio';
    radioOut.name = `${id}-presence`;
    radioOut.id = outId;
    radioOut.value = 'out';
    radioOut.checked = !isInOffice;
    labelOut.appendChild(radioOut);
    labelOut.appendChild(document.createTextNode('Abwesend'));

    [radioIn, radioOut].forEach(r => {
      r.addEventListener('change', () => {
        persistAndNotify(r.value === 'in');
      });
    });

    wrapper.append(labelIn, labelOut);
    return wrapper;
  }

  const widget = (mode === 'radio') ? buildRadioGroup() : buildToggle();
  container.appendChild(widget);
  container.setPresenceMode = (newMode) => {
    // rebuild
    container.innerHTML = '';
    const w = (newMode === 'radio') ? buildRadioGroup() : buildToggle();
    container.appendChild(w);
  };

  container.setState = (state) => {
    persistAndNotify(!!state);
    // refresh visible widget
    // if it's a toggle -> update label & classes, else update radios
    const btn = container.querySelector('.toggle-attendance');
    if (btn) {
      btn.textContent = isInOffice ? 'Anwesend' : 'Abwesend';
      btn.classList.toggle('present', isInOffice);
      btn.classList.toggle('absent', !isInOffice);
      btn.setAttribute('aria-checked', String(isInOffice));
    } else {
      const radioIn = container.querySelector(`input[value="in"]`);
      const radioOut = container.querySelector(`input[value="out"]`);
      if (radioIn) radioIn.checked = isInOffice;
      if (radioOut) radioOut.checked = !isInOffice;
    }
  };

  return container;
}


function getWeekNumber(date) {
  const tempDate = new Date(date);
  tempDate.setDate(tempDate.getDate() - tempDate.getDay() + 3);
  const firstThursday = new Date(tempDate.getFullYear(), 0, 1);
  return Math.ceil(((tempDate - firstThursday) / 86400000 + 1) / 7);
}

function initPresence() {
  const container = document.getElementById('presence-container');
  if (!container) return;

  const presenceSelector = createPresenceSelector({
    defaultValue: true, // default in-office
    mode: 'radio',     // or 'radio'
    onChange: (isInOffice) => {
      setOfficeStatus(isInOffice);
    }
  });

  container.appendChild(presenceSelector);
}

function onStateFlagClick() {
  const navItem = document.getElementById('nav-calendar-settings');
  const navItemHint = document.getElementById('state-image-hint');
  if (navItem) {
    navItem.focus();
    if (navItemHint) navItemHint.classList.remove('hidden');
    navItem.classList.add('hint-highlight');
    setTimeout(() => {
      navItem.classList.remove('hint-highlight');
      if (navItemHint) navItemHint.classList.add('hidden');
    }, 2250);
  }
}


async function createCalendarNavigation() {
  const stateImage = document.getElementById('state-image');
  const monthLabel = document.getElementById('calendar-month');
  const yearLabel = document.getElementById('calendar-year');
  // const toggleAttendanceButton = document.getElementById('toggle-attendance');
  const savedState = await window.cacheAPI.getCacheValue('presenceState');
  const presenceSelector = createPresenceSelector({
    defaultValue: savedState !== null ? savedState === 'true' : true,
    mode: 'toggle',
    onChange: (isInOffice) => setOfficeStatus(isInOffice)
  });

  const prevMonthButton = document.getElementById('prev-month');
  const nextMonthButton = document.getElementById('next-month');
  const prevYearButton = document.getElementById('prev-year');
  const nextYearButton = document.getElementById('next-year');

  currentMonthIndex = new Date().getMonth();
  currentYear = new Date().getFullYear();

  const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];

  currentState = await loadStateData(cachedApi);
  if (stateImage) {
    updateStateFlag(currentState, stateImage);
    stateImage.removeEventListener('click', onStateFlagClick);
    stateImage.addEventListener('click', onStateFlagClick);
  }


  monthLabel.textContent = monthNames[currentMonthIndex];
  yearLabel.textContent = currentYear;

  initPresence();

  updateZodiac(currentYear);

  const updateCalendarNav = () => {
    monthLabel.textContent = monthNames[currentMonthIndex];
    yearLabel.textContent = currentYear;
    updateZodiac(currentYear);
  };


  // Debounce helper, local
  function debounceCalendarNav(fn, delay = 200) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function updateLegendFromCalendar() {
    const filtered = filterEmployeesByMonthYear(calendarEmployees, currentMonthIndex, currentYear);
    const employeeContent = document.getElementById('legend-employees');
    renderEmployees(employeeContent, filtered);
  }

  // ---- Navigation buttons with debounce ----
  prevMonthButton.addEventListener('click', debounceCalendarNav(() => {
    if (currentMonthIndex === 0) {
      currentMonthIndex = 11;
      currentYear--;
    } else {
      currentMonthIndex--;
    }
    updateCalendarNav();
    generateAndRenderCalendar(currentMonthIndex, currentYear);
    updateLegendFromCalendar(); // <-- update legend
  }, 150));

  nextMonthButton.addEventListener('click', debounceCalendarNav(() => {
    if (currentMonthIndex === 11) {
      currentMonthIndex = 0;
      currentYear++;
    } else {
      currentMonthIndex++;
    }
    updateCalendarNav();
    generateAndRenderCalendar(currentMonthIndex, currentYear);
    updateLegendFromCalendar(); // <-- update legend
  }, 150));

  prevYearButton.addEventListener('click', debounceCalendarNav(() => {
    currentYear--;
    updateCalendarNav();
    generateAndRenderCalendar(currentMonthIndex, currentYear);
    updateLegendFromCalendar(); // <-- add legend update
  }, 150));

  nextYearButton.addEventListener('click', debounceCalendarNav(() => {
    currentYear++;
    updateCalendarNav();
    generateAndRenderCalendar(currentMonthIndex, currentYear);
    updateLegendFromCalendar(); // <-- add legend update
  }, 150));

  const refreshBtn = document.getElementById('refresh-calendar-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      await globalRefresh();
    });
  }

}

function updateZodiac() {
  const zodiac = [
    { emoji: "🐀", mA: "der", mZ: "Ratte", fA: "der", fZ: "Maus" },
    { emoji: "🐄", mA: "des", mZ: "Ochsen", fA: "der", fZ: "Kuh" },
    { emoji: "🐅", mA: "des", mZ: "Tigers", fA: "der", fZ: "Tigerin" },
    { emoji: "🐇", mA: "des", mZ: "Rammlers", fA: "des", fZ: "Hasen" },
    { emoji: "🐉", mA: "des", mZ: "Drachens", fA: "der", fZ: "Drachin" },
    { emoji: "🐍", mA: "der", mZ: "Schlange", fA: "der", fZ: "Schlange" },
    { emoji: "🐎", mA: "des", mZ: "Hengstes", fA: "der", fZ: "Stute" },
    { emoji: "🐑", mA: "der", mZ: "Ziege", fA: "des", fZ: "Schafes" },
    { emoji: "🐒", mA: "des", mZ: "Affen", fA: "der", fZ: "Affin" },
    { emoji: "🐓", mA: "des", mZ: "Hahns", fA: "des", fZ: "Huhns" },
    { emoji: "🐕", mA: "des", mZ: "Hundes", fA: "der", fZ: "Hündin" },
    { emoji: "🐖", mA: "des", mZ: "Schweins", fA: "der", fZ: "Sau" }
  ];

  const colors = [
    "grünen", "grünen",   // Wood
    "roten", "roten",    // Fire
    "gelben", "gelben",   // Earth
    "weißen", "weißen",   // Metal
    "blauen", "blauen"  // Water (sometimes "blauen")
  ];
  const elements = [
    "Holz", "Holz",
    "Feuer", "Feuer",
    "Erde", "Erde",
    "Eisen", "Eisen",
    "Wasser", "Wasser"
  ];

  const zIndex = (currentYear - 4) % 12;
  const z = zodiac[zIndex];

  const stemIndex = (currentYear - 4) % 10;
  const color = colors[stemIndex];
  const element = elements[stemIndex];

  const isYang = stemIndex % 2 === 0;
  const article = isYang ? z.mA : z.fA;
  const animalName = isYang ? z.mZ : z.fZ;

  const zodiacSpan = document.getElementById("zodiac");
  zodiacSpan.textContent = z.emoji;
  zodiacSpan.title = `Jahr ${article} ${color} ${element}-${animalName}`;
}

async function renderCalendarMonth(weeks) {
  const renderSeq = ++calendarRenderSeq;

  let cachedZodiacStyle = await window.cacheAPI.getCacheValue('zodiacStyle');
  if (!cachedZodiacStyle) cachedZodiacStyle = localStorage.getItem('zodiacStyle') || 'none';

  const calendarMonth = document.getElementById('calendar-month-sheet');

  if (!calendarMonth) {
    console.error(" calendar month sheet not found  ");
    return;
  }

  calendarMonth.innerHTML = '';
  const { headerRow, columnWidths } = renderCalendarHeader();
  calendarMonth.appendChild(headerRow);
  calendarMonth.style.gridTemplateColumns = `50px ${columnWidths.join(' ')}`;

  let monthRequests = [];
  const attendanceByDate = {};

  try {
    const formattedMonth = String(currentMonthIndex + 1).padStart(2, '0');
    monthRequests = await loadRequests(cachedApi, currentYear);
    monthRequests = filterRequestsByMonth(monthRequests, formattedMonth, currentYear);
  } catch (error) {
    console.warn("Error loading month requests:");
    monthRequests = [];
  }


  weeks.forEach(week => {
    const weekRow = renderWeekRow(week, monthRequests, attendanceByDate);
    calendarMonth.appendChild(weekRow);
  });

  const roleCount = Array.isArray(calendarRoles) && calendarRoles.length > 0
    ? calendarRoles.length
    : 14;

  const rulesetForCheck = {
    ...machineRuleSet,
    context: {
      attendanceByDate,
      roleCount
    }
  };

  const rangeStart = new Date(currentYear, currentMonthIndex, 1);
  const rangeEnd = new Date(currentYear, currentMonthIndex + 1, 0);
  const ruleStats = executeRuleset(rulesetForCheck, rangeStart, rangeEnd, true);
  if (renderSeq !== calendarRenderSeq) return;
  applyRuleWarnings(ruleStats);
}

function filterRequestsByMonth(requests, month, year) {
  return requests.filter(req => {
    const startDate = new Date(req.start);
    const endDate = new Date(req.end);

    // Month is 1-based string, convert to number:
    const targetMonth = Number(month) - 1; // JS months: 0-11
    const targetYear = Number(year);

    // Get start and end of the month:
    const monthStart = new Date(targetYear, targetMonth, 1);
    const monthEnd = new Date(targetYear, targetMonth + 1, 0);

    const overlaps = startDate <= monthEnd && endDate >= monthStart;
    const isApprovedOrPending = req.status !== 'rejected';

    return overlaps && isApprovedOrPending;
  });
}

function buildCheckerAttendance(shiftAttendanceByType, roleCount) {
  const result = Array.from({ length: roleCount }, () => [0, 0, 0]);
  const shiftIndex = { early: 0, day: 1, late: 2 };

  Object.entries(shiftAttendanceByType || {}).forEach(([shift, attendance]) => {
    const idx = shiftIndex[shift];
    if (idx == null || !Array.isArray(attendance)) return;

    for (let role = 0; role < roleCount; role++) {
      const mainCount = attendance?.[role]?.[0] ?? 0;
      result[role][idx] = mainCount;
    }
  });

  return result;
}

export async function computeAttendanceForRange(startDate, endDate, options = {}) {
  const attendanceByDate = {};
  const { extraRequests = [] } = options;

  if (!startDate || !endDate) {
    console.warn('computeAttendanceForRange: missing startDate or endDate.');
    return attendanceByDate;
  }

  let start = new Date(startDate);
  let end = new Date(endDate);

  if (isNaN(start) || isNaN(end)) {
    console.warn('computeAttendanceForRange: invalid date input.', { startDate, endDate });
    return attendanceByDate;
  }

  if (start > end) {
    const temp = start;
    start = end;
    end = temp;
  }

  const roleCount = Array.isArray(calendarRoles) && calendarRoles.length > 0
    ? calendarRoles.length
    : 14;

  const requestsByYear = {};
  const extraByYear = {};
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const years = [];

  for (let y = startYear; y <= endYear; y++) years.push(y);

  if (Array.isArray(extraRequests) && extraRequests.length) {
    extraRequests.forEach(req => {
      if (!req?.start || !req?.end) return;
      const s = new Date(req.start);
      const e = new Date(req.end);
      if (isNaN(s) || isNaN(e)) return;

      const minYear = Math.min(s.getFullYear(), e.getFullYear());
      const maxYear = Math.max(s.getFullYear(), e.getFullYear());
      for (let y = minYear; y <= maxYear; y++) {
        if (!extraByYear[y]) extraByYear[y] = [];
        extraByYear[y].push(req);
      }
    });
  }

  if (cachedApi) {
    await Promise.all(years.map(async (year) => {
      try {
        const data = await loadRequests(cachedApi, year);
        requestsByYear[year] = Array.isArray(data) ? data : [];
      } catch (err) {
        console.warn('computeAttendanceForRange: failed to load requests', { year, err });
        requestsByYear[year] = [];
      }
    }));
  } else {
    console.warn('computeAttendanceForRange: cachedApi not set; using empty requests.');
  }

  const monthCache = {};
  const getMonthRequests = (year, monthIndex) => {
    const key = `${year}-${monthIndex}`;
    if (monthCache[key]) return monthCache[key];

    const base = requestsByYear[year] || [];
    const extra = extraByYear[year] || [];
    const all = extra.length ? base.concat(extra) : base;
    const formattedMonth = String(monthIndex + 1).padStart(2, '0');
    const filtered = filterRequestsByMonth(all, formattedMonth, year);
    monthCache[key] = filtered;
    return filtered;
  };

  const totalDays = Math.floor((end - start) / 86400000) + 1;
  const maxDays = 3660;

  if (totalDays > maxDays) {
    console.warn('computeAttendanceForRange: range too large, truncating.', { totalDays, maxDays });
  }

  for (let i = 0; i < totalDays && i < maxDays; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    if (date > end) break;

    const year = date.getFullYear();
    const monthIndex = date.getMonth();
    const day = date.getDate();
    const fullDate = date.toISOString().slice(0, 10);
    const weekdayIndex = (date.getDay() + 6) % 7; // Monday = 0

    const officeSchedule = Array.isArray(officeDays) ? officeDays[weekdayIndex] : null;
    let shiftStatusForDay = { early: false, day: false, late: false };

    if (officeSchedule && officeSchedule !== 'never') {
      try {
        shiftStatusForDay = keyToBools(officeSchedule);
      } catch (err) {
        console.warn('computeAttendanceForRange: invalid office day key.', { officeSchedule, err });
      }
    }

    const monthRequests = getMonthRequests(year, monthIndex);
    const shiftAttendanceByType = {};

    if (shiftStatusForDay.early) {
      shiftAttendanceByType.early = computeShiftAttendance('early', day, weekdayIndex, monthRequests, shiftStatusForDay.early, { usePresenceState: false });
    }
    if (shiftStatusForDay.day) {
      shiftAttendanceByType.day = computeShiftAttendance('day', day, weekdayIndex, monthRequests, shiftStatusForDay.day, { usePresenceState: false });
    }
    if (shiftStatusForDay.late) {
      shiftAttendanceByType.late = computeShiftAttendance('late', day, weekdayIndex, monthRequests, shiftStatusForDay.late, { usePresenceState: false });
    }

    attendanceByDate[fullDate] = buildCheckerAttendance(shiftAttendanceByType, roleCount);
  }

  return attendanceByDate;
}

function applyRuleWarnings(ruleStats) {
  const existingIcons = document.querySelectorAll('.violation-icon');
  existingIcons.forEach(icon => icon.remove());

  const weekContainers = document.querySelectorAll('.kw-warning-container');
  weekContainers.forEach(el => {
    el.innerHTML = '';
  });

  const dayWarningSpans = document.querySelectorAll('.dayCellHeader-side.right-warning');
  dayWarningSpans.forEach(el => {
    el.textContent = '';
  });

  if (!ruleStats || !Array.isArray(ruleStats.failures)) return;

  const seen = new Set();
  const getRoleLabel = (failure) => {
    const subjectRoles = Array.isArray(failure?.subjectRoles) ? failure.subjectRoles : [];
    const names = subjectRoles
      .map((roleIdx) => Number(roleIdx))
      .filter((roleIdx) => Number.isInteger(roleIdx) && roleIdx >= 0)
      .map((roleIdx) => roleNameByIndex.get(roleIdx) || `Rolle ${roleIdx + 1}`);

    if (!names.length) return 'Rollen';
    if (names.length === 1) return names[0];
    return names.join(', ');
  };

  const buildViolationTooltip = (failure) => {
    const typeLabel = failure.type === 'TOO_MANY' ? 'zu viele' : 'zu wenig';
    const roleLabel = getRoleLabel(failure);
    const actual = Number.isFinite(failure.total) ? failure.total : '?';
    const expected = Number.isFinite(failure.limit) ? failure.limit : '?';
    return `Regel ${failure.ruleId}: ${typeLabel} ${roleLabel}, ist = ${actual}, soll = ${expected}`;
  };

  ruleStats.failures.forEach(failure => {
    const key = [
      failure.scope,
      failure.ruleId,
      failure.type,
      failure.scope === 'daily' ? failure.date : failure.weekNumber
    ].join('|');
    if (seen.has(key)) return;
    seen.add(key);

    if (failure.scope === 'weekly') {
      const container = document.getElementById(`week-${failure.weekNumber}-warning`);
      if (!container) return;
      const icon = document.createElement('span');
      icon.classList.add('violation-icon');
      icon.textContent = failure.type === 'TOO_MANY' ? '⚠️' : '🚨';
      icon.title = buildViolationTooltip(failure);
      container.appendChild(icon);
    }

    if (failure.scope === 'daily') {
      const warningEl = document.querySelector(`[data-date-warning="${failure.date}"]`);
      if (!warningEl) return;
      const icon = document.createElement('span');
      icon.classList.add('violation-icon');
      icon.textContent = failure.type === 'TOO_MANY' ? '⚠️' : '🚨';
      icon.title = buildViolationTooltip(failure);
      warningEl.appendChild(icon);
    }
  });
}
function getUsedShiftsInWeek(officeDays) {
  let isEarly = false, isDay = false, isLate = false;

  officeDays.forEach(dayKey => {
    if (dayKey === 'never') return;

    try {
      const { early, day, late } = keyToBools(dayKey);
      if (early) isEarly = true;
      if (day) isDay = true;
      if (late) isLate = true;
    } catch (err) {
      console.warn(`Invalid shift key: ${dayKey}`);
    }
  });

  return { isEarly, isDay, isLate };
}

function renderCalendarHeader() {

  const headerRow = document.createElement('div');
  headerRow.classList.add('calendar-weekday-header');

  const daysOfWeek = ['KW', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const columnWidths = [];

  daysOfWeek.forEach((day, index) => {
    const headerCell = document.createElement('div');
    headerCell.textContent = day;
    headerCell.className = day === 'KW' ? 'kw-column' : 'day-column';

    if (officeDays[index - 1] === 'never' || day === 'KW') {
      headerCell.classList.add('shrink');
      columnWidths.push('35px');
    } else {
      columnWidths.push('1fr');
    }
    if (day === 'Sa') headerCell.classList.add('saturday');
    if (day === 'So') headerCell.classList.add('sunday');
    headerRow.appendChild(headerCell);
  });

  return { headerRow, columnWidths };
}

function createMorningShift(day, index, monthRequests, isOpen, reassignments = null, matchesOverride = null) {

  const shift = document.createElement('span');

  shift.classList.add('shift', 'noto');
  shift.title = 'vormittags';

  if (!isOpen) {
    shift.innerHTML = "🔒";
    shift.title = "vormittags geschlossen";
    shift.style.background = "var(--calendar-day-closed-bg)";
    const attendance = createEmptyAttendance();
    return { shiftElement: shift, attendance };
  }

  shift.classList.add('morning-shift');
  shift.innerHTML = `${getShiftSymbol('early', cachedShiftSymbols)}`;
  const attendance = populateShift('early', shift, day, index, monthRequests, reassignments, matchesOverride);
  return { shiftElement: shift, attendance };
}

function createAfternoonShift(day, index, monthRequests, isOpen, reassignments = null, matchesOverride = null) {

  const afternoonShift = document.createElement('span');
  afternoonShift.classList.add('shift', 'noto');
  afternoonShift.title = "nachmittags";

  if (!isOpen) {
    afternoonShift.innerHTML = "🔒";
    afternoonShift.title = "nachmittags geschlossen";
    afternoonShift.style.background = "var(--calendar-day-closed-bg)";
    const attendance = createEmptyAttendance();
    return { shiftElement: afternoonShift, attendance };
  }
  afternoonShift.classList.add('afternoon-shift');
  afternoonShift.innerHTML = `${getShiftSymbol('late', cachedShiftSymbols)}`;;
  const attendance = populateShift('late', afternoonShift, day, index, monthRequests, reassignments, matchesOverride);
  return { shiftElement: afternoonShift, attendance };
}

function createDayShift(day, index, monthRequests, isOpen, reassignments = null, matchesOverride = null) {

  const dayShift = document.createElement('span');
  dayShift.innerHTML = `${getShiftSymbol('day', cachedShiftSymbols)}`;;
  dayShift.title = 'ganztags';
  dayShift.classList.add('shift', 'noto');
  if (!isOpen) {
    dayShift.style.background = "var(--calendar-day-closed-bg)";
    dayShift.innerHTML = "🔒";
    dayShift.title = "halbtags geschlossen"
    const attendance = createEmptyAttendance();
    return { shiftElement: dayShift, attendance };
  }
  dayShift.classList.add('day-shift');
  const attendance = populateShift('full', dayShift, day, index, monthRequests, reassignments, matchesOverride);
  return { shiftElement: dayShift, attendance };
}

function checkEmployeeRequested(employee, monthRequests, day) {
  if (!Array.isArray(monthRequests)) {
    return { overlap: false, vacationType: null, shift: null, status: "none" };
  }

  for (const req of monthRequests) {
    if (Number(employee.id) === Number(req.employeeID)) {
      const startDate = new Date(req.start);
      const endDate = new Date(req.end);
      const requestDate = new Date(currentYear, currentMonthIndex, day);

      if (requestDate >= startDate && requestDate <= endDate) {
        return {
          overlap: true,
          vacationType: req.vacationType,
          shift: req.shift,
          status: req.status || "approved"
        };
      }
    }
  }

  return {
    overlap: false,
    vacationType: null,
    shift: null,
    status: "none"    // ← FIX!
  };
}

function createKWCell(week) {
  const kwCell = document.createElement('div');
  kwCell.className = 'kw-column';

  // TOP: warnings
  const kwWarningContainer = document.createElement('div');
  kwWarningContainer.className = 'kw-warning-container';
  kwWarningContainer.id = `week-${week.weekNumber}-warning`;

  // CENTER: KW number
  const kwNumberContainer = document.createElement('div');
  kwNumberContainer.className = 'kw-number-container';
  kwNumberContainer.innerHTML = `KW ${week.weekNumber}`;

  // BOTTOM: empty spacer (optional)
  const kwBottomSpacer = document.createElement('div');
  kwBottomSpacer.className = 'kw-bottom-spacer';

  kwCell.appendChild(kwWarningContainer);
  kwCell.appendChild(kwNumberContainer);
  kwCell.appendChild(kwBottomSpacer);

  return kwCell;
}

function getEmployeesForShift(type, day, index, monthRequests, options = {}) {
  const results = [];
  const normalizedType = type === 'full' ? 'day' : type;
  const usePresenceState = options && options.usePresenceState !== undefined
    ? options.usePresenceState
    : true;
  const presenceState = usePresenceState
    ? ((typeof isInOffice === 'boolean')
      ? isInOffice
      : (localStorage.getItem('presenceState') !== 'false'))
    : true;

  calendarEmployees.sort((a, b) => {
    if (a.mainRoleIndex < b.mainRoleIndex) return -1;
    if (a.mainRoleIndex > b.mainRoleIndex) return 1;
    return 0;
  });

  calendarEmployees.forEach(employee => {
    const employeeShiftRaw = employee.workDays[index] || 'never';
    const employeeShift = String(employeeShiftRaw).trim().toLowerCase();

    if (employeeShift === 'never') return;

    const checkResult = checkEmployeeRequested(employee, monthRequests, day);
    const showEmployee =
      checkResult.status === 'pending' ||
      checkResult.overlap !== presenceState;

    if (!showEmployee) return;

    const matchesShift = normalizedType === 'day'
      ? (employeeShift === 'day' || employeeShift === 'full')
      : (employeeShift === normalizedType ||
        (employeeShift === 'full' && officeDays[index] !== 'full'));

    if (matchesShift) {
      results.push({ employee, checkResult });
    }
  });

  return results;
}

function addEmployeeToAttendance(attendance, employee) {
  if (attendance[employee.mainRoleIndex] !== undefined) {
    if (attendance[employee.mainRoleIndex]) attendance[employee.mainRoleIndex][0] += 1; // main
    if (attendance[employee.secondaryRoleIndex] != null) attendance[employee.secondaryRoleIndex][1] += 1; // secondary
    if (attendance[employee.tertiaryRoleIndex] != null) attendance[employee.tertiaryRoleIndex][2] += 1; // tertiary
  } else {
    console.warn(`Invalid attendance index: role=${employee.mainRoleIndex}`);
  }
}

function computeShiftAttendance(type, day, index, monthRequests, isOpen, options = {}) {
  const attendance = createEmptyAttendance();
  if (!isOpen) return attendance;

  const matches = getEmployeesForShift(type, day, index, monthRequests, options);
  matches.forEach(({ employee }) => addEmployeeToAttendance(attendance, employee));
  return attendance;
}

function getShiftMatchesAndAttendance(type, day, index, monthRequests, isOpen, options = {}) {
  const attendance = createEmptyAttendance();
  if (!isOpen) return { attendance, matches: [] };

  const matches = getEmployeesForShift(type, day, index, monthRequests, options);
  matches.forEach(({ employee }) => addEmployeeToAttendance(attendance, employee));
  return { attendance, matches };
}

function buildStaticSolverRules(ruleset) {
  const empty = { static: [], flexible: [] };
  if (!ruleset) return empty;

  const buckets = [
    ruleset.shiftly,
    ruleset.daily,
    ruleset.weekly,
    ruleset.special
  ].filter(Array.isArray);

  const staticRules = [];
  buckets.forEach(list => {
    list.forEach(rule => {
      const cond = rule?.dominantCondition;
      const roleOp = String(cond?.roleLogicOperator || '').toUpperCase();
      const slots = cond?.timeframeSlots;

      if (roleOp !== 'TOTAL') return;
      if (!Array.isArray(cond?.subjectRoles) || cond.subjectRoles.length < 1) return;
      if (!Array.isArray(slots)) return;

      // only shift-aware rules (e.g., ['early','day','late'])
      const hasShiftSlots = slots.some(slot => typeof slot === 'string');
      if (!hasShiftSlots) return;

      staticRules.push(rule);
    });
  });

  return { static: staticRules, flexible: [] };
}

function mapSolverMovesToReassignments(moves, matches) {
  const result = {};
  if (!Array.isArray(moves) || !Array.isArray(matches) || matches.length < 1) return result;

  const used = new Set();
  const employees = matches.map(m => m.employee).filter(Boolean);

  moves.forEach(move => {
    const fromRoleId = move?.from?.roleId;
    const toRoleId = move?.to?.roleId;
    if (!Number.isFinite(fromRoleId) || !Number.isFinite(toRoleId)) return;

    const candidates = employees.filter(emp =>
      emp &&
      emp.mainRoleIndex === fromRoleId &&
      !used.has(emp.id)
    );

    let badge = null;
    let chosen = null;

    if (move?.to?.rank === 2) {
      chosen = candidates.find(emp => emp.tertiaryRoleIndex === toRoleId);
      badge = chosen ? '⚡' : null;
    } else if (move?.to?.rank === 1) {
      chosen = candidates.find(emp => emp.secondaryRoleIndex === toRoleId);
      badge = chosen ? '🎭' : null;
    }

    if (!chosen) {
      chosen = candidates.find(emp => emp.secondaryRoleIndex === toRoleId);
      badge = chosen ? '🎭' : null;
    }
    if (!chosen) {
      chosen = candidates.find(emp => emp.tertiaryRoleIndex === toRoleId);
      badge = chosen ? '⚡' : null;
    }

    if (!chosen) return;

    used.add(chosen.id);
    result[String(chosen.id)] = {
      fromRoleIndex: fromRoleId,
      toRoleIndex: toRoleId,
      badge
    };
  });

  return result;
}

function populateShift(type, shift, day, index, monthRequests, reassignments = null, matchesOverride = null) {

  // Attendance model per role:
  // [0] = main assignment (counts toward demand)
  // [1] = secondary pool (may be reassigned)
  // [2] = tertiary/ emergency pool

  const attendance = createEmptyAttendance();
  const matches = Array.isArray(matchesOverride)
    ? matchesOverride
    : getEmployeesForShift(type, day, index, monthRequests);

  matches.forEach(({ employee, checkResult }) => {
    const reassignment = reassignments?.[String(employee.id)] || null;
    const displayRoleIndex = Number.isFinite(reassignment?.toRoleIndex)
      ? reassignment.toRoleIndex
      : employee.mainRoleIndex;
    const safeRoleIndex = Number.isFinite(displayRoleIndex) ? displayRoleIndex : 0;

    const roleColor = getComputedStyle(document.body)
      .getPropertyValue(`--role-${safeRoleIndex}-color`)
      .trim();

    const emoji = document.createElement('span');
    emoji.title = employee.name;
    emoji.classList.add(
      'noto',
      'calendar-emoji',
      'small',
      `emp-${employee.id}`,
      `role-${employee.mainRoleIndex}`
    );
    emoji.innerHTML = employee.personalEmoji;

    if (checkResult.status === 'pending') {
      emoji.innerHTML += "⌛";
      emoji.title = `${employee.name}´s Antrag steht aus`;
    }

    if (Number(employee.birthday) === day && Number(employee.birthMonth) - 1 === currentMonthIndex) {
      emoji.innerHTML += "🎂";
      emoji.title = `${employee.name}´s Geburtstag`;
      emoji.classList.add('birthday');
    }

    if (reassignment?.badge) {
      emoji.innerHTML += reassignment.badge;
      emoji.dataset.reassignBadge = reassignment.badge;
    }

    emoji.style.backgroundColor = roleColor;
    shift.appendChild(emoji);

    addEmployeeToAttendance(attendance, employee);
  });

  if (matches.length < 1) {
    const noOne = document.createElement('span');
    noOne.classList.add('hint');

    if (isInOffice) {
      noOne.textContent = ' Niemand arbeitet';
    } else {
      noOne.textContent = ' Niemand fehlt';
    }

    shift.appendChild(noOne);
  }

  return attendance;
}

function createDayCellHeader(day, dayCell, dayInfo, zodiacSpan, fullDate) {
  const header = document.createElement('div');
  header.classList.add('day-header');

  const isClosed = ['public-closed', 'company-closed', 'bridge-closed', 'office-closed'].includes(dayInfo.type);
  header.classList.add(isClosed ? 'dayCellHeader-column' : 'dayCellHeader-row');

  // --- left side (info emojis like 🎂🐇🎅 etc.) ---
  const left = document.createElement('span');
  left.classList.add('dayCellHeader-side', 'left-info', 'noto');

  // existing emoji
  if (dayInfo.emoji && !isClosed) {
    left.textContent = dayInfo.emoji;
    if (dayInfo.tooltip) left.title = dayInfo.tooltip;
  }

  // append zodiac span if provided
  if (zodiacSpan && !isClosed) {
    left.appendChild(zodiacSpan);
  }

  // --- center (day number) ---
  const center = document.createElement('span');
  center.classList.add('dayCellHeader-center');
  center.textContent = day;

  // --- right side (warnings 🚨) ---
  const right = document.createElement('span');
  right.classList.add('dayCellHeader-side', 'right-warning', 'noto');
  right.id = `day - ${day} - warning`;
  if (fullDate) right.dataset.dateWarning = fullDate;

  // --- build structure ---
  if (!isClosed) {
    header.appendChild(left);
    header.appendChild(center);
    header.appendChild(right);
  } else {
    // stacked layout for closed days: number → emoji → label
    center.classList.add('day-number');
    header.appendChild(center);

    const emojiRow = document.createElement('span');
    emojiRow.classList.add('noto');
    emojiRow.textContent = dayInfo.emoji || '🔒';
    emojiRow.title = dayInfo.tooltip || 'Betriebsferien';
    header.appendChild(emojiRow);

    const labelRow = document.createElement('span');
    labelRow.classList.add('closed-label');
    labelRow.textContent = dayInfo.tooltip || 'Closed';
    header.appendChild(labelRow);
  }

  dayCell.appendChild(header);
  return header;
}

function renderWeekRow(week, monthRequests, attendanceByDate) {
  const weekRow = document.createElement('div');
  weekRow.classList.add('calendar-row');

  // Create KW cell using the new function
  const kwCell = createKWCell(week);
  weekRow.appendChild(kwCell);

  const usedShifts = getUsedShiftsInWeek(officeDays);
  const shiftStatusForDayForWeek = week.days.map((_, index) =>
    keyToBools(officeDays[index])
  );

  const weeklyAttendance = createEmptyAttendance();

  week.days.forEach((day, index) => {
    const shiftStatusForDay = shiftStatusForDayForWeek[index];
    const dayCellObj = renderDayCell(day, index, shiftStatusForDay, usedShifts, monthRequests, attendanceByDate);

    weekRow.appendChild(dayCellObj.cell);

    if (dayCellObj.attendance) {
      // mergeAttendance(weeklyAttendance, dayCellObj.attendance);
    }
  });

  const warningContainer = kwCell.querySelector(`#week-${week.weekNumber}-warning`);
  const weeklyViolations = checkRulesForWeek(weeklyAttendance);  // TO:DO Legacy

  if (warningContainer) {

    // console.log(" warning weekly calanedar stuff ");

  }

  return weekRow;
}

function getCompanyHoliday(date) {

  if (!companyHolidays) return false;

  for (const holiday of companyHolidays) {
    const holidayStart = new Date(holiday.startDate);
    const holidayEnd = new Date(holiday.endDate);
    const targetDate = new Date(date);

    if (targetDate >= holidayStart && targetDate <= holidayEnd) {
      return true;
    }
  }
  return false;
}

function getSchoolHoliday(date) {
  const schoolHoliday = [];
  for (const holiday of schoolHoliday) {
    const holidayStart = new Date(holiday.startDate);
    const holidayEnd = new Date(holiday.endDate);
    const targetDate = new Date(date);

    const isHolidayInState = holiday.bundesländer.includes(currentState) || holiday.bundesländer.includes('All States');
    if (targetDate >= holidayStart && targetDate <= holidayEnd && isHolidayInState) {
      return {
        emoji: holiday.emoji,
        tooltipText: holiday.name
      };
    }
  }
  return null;
}

function showCalendarUpdateFeedback() {
  const feedbackEl = document.querySelector('.fade-feedback');
  feedbackEl.classList.add('active');
  setTimeout(() => {
    feedbackEl.classList.remove('active');
  }, 1000);
}

function isSameDate(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

function isWithinCompanyHoliday(fullDate, companyHolidays) {
  const d = new Date(fullDate);
  return companyHolidays.some(h => {
    const start = new Date(h.startDate);
    const end = new Date(h.endDate);
    return d >= start && d <= end;
  });
}

function isSchoolHoliday(fullDate, schoolHolidays) {
  if (!schoolHolidays || !Array.isArray(schoolHolidays)) return false;
  const d = new Date(fullDate);
  return schoolHolidays.some(h => {
    const start = new Date(h.startDate);
    const end = new Date(h.endDate);
    return d >= start && d <= end;
  });
}

function getPublicHoliday(fullDate, allPublicHolidays, publicHolidayStates) {
  // match entry by date string or id, return merged holiday data
  const d = new Date(fullDate);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const dateStr = `${y} - ${m} - ${day}`;
  return allPublicHolidays.find(h => h.date === dateStr) || null;
}

function getDayType(fullDate, weekdayIndex, { publicHolidays, publicHolidayStates, companyHolidays, bridgeDays, officeDays, schoolHolidays }) {
  // 1️⃣ Public holiday?
  const ph = getPublicHoliday(fullDate, publicHolidays, publicHolidayStates);
  if (ph) {
    const state = publicHolidayStates.find(p => p.id === ph.id);
    if (state && state.isOpen === false) return { type: 'public-closed', emoji: ph.emoji, tooltip: ph.name };
    if (state && state.isOpen === true) return { type: 'public-open', emoji: ph.emoji, tooltip: ph.name };
  }

  // 2️⃣ Company holiday
  if (isWithinCompanyHoliday(fullDate, companyHolidays))
    return { type: 'company-closed', emoji: '🔐', tooltip: 'Betriebsferien' };

  // 3️⃣ Bridge day (closed only)
  if (bridgeDays && bridgeDays.some(bd => isSameDate(bd, fullDate)))
    return { type: 'bridge-closed', emoji: '🚧', tooltip: 'Brückentag' };

  // 4️⃣ Office closed (schedule)
  if (officeDays && officeDays[weekdayIndex] === 'never')
    return { type: 'office-closed', emoji: '🔒', tooltip: 'Geschlossen' };

  // 5️⃣ Regular open
  const result = { type: 'regular', emoji: '', tooltip: '' };

  // 6️⃣ School holiday overlay
  if (isSchoolHoliday(fullDate, schoolHolidays))
    result.schoolInfo = { emoji: '🏫', tooltip: 'Schulferien' };

  return result;
}

function renderDayCell(day, index, shiftStatusForDay, usedShifts, monthRequests, attendanceByDate) {

  const fullDate = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')
    }-${String(day).padStart(2, '0')}`;
  const attendance = createEmptyAttendance();
  const dayCell = document.createElement('div');

  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const isToday = fullDate === todayISO;

  dayCell.className = 'day-column';
  if (officeDays[index] === "never") dayCell.classList.add('shrink');

  if (!day) {
    dayCell.classList.add('empty');
    dayCell.style.background = 'transparent';
    return { cell: dayCell, render: false, attendance };
  }

  dayCell.dataset.date = fullDate;

  if (isToday) dayCell.classList.add('today');

  // 🔍 Determine day type
  const dayInfo = getDayType(fullDate, index, {
    publicHolidays: allPublicHolidays,
    publicHolidayStates: publicHolidays,
    companyHolidays,
    bridgeDays,
    officeDays,
    schoolHolidays,
  });

  const zodiacSpan = getZodiac(new Date(fullDate), cachedZodiacStyle);
  const header = createDayCellHeader(day, dayCell, dayInfo, zodiacSpan, fullDate);

  const setBackground = (colorVar, cssClass) => {
    dayCell.style.background = `var(${colorVar})`;
    if (cssClass) dayCell.classList.add(cssClass);
  };


  switch (dayInfo.type) {
    case 'public-closed':
    case 'company-closed':
    case 'bridge-closed':
    case 'office-closed':
      setBackground('--calendar-day-closed-bg', dayInfo.type);
      return { cell: dayCell, render: index === 7, attendance };
    case 'public-open':
      setBackground('--calendar-day-holiday-bg', 'public-open');
      break;

    case 'regular':
    default:
      if (index === 5) setBackground('--calendar-day-weekend-bg', 'saturday');
      else if (index === 6) setBackground('--calendar-day-holiday-bg', 'sunday');
      else setBackground('--calendar-day-regular-bg', 'weekday');
      break;
  }

  if (dayInfo.schoolInfo) {
    const schoolSpan = document.createElement('span');
    schoolSpan.className = 'noto';
    schoolSpan.textContent = dayInfo.schoolInfo.emoji;
    schoolSpan.title = dayInfo.schoolInfo.tooltip;
    header.appendChild(schoolSpan);
    dayCell.classList.add('school-holiday');
    dayCell.style.borderStyle = 'double';
  }

  // 👩‍💼 Shifts + rule validation
  const shiftResult = createShifts(day, index, monthRequests, shiftStatusForDay, usedShifts);
  dayCell.appendChild(shiftResult.shifts);
  if (shiftResult?.shiftAttendanceByType && attendanceByDate) {
    const roleCount = Array.isArray(calendarRoles) && calendarRoles.length > 0
      ? calendarRoles.length
      : 14;
    attendanceByDate[fullDate] = buildCheckerAttendance(shiftResult.shiftAttendanceByType, roleCount);
  }
  // mergeAttendance(attendance, shiftResult.attendance);

  /*
  const warningSpan = dayCell.querySelector(`#day-${day}-warning`);
  if (warningSpan) {
    const violations = checkRulesForDay(index, attendance); // TO:DO Legacy
    violations.forEach(v => {
      const icon = document.createElement('span');
      icon.innerHTML = v.icon;
      icon.title = v.title;
      icon.classList.add('violation-icon');
      warningSpan.appendChild(icon);
    });
  }
  */
  return { cell: dayCell, render: true, attendance };
}

function createShifts(day, index, monthRequests, shiftStatusForDay, usedShifts) {

  /*
  in an attendance aray [ main, secondary, tertiary]
  main are the roles actually assigned
  secondary / tertiary are a role pool we may pull from
 */
  let summedAttendance = createEmptyAttendance();

  const shifts = document.createElement('div');
  shifts.style.width = "100%";

  // Determine which shifts are scheduled to be open for this weekday
  const officeSchedule = officeDays[index]; // index runs 1–7 (Mon–Sun)
  const officeShiftStatus = keyToBools(officeSchedule);
  const isOfficeClosed = officeSchedule === 'never';

  /*   TO:DO
  const attendanceByShift = {
    early: attendanceMorning ?? createEmptyAttendance(),
    day: attendanceDay ?? createEmptyAttendance(),
    late: attendanceAfternoon ?? createEmptyAttendance()
  };

  
  const solverResult = runSolver(
    attendanceByShift,
    {
      static: machineRuleSet.static,
      flexible: machineRuleSet.flexible
    }
  );
  */

  // Helper to color the shift backgrounds
  const setShiftColor = (shiftElement, shiftType, isActive) => {
    if (!isActive) {
      shiftElement.style.background = `var(--calendar-day-closed-bg)`;
    } else {
      switch (shiftType) {
        case 'early':
          shiftElement.style.background = `var(--calendar-shift-early-bg)`;
          break;
        case 'day':
          shiftElement.style.background = `var(--calendar-shift-day-bg)`;
          break;
        case 'late':
          shiftElement.style.background = `var(--calendar-shift-late-bg)`;
          break;
      }
    }
  };

  const shiftAttendanceByType = {};
  const shiftMatchesByType = {};

  if (usedShifts.isEarly) {
    const { matches: matchesMorning } =
      getShiftMatchesAndAttendance('early', day, index, monthRequests, shiftStatusForDay.early);
    const attendanceMorning = computeShiftAttendance('early', day, index, monthRequests, shiftStatusForDay.early, { usePresenceState: false });

    shiftAttendanceByType.early = attendanceMorning;
    shiftMatchesByType.early = matchesMorning;
  }

  if (usedShifts.isDay) {
    const { matches: matchesDay } =
      getShiftMatchesAndAttendance('day', day, index, monthRequests, shiftStatusForDay.day);
    const attendanceDay = computeShiftAttendance('day', day, index, monthRequests, shiftStatusForDay.day, { usePresenceState: false });

    shiftAttendanceByType.day = attendanceDay;
    shiftMatchesByType.day = matchesDay;
  }

  if (usedShifts.isLate) {
    const { matches: matchesLate } =
      getShiftMatchesAndAttendance('late', day, index, monthRequests, shiftStatusForDay.late);
    const attendanceAfternoon = computeShiftAttendance('late', day, index, monthRequests, shiftStatusForDay.late, { usePresenceState: false });

    shiftAttendanceByType.late = attendanceAfternoon;
    shiftMatchesByType.late = matchesLate;
  }

  const solverRules = buildStaticSolverRules(machineRuleSet);
  let solverResult = null;
  if (solverRules.static.length || solverRules.flexible.length) {
    try {
      solverResult = runSolverPerShift({
        early: shiftAttendanceByType.early || createEmptyAttendance(),
        day: shiftAttendanceByType.day || createEmptyAttendance(),
        late: shiftAttendanceByType.late || createEmptyAttendance()
      }, solverRules);
    } catch (error) {
      console.warn('Solver failed for day shift:', error);
    }
  }

  const reassignmentsByShift = {
    early: mapSolverMovesToReassignments(solverResult?.early?.moves, shiftMatchesByType.early),
    day: mapSolverMovesToReassignments(solverResult?.day?.moves, shiftMatchesByType.day),
    late: mapSolverMovesToReassignments(solverResult?.late?.moves, shiftMatchesByType.late)
  };

  if (usedShifts.isEarly) {
    const { shiftElement: morningShift, attendance: attendanceMorning } =
      createMorningShift(
        day,
        index,
        monthRequests,
        shiftStatusForDay.early,
        reassignmentsByShift.early,
        shiftMatchesByType.early
      );
    mergeAttendance(summedAttendance, attendanceMorning);

    setShiftColor(morningShift, 'early', officeShiftStatus.early && !isOfficeClosed);
    shifts.appendChild(morningShift);
  }

  if (usedShifts.isDay) {
    const { shiftElement: dayShift, attendance: attendanceDay } =
      createDayShift(
        day,
        index,
        monthRequests,
        shiftStatusForDay.day,
        reassignmentsByShift.day,
        shiftMatchesByType.day
      );
    mergeAttendance(summedAttendance, attendanceDay);
    setShiftColor(dayShift, 'day', officeShiftStatus.day && !isOfficeClosed);
    shifts.appendChild(dayShift);
  }

  if (usedShifts.isLate) {
    const { shiftElement: lateShift, attendance: attendanceAfternoon } =
      createAfternoonShift(
        day,
        index,
        monthRequests,
        shiftStatusForDay.late,
        reassignmentsByShift.late,
        shiftMatchesByType.late
      );
    mergeAttendance(summedAttendance, attendanceAfternoon);
    setShiftColor(lateShift, 'late', officeShiftStatus.late && !isOfficeClosed);
    shifts.appendChild(lateShift);
  }

  return { shifts, summedAttendance, shiftAttendanceByType };
}



