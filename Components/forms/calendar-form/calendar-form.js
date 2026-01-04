import { saveStateData, saveOfficeDays, loadStateData, loadCompanyHolidayData, setBranch, updateOfficeDays, loadOfficeDaysData } from '../../../js/loader/calendar-loader.js';
import { loadPublicHolidaysSimple, savePublicHolidaysSimple, saveBridgeDaysSimple, loadBridgeDays, saveCompanyHolidaysCSV } from '../../../js/loader/calendar-loader.js';
import { getAllHolidaysForYear, filterPublicHolidaysByYearAndState } from '../../../js/Utils/holidayUtils.js';
import { updateStateFlag } from '../../../js/Utils/flagUtils.js';
import { GetSchoolHoliday, apiHealthCheck, DownloadSchoolHoliday, parseToCSV, parseSchoolHolidayCsv } from '../../../js/Utils/schoolHollydayUpdater.js';
import { updateCalendarDisplay, setDateRemote } from '../../calendar/calendar.js';
import { checkOnboardingState } from '../../../js/Utils/onboarding.js';
import * as Util from './calendar-form-utils.js';
import { createDateRangePicker } from '../../customDatePicker/customDatePicker.js';
import { createHelpButton } from '../../../js/Utils/helpPageButton.js';
import { createWindowButtons } from '../../../js/Utils/minMaxFormComponent.js';
import { createBranchSelect } from '../../../js/Utils/branch-select.js';
import { createSaveAllButton, saveAll } from '../../../js/Utils/saveAllButton.js';
import { keyToBools } from './calendar-form-utils.js';

/**
 * 🎉 Special Days & Schützenfest (Future Enhancements)
 * 
 * Plan: Add playful, region-specific tooltips and optional calendar events 
 * to create a more delightful and culturally tuned user experience.
 * 
 * Tooltip Examples:
 * - Bavaria: "We love to celebrate twice here"
 * - Thuringia: "Witches on Walpurgis Night"
 * - Berlin: "Holiday vibes"
 * - Default: "Bridge days and special days"
 * 
 * Schützenfest:
 * - Applies to NRW & Lower Saxony (🎯 or 🥨 emoji)
 * - Tentative date: July 15
 * - Example tooltips:
 *    • NRW: "On target all summer – Schützenfest time!"
 *    • Lower Saxony: "Aim, celebrate, and connect – our Schützenfest."
 */
window.debugChecklist = false;

const states = [
  { code: 'XX', name: 'Nimmerland', flag: 'wappen-nimmerland.png', hidden: true },
  { code: 'SH', name: 'Schleswig-Holstein', flag: 'wappen-schleswigHolstein.png' },
  { code: 'NI', name: 'Niedersachsen', flag: 'wappen-niedersachsen.png' },
  { code: 'MV', name: 'Mecklenburg-Vorpommern', flag: 'wappen-MeVoPO.png' },
  { code: 'HB', name: 'Bremen', flag: 'wappen-bremen.png' },
  { code: 'HH', name: 'Hamburg', flag: 'wappen-hamburg.png' },
  { code: 'NW', name: 'Nordrhein-Westfalen', flag: 'wappen-nrw.png' },
  { code: 'BB', name: 'Brandenburg', flag: 'wappen-brandenburg.png' },
  { code: 'BE', name: 'Berlin', flag: 'wappen-berlin.png' },
  { code: 'ST', name: 'Sachsen-Anhalt', flag: 'wappen-sachsenAnhalt.png' },
  { code: 'HE', name: 'Hessen', flag: 'wappen-hessen.png' },
  { code: 'TH', name: 'Thüringen', flag: 'wappen-thüringen.png' },
  { code: 'RP', name: 'Rheinland-Pfalz', flag: 'wappen-rheinlandPfalz.png' },
  { code: 'BW', name: 'Baden-Württemberg', flag: 'wappen-badenWuertenberg.png' },
  { code: 'SN', name: 'Sachsen', flag: 'wappen-sachsen.png' },
  { code: 'SL', name: 'Saarland', flag: 'wappen-Saarland.png' },
  { code: 'BY', name: 'Bayern', flag: 'wappen-Bayern.png' },
];

const calendarState = {
  mon: { early: false, day: false, late: false },
  tue: { early: false, day: false, late: false },
  wed: { early: false, day: false, late: false },
  thu: { early: false, day: false, late: false },
  fri: { early: false, day: false, late: false },
  sat: { early: false, day: false, late: false },
  sun: { early: false, day: false, late: false },
};

const dayIds = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const shiftIds = ['early', 'day', 'late'];
const weekdaysData = [
  { id: 'mon', type: 'weekday', short: 'Mo', name: 'Montag', isOpen: true },
  { id: 'tue', type: 'weekday', short: 'Di', name: 'Dienstag', isOpen: true },
  { id: 'wed', type: 'weekday', short: 'Mi', name: 'Mittwoch', isOpen: true },
  { id: 'thu', type: 'weekday', short: 'Do', name: 'Donnerstag', isOpen: true },
  { id: 'fri', type: 'weekday', short: 'Fr', name: 'Freitag', isOpen: true },
  { id: 'sat', type: 'weekday', short: 'Sa', name: 'Samstag', isOpen: false },
  { id: 'sun', type: 'weekday', short: 'So', name: 'Sonntag', isOpen: false }
];

let shiftsData = {
  mon: [
    { id: 'early', label: 'Frühschicht', active: true },
    { id: 'day', label: 'Tagschicht', active: true },
    { id: 'late', label: 'Spätschicht', active: false }
  ],
  tue: [
    { id: 'early', label: 'Frühschicht', active: true },
    { id: 'day', label: 'Tagschicht', active: true },
    { id: 'late', label: 'Spätschicht', active: false }
  ],
  wed: [
    { id: 'early', label: 'Frühschicht', active: true },
    { id: 'day', label: 'Tagschicht', active: true },
    { id: 'late', label: 'Spätschicht', active: false }
  ],
  thu: [
    { id: 'early', label: 'Frühschicht', active: true },
    { id: 'day', label: 'Tagschicht', active: true },
    { id: 'late', label: 'Spätschicht', active: false }
  ],
  fri: [
    { id: 'early', label: 'Frühschicht', active: true },
    { id: 'day', label: 'Tagschicht', active: true },
    { id: 'late', label: 'Spätschicht', active: false }
  ],
  sat: [
    { id: 'early', label: 'Frühschicht', active: false },
    { id: 'day', label: 'Tagschicht', active: false },
    { id: 'late', label: 'Spätschicht', active: false }
  ],
  sun: [
    { id: 'early', label: 'Frühschicht', active: false },
    { id: 'day', label: 'Tagschicht', active: false },
    { id: 'late', label: 'Spätschicht', active: false }
  ]
};

const calendarLists = [
  { id: "weekdays", title: "Wochentage", type: "static", target: "left-collapsibles", data: weekdaysData },
  { id: "shifts", title: "Schichten", type: "matrix", target: "left-collapsibles", data: shiftsData },
  { id: "holidays", title: "Feiertage", type: "dynamic", target: "right-collapsibles", data: [] },
  { id: "bridgedays", title: "Brückentage", type: "computed", target: "right-collapsibles", data: [] },
  { id: "companyHolidays", title: "Betriebsferien", type: "manual", target: "right-collapsibles", data: [] },
  { id: "schoolHolidays", title: "Schulferien", type: "dynamic", target: "right-collapsibles", data: [] },
];

let collapsibleState = {
  weekdays: true,
  shifts: true,
  holidays: true,
  bridgedays: true,
  companyHolidays: true,
  schoolHolidays: true
};

let activeCompanyHolidayPicker;

const DEFAULT_WORD = 'Öffnungszeiten';

const branchHeaders = {
  shop: "Öffnungszeiten festlegen",
  gastro: "Öffnungszeiten festlegen",
  hospitality: "Übernachtungszeiten festlegen",
  health: "Praxiszeiten festlegen",
  office: "Bürozeiten festlegen",
  logistics: "Werkszeiten festlegen",
  industrial: "Werkszeiten festlegen",
  custom: "" // custom input triggers stored word
};
let companyHolidayDraft = {
  startDate: null,
  endDate: null
};

let currentYear = new Date().getFullYear();
let ruleFederalState;
let cachedApi;
let companyHolidays = [];
let officeDays = [];
let publicHolidayState = {};
let bridgeDayState = {};

export async function initializeCalendarForm(passedApi) {
  if (!passedApi) {
    console.error("❌ API not provided to initializeCalendarForm");
    return;
  }
  cachedApi = passedApi;
  // 1️⃣ Preload / Data Phase
  const { isOnboarding, dataFolder } = await checkOnboardingState(cachedApi);
  let ruleFormState, officeDays, companyHolidays, savedBridgeDays;

  try {
    const [
      _holidays,
      _holidayState,
      _flag,
      _school,
      officeDaysData,
      companyHolidaysData,
      bridgeDaysData
    ] = await Promise.all([
      getAllHolidaysForYear(),
      loadPublicHolidaysSimple(cachedApi),
      loadStateData(cachedApi),
      GetSchoolHoliday(cachedApi, 'SL', currentYear),
      loadOfficeDaysData(cachedApi, isOnboarding),
      loadCompanyHolidayData(cachedApi, currentYear),
      loadBridgeDays(cachedApi)  // ✅ NEW
    ]);

    savedBridgeDays = bridgeDaysData;
    publicHolidayState = _holidayState;
    ruleFormState = _flag;
    officeDays = officeDaysData;
    companyHolidays = companyHolidaysData;
    console.log("✅ Data loaded:", { ruleFormState, officeDays, companyHolidays, isOnboarding });
  } catch (error) {
    console.error('❌ Error loading data in calendar-form:', error);
    return;
  }
  await clearAndLoadDOM();

  shiftsData = updateShiftState(shiftsData, officeDays);

  loadCollapsibleState();
  updateDivider("bg-calendar");
  await buildCollapsableContainer();
  populateWeekdaysList();

  const publicHolidays = filterPublicHolidaysByYearAndState(currentYear, ruleFormState);
  populatePublicHolidayList(publicHolidays);
  const calculatedBridgeDays = findBridgeDays(publicHolidays, weekdaysData);
  const mergedBridgeDays = mergeBridgeDays(calculatedBridgeDays, savedBridgeDays);
  populateBridgeDaysList(mergedBridgeDays);
  populateCompanyHolidaysList(companyHolidays);
  populateSchoolHolidaysListUnified(cachedApi, ruleFormState, currentYear);

  requestAnimationFrame(() => {
    initializeYearAndState();
    initCalendarStateFromCSV(officeDays);
    updateCalendarUIFromState();
    initCollapseExpandToggles();
  });

  const saveBtn = document.getElementById('btn-weekday-store');
  if (saveBtn) {
    saveBtn.classList.remove('hidden');
    saveBtn.classList.add('noto');
    saveBtn.addEventListener('click', () => saveOfficeDays(cachedApi, calendarState));
  }
}

function updateShiftState(shiftsData, officeDays) {
  console.log("office days", officeDays);
  console.log("shift state", shiftsData);

  const weekDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

  weekDays.forEach((day, index) => {
    const officeKey = officeDays[index] || "never";
    const officeOpen = keyToBools(officeKey);

    const dayShifts = shiftsData[day];
    if (!dayShifts) return;

    dayShifts.forEach(shift => {
      switch (shift.id) {
        case "early":
          shift.active = officeOpen.early;
          break;
        case "day":
          shift.active = officeOpen.day;
          break;
        case "late":
          shift.active = officeOpen.late;
          break;
        default:
          console.warn("Unknown shift id:", shift.id);
      }
    });
  });

  return shiftsData;
}


