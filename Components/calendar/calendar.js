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
import { runSolver as runSolver, mergeAttendance, checkRulesForWeek, checkRulesForSpecial, createEmptyAttendance } from '../forms/rule-form/solver.js';


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

export async function initializeCalendar(api) {
  if (!api) {
    console.error('❌ window.api is not available in calendar.js');
    return;
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
    currentState = await loadStateData(api);
    officeDays = _officeDaysData;
    calendarEmployees = _employees;
    companyHolidays = _companyHolidays;
    publicHolidays = _publicHolidays;
    allPublicHolidays = getAllHolidaysForYear(currentYear, currentState);
    bridgeDays = normalizeBridgedays(_bridgeDays);
    machineRuleSet = updateRuleset(_ruleset) || [];

    setupCalendarEnvironment();

    cachedZodiacStyle = localStorage.getItem('zodiacStyle') || 'none';
    cachedShiftSymbols = localStorage.getItem('shiftSymbols') || 'letters';

    console.log(cachedShiftSymbols, cachedZodiacStyle);

    isInOffice = localStorage.getItem('presenceState') || true;
    const colorTheme = localStorage.getItem('colorTheme');
    const zoomFactor = localStorage.getItem('zoomFactor');
    const clientDefinedDataFolder = localStorage.getItem('clientDefinedDataFolder');
    const autoSaveEnabled = localStorage.getItem('autoSaveEnabled') === 'true';

    window.dispatchEvent(new CustomEvent('autoSaveChanged', { detail: { enabled: autoSaveEnabled } }));

    const cacheDump = {
      colorTheme: colorTheme ?? 'default (light)',
      zoomFactor: zoomFactor ?? 'default (1.0)',
      clientDefinedDataFolder: clientDefinedDataFolder ?? 'Not set',
      autoSave: autoSaveEnabled,
    };
    api.send('update-cache', cacheDump);
  } catch (error) {
    console.warn('❌ Error loading initial calendar data:', error);
  }
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

    // optionally reuse the UI state logic
    const colorTheme = localStorage.getItem('colorTheme');
    const zoomFactor = localStorage.getItem('zoomFactor');

    const cacheDump = {
      colorTheme: colorTheme ?? 'default (light)',
      zoomFactor: zoomFactor ?? 'default (1.0)',
      dataSource: 'external', // mark that this came from injected data
    };

    console.log('✅ Calendar initialized with external data:', cacheDump);
  } catch (error) {
    console.error('❌ Error initializing calendar with provided data:', error);
  }
}