function initPublicHolidayStateFromCSV(holidayRows) {
  holidayRows.forEach(h => {
    publicHolidayState[h.id] = h.isOpen;
  });
}

export function mergeBridgeDays(calculated, savedArray) {
  const savedMap = Object.fromEntries(savedArray.map(({ id, isOpen }) => [id, isOpen]));

  return calculated.map(day => {
    if (savedMap.hasOwnProperty(day.id)) {
      return { ...day, isOpen: savedMap[day.id] };
    }
    return day;
  });
}

async function buildCollapsableContainer() {
  const leftContainer = document.getElementById('left-collapsibles');
  const rightContainer = document.getElementById('right-collapsibles');

  if (!leftContainer || !rightContainer) return;

  calendarLists.forEach(cfg => {
    const node = createCollapsible(cfg);
    if (cfg.target === 'left-collapsibles') leftContainer.appendChild(node);
    else if (cfg.target === 'right-collapsibles') rightContainer.appendChild(node);
  });

  await new Promise(requestAnimationFrame);
  console.log('✅ All collapsibles created');
}

function initCalendarStateFromCSV(csvRow) {
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  days.forEach((day, i) => {
    const key = csvRow[i]; // e.g. "full", "morning"
    calendarState[day] = keyToBools(key);
  });

  console.log("[calendar-form] init state", calendarState);
}

function updateCalendarUIFromState() {
  Object.entries(calendarState).forEach(([day, shifts]) => {
    // weekday checkbox
    const weekdayCheckbox = document.getElementById(`chk-${day}`);
    if (weekdayCheckbox) {
      const anyActive = shifts.early || shifts.day || shifts.late;
      weekdayCheckbox.checked = anyActive;
      updateWeekdayIcon(day, anyActive);
    }

    // shift checkboxes
    Object.entries(shifts).forEach(([shiftId, isActive]) => {
      const shiftCheckbox = document.getElementById(`chk-${day}-${shiftId}`);
      if (shiftCheckbox) {
        shiftCheckbox.checked = isActive;
        // optionally update lock icon / color
        const icon = shiftCheckbox.parentNode.querySelector('.lock-icon');
        if (icon) {
          icon.classList.toggle('unlocked', isActive);
          icon.classList.toggle('locked', !isActive);
        }
      }
    });
  });
}

async function handleYearUpdate(year) {

  const publicHolidays = filterPublicHolidaysByYearAndState(year, publicHolidayState);
  const schoolHolidays = await GetSchoolHoliday(cachedApi, 'SL', year);
  const companyHolidays = await loadCompanyHolidayData(cachedApi, year);
  const bridgeDaysData = await loadBridgeDays(cachedApi);

  populatePublicHolidayList(publicHolidays);
  const calculatedBridgeDays = findBridgeDays(publicHolidays, weekdaysData);
  const mergedBridgeDays = mergeBridgeDays(calculatedBridgeDays, bridgeDaysData);
  populateBridgeDaysList(mergedBridgeDays);
  populateCompanyHolidaysList(companyHolidays);
  populateSchoolHolidaysListUnified(cachedApi, publicHolidayState, year);

}


async function initializeYearAndState() {
  const container = document.getElementById("state-year-container");
  if (!container) return;

  publicHolidayState = await loadStateData(cachedApi);

  const yearInput = document.createElement("input");
  yearInput.id = "calendar-form-year";
  yearInput.type = "number";
  yearInput.addEventListener("change", async (e) => {
    const selectedYear = parseInt(e.target.value, 10);
    localStorage.setItem("calendarSettingYear", selectedYear);
    currentYear = selectedYear;
    await handleYearUpdate(selectedYear);
  });

  const cachedYear = parseInt(localStorage.getItem("calendarSettingYear"), 10);
  currentYear = cachedYear || new Date().getFullYear();
  yearInput.value = currentYear;


  const flagDiv = document.createElement("div");
  flagDiv.id = "state-flag";
  flagDiv.classList.add("state-flag-icon");
  container.appendChild(flagDiv);

  const stateSelect = document.createElement("select");
  stateSelect.id = "state-select";

  const filtredStates = publicHolidayState !== "XX" ? states.filter(s => !s.hidden) : states;
  filtredStates.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.code;
    opt.textContent = s.name;
    opt.selected = s.code === publicHolidayState;
    stateSelect.appendChild(opt);
  });

  const saveBtn = document.createElement("button");
  saveBtn.id = "save-state-btn";
  saveBtn.textContent = "🛡️💾";
  saveBtn.title = "Bundesland speichern";
  saveBtn.setAttribute("aria-label", "Bundesland speichern");
  saveBtn.classList.add("noto");
  saveBtn.classList.add("hidden");
  saveBtn.addEventListener('click', async () => {
    await saveStateData(cachedApi, stateSelect.value);
    saveBtn.classList.add("hidden");
  });


  container.appendChild(stateSelect);
  container.appendChild(saveBtn);
  container.appendChild(yearInput);

  // Initialize flag
  updateStateFlag(stateSelect.value, flagDiv);

  // Update flag on change
  stateSelect.addEventListener("change", async (e) => {

    const selectedStateCode = e.target.value;
    ruleFederalState = selectedStateCode;
    publicHolidayState = selectedStateCode;

    console.log(" state changed val: ", e.target.value);

    const saveBtnLocal = document.getElementById('save-state-btn');
    if (saveBtnLocal) saveBtnLocal.classList.remove("hidden");

    updateStateFlag(selectedStateCode, flagDiv);

    const topFlag = document.getElementById('state-image');
    const bottomFlag = document.getElementById('state-flag');
    const stateSelector = document.getElementById('state-select');

    if (topFlag) {
      updateStateFlag(selectedStateCode, topFlag);
    }
    if (bottomFlag) {
      updateStateFlag(selectedStateCode, bottomFlag);
    }
    if (stateSelector) {
      stateSelector.value = selectedStateCode;
    }
    console.log("[calendar-form] selected state code: ", selectedStateCode);
    console.log("[calendar-form] current year: ", currentYear);
    const publicHolidaysLocal = filterPublicHolidaysByYearAndState(currentYear, selectedStateCode);
    console.log("[calendar-form] filtered public holidays : ", publicHolidaysLocal);
    populatePublicHolidayList(publicHolidaysLocal);
    const bridgedays = findBridgeDays(publicHolidaysLocal, weekdaysData);
    populateBridgeDaysList(bridgedays);
    populateSchoolHolidaysListUnified(cachedApi, selectedStateCode, currentYear);
  });
}


async function clearAndLoadDOM() {
  const container = document.getElementById('form-container');
  if (!container) {
    console.error('❌ form-container not found');
    return;
  }

  try {
    const res = await fetch('Components/forms/calendar-form/calendar-form.html');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    container.innerHTML = html;
    console.log('✅ Base calendar form HTML loaded');
  } catch (err) {
    console.error('❌ Failed to load form HTML:', err);
  }
}

async function buildCollapsables() {
  for (const cfg of calendarLists) {
    const parent = document.getElementById(cfg.target);
    if (!parent) continue;

    const node = createCollapsible(cfg);
    parent.appendChild(node);
  }
  await new Promise(requestAnimationFrame);
  console.log("✅ All collapsibles created");
}

function createCollapsible(cfg) {
  const tpl = document.getElementById("tpl-rule-collapsible");
  const clone = tpl.content.cloneNode(true);

  const wrapper = clone.querySelector(".rule-collapsible");
  if (wrapper) wrapper.id = `rule-collapsible-${cfg.id}`;

  const toggleBtn = clone.querySelector(".rule-collapsible-toggle");
  if (toggleBtn) {
    // Give the toggle button a unique ID
    toggleBtn.id = `collapse-${cfg.id}-toggle`;
  }

  const chev = clone.querySelector(".chev");
  if (chev) {
    // Optionally give the chev its own ID
    chev.id = `chev-${cfg.id}`;
  }

  const titleEl = clone.querySelector(".title");
  if (titleEl) titleEl.textContent = cfg.title;

  const content = clone.querySelector(".rule-collapsible-content");

  let innerNode;
  switch (cfg.type) {
    case "matrix":
      innerNode = createMatrixList(cfg);
      break;
    default:
      innerNode = createStandardList(cfg);
      break;
  }

  if (content && innerNode) content.appendChild(innerNode);

  console.log(`🧱 Collapsible created: fieldset=${wrapper?.id}, toggle=${toggleBtn?.id}, chev=${chev?.id}`);
  return clone;
}


function createStandardList(cfg) {

  const tpl = document.getElementById('tpl-list');
  const tplItem = document.getElementById('tpl-list-item');

  if (!tpl || !tplItem) {
    console.error('Templates for standard list not found');
    return document.createElement('div');
  }

  // Clone the list container template
  const listNode = tpl.content.cloneNode(true);
  const body = listNode.querySelector('.list-body');

  // Fill with data
  (cfg.data || []).forEach(item => {
    const li = createListItem(item);
    body.appendChild(li);
  });

  // Optional: mini view for collapsed state
  const miniView = document.createElement('div');
  miniView.className = 'list-mini';
  (cfg.data || []).forEach(item => {
    const miniItem = document.createElement('span');
    miniItem.className = 'mini-item';

    // Show only icon (locked/unlocked) for mini
    const icon = document.createElement('span');
    miniItem.appendChild(icon);

    miniView.appendChild(miniItem);
  });

  listNode.querySelector('.list-calendar-settings').appendChild(miniView);

  return listNode;
}

function onShiftToggle(day, shiftId, isActive) {
  console.log("[calendar-form] day/id/active:", day, shiftId, isActive);
  calendarState[day][shiftId] = isActive;
  const dayState = calendarState[day];
  console.log("[calendar-form] day state:", dayState);
  const anyActive = dayState.early || dayState.day || dayState.late;
  console.log("[calendar-form] any active:", anyActive);
  console.log("[calendar setting] weekday identifier", `input[data-day="${day}"][data-type="weekday"]`);
  const weekdayCheckbox = document.getElementById(`chk-${day}`);

  if (weekdayCheckbox) {
    weekdayCheckbox.checked = anyActive;
    updateWeekdayIcon(day, anyActive);
  }

  if (typeof handleCalendarSettingChange === 'function') {
    handleCalendarSettingChange(`${day}-${shiftId}`, isActive);
  }

  // Optional debug
  console.table(calendarState);
}

function onWeekdayToggle(day, isActive) {
  calendarState[day] = { early: isActive, day: isActive, late: isActive };

  ['early', 'day', 'late'].forEach(shiftId => {
    const shiftCheckbox = document.querySelector(`input[data-day="${day}"][data-shift="${shiftId}"]`);
    if (shiftCheckbox) {
      shiftCheckbox.checked = isActive;
      const icon = shiftCheckbox.nextElementSibling;
      if (icon) {
        icon.classList.toggle('unlocked', isActive);
        icon.classList.toggle('locked', !isActive);
      }
    }
    handleCalendarSettingChange(`${day}-${shiftId}`, isActive);
  });

  updateWeekdayIcon(day, isActive);
}

// optional helper
function updateWeekdayIcon(day, active) {
  const weekdayRow = document.querySelector(`[data-weekday="${day}"]`);
  if (!weekdayRow) return;
  weekdayRow.classList.toggle('is-active', active);
}


// === 🧩 Create the list inside each collapsible ===
function createList(cfg) {
  const tpl = document.getElementById('tpl-list');
  const tplItem = document.getElementById('tpl-list-item');

  const listNode = tpl.content.cloneNode(true);
  const body = listNode.querySelector('.list-body');

  if (Array.isArray(cfg.data)) {
    cfg.data.forEach(item => body.appendChild(createListItem(item)));
  } else if (typeof cfg.data === 'object') {
    Object.entries(cfg.data).forEach(([day, shifts]) => {
      shifts.forEach(shift => {
        body.appendChild(createListItem({ day, ...shift }));
      });
    });
  }

  return listNode;
}

function createListItem(item, colorClass = "is-closed") {
  const tpl = document.getElementById('tpl-list-item');
  if (!tpl) return null;

  const node = tpl.content.cloneNode(true);
  const row = node.querySelector('.data-row');

  row.dataset.key = item.id || '';

  row.classList.add(colorClass);

  const labelText = row.querySelector('.label-text');
  labelText.innerHTML = '';

  if (item.date) {
    const dateSpan = document.createElement('span');
    dateSpan.classList.add('date-name');
    dateSpan.textContent = `${item.date} `;
    labelText.appendChild(dateSpan);
  }

  if (item.emoji) {
    const emojiSpan = document.createElement('span');
    emojiSpan.classList.add('emoji', 'noto');
    emojiSpan.textContent = item.emoji + ' ';
    labelText.appendChild(emojiSpan);
  }

  const nameSpan = document.createElement('span');
  nameSpan.classList.add('full-name');
  nameSpan.innerHTML = item.name || '—';
  labelText.appendChild(nameSpan);

  const shortSpan = document.createElement('span');
  shortSpan.classList.add('short-name', 'hidden'); // hidden by default
  shortSpan.textContent = item.short || item.name?.slice(0, 2) || '?';
  labelText.appendChild(shortSpan);


  const checkbox = row.querySelector('.row-checkbox');
  checkbox.type = "checkbox";
  checkbox.dataset.type = item.type || "";

  const icon = row.querySelector('.status-icon');

  if (checkbox) {
    checkbox.checked = !!item.isOpen;
    const uniqueId = `chk-${item.id || crypto.randomUUID()}`;
    checkbox.id = uniqueId;
    row.querySelector('.label-text').setAttribute('for', uniqueId);

    if (icon) {
      icon.classList.toggle('unlocked', checkbox.checked);
      icon.classList.toggle('locked', !checkbox.checked);
    }

    checkbox.addEventListener('change', (e) => {
      const isOpen = e.target.checked;
      if (icon) {
        icon.classList.toggle('unlocked', isOpen);
        icon.classList.toggle('locked', !isOpen);
      }

      row.classList.toggle('is-regular', isOpen);
      row.classList.toggle('is-closed', !isOpen);

      if (typeof handleCalendarSettingChange === 'function') {
        handleCalendarSettingChange(row.dataset.key, isOpen);
        onWeekdayToggle(row.dataset.key, isOpen);
      }
    });
  }

  if (item.disabled) {
    row.classList.add('disabled');
    if (checkbox) checkbox.disabled = true;
  }

  return node;
}

function handleCalendarSettingChange(key, isOpen) {
  console.log(key, isOpen);
}

function loadCollapsibleState() {
  const saved = localStorage.getItem('calendarCollapsibleState');
  if (saved) {
    try {
      collapsibleState = JSON.parse(saved);
    } catch (err) {
      console.warn('Failed to parse saved collapsible state', err);
    }
  }
}

function populateWeekdaysList() {
  const collapsible = document.getElementById('rule-collapsible-weekdays');
  if (!collapsible) return;

  const body = collapsible.querySelector('.list-body');
  body.innerHTML = '<br> <br>'; // clear existing rows

  let i = 0;
  weekdaysData.forEach(day => {
    let colorClass = 'is-regular';
    if (i === 5) colorClass = "is-weekend";
    if (i === 6) colorClass = "is-sunday";
    i++;

    const li = createListItem(day, colorClass); // pass color hint
    body.appendChild(li);
  });
}

function populatePublicHolidayList(publicHolidays) {
  const collapsible = document.getElementById('rule-collapsible-holidays');
  if (!collapsible) {
    console.warn("⚠️ Didn't find public holiday container");
    return;
  }
  const body = collapsible.querySelector('.list-body');
  body.innerHTML = ''; // clear any existing rows

  const publicHolidaySaveBtn = collapsible.querySelector('.btn-store');

  if (publicHolidaySaveBtn) {
    publicHolidaySaveBtn.classList.remove('hidden');
    publicHolidaySaveBtn.classList.add('noto');
    publicHolidaySaveBtn.addEventListener('click', async () => {
      gatherHolidaysAndSave();
      console.log('✅ Public holidays saved!');
    });
  }

  publicHolidays.forEach(holiday => {
    // Format date like "Di. 25.12"
    const dateObj = new Date(holiday.date);
    const weekday = dateObj.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const formattedDate = `${weekday}. ${day}.${month}`;
    const checkIsOpen = publicHolidayState[holiday.id] ?? false;
    const colorClass = checkIsOpen ? getDateColorClass(holiday.date) : 'is-closed';
    const listItem = createListItem({
      id: holiday.id,
      name: `<br>${holiday.name}`,
      date: formattedDate,
      emoji: holiday.emoji,
      disabled: holiday.disabled,
      isOpen: checkIsOpen,
    }, colorClass);

    if (listItem) {
      body.appendChild(listItem);
    }
  });

  console.log(`✅ Populated ${publicHolidays.length} public holidays`);
}

async function saveCompanyHoliday(startInputId, endInputId) {
  const startEl = document.getElementById(startInputId);
  const endEl = document.getElementById(endInputId);

  if (!startEl) {
    alert("❌ Date picker missing (start)");
    return;
  }

  const startValue = startEl.value;
  const endValue = endEl?.value || startValue;

  if (!startValue) {
    alert("Bitte Startdatum wählen.");
    return;
  }

  const startDate = new Date(startValue);
  const endDate = new Date(endValue);

  if (isNaN(startDate) || isNaN(endDate)) {
    alert("Ungültiges Datum");
    return;
  }

  // Normalize order (end >= start)
  const fixedEndDate = endDate < startDate ? startDate : endDate;

  companyHolidays.push({
    startDate: startDate.toISOString().slice(0, 10),
    endDate: fixedEndDate.toISOString().slice(0, 10)
  });

  // Sort chronologically
  companyHolidays.sort(
    (a, b) => new Date(a.startDate) - new Date(b.startDate)
  );

  const year = startDate.getFullYear();
  await saveCompanyHolidaysCSV(cachedApi, year, companyHolidays);

  populateCompanyHolidaysList(companyHolidays);
}

function removeCompanyHoliday(period) {
  companyHolidays = companyHolidays.filter(h =>
    !(h.startDate === period.startDate && h.endDate === period.endDate)
  );

  const year = new Date(period.startDate).getFullYear();

  saveCompanyHolidaysCSV(cachedApi, year, companyHolidays)
    .then(() => populateCompanyHolidaysList(companyHolidays));
}


function editCompanyHoliday(period) {
  if (!activeCompanyHolidayPicker) {
    alert("❌ Date picker not ready yet.");
    return;
  }

  activeCompanyHolidayPicker.setStart(period.startDate);
  activeCompanyHolidayPicker.setEnd(period.endDate);
}



async function gatherBridgeDaysAndSave() {
  const allBridgeDays = [];

  const checkboxes = document.querySelectorAll('#rule-collapsible-bridgedays .row-checkbox');

  checkboxes.forEach(cb => {
    const id = (cb.dataset.id || cb.id).replace(/^chk-/, '');
    if (!id) return;

    allBridgeDays.push({
      id: id,
      isOpen: cb.checked
    });
  });

  // Update global state
  bridgeDayState = allBridgeDays.reduce((acc, { id, isOpen }) => {
    acc[id] = isOpen;
    return acc;
  }, {});

  try {
    await saveBridgeDaysSimple(cachedApi, allBridgeDays);
    console.log('✅ Bridge days saved');
  } catch (err) {
    console.error('❌ Bridge days save failed', err);
  }
}

async function gatherHolidaysAndSave() {
  const allHolidays = [];

  // Find all holiday checkboxes in the list
  const checkboxes = document.querySelectorAll('#rule-collapsible-holidays .row-checkbox');

  checkboxes.forEach(cb => {
    const id = cb.dataset.id || cb.id; // use dataset.id if set, fallback to id
    if (!id) return;

    allHolidays.push({
      id: id.replace(/^chk-/, ''),
      isOpen: cb.checked
    });
  });

  // Update global state if you want
  publicHolidayState = allHolidays.reduce((acc, { id, isOpen }) => {
    acc[id] = isOpen;
    return acc;
  }, {});

  try {
    await savePublicHolidaysSimple(cachedApi, allHolidays);
    console.log('✅ Save completed');
  } catch (err) {
    console.error('❌ Save failed', err);
  }
}


function populateBridgeDaysList(bridgeDays) {
  const collapsible = document.getElementById('rule-collapsible-bridgedays');
  if (!collapsible) {
    console.warn("⚠️ Didn't find bridge days container");
    return;
  }

  const body = collapsible.querySelector('.list-body');
  body.innerHTML = ''; // clear any existing rows

  const saveBtn = collapsible.querySelector('.btn-store');
  if (saveBtn) {
    saveBtn.classList.remove('hidden');
    saveBtn.classList.add('noto');
    saveBtn.addEventListener('click', gatherBridgeDaysAndSave);
  }


  if (!bridgeDays || bridgeDays.length < 1) {
    const noBridge = document.createElement('span');
    noBridge.textContent = "Keine Brückentage erkannt";
    body.appendChild(noBridge);
    return;
  }

  bridgeDays.forEach(day => {
    // --- Format date like "Fr. 27.12" ---
    const dateObj = new Date(day.date);
    const weekday = dateObj.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
    const dayNum = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const formattedDate = `${weekday}. ${dayNum}.${month}`;

    // --- Determine color class ---
    const colorClass = day.isOpen ? getDateColorClass(day.date) : 'isClosed';

    // --- Determine emoji and label ---
    const bridgeLabel = day.after
      ? `<br> <span class ="noto"> ${day.emoji}⇨🚧 </span>`
      : `<br> <span class ="noto"> 🚧⇨${day.emoji} </span>`;

    // --- Create list item ---
    const listItem = createListItem({
      id: `bridge-${day.date}`,
      name: bridgeLabel,
      date: formattedDate,
      // emoji: day.emoji || '🚧',
      disabled: day.disabled,
      isOpen: day.isOpen,
    }, colorClass);

    if (listItem) {
      body.appendChild(listItem);
    }
  });

  console.log(`✅ Populated ${bridgeDays.length} bridge days`);
}