function setupCalendarEnvironment() {
  initializeCalendarData();
  createCalendarNavigation();
  updateCalendarDisplay();
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


function generateAndRenderCalendar(newMonthIndex, newYear) {

  applyCalendarStyles();
  weeks = generateCalendar(newMonthIndex, newYear);
  renderCalendarMonth(weeks);
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

  // Build initial UI depending on mode
  const widget = (mode === 'radio') ? buildRadioGroup() : buildToggle();
  container.appendChild(widget);

  // expose an API to change mode or state externally
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

  try {
    const formattedMonth = String(currentMonthIndex + 1).padStart(2, '0');
    monthRequests = await loadRequests(cachedApi, currentYear);
    monthRequests = filterRequestsByMonth(monthRequests, formattedMonth, currentYear);
  } catch (error) {
    console.warn("Error loading month requests:");
    monthRequests = [];
  }


  weeks.forEach(week => {
    const weekRow = renderWeekRow(week, monthRequests);
    calendarMonth.appendChild(weekRow);
  });
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

function createMorningShift(day, index, monthRequests, isOpen) {

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
  const attendance = populateShift('early', shift, day, index, monthRequests);
  return { shiftElement: shift, attendance };
}

function createAfternoonShift(day, index, monthRequests, isOpen) {

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
  const attendance = populateShift('late', afternoonShift, day, index, monthRequests);
  return { shiftElement: afternoonShift, attendance };
}

function createDayShift(day, index, monthRequests, isOpen) {

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
  const attendance = populateShift('full', dayShift, day, index, monthRequests);
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

function populateShift(type, shift, day, index, monthRequests) {

  // Attendance model per role:
  // [0] = main assignment (counts toward demand)
  // [1] = secondary pool (may be reassigned)
  // [2] = tertiary/ emergency pool

  const attendance = createEmptyAttendance();

  calendarEmployees.sort((a, b) => {
    if (a.mainRoleIndex < b.mainRoleIndex) return -1;
    if (a.mainRoleIndex > b.mainRoleIndex) return 1;
    return 0;
  });

  let employeesPerShiftCount = 0;

  calendarEmployees.forEach(employee => {
    if (employee.workDays[index] === 'never') return;

    const checkResult = checkEmployeeRequested(employee, monthRequests, day);

    const showEmployee =
      checkResult.status === 'pending' ||   // Schrödinger: always show pending
      checkResult.overlap !== isInOffice;   // only show if requested presence differs from office status

    if (!showEmployee) return;


    if (
      employee.workDays[index] === type ||
      (employee.workDays[index] === 'full' && officeDays[index] !== 'full')
    ) {
      employeesPerShiftCount++;
      const roleColor = getComputedStyle(document.body)
        .getPropertyValue(`--role-${employee.mainRoleIndex}-color`)
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

      // console.log(" check result ", checkResult);

      if (checkResult.status === 'pending') {
        emoji.innerHTML += "⌛";
        emoji.title = `${employee.name}´s Antrag steht aus`;
      }

      if (Number(employee.birthday) === day && Number(employee.birthMonth) - 1 === currentMonthIndex) {
        emoji.innerHTML += "🎂";
        emoji.title = `${employee.name}´s Geburtstag`;
        emoji.classList.add('birthday');
      }

      emoji.style.backgroundColor = roleColor;
      shift.appendChild(emoji);

      if (attendance[employee.mainRoleIndex] !== undefined) {
        if (attendance[employee.mainRoleIndex]) attendance[employee.mainRoleIndex][0] += 1; // main
        if (attendance[employee.secondaryRoleIndex] != null) attendance[employee.secondaryRoleIndex][1] += 1; // secondary
        if (attendance[employee.tertiaryRoleIndex] != null) attendance[employee.tertiaryRoleIndex][2] += 1; // tertiary

      } else {
        console.warn(`Invalid attendance index: role=${employee.mainRoleIndex}`);
      }
    }
  });

  if (employeesPerShiftCount < 1) {
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

function createDayCellHeader(day, dayCell, dayInfo, zodiacSpan) {
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

function renderWeekRow(week, monthRequests) {
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
    const dayCellObj = renderDayCell(day, index, shiftStatusForDay, usedShifts, monthRequests);

    weekRow.appendChild(dayCellObj.cell);

    if (dayCellObj.attendance) {
      // mergeAttendance(weeklyAttendance, dayCellObj.attendance);
    }
  });

  // Append weekly violations to the warning container
  const warningContainer = kwCell.querySelector(`#week-${week.weekNumber}-warning`);
  const weeklyViolations = checkRulesForWeek(weeklyAttendance);  // TO:DO Legacy

  if (warningContainer) {

    console.log(" warning weekly calanedar stuff ");
    /*
    weeklyViolations.forEach((v) => {
      const icon = document.createElement('span');
      icon.innerHTML = v.icon;
      icon.title = v.title;
      icon.classList.add('violation-icon');
      warningContainer.appendChild(icon);
    });
    */
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

function renderDayCell(day, index, shiftStatusForDay, usedShifts, monthRequests) {

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
  const header = createDayCellHeader(day, dayCell, dayInfo, zodiacSpan);

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

  if (usedShifts.isEarly) {
    const { shiftElement: morningShift, attendance: attendanceMorning } =
      createMorningShift(day, index, monthRequests, shiftStatusForDay.early);
    mergeAttendance(summedAttendance, attendanceMorning);

    setShiftColor(morningShift, 'early', officeShiftStatus.early && !isOfficeClosed);
    shifts.appendChild(morningShift);
  }

  if (usedShifts.isDay) {
    const { shiftElement: dayShift, attendance: attendanceDay } =
      createDayShift(day, index, monthRequests, shiftStatusForDay.day);
    mergeAttendance(summedAttendance, attendanceDay);
    setShiftColor(dayShift, 'day', officeShiftStatus.day && !isOfficeClosed);
    shifts.appendChild(dayShift);
  }

  if (usedShifts.isLate) {
    const { shiftElement: lateShift, attendance: attendanceAfternoon } =
      createAfternoonShift(day, index, monthRequests, shiftStatusForDay.late);
    mergeAttendance(summedAttendance, attendanceAfternoon);
    setShiftColor(lateShift, 'late', officeShiftStatus.late && !isOfficeClosed);
    shifts.appendChild(lateShift);
  }

  return { shifts, summedAttendance };
}