function populateCompanyHolidaysList(companyHolidays = []) {
  const collapsible = document.getElementById('rule-collapsible-companyHolidays');
  if (!collapsible) {
    console.warn("⚠️ Company Holidays container not found");
    return;
  }

  // Clone main list template
  const tplList = document.getElementById('tpl-list');
  const listNode = tplList.content.cloneNode(true);
  const listBody = listNode.querySelector('.list-body');
  const listControls = listNode.querySelector('.list-controls');

  // --- Input controls for new company holiday ---
  const inputContainer = document.createElement('div');
  inputContainer.classList.add('company-holiday-input', 'noto', 'flex-col');

  // Generate unique IDs
  const timestamp = Date.now();
  const startBtnId = `pick-start-${timestamp}`;
  const endBtnId = `pick-end-${timestamp}`;
  const startInputId = `start-date-picker-${timestamp}`;
  const endInputId = `end-date-picker-${timestamp}`;
  const previewStartId = `preview-start-${timestamp}`;
  const previewEndId = `preview-end-${timestamp}`;
  const saveBtnId = `save-company-holiday-btn-${timestamp}`;

  inputContainer.innerHTML = `
  <div class="flex-row">
    <div class="flex-column">

      <div class="custom-date-wrapper">
        <button id="${startBtnId}" class="date-trigger noto">
          🔜 Anfang:
        </button>
        <span id="${previewStartId}" class="date-preview">–</span>
        <input type="date" id="${startInputId}" class="visually-hidden-date-picker" />
      </div>

      <div class="custom-date-wrapper">
        <button id="${endBtnId}" class="date-trigger noto">
          🔚 Ende:
        </button>
        <span id="${previewEndId}" class="date-preview">–</span>
        <input type="date" id="${endInputId}" class="visually-hidden-date-picker" />
      </div>

      <div class="flex-row duration-row">
        <span>Dauer:</span>
        <span id="company-holiday-duration">??</span>
        <span>Tage</span>
      </div>

    </div>

    <div class="flex-column">
      <button id="${saveBtnId}" class="noto save-btn">💾</button>
    </div>
  </div>
  <br>
`;

  listControls.appendChild(inputContainer);

  // --- Append fragment to DOM first ---
  const content = collapsible.querySelector('.rule-collapsible-content');
  content.innerHTML = '';
  content.appendChild(listNode);

  // --- Now all elements exist; wire up save button ---
  const saveBtn = document.getElementById(saveBtnId);
  saveBtn.addEventListener("click", () => saveCompanyHoliday(startInputId, endInputId));


  // --- Initialize the date picker AFTER DOM is ready ---
  activeCompanyHolidayPicker = createDateRangePicker({
    startButton: `#${startBtnId}`,
    endButton: `#${endBtnId}`,
    startInput: `#${startInputId}`,
    endInput: `#${endInputId}`,
    previewStart: `#${previewStartId}`,
    previewEnd: `#${previewEndId}`,
    previewDuration: '#company-holiday-duration',
    onChange: () => { }
  });


  // --- Render existing holidays ---
  if (!companyHolidays.length) {
    const empty = document.createElement('span');
    empty.textContent = "Keine Betriebsferien hinterlegt";
    listBody.appendChild(empty);
  } else {
    // SORT HOLIDAYS BY START DATE (earliest first)
    companyHolidays.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

    companyHolidays.forEach(period => {
      const tplItem = document.getElementById('tpl-list-item');
      const fragment = tplItem.content.cloneNode(true);
      const itemNode = fragment.querySelector('.data-row');
      if (!itemNode) return;

      itemNode.classList.add('is-closed');

      const labelText = itemNode.querySelector('.label-text');
      const rowRight = itemNode.querySelector('.row-right');

      itemNode.querySelector('.row-checkbox')?.remove();

      const start = new Date(period.startDate);
      const end = new Date(period.endDate);
      const startStr = start.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
      const endStr = end.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

      const label = document.createElement('div');
      label.classList.add('company-holiday-label');

      const startLabel = document.createElement('span');
      startLabel.innerHTML = `<span class="noto">🔜</span> ${startStr}`;
      label.appendChild(startLabel);

      const delBtn = document.createElement('button');
      delBtn.classList.add('noto', 'delete-btn');
      delBtn.title = "Löschen";
      delBtn.setAttribute('aria-label', 'Betriebsferien löschen');
      delBtn.textContent = '🗑️';
      delBtn.addEventListener('click', () => removeCompanyHoliday(period));
      label.appendChild(delBtn);

      if (startStr !== endStr) {
        label.appendChild(document.createElement('br'));

        const endLabel = document.createElement('span');
        endLabel.innerHTML = `<span class="noto">🔚</span> ${endStr}`;
        label.appendChild(endLabel);

        const editBtn = document.createElement('button');
        editBtn.classList.add('noto', 'edit-btn');
        editBtn.title = "Bearbeiten";
        editBtn.setAttribute('aria-label', 'Betriebsferien bearbeiten');
        editBtn.textContent = '✏️';
        editBtn.addEventListener('click', () => editCompanyHoliday(period));
        label.appendChild(editBtn);
      }

      labelText.innerHTML = "";
      labelText.appendChild(label);

      const lockIcon = document.createElement('span');
      lockIcon.classList.add('noto');
      lockIcon.setAttribute('aria-label', 'geschlossen');
      lockIcon.textContent = '🔒';
      lockIcon.style.fontSize = '1.75rem';
      lockIcon.style.lineHeight = '1';

      rowRight.innerHTML = "";
      rowRight.appendChild(lockIcon);

      listBody.appendChild(itemNode);
    });
  }
}


async function downloadAndCacheSchoolHolidays(api, state, year, progressText) {
  initChecklist();

  try {
    if (!navigator.onLine) throw new Error("offline");

    updateChecklist('online', 'success');
    const health = await apiHealthCheck(api, 'https://openholidaysapi.org');
    updateChecklist('apiReachable', health.success ? 'success' : 'failure');
    if (!health.success) throw new Error('api');

    const holidays = await DownloadSchoolHoliday(api, state, year);
    if (!holidays?.length) throw new Error('noData');

    updateChecklist('apiResponse', 'success');
    updateChecklist('dataReceived', 'success');

    const csv = parseToCSV(holidays);
    updateChecklist('dataParsed', 'success');

    await api.saveCSV('home', `schoolHolidays/${state}_${year}_holidays.csv`, csv);
    updateChecklist('csvWritten', 'success');

    progressText.textContent = "✅ Erfolgreich geladen!";
    return true;
  } catch (err) {
    const msg =
      err.message === "offline" ? "📴 Kein Internet" :
        err.message === "api" ? "❌ API nicht erreichbar" :
          err.message === "noData" ? "📄 Keine Daten" :
            "⚠️ Fehler beim Laden";

    progressText.textContent = msg;
    console.error("Download error:", err);
    return false;
  }
}

async function populateSchoolHolidaysListUnified(cachedApi, state, year) {
  const collapsible = document.getElementById('rule-collapsible-schoolHolidays');
  if (!collapsible) {
    console.warn("⚠️ School Holidays container not found");
    return;
  }

  const contentWrapper = collapsible.querySelector('.rule-collapsible-content');
  contentWrapper.innerHTML = ''; // always start fresh

  // --- Clone the generic list template ---
  const tplList = document.getElementById('tpl-list');
  if (!tplList) return;
  const listNode = tplList.content.cloneNode(true);
  const body = listNode.querySelector('.list-body');
  const controls = listNode.querySelector('.list-controls');

  // --- Header ---
  const title = document.createElement('div');
  title.innerHTML = ``;
  controls.appendChild(title);

  let schoolHolidays = await GetSchoolHoliday(cachedApi, state, year);
  if (typeof schoolHolidays === 'string') {
    schoolHolidays = parseSchoolHolidayCsv(schoolHolidays, year);
  }

  if (!schoolHolidays || schoolHolidays.length < 1) {
    // --- CSV not found: show download button ---
    const downloadBtn = document.createElement('button');
    downloadBtn.classList.add('noto', 'download-school-data-btn');
    downloadBtn.innerHTML = `<span class="noto">🌐 Schulferien aktualisieren</span>`;

    downloadBtn.addEventListener('click', async () => {
      downloadBtn.disabled = true;
      const success = await downloadAndCacheSchoolHolidays(cachedApi, state, year, progressText);
      downloadBtn.disabled = false;
      if (success) populateSchoolHolidaysListUnified(cachedApi, state, year);
    });

    const progressText = document.createElement('span');
    progressText.classList.add('progress-text');
    controls.appendChild(downloadBtn);
    controls.appendChild(progressText);

    downloadBtn.addEventListener('click', async () => {
      downloadBtn.disabled = true;
      progressText.textContent = "Wird geladen...";
      initChecklist();

      try {
        if (!navigator.onLine) throw new Error("offline");

        updateChecklist('online', 'success');
        const health = await apiHealthCheck(cachedApi, 'https://openholidaysapi.org');
        updateChecklist('apiReachable', health.success ? 'success' : 'failure');
        if (!health.success) throw new Error('api');

        const holidays = await DownloadSchoolHoliday(cachedApi, state, year);
        updateChecklist('apiResponse', 'success');
        if (!holidays?.length) throw new Error('noData');
        updateChecklist('dataReceived', 'success');

        await waitForCsvCreation();
        progressText.innerHTML = "<span class='noto'>✅</span> Erfolgreich geladen!";
        populateSchoolHolidaysListUnified(cachedApi, state, year);
      } catch (err) {
        console.error('Download error', err);
        const msg =
          err.message === "offline" ? "📴 Kein Internet" :
            err.message === "api" ? "❌ API nicht erreichbar" :
              err.message === "noData" ? "📄 Keine Daten" :
                "⚠️ Fehler beim Laden";
        progressText.textContent = msg;
        downloadBtn.disabled = false;
      }
    });
  } else {
    // --- Render holidays list ---
    schoolHolidays.forEach(holiday => {
      const tpl = document.getElementById('tpl-list-item');
      if (!tpl) return;
      const li = tpl.content.cloneNode(true);

      const labelText = li.querySelector('.label-text');
      const checkbox = li.querySelector('input[type="checkbox"]');
      const lockIcon = li.querySelector('.lock-icon');

      // --- Format date ---
      const start = new Date(holiday.startDate);
      const end = new Date(holiday.endDate);
      const startStr = start.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
      const endStr = end.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

      labelText.innerHTML = `${startStr} ⇨ ${endStr} <br>`;
      const emoji = document.createElement('span');
      emoji.classList.add('noto');
      emoji.textContent = holiday.emoji || '🏫';
      labelText.prepend(emoji);

      const nameSpan = document.createElement('span');
      nameSpan.classList.add('holiday-name');
      nameSpan.textContent = ` ${holiday.name}`;
      labelText.appendChild(nameSpan);

      if (checkbox) checkbox.remove(); // probably not needed
      if (lockIcon) lockIcon.remove();

      body.appendChild(li);
    });

    console.log(`✅ Populated ${schoolHolidays.length} school holidays`);
  }

  // --- Append to DOM ---
  contentWrapper.appendChild(listNode);
}

function initChecklist() {
  // Remove existing checklist if one is already present
  const oldChecklist = document.getElementById('holiday-checklist');
  if (oldChecklist) oldChecklist.remove();

  // Create a new checklist container
  const checklist = document.createElement('ul');
  checklist.id = 'holiday-checklist';
  checklist.classList.add('holiday-checklist');

  // Define the steps you want to display
  const steps = [
    { key: 'online', label: 'Online' },
    { key: 'apiReachable', label: 'API erreichbar' },
    { key: 'apiResponse', label: 'API Antwort' },
    { key: 'dataReceived', label: 'Daten empfangen' },
    { key: 'dataParsed', label: 'Daten verarbeitet' },
    { key: 'csvWritten', label: 'CSV gespeichert' }
  ];

  // Build the list items
  steps.forEach(step => {
    const li = document.createElement('li');
    li.dataset.step = step.key;
    li.classList.add('pending'); // initial state
    li.innerHTML = `
      <span class="status-indicator noto">⏳</span>
      <span class="status-label">${step.label}</span>
    `;
    checklist.appendChild(li);
  });

  // Find a place to insert the checklist
  const container =
    document.querySelector('#rule-collapsible-schoolHolidays .list-controls') ||
    document.querySelector('#rule-collapsible-schoolHolidays .rule-collapsible-content');

  if (container) {
    container.appendChild(checklist);
  } else {
    console.warn('⚠️ Could not find checklist container');
  }
}

function findBridgeDays(holidays, weekdays, persistedBridgeDays = []) {
  if (holidays.some(h => h.state === 'XX')) {
    console.log('Skipping bridge day generation for Nimmerland.');
    return [];
  }

  const result = [];
  const weekdayIndexMap = { sun: 6, mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5 };
  const weekendDays = weekdays.filter(day => !day.isOpen).map(day => weekdayIndexMap[day.id]);
  const sorted = [...holidays].sort((a, b) => new Date(a.date) - new Date(b.date));

  sorted.forEach(holiday => {
    const holidayDate = new Date(holiday.date);
    let currentWeekdayIndex = holidayDate.getDay() - 1; // Monday = 0
    if (currentWeekdayIndex < 0) currentWeekdayIndex = 6;

    if (weekendDays.includes(currentWeekdayIndex)) return;

    const emoji = holiday.emoji || '🎉';

    const nextDayIndex = (currentWeekdayIndex + 1) % 7;
    const dayAfterNext = (nextDayIndex + 1) % 7;
    if (!weekendDays.includes(nextDayIndex) && weekendDays.includes(dayAfterNext)) {
      const bridgeDate = new Date(holidayDate);
      bridgeDate.setDate(bridgeDate.getDate() + 1);
      const bridgeDateStr = bridgeDate.toISOString().slice(0, 10);
      if (!holidays.some(h => h.date === bridgeDateStr) && !result.some(b => b.date === bridgeDateStr)) {
        result.push({
          date: bridgeDateStr,
          weekdayIndex: nextDayIndex,
          emoji: `${emoji}`,
          isOpen: true,
          id: `bridge-${bridgeDateStr}`
        });
      }
    }

    const prevDayIndex = (currentWeekdayIndex + 6) % 7;
    const dayBeforePrev = (prevDayIndex + 6) % 7;
    if (!weekendDays.includes(prevDayIndex) && weekendDays.includes(dayBeforePrev)) {
      const bridgeDate = new Date(holidayDate);
      bridgeDate.setDate(bridgeDate.getDate() - 1);
      const bridgeDateStr = bridgeDate.toISOString().slice(0, 10);
      if (!holidays.some(h => h.date === bridgeDateStr) && !result.some(b => b.date === bridgeDateStr)) {
        result.push({
          date: bridgeDateStr,
          weekdayIndex: prevDayIndex,
          emoji: `⇦${emoji}`,
          isOpen: true,
          id: `bridge-${bridgeDateStr}`
        });
      }
    }
  });

  return result;
}
function createMatrixList(cfg) {
  const container = document.createElement('div');
  container.className = 'shift-matrix-container';

  // Create both versions
  const expandedGrid = createExpandedMatrix(cfg);
  const miniGrid = createMiniMatrix(cfg);

  container.appendChild(expandedGrid);
  container.appendChild(miniGrid);

  return container;
}

function createExpandedMatrix(cfg) {
  const expandedGrid = document.createElement('div');
  expandedGrid.className = 'shift-matrix shift-matrix-expanded';

  // --- Header row ---
  const headerRow = document.createElement('div');
  headerRow.className = 'shift-row shift-header-row';

  const topLeft = document.createElement('div');
  topLeft.className = 'shift-label';
  topLeft.textContent = ''; // empty top-left corner
  headerRow.appendChild(topLeft);

  const shiftIds = ['early', 'day', 'late'];
  const shiftLabels = { early: 'Früh', day: 'Voll/Tag', late: 'Spät' };
  const shiftHeaderClasses = { early: 'is-early', day: 'is-day', late: 'is-late' };

  shiftIds.forEach(id => {
    const col = document.createElement('div');
    col.className = 'shift-cell';
    col.textContent = shiftLabels[id];
    col.classList.add(shiftHeaderClasses[id]);
    headerRow.appendChild(col);
  });

  expandedGrid.appendChild(headerRow);

  // --- Data rows for weekdays ---
  const weekdayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const rowHeaderClasses = ['is-regular', 'is-regular', 'is-regular', 'is-regular', 'is-regular', 'is-weekend', 'is-sunday'];

  Object.entries(cfg.data).forEach(([day, shifts], index) => {
    const row = document.createElement('div');
    row.className = 'shift-row';

    // Row header
    const label = document.createElement('div');
    label.className = 'shift-label';
    label.textContent = weekdayLabels[index];
    label.classList.add(rowHeaderClasses[index]);
    row.appendChild(label);

    // Cells with checkboxes
    shifts.forEach(shift => {
      const cell = createMatrixCell(day, shift, true); // true for expanded version
      row.appendChild(cell);
    });

    expandedGrid.appendChild(row);
  });

  return expandedGrid;
}

function createMiniMatrix(cfg) {
  const miniGrid = document.createElement('div');
  miniGrid.className = 'shift-matrix shift-matrix-mini';

  // --- Mini header row (same color classes as big matrix) ---
  const miniHeaderRow = document.createElement('div');
  miniHeaderRow.className = 'shift-row-mini shift-header-row-mini';

  const shiftIds = ['early', 'day', 'late'];
  const shiftHeaderClasses = {
    early: 'is-early',
    day: 'is-day',
    late: 'is-late'
  };
  const shiftHeaderLabels = {
    early: 'F',   // small abbrev or icon
    day: 'T',
    late: 'S'
  };

  shiftIds.forEach(id => {
    const col = document.createElement('div');
    col.classList.add('shift-cell-mini', shiftHeaderClasses[id]);
    col.textContent = shiftHeaderLabels[id];
    miniHeaderRow.appendChild(col);
  });

  miniGrid.appendChild(miniHeaderRow);

  Object.entries(cfg.data).forEach(([day, shifts]) => {
    const miniRow = document.createElement('div');
    miniRow.className = 'shift-row-mini';

    shifts.forEach(shift => {
      const cell = createMatrixCell(day, shift, false); // false = mini
      miniRow.appendChild(cell);
    });

    miniGrid.appendChild(miniRow);
  });

  return miniGrid;
}


function createMatrixCell(day, shift, isExpanded) {
  const cell = document.createElement('div');

  if (isExpanded) {
    cell.classList.add('shift-cell');

    const shiftColorClass = {
      early: 'is-early',
      day: 'is-day',
      late: 'is-late'
    }[shift.id] || '';

    if (shiftColorClass) cell.classList.add(shiftColorClass);

    // Add closed state if inactive
    if (!shift.active) {
      cell.classList.add('is-closed');
      cell.classList.remove('is-early', 'is-day', 'is-late');
    }

    const todayShift = shiftsData[day];
    const todayShiftEntry = todayShift.find(s => s.id === shift.id);
    const isShiftOpen = todayShiftEntry ? todayShiftEntry.active : false;

    // === Checkbox for expanded version ===
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = isShiftOpen;
    checkbox.dataset.day = day;
    checkbox.dataset.shift = shift.id;
    checkbox.dataset.key = `${day}-${shift.id}`;

    // === Lock Icon ===
    const icon = document.createElement('span');
    icon.className = 'lock-icon ' + (shift.active ? 'unlocked' : 'locked');

    // === Assemble cell ===
    cell.appendChild(checkbox);
    cell.appendChild(icon);

    checkbox.addEventListener('change', e => {
      const isActive = e.target.checked;

      // Update lock icon
      icon.classList.toggle('unlocked', isActive);
      icon.classList.toggle('locked', !isActive);

      cell.classList.remove('is-early', 'is-day', 'is-late', 'is-closed');

      if (isActive) {
        cell.classList.add(shiftColorClass);
      } else {
        cell.classList.add('is-closed');
      }

      onShiftToggle(day, shift.id, isActive);
    });

  } else {
    // --- MINI VERSION (visual only, but same colors + lock icons as expanded) ---
    cell.classList.add('shift-cell-mini');

    const shiftColorClass = {
      early: 'is-early',
      day: 'is-day',
      late: 'is-late'
    }[shift.id] || '';

    if (shiftColorClass) cell.classList.add(shiftColorClass);

    // Closed state removes color and shows gray look
    if (!shift.active) {
      cell.classList.add('is-closed');
      cell.classList.remove('is-early', 'is-day', 'is-late');
    }

    // --- Mini lock icon (same locked/unlocked semantics) ---
    const icon = document.createElement('span');
    icon.className = 'lock-icon-mini ' + (shift.active ? 'unlocked' : 'locked');
    icon.classList.add('noto');
    cell.appendChild(icon);
  }

  return cell;
}

function getDateColorClass(dateStr, isClosed = false) {

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    console.error(`Invalid date format: "${dateStr}". Expected "YYYY-MM-DD".`);
    return null;
  }

  const date = new Date(dateStr);
  if (isNaN(date)) {
    console.error(`Invalid date: "${dateStr}" could not be parsed.`);
    return null;
  }

  const day = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  if (day === 0) return 'is-sunday';
  if (day === 6) return 'is-weekend';
  return 'is-regular';
}


// Helper for weekday abbreviation
function dayAbbr(dayId) {
  const map = { mon: 'Mo', tue: 'Di', wed: 'Mi', thu: 'Do', fri: 'Fr', sat: 'Sa', sun: 'So' };
  return map[dayId] || dayId;
}


//
//            OLD                  old             oldold
//         old   old               old             old    old
//         old   old               old             old    old
//         old   old               old             old    old
//         old   old               oldoldold       old    old
//            old                  oldoldold       oldold
//

function updateDivider(className = "bg-calendar") {
  const divider = document.getElementById('horizontal-divider');
  if (!divider) {
    console.error("❌ horizontal-divider not found");
    return;
  }

  divider.className = className;
  divider.innerHTML = '';

  // Left gap
  const leftGap = document.createElement('div');
  leftGap.className = 'left-gap';

  // Header
  const h2 = document.createElement('h2');
  h2.id = 'role-form-title';
  h2.className = 'sr-only';
  h2.innerHTML = `<span class="noto">📋</span> Öffnungszeiten planen <span class="noto">✍🏻</span>`;

  // Container for form controls
  const buttonContainer = document.createElement('div');
  buttonContainer.id = 'form-buttons';
  buttonContainer.className = 'flex items-center gap-3';

  // --- Global buttons (will work as before) ---
  const helpBtn = createHelpButton('chapter-employees');
  const branchSelect = createBranchSelect({
    onChange: (val) => applyBranchPreset(val)
  });

  // --- New global window buttons ---
  const windowBtns = createWindowButtons(); // your new min/max buttons

  // Compose: add branchSelect, helpBtn, saveBtn, then windowBtns
  buttonContainer.append(branchSelect, helpBtn, windowBtns);

  divider.append(leftGap, h2, buttonContainer);
}


function saveAllChanges() {

}

function createYearSelect({ defaultYear = new Date().getFullYear(), minYear = 2025, onChange } = {}) {
  const container = document.createElement('div');
  container.className = 'calendar-form-field year-select-group flex items-center gap-2';

  const label = document.createElement('label');
  label.setAttribute('for', 'calendar-form-year');
  label.textContent = 'Jahr';

  const input = document.createElement('input');
  input.type = 'number';
  input.id = 'calendar-form-year';
  input.min = minYear;
  input.value = defaultYear;
  input.setAttribute('aria-label', 'Jahr auswählen');

  function handleYearChange(e) {
    const year = parseInt(e.target.value, 10);
    debug('[YEAR INPUT] event fired', { raw: e.target.value, parsed: year });

    if (!isNaN(year) && year >= minYear) {
      if (typeof onChange === 'function') {
        debug('[YEAR INPUT] calling onChange handler');
        onChange(year);
      } else {
        debug('[YEAR INPUT] onChange missing or not a function');
      }
    } else {
      debug('[YEAR INPUT] invalid year, resetting');
      e.target.value = defaultYear;
    }
  }

  try {
    input.addEventListener('change', handleYearChange);
    input.addEventListener('blur', handleYearChange);
    input.addEventListener('input', debounce(handleYearChange, 500));
    debug('[YEAR INPUT] listeners attached ✅');
  } catch (err) {
    console.error('[YEAR INPUT] Failed to attach listener ❌', err);
  }

  queueMicrotask(() => {
    const el = document.getElementById('calendar-form-year');
    debug('[YEAR INPUT] Post-init check:', {
      exists: !!el,
      disabled: el?.disabled,
      readOnly: el?.readOnly,
      parentVisible: el?.offsetParent !== null,
    });
  });

  container.append(label, input);
  return container;
}


const DEBUG_UI = true; // set false for production

function debug(...args) {
  if (DEBUG_UI) console.log('[DEBUG]', ...args);
}

function createStateSelect({ defaultValue = 'BB', onChange } = {}) {
  const container = document.createElement('div');
  container.className = 'calendar-form-field state-select-group flex items-center gap-2';

  const flagImg = document.createElement('img');
  flagImg.className = 'state-flag-icon';
  flagImg.alt = 'Bundesland Flagge';
  flagImg.setAttribute('aria-hidden', 'true');

  const label = document.createElement('label');
  label.setAttribute('for', 'state-select');
  label.textContent = 'Bundesland';

  const select = document.createElement('select');
  select.id = 'state-select';
  select.setAttribute('aria-label', 'Bundesland auswählen');

  states.forEach(({ code, name }) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = name;
    select.appendChild(opt);
  });

  select.value = defaultValue;

  const updateFlag = (stateCode) => {
    flagImg.src = `assets/png/wappen-${mapStateCode(stateCode)}.png`;
  };
  updateFlag(select.value);

  // 🧠 Add event listener diagnostics
  try {
    select.addEventListener('change', (e) => {
      const val = e.target.value;
      debug('[STATE SELECT] event fired', { val, disabled: select.disabled });

      updateFlag(val);
      if (typeof onChange === 'function') {
        debug('[STATE SELECT] calling onChange handler');
        onChange(val);
      } else {
        debug('[STATE SELECT] onChange missing or not a function');
      }
    });

    debug('[STATE SELECT] Event listener attached ✅');
  } catch (err) {
    console.error('[STATE SELECT] Failed to attach listener ❌', err);
  }

  // 🧠 DOM inspection
  queueMicrotask(() => {
    const el = document.getElementById('state-select');
    debug('[STATE SELECT] Post-init check:', {
      exists: !!el,
      disabled: el?.disabled,
      parentVisible: el?.offsetParent !== null,
    });
  });

  container.append(flagImg, label, select);

  setTimeout(() => {
    const stateSelect = document.getElementById('state-select');
    debug('[STATE SELECT] Live element check after rebind:', {
      sameNode: stateSelect === select,
      eventListenersStillPresent: getEventListeners ? getEventListeners(stateSelect) : 'n/a',
    });
  }, 2000);

  return container;
}


// Debounce helper function for better performance
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function createEventListener() {
  initCheckboxLockToggles();
  initCollapseExpandToggles();
  // initBranchSelectLogic();
  createCompanyHolidayEventListeners();
  // createCalendarFormYearSelect(); // This will now work properly
}

function createCalendarFormYearSelect() {
  const formYearInput = document.getElementById('calendar-form-year');
  if (formYearInput) {
    formYearInput.addEventListener('change', () => {
      const newYear = parseInt(formYearInput.value, 10);
      if (!isNaN(newYear)) {
        currentYear = newYear;
        setDateRemote(newYear);
      }
    });
  }
}

function initCheckboxLockToggles() {
  document.querySelectorAll('.data-box input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const container = checkbox.closest('.data-box');
      const key = container.getAttribute('data-shift') || container.getAttribute('data-day');
      if (!key) return;

      const isChecked = checkbox.checked;

      document.querySelectorAll(`[data-lock-key="${key}"]`).forEach(icon => {
        icon.classList.toggle('unlocked', isChecked);
        icon.classList.toggle('locked', !isChecked);
      });

      container.classList.toggle('checked', isChecked);

      document.querySelectorAll(`.data-box[data-shift="${key}"]`).forEach((box) => {
        box.classList.remove('ambigious');
        box.classList.toggle('checked', isChecked);
      });

      const storeButton = container.closest('.shift-controls')?.querySelector('#store-shifts');
      if (storeButton) storeButton.classList.remove('hidden');

      updateShiftSelectOptions();
      const sectionId = getSectionId(checkbox);
      if (!sectionId) {
        console.warn('Could not determine section for checkbox');
        return;
      }

      switch (sectionId) {
        case 'weekday-expanded':
          interpretWeekdays(checkbox);
          break;
        case 'shift-expanded':
          interpretShifts(); // still same for now
          break;
        case 'holiday-expanded':
          updatePublicHolidays();
          break;
        case 'bridgeday-expanded':
          updateBridgeDays();
          break;
        default:
          console.warn('Unhandled checkbox section:', sectionId);
      }
      updateCalendarDisplay();
    });
  });

  updateShiftSelectOptions();
}

function getSectionId(element) {
  // climb up the DOM tree until we find an element with one of the known section IDs
  const sectionIds = ['weekday-expanded', 'shift-expanded', 'holiday-expanded', 'bridgeday-expanded'];
  let current = element;
  while (current) {
    if (current.id && sectionIds.includes(current.id)) {
      return current.id;
    }
    current = current.parentElement;
  }
  return null;
}

function gatherShiftStates() {
  const early = document.getElementById("input-shift-early").checked;
  const day = document.getElementById("input-shift-day").checked;
  const late = document.getElementById("input-shift-late").checked;
  return Util.boolsToKey({ early, day, late });
}


function interpretWeekdays(weekdayCheckbox) {
  const dayIds = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const dayKey = weekdayCheckbox.getAttribute('data-day') || weekdayCheckbox.id.split('-').pop();
  const dayIndex = dayIds.indexOf(dayKey);
  if (dayIndex === -1) {
    console.warn('Day key not found:', dayKey);
    return;
  }

  const shiftWeekdaySelect = document.getElementById('shift-weekday');
  const selectedShiftDay = shiftWeekdaySelect.value; // e.g. 'shift-all', 'shift-mon', etc.

  if (!weekdayCheckbox.checked) {
    updateOfficeDays(dayIndex, "never");
    return;
  }

  if (selectedShiftDay !== 'shift-all' && selectedShiftDay !== `shift-${dayKey}`) {
    shiftWeekdaySelect.value = `shift-${dayKey}`;

    document.getElementById("input-shift-early").checked = false;
    document.getElementById("input-shift-day").checked = true;
    document.getElementById("input-shift-late").checked = false;
  }

  const shiftKey = gatherShiftStates();
  updateOfficeDays(dayIndex, shiftKey);
}

function interpretShifts() {
  console.log('interpretShifts() called ✅');
  const key = gatherShiftStates();
}

function updateBridgeDays() {
  console.log('updateBridgeDays() called ✅');
}

function updatePublicHolidays() {
  console.log('updatePublicHolidays() called ✅');
}

function initCollapseExpandToggles() {

  const defaultExpandedStates = {
    'collapse-shift-toggle': true,
    'collapse-weekday-toggle': true,
    'collapse-holiday-toggle': false,
    'collapse-bridge-toggle': false,
    'collapse-closed-toggle': false,
    'collapse-school-toggle': false,
  };

  document.querySelectorAll('.rule-collapsible-toggle').forEach(toggleBtn => {
    const id = toggleBtn.id;
    const savedState = localStorage.getItem(`collapseState-${id}`);

    if (savedState !== null) {
      const parsed = savedState === 'true';
      applyCollapseState(toggleBtn, parsed);
    } else {
      const defaultState = defaultExpandedStates[id] ?? true;
      applyCollapseState(toggleBtn, defaultState);
    }
    toggleBtn.addEventListener('click', () => {
      const id = toggleBtn.id; // <= anonymus function doesnt know id
      const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      const newState = !isExpanded;
      applyCollapseState(toggleBtn, newState);
      localStorage.setItem(`collapseState-${id}`, newState);
    });
  });
}

function applyCollapseState(toggleBtn, expanded) {
  const fieldset = toggleBtn.closest('fieldset');
  if (!fieldset) return;

  toggleBtn.setAttribute('aria-expanded', expanded.toString());
  toggleBtn.classList.toggle('expanded', expanded);
  fieldset.classList.toggle('active', expanded);

  const chev = toggleBtn.querySelector('.chev');
  if (chev) chev.classList.toggle('active', expanded);

  if (toggleBtn.id === 'collapse-shifts-toggle') {
    const expandedMatrix = document.querySelector('.shift-matrix-expanded');
    const miniMatrix = document.querySelector('.shift-matrix-mini');

    if (expandedMatrix && miniMatrix) {
      if (expanded) {
        expandedMatrix.classList.remove('hidden');
        miniMatrix.classList.add('hidden');
      } else {
        expandedMatrix.classList.add('hidden');
        miniMatrix.classList.remove('hidden');
      }
    }
  }

  fieldset.querySelectorAll('.data-row').forEach(row => {
    const checkbox = row.querySelector('.row-checkbox');
    const fullName = row.querySelector('.full-name');
    const shortName = row.querySelector('.short-name');

    if (checkbox) checkbox.classList.toggle('hidden', !expanded);
    if (fullName) fullName.classList.toggle('hidden', !expanded);
    if (shortName) shortName.classList.toggle('hidden', expanded);
  });
}

function initBranchSelectLogic() {
  const branchSelect = document.getElementById('branch-select');
  const LOCAL_STORAGE_KEY = 'customBranchWord';
  let previousValue = branchSelect?.value;

  branchSelect?.addEventListener('change', (event) => {
    const newValue = event.target.value;

    if (previousValue === 'custom' && newValue !== 'custom') {
      showBranchWarning(() => {
        previousValue = newValue;
      }, () => {
        branchSelect.value = previousValue;
      });
    } else {
      previousValue = newValue;
    }
    updateHeader(newValue);
    const officeDaysUpdate = setBranch(newValue)
    updateWeekdayAndShiftCheckboxes(officeDaysUpdate);
  });


}

function createCompanyHolidayEventListeners() {
  const pickStartBtn = document.getElementById("pick-start");
  const pickEndBtn = document.getElementById("pick-end");
  const startDatePicker = document.getElementById("start-date-picker");
  const endDatePicker = document.getElementById("end-date-picker");

  // Show warning dialog if year blocked
  function showYearBlockedDialog() {
    showYearWarning(onYearBlockedConfirmed, onYearBlockedCancelled);
  }

  function onYearBlockedConfirmed() {
    console.log("User confirmed year is blocked.");
    // Optionally disable inputs/buttons here
  }

  function onYearBlockedCancelled() {
    console.log("User cancelled dialog.");
  }

  // Validation function placeholder
  function validateDates(start, end) {
    console.log("Validating dates:", start, end);
    // Add your validation logic here
  }

  // Set defaults and open picker on start button click
  function onPickStartClick() {
    const result = getDefaultHolidayDates();
    if (result.blocked) {
      showYearBlockedDialog();
      return;
    }
    startDatePicker.value = result.startDate;
    updatePreview("start", result.startDate);
    validateDates(result.startDate, endDatePicker.value);

    startDatePicker.showPicker?.() || startDatePicker.focus();
  }

  // Set defaults and open picker on end button click
  function onPickEndClick() {
    const result = getDefaultHolidayDates();
    if (result.blocked) {
      showYearBlockedDialog();
      return;
    }
    endDatePicker.value = result.endDate;
    updatePreview("end", result.endDate);
    validateDates(startDatePicker.value, result.endDate);

    endDatePicker.showPicker?.() || endDatePicker.focus();
  }

  // Date pickers change handlers
  function onStartDateChange() {
    const pickedDate = startDatePicker.value;
    updatePreview("start", pickedDate);
    validateDates(pickedDate, endDatePicker.value);
  }

  function onEndDateChange() {
    const pickedDate = endDatePicker.value;
    updatePreview("end", pickedDate);
    validateDates(startDatePicker.value, pickedDate);
  }

  // Attach listeners
  pickStartBtn?.addEventListener("click", onPickStartClick);
  pickEndBtn?.addEventListener("click", onPickEndClick);
  startDatePicker?.addEventListener("change", onStartDateChange);
  endDatePicker?.addEventListener("change", onEndDateChange);
}

//#endregion

// Load stored custom word or fallback
function getStoredCustomWord() {
  return localStorage.getItem(LOCAL_STORAGE_KEY) || DEFAULT_WORD;
}

// Save custom word
function setStoredCustomWord(word) {
  localStorage.setItem(LOCAL_STORAGE_KEY, word);
}

// Update header text based on branch and stored custom word
function updateHeader(branchValue) {
  const header = document.getElementById('openinghours');
  let branchWord = "`${DEFAULT_WORD} festlegen`"
  if (branchValue === 'custom') {
    const customWord = getStoredCustomWord();
    branchWord = `${customWord} festlegen`;
  } else {
    branchWord = branchHeaders[branchValue] || branchWord;
  }
  header.innerHTML = branchWord;
}

function updateWeekdayAndShiftCheckboxes(officeDaysUpdate) {
  // 1) Update weekday checkboxes, trigger change event
  dayIds.forEach((day, idx) => {
    const dayBox = document.querySelector(`.weekday-expanded .data-box[data-day="${day}"]`);
    if (!dayBox) return;
    const cb = dayBox.querySelector('input[type="checkbox"]');
    cb.checked = officeDaysUpdate[idx] !== 'never';
    cb.dispatchEvent(new Event('change', { bubbles: true }));
  });

  // 2) Aggregate bools across all days
  const aggregate = { early: false, day: false, late: false };
  officeDaysUpdate.forEach(key => {
    if (key === 'never') return;
    const bools = Util.keyToBools(key);
    aggregate.early = aggregate.early || bools.early;
    aggregate.day = aggregate.day || bools.day;
    aggregate.late = aggregate.late || bools.late;
  });

  // 3) Convert aggregate bools back to shift key
  const combinedShiftKey = Util.boolsToKey(aggregate);

  // 4) Update global shift checkboxes accordingly
  ['early', 'day', 'late'].forEach(shiftKey => {
    const shiftBox = document.querySelector(`.shift-expanded .data-box[data-shift="${shiftKey}"]`);
    if (!shiftBox) return;
    const cb = shiftBox.querySelector('input[type="checkbox"]');
    // checked if aggregate bool for that shiftKey is true
    const shouldBeChecked = aggregate[shiftKey];
    if (cb.checked !== shouldBeChecked) {
      cb.checked = shouldBeChecked;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  const boolMatrix = convertShiftKeysToMatrix(officeDays);
  const weeklyShifts = analyzeShiftMatrix(boolMatrix);
  const shiftSelect = document.getElementById('shift-weekday');
}


function updateShiftSelectOptions() {
  const weekdayCheckboxes = document.querySelectorAll('.weekday-expanded .data-box input[type="checkbox"]');
  const shiftSelect = document.getElementById('shift-weekday');

  // Build a map of weekday -> checked
  const weekdayStatus = {};
  weekdayCheckboxes.forEach(cb => {
    const day = cb.closest('.data-box').getAttribute('data-day');
    weekdayStatus[day] = cb.checked;
  });

  // Helper: find option by value
  function setOptionDisabled(value, disabled) {
    const option = shiftSelect.querySelector(`option[value="${value}"]`);
    if (option) option.disabled = disabled;
  }

  // For single weekdays, disable option if checkbox unchecked
  Object.entries(weekdayStatus).forEach(([day, checked]) => {
    setOptionDisabled(`shift-${day}`, !checked);
  });

  // For "alle Arbeitstage" option, disable if any weekday (Mon-Fri) unchecked
  const allWorkdaysChecked = ['mon', 'tue', 'wed', 'thu', 'fri'].every(d => weekdayStatus[d]);
  setOptionDisabled('shift-all', !allWorkdaysChecked);
  setOptionDisabled('shift-all', false);

}

function convertShiftKeysToMatrix(officeDaysUpdate) {
  return officeDaysUpdate.map(Util.keyToBools);
}


function analyzeShiftMatrix(boolMatrix) {
  // Filter only open days (where any shift is true)
  const openDays = boolMatrix.filter(day =>
    day.early || day.day || day.late
  );

  if (openDays.length === 0) {
    return {
      early: { emoji: '🔒', status: false },
      day: { emoji: '🔒', status: false },
      late: { emoji: '🔒', status: false },
    };
  }

  const result = {};
  ['early', 'day', 'late'].forEach(shift => {
    const values = openDays.map(day => day[shift]);
    const allTrue = values.every(v => v === true);
    const allFalse = values.every(v => v === false);

    if (allTrue) {
      result[shift] = { emoji: '🔑', status: true };       // open
    } else if (allFalse) {
      result[shift] = { emoji: '🔒', status: false };      // closed
    } else {
      result[shift] = { emoji: '⊖', status: true };        // inconsistent but still "open"
    }
  });

  return result;
}

//#region Warnings
function showYearWarning(onConfirm, onCancel) {
  const dialog = document.getElementById('year-warning-dialog');
  dialog.classList.remove('hidden');

  const confirmBtn = document.getElementById('year-dialog-confirm');
  const cancelBtn = document.getElementById('year-dialog-cancel');

  const closeDialog = () => dialog.classList.add('hidden');

  confirmBtn.onclick = () => {
    closeDialog();
    onConfirm();
  };

  cancelBtn.onclick = () => {
    closeDialog();
    onCancel();
  };
}

function showShiftWarning(onConfirm, onCancel) {
  const dialog = document.getElementById('shift-warning-dialog');
  dialog.classList.remove('hidden');

  const confirmBtn = document.getElementById('shift-dialog-confirm');
  const cancelBtn = document.getElementById('shift-dialog-cancel');

  const closeDialog = () => dialog.classList.add('hidden');

  confirmBtn.onclick = () => {
    closeDialog();
    onConfirm();
  };

  cancelBtn.onclick = () => {
    closeDialog();
    onCancel();
  };
}

//#endregion

function updateHolidayCheckedStates() {
  document.querySelectorAll('.holiday-checkbox').forEach(cb => {
    const box = cb.closest('.data-box');
    box.classList.toggle('checked', cb.checked);
    updateCollapsedHolidayCheckedStates();
  });
}

function updateCollapsedHolidayCheckedStates() {
  const expandedCheckboxes = document.querySelectorAll('#holiday-expanded .holiday-checkbox');
  expandedCheckboxes.forEach(cb => {
    const key = cb.dataset.holidayKey;
    const collapsedBox = document.querySelector(`#holiday-collapsed .data-box[data-holiday="${key}"]`);
    if (collapsedBox) {
      collapsedBox.classList.toggle('checked', cb.checked);
    }
  });
}

function updateHolidaysForYear(year) {
  try {
    const holidays = getAllHolidaysForYear(year, ruleFederalState);
    const expandedContainer = document.getElementById('holiday-expanded');
    const collapsedContainer = document.getElementById('holiday-collapsed');

    if (!expandedContainer || !collapsedContainer) {
      console.warn('Holiday containers not found!');
      return;
    }

    expandedContainer.querySelectorAll('.data-box').forEach(el => el.remove());
    collapsedContainer.innerHTML = '';

    holidays.forEach(holiday => {
      const key = holiday.key || holiday.date; // Unique key for locking
      const date = new Date(holiday.date);
      const formattedDate = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`;

      //
      // Expanded view (checkbox, emoji, name, lock)
      //
      const dataBox = document.createElement('div');
      dataBox.classList.add('data-box');
      dataBox.dataset.holiday = key;

      const label = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.classList.add('holiday-checkbox');
      checkbox.dataset.holidayKey = key;
      checkbox.value = holiday.id || key;
      checkbox.addEventListener('change', () => {
        const isChecked = checkbox.checked;
        dataBox.classList.toggle('checked', isChecked);
      });

      const labelText = document.createElement('span');
      // labelText.classList.add('label-text', 'noto');
      // labelText.innerHTML = `${formattedDate} ${holiday.emoji} ⇨ ${holiday.name}`;

      const dateSpan = document.createElement('span');
      dateSpan.textContent = formattedDate;

      const emojiSpanExt = document.createElement('span');
      emojiSpanExt.classList.add('noto');
      emojiSpanExt.textContent = ` ${holiday.emoji}`;

      const arrowSpan = document.createElement('span');
      arrowSpan.textContent = '⇨';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = ` ${holiday.name}`;

      // Append all spans to labelText
      labelText.appendChild(dateSpan);
      labelText.appendChild(emojiSpanExt);
      labelText.appendChild(arrowSpan);
      labelText.appendChild(nameSpan);

      label.appendChild(checkbox);
      label.appendChild(labelText);

      const lockIcon = document.createElement('span');
      lockIcon.classList.add('lock-icon', 'unlocked', 'noto');
      lockIcon.dataset.lockKey = key;

      dataBox.appendChild(label);
      dataBox.appendChild(lockIcon);
      expandedContainer.appendChild(dataBox);

      //
      // Collapsed view (emoji, lock)
      //
      const collapsedBox = document.createElement('div');
      collapsedBox.classList.add('data-box');
      collapsedBox.dataset.holiday = key;

      const emojiSpan = document.createElement('span');
      emojiSpan.classList.add('noto');
      emojiSpan.title = holiday.name;
      emojiSpan.innerText = holiday.emoji; // Show emoji ✔️

      const collapsedLock = document.createElement('span');
      collapsedLock.classList.add('lock-icon', 'unlocked', 'noto');
      collapsedLock.dataset.lockKey = key;

      // Nest the lock icon inside the emoji span
      emojiSpan.appendChild(collapsedLock);

      collapsedBox.appendChild(emojiSpan);
      collapsedContainer.appendChild(collapsedBox);
    }); // <-- properly closes the forEach loop

    //
    // Hook up master checkbox to control all holiday checkboxes (outside the loop!)
    //
    const masterToggle = document.getElementById('toggle-all-holidays');
    if (masterToggle) {
      masterToggle.addEventListener('change', () => {
        const allCheckboxes = expandedContainer.querySelectorAll('.holiday-checkbox');
        allCheckboxes.forEach(cb => {
          cb.checked = masterToggle.checked;
        });
        updateHolidayCheckedStates();
      });
    }

  } catch (error) {
    console.error('Failed to load holidays:', error);
  }
}

async function checkAndRenderSchoolHolidays(cachedApi) {

  let csvFilePath = `./samples/schoolHolidays/DE-${ruleFederalState}_${currentYear}_holidays.csv`;

  const response = await GetSchoolHoliday(cachedApi, ruleFederalState, currentYear);
  if (response) {
    renderSchoolHolidays(ruleFederalState, currentYear);
  } else {
    showDownloadButton();
  }
}

function formatShortDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

async function renderSchoolHolidays(ruleFormState, currentYear) {

  const collapsible = document.getElementById('school-holiday-container');
  collapsible.innerHTML = '';
  const schoolHolidaysList = document.createElement('ul');

  let csvFilePath = `schoolHolidays/DE-${ruleFormState}_${currentYear}_holidays.csv`;

  try {
    const response = await fetch(csvFilePath);
    if (!response.ok) throw new Error('Failed to load CSV');
    const text = await response.text();
    const rows = text.split('\n').slice(1); // Skip header
    schoolHolidaysList.innerHTML = rows
      .filter(row => row.trim())
      .map(row => {
        const [name, start, end] = row.split(',');
        return `<li><strong>${name}:</strong> ${start} - ${end}</li>`;
      })
      .join('');
    collapsible.appendChild(schoolHolidaysList);
  } catch (error) {
    console.error('Error loading CSV:', error);
  }
}

async function waitForCsvCreation() {
  let attempts = 0;
  const maxAttempts = 10;
  const retryDelayMs = 500;
  let csvFilePath = `schoolHolidays/DE-${ruleFederalState}_${currentYear}_holidays.csv`;

  return new Promise((resolve, reject) => {
    const checkExistence = async () => {
      try {
        const response = await fetch(csvFilePath, { method: 'HEAD' });

        if (response.ok) {
          renderSchoolHolidays(ruleFederalState, currentYear);
          resolve();
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(checkExistence, retryDelayMs);
        } else {
          const message = `Schulferien für ${currentYear} sind noch nicht verfügbar. Bitte versuchen Sie es später erneut.`;
          showSchoolHolidayError(message);

          // Also show the download button to retry
          const downloadButton = document.getElementById('downloadButton');
          if (downloadButton) {
            downloadButton.style.display = 'inline-block';
          }
          reject(new Error(message));
        }
      } catch (error) {
        console.error('Error checking CSV creation:', error);
        showSchoolHolidayError('Fehler beim Überprüfen der Ferien-Daten. Bitte versuchen Sie es erneut.');

        const downloadButton = document.getElementById('downloadButton');
        if (downloadButton) {
          downloadButton.style.display = 'inline-block';
        }
        reject(error);
      }
    };

    checkExistence();
  });
}

function showSchoolHolidayError(message) {
  let errorDiv = document.getElementById('schoolHolidayError');
  if (!errorDiv) {
    const collapsible = document.getElementById('school-holiday-container');
    errorDiv = document.createElement('div');
    errorDiv.id = 'schoolHolidayError';
    errorDiv.className = 'error-message';
    errorDiv.setAttribute('role', 'alert');
    errorDiv.setAttribute('aria-live', 'assertive');
    collapsible.appendChild(errorDiv);
  }
  errorDiv.textContent = message;
}

function updateChecklist(step, status) {
  const row = document.querySelector(`[data-step="${step}"]`);
  if (!row) return;

  const indicator = row.querySelector('.status-indicator');
  if (!indicator) return;

  row.classList.remove('status-success', 'status-failure', 'status-pending');
  indicator.classList.add('noto');

  const icons = {
    success: '✅',
    failure: '❌',
    pending: '⏳'
  };

  if (window.debugChecklist) {
    console.log(`🪶 [Checklist] ${step} → ${status}`);
  }

  const baseDelay = 250; // minimum 0.25s
  const randomExtra = Math.random() * 1000; // + up to 1.0s
  const totalDelay = baseDelay + randomExtra;

  setTimeout(() => {
    switch (status) {
      case 'success':
        row.classList.add('status-success');
        indicator.innerHTML = `<span class="noto">${icons.success}</span>`;
        break;
      case 'failure':
        row.classList.add('status-failure');
        indicator.innerHTML = `<span class="noto">${icons.failure}</span>`;
        break;
      case 'pending':
      default:
        row.classList.add('status-pending');
        indicator.innerHTML = `<span class="noto">${icons.pending}</span>`;
        break;
    }
  }, totalDelay);
}


function onSave() {
  const allShiftsUnchecked = [...document.querySelectorAll('.shift-controls input[type="checkbox"]')].every(cb => !cb.checked);
  const allWeekdaysUnchecked = [...document.querySelectorAll('.weekday-controls input[type="checkbox"]')].every(cb => !cb.checked);


  console.log("onSave", allShiftsUnchecked, allWeekdaysUnchecked);
  /*
  if (allShiftsUnchecked || allWeekdaysUnchecked) {
    showWarningDialog(
      () => {
        // User confirmed saving despite no selection
        console.log("User confirmed save.");
        proceedWithSave();
      },
      () => {
        // User canceled, do nothing or focus back on UI
        console.log("User canceled save.");
      }
    );
  } else {
    proceedWithSave();
  }
  */
  proceedWithSave();
}

function proceedWithSave() {
  // Your actual save logic here
  console.log("Saving data...");
  // maybe update UI, localStorage, send data to backend, etc.
}

function getDefaultHolidayDates() {
  const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];

  const calendarMonthString = document.getElementById("calendar-month")?.textContent;
  const calendarMonth = monthNames.indexOf(calendarMonthString) + 1;
  const calendarYear = parseInt(document.getElementById("calendar-year")?.textContent, 10);

  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();

  if (currentYear < todayYear) {
    return { blocked: true };
  }

  let defaultMonth;

  if (currentYear === calendarYear) {
    defaultMonth = calendarMonth;
  } else if (currentYear === todayYear) {
    defaultMonth = todayMonth;
  } else {
    defaultMonth = 6; // July
  }

  const start = new Date(currentYear, defaultMonth, 1);
  const end = new Date(currentYear, defaultMonth + 1, 0);

  return {
    blocked: false,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10)
  };
}

function isOfficeClosed(dayIndex) {
  const openDays = loadOfficeDaysData();
  const value = openDays[dayIndex];
  return value === "never";
}

function getWeekdayIndex(date) {
  // JS: Sunday is 0 → convert to Monday=0
  return (date.getDay() + 6) % 7;
}

function addDays(date, numDays) {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + numDays);
  return newDate;
}

function formatDate(dateString) {
  if (!dateString) return "–";
  const [y, m, d] = dateString.split("-");
  return `${d}.${m}.${y}`;
}

function updatePreview(type, dateString) {
  const id = type === "start" ? "preview-start" : "preview-end";
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = formatDate(dateString);
}


function updateBridgeDaysForYear(year, state) {
  const holidays = getAllHolidaysForYear(year, state);
  const bridgeDays = findBridgeDays(holidays);

  console.log(holidays);
  console.log("[update Bridgedays");
  console.log(bridgeDays);

  const bridgeList = document.getElementById('bridge-days');
  if (!bridgeList) {
    console.warn('Bridge list container not found!');
    return;
  }

  bridgeList.innerHTML = ''; // Clear existing list

  bridgeDays.forEach(item => {
    const date = new Date(item.date);
    const li = document.createElement('li');

    const directionEmoji = item.context.includes("nach") ? "🔜" : "🔚";
    const holidayName = item.context.replace(/^Brückentag (nach|vor) /, "");
    const tooltip = `Brückentag ${item.context} (${holidayName})`;

    li.innerHTML = `
    <mark class="noto">🚧<mark> <span title="${tooltip}">
      ${formatDate(date)} ${directionEmoji}
    </span>
    <label>
      <input type="checkbox" data-bridge-day="${item.date}" checked>
    </label>
  `;

    bridgeList.appendChild(li);
  });
}

function restoreOfficeDaysUI(officeDays) {
  if (!Array.isArray(officeDays) || officeDays.length !== 7) {
    console.warn("Invalid officeDays array:", officeDays);
    return;
  }

  let globalShift = { early: true, day: true, late: true }; // will be used to find common shift checkboxes

  officeDays.forEach((key, index) => {
    const day = dayIds[index];
    const bools = Util.keyToBools(key);
    const el = document.querySelector(`.data-box[data-day="${day}"]`);
    const checkbox = document.getElementById(`input-weekday-${day}`);
    const lockIcon = el?.querySelector('.lock-icon'); // 🔍 get the lock icon inside the box

    if (!el || !checkbox) return;

    if (key !== "never") {
      checkbox.checked = true;
      el.classList.add("checked");
      lockIcon?.classList.add("unlocked");
    } else {
      checkbox.checked = false;
      el.classList.remove("checked");
      lockIcon?.classList.remove("unlocked");
    }

    const weekdayCheckbox = document.querySelector(
      `input[data-day="${key}"][data-type="weekday"]`
    );

    if (weekdayCheckbox) {
      // Only check if at least one shift is active
      const anyShift = bools.early || bools.day || bools.late;
      weekdayCheckbox.checked = anyShift;
      weekdayCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      console.warn(`Weekday checkbox not found for ${day}`);
    }

    // Combine shifts for global shift section (logical AND across all days)
    globalShift.early = globalShift.early && bools.early;
    globalShift.day = globalShift.day && bools.day;
    globalShift.late = globalShift.late && bools.late;
  });

  const shiftMatrix = convertShiftKeysToMatrix(officeDays);
  const shiftSelect = document.getElementById('shift-weekday');

  let displayShifts; // this will be { early: { emoji, status }, ... }

  switch (shiftSelect.value) {
    case "shift-all":
      displayShifts = analyzeShiftMatrix(shiftMatrix);
      break;

    case "shift-mon":
    case "shift-tue":
    case "shift-wed":
    case "shift-thu":
    case "shift-fri":
    case "shift-sat":
    case "shift-sun":
      const dayKey = shiftSelect.value.replace("shift-", "");
      const index = dayIds.indexOf(dayKey);
      const bools = shiftMatrix[index];

      displayShifts = {
        early: { emoji: bools.early ? '🔑' : '🔒', status: bools.early },
        day: { emoji: bools.day ? '🔑' : '🔒', status: bools.day },
        late: { emoji: bools.late ? '🔑' : '🔒', status: bools.late }
      };
      break;

    default:
      console.warn("Unknown shift select value:", shiftSelect.value);
      displayShifts = null;
  }


  ['early', 'day', 'late'].forEach(shift => {
    const checkbox = document.querySelector(`#input-shift-${shift}`);
    const { status, emoji } = displayShifts[shift];

    // ✅ 1. Update checkbox
    if (checkbox) {
      checkbox.checked = status; // true/false
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // ✅ 2. Update .lock-icon classes to reflect emoji state
    const lockIcons = document.querySelectorAll(`.lock-icon[data-lock-key="${shift}"]`);
    lockIcons.forEach(icon => {
      icon.classList.remove('unlocked', 'ambigious'); // reset

      if (emoji === '🔑') {
        icon.classList.add('unlocked');
      } else if (emoji === '⊖') {
        icon.classList.add('ambigious');
      }
      // 🔒 is default — no class needed
      const wrapper = checkbox.closest('.data-box');
      if (wrapper) {
        wrapper.classList.remove('ambigious');
        if (emoji === '⊖') {
          wrapper.classList.add('ambigious');
        }
      }
    });
  });


}
