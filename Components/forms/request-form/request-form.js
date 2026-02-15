import { loadRoleData } from '../../../js/loader/role-loader.js';
import { loadEmployeeData, filterEmployeesByEndDate, storeEmployeeChange } from '../../../js/loader/employee-loader.js';
import { loadOfficeDaysData, loadPublicHolidaysSimple, loadStateData } from '../../../js/loader/calendar-loader.js';
import { loadRequests, appendRequest, updateRequest, getAvailableRequestFiles, storeApproval } from '../../../js/loader/request-loader.js';
import { loadRuleData } from '../../../js/loader/rule-loader.js';
import { filterPublicHolidaysByYearAndState, getAllHolidaysForYear } from '../../../js/Utils/holidayUtils.js';
import { createHelpButton } from '../../../js/Utils/helpPageButton.js';
import { createWindowButtons } from '../../../js/Utils/minMaxFormComponent.js';
import { createDataModeToggle } from '../../../js/Utils/DataMode-select.js';
import { recalcWarnings, resetWarnings, setRuleCheckInfo } from "./request-warnings.js";
import { createDateRangePicker } from '../../../Components/customDatePicker/customDatePicker.js';
import { createSaveButton } from '../../../js/Utils/saveButton.js';
import { executeRulechecker, computeRequestDelta } from '../rule-form/ruleChecker.js';
import { ensureCalendarReady, computeAttendanceForRange } from '../../calendar/calendar.js';

let requestYear = 2000;
let api;
let currentEmployee;
let allRequests = [];
let requestEmployees = [];
let officeDays = [];
let publicHolidays = [];
let federalState = '';
let saveButtonHeader;
let filtersInitialized = false;
let draftRuleCheckTimer = null;
let sanityListenerInitialized = false;
let calendarJumpTimer = null;
let baselineViolations = new Map(); // Maps request ID -> violations count
let baselineViolationDetails = new Map(); // Maps request ID -> warning lines
let requestBeingEdited = null;
let cachedRoles = [];
let rules = [];

const rankEmojis = {
  1: "📝",   // Hint / minor
  2: "⚠️",   // Major
  3: "⚠️",   // Major (different rank, same emoji)
  4: "🛑",   // Critical
  5: "🚨"    // Critical / urgent
};

const autoApprovedTypes = ["sik", "spe", "but", "par"];
const hintOnlyTypes = ["hom"]; // gets a soft "info" hint

const newRequest = {
  id: "",                  // Unique ID (timestamp when request was made)
  employeeID: "",          // Employee ID
  vacationType: "vac",        // Type of leave (was: DayOffType)
  start: "",               // Start date
  end: "",                 // End date
  shift: "",               // Shift day (true = half-day)
  requesterMSG: "",        // Optional message from requester
  approverMSG: "",         // Optional message from approver
  status: "pending",       // 'pending', 'approved', 'rejected'
  decisionDate: "",        // When it was approved/rejected
  requestedAt: "",         // formated date dd,mm,yyyy
}

function resetNewRequest() {
  newRequest.id = "";                  // Unique ID (timestamp when request was made)
  newRequest.employeeId = "";          // Employee ID
  newRequest.vacationType = "vac";     // Type of leave (was: DayOffType)
  newRequest.startDate = "";               // Start date
  newRequest.endDate = "";                 // End date
  newRequest.shift = "";               // Shift day (true = half-day)
  newRequest.requesterMSG = "";        // Optional message from requester
  newRequest.approverMSG = "";         // Optional message from approver
  newRequest.status = "pending";       // 'pending', 'approved', 'rejected'
  newRequest.decisionDate = "";        // When it was approved/rejected
  newRequest.daysRequested = 0;        // Raw days requested (before adjustments)
  newRequest.daysDeducted = 0;         // Adjusted days deducted (was: days)
  newRequest.requestedAt = "";         // Timestamp when the request was created
}

let mode = 'create';

export async function initializeRequestForm(passedApi) {
  api = passedApi;
  if (!api) console.error("Api was not passed ==> " + api);

  try {
    officeDays = await loadOfficeDaysData(api);
  } catch (err) {
    console.warn("⚠️ Failed to load office days:", err);
    officeDays = [];
  }

  cachedRoles = await loadRoleData(api);

  try {
    requestEmployees = await loadEmployeeData(api);
  } catch (err) {
    console.error("❌ Failed to load employees:", err);
    requestEmployees = [];
  }

  try {
    federalState = await loadStateData(api);
  } catch (err) {
    console.error("❌ Failed to load federal state:", err);
    federalState = '';
  }

  publicHolidays = await loadPublicHolidaysSimple(api);

  const formContainer = document.getElementById('form-container');
  if (!formContainer) return console.error("Form container not found");
  formContainer.innerHTML = '';

  try {
    const response = await fetch('Components/forms/request-form/request-form.html');
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    formContainer.innerHTML = await response.text();
  } catch (err) {
    console.error(`Failed to load request form HTML: ${err}`);
    return;
  }

  const yearFilter = document.getElementById('request-year');
  requestYear = parseInt(localStorage.getItem('RequestListDate'), 10) || new Date().getFullYear();
  if (yearFilter) {
    yearFilter.value = requestYear;
    yearFilter.title = "Jahr für Antragsliste wählen";
    yearFilter.addEventListener('change', async () => {
      const selectedYear = parseInt(yearFilter.value, 10) || new Date().getFullYear();
      localStorage.setItem('RequestListDate', selectedYear);
      requestYear = selectedYear;
      await loadAndRenderRequests();
      updateFilterButtons();
    });
  }
  const clearBtn = document.getElementById("clear-filters-btn");
  if (clearBtn) {
    clearBtn.replaceWith(clearBtn.cloneNode(true));
    document
      .getElementById("clear-filters-btn")
      .addEventListener("click", clearAllFilters);
  }

  const createRequestBtn = document.getElementById("create-request-mode-btn");
  const approveRequestBtn = document.getElementById("approve-request-mode-btn");
  const decisionContainer = document.getElementById("request-enter-container");
  const requestEnter = document.getElementById("decision");

  const switchMode = async (mode) => {

    if (mode === "approve") {
      createRequestBtn.classList.replace("inactive", "active");
      approveRequestBtn.classList.replace("active", "inactive");
      requestEnter.classList.replace("inactive", "active");
      decisionContainer.classList.replace("active", "inactive");
      if (saveButtonHeader) saveButtonHeader.el.classList.add('hidden');
      initDecisionEventListener();
      initFilterListener();
      initFunnelButtons();
      initSingleClearFilterButtons();
      updateFilterButtons();

      await loadAndRenderRequests();
    } else {
      if (saveButtonHeader) {
        saveButtonHeader.el.classList.remove('hidden');
        if (localStorage.getItem('dataMode') !== 'sample') saveButtonHeader.setState('blocked');
        else saveButtonHeader.setState('is-readonly');
      }
      createRequestBtn.classList.replace("active", "inactive");
      approveRequestBtn.classList.replace("inactive", "active");
      requestEnter.classList.replace("active", "inactive");
      decisionContainer.classList.replace("inactive", "active");

      renderRequesterList();
      initRequestEventListener();
      await loadAndRenderRequests(); // make sure requests use latest data
    }
  };

  createRequestBtn.addEventListener("click", async () => {
    localStorage.setItem('requestForm_lastTab', 'create');
    await switchMode("create");
  });

  approveRequestBtn.addEventListener("click", async () => {
    localStorage.setItem('requestForm_lastTab', 'approve');
    await switchMode("approve");
  });

  const lastTab = localStorage.getItem('requestForm_lastTab') || 'approve';
  await switchMode(lastTab);

  updateDivider("bg-request");
  resetRequestWarnings();
  updateFilterButtons();
}

function getRequestMonth(request) {
  if (!request?.start) return null;

  const date =
    request.start instanceof Date
      ? request.start
      : new Date(request.start);

  if (isNaN(date)) return null;

  return String(date.getMonth() + 1).padStart(2, "0");
}

function handleFilterChange(e) {
  const filteredRequests = filterRequests(allRequests);
  renderRequestsTable(filteredRequests);
  updateFilterButtons();
}

function initFilterListener() {
  const statusFilter = document.getElementById("status-filter");
  const employeeFilter = document.getElementById("requester-filter");
  const typeFilter = document.getElementById("decision-type-select");
  const monthFilter = document.getElementById("month-filter");

  [statusFilter, employeeFilter, typeFilter, monthFilter].forEach(select => {
    if (!select) return;
    select.removeEventListener("change", handleFilterChange);
    select.addEventListener("change", (e) => handleFilterChange(e));
  });
}

function switchVacationType(ev) {
  const select = ev.target;
  const option = select.selectedOptions[0];

  if (!option || option.value === 'none') return;

  const emoji = option.dataset.emoji;
  const label = option.dataset.label;

  const emojiSpan = document.getElementById('vacation-type-emoji');
  emojiSpan.innerHTML = emoji;
  emojiSpan.classList.add('noto');

  const originalText = option.innerHTML;
  option.innerHTML = label;

  select.addEventListener(
    'mousedown',
    () => {
      option.innerHTML = originalText;
    },
    { once: true }
  );

  newRequest.type = option.value;
  recalcWarnings(saveButtonHeader, cachedRoles, allRequests, rules, requestEmployees);
}

function resetRequestWarnings() {
  resetNewRequest();
  resetRequestForm();
  recalcWarnings(saveButtonHeader, cachedRoles, allRequests, rules, requestEmployees);
  updateDurationPreview();
}

function updateDivider(className) {
  const divider = document.getElementById('horizontal-divider-box');
  divider.innerHTML = '';
  divider.className = className;

  const leftGap = document.createElement('div');
  leftGap.className = 'left-gap';

  const h2 = document.createElement('h2');
  h2.id = 'role-form-title';
  h2.innerHTML = `<span class="noto">📋</span> Urlaubsanträge stellen & genehmigen <span class="noto">✍🏻</span>`;

  const buttonContainer = document.createElement('div');
  buttonContainer.id = 'form-buttons';

  const helpBtn = createHelpButton('chapter-requests');
  helpBtn.setAttribute('aria-label', 'Hilfe öffnen für Rollen-Formular');

  saveButtonHeader = createSaveButton({
    onSave: () => storeAllRequests(api)
  });
  saveButtonHeader.el.id = 'new-request-save-btn';

  const windowBtns = createWindowButtons();

  const refreshBtn = document.createElement('button');
  refreshBtn.id = "refresh-request-form";
  refreshBtn.classList.add('noto', 'button');
  refreshBtn.textContent = '⟳';
  refreshBtn.title = "Formular auffrischen";
  refreshBtn.setAttribute('aria-label', 'Formular auffrischen');
  refreshBtn.addEventListener('click', async () => {
    await initializeRequestForm(api);
  });

  const dataModeToggle = createDataModeToggle({
    onChange: (val) => {
    }
  });

  buttonContainer.append(
    saveButtonHeader.el,
    refreshBtn,
    helpBtn,
    dataModeToggle,
    windowBtns
  );

  divider.append(leftGap, h2, buttonContainer);
}

async function storeAllRequests(api) {
  try {
    await runDraftRequestRuleCheck();
  } catch (err) {
    console.warn('Final draft rule check failed:', err);
  }

  storeRequest(api);
  if (localStorage.getItem('dataMode') !== 'sample') saveButtonHeader.setState('blocked');
  else saveButtonHeader.setState('readonly');
}

function initDatePickers() {
  createDateRangePicker({
    startButton: "#pick-request-start",
    endButton: "#pick-request-end",
    startInput: "#request-start-picker",
    endInput: "#request-end-picker",
    previewStart: "#request-preview-start",
    previewEnd: "#request-preview-end",
    previewDuration: "#request-durration",
    onChange: handleDateChange
  });
}

let isHandlingDate = false;

function handleDateChange() {
  if (isHandlingDate) return;
  isHandlingDate = true;

  const start = document.querySelector("#request-start-picker")?.value;
  let end = document.querySelector("#request-end-picker")?.value;

  const durationEl = document.querySelector("#request-durration");
  const unitEl = document.querySelector("#request-duration-unit");
  const halfDayCheckbox = document.querySelector("#request-halfDay");

  if (!start) {
    durationEl.textContent = "";
    halfDayCheckbox.checked = false;
    halfDayCheckbox.disabled = true;
    return;
  }

  let days;
  if (!end) {
    end = start;
    days = 1;
  } else {
    days = calculateDaysOff(start, end);
  }

  if (days === 1) {
    halfDayCheckbox.disabled = false;
  } else {
    halfDayCheckbox.checked = false;
    halfDayCheckbox.disabled = true;
  }

  let effectiveDays = days;
  if (days === 1 && halfDayCheckbox.checked) {
    effectiveDays = 0.5;
  }

  durationEl.textContent = effectiveDays;
  unitEl.textContent = effectiveDays === 1
    ? "Tag"
    : "Tage";

  fireWarnings();

  if (start && end) {
    scheduleCalendarJump(start, end);
  }

  const event = new Event('change', { bubbles: true });
  document.getElementById('request-end-picker')?.dispatchEvent(event);

  isHandlingDate = false;
}


function calculateDaysOff(startDate, endDate, federalState) {
  if (!startDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate || startDate); // default: single-day request

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (isNaN(start) || isNaN(end) || start > end) return 0;

  const year = start.getFullYear();

  let allHolidays = [];
  try {
    allHolidays = getAllHolidaysForYear(year, federalState) || [];
  } catch (err) {
    console.warn("Failed to get holidays:", err);
  }

  const holidayDates = allHolidays
    .filter(h => h.isOpen === false)
    .filter(h => !federalState || h.bundesländer?.includes(federalState))
    .map(h => h.date || "");

  let employee = currentEmployee;
  const employeeIdRaw = document.getElementById("requester-select")?.value;

  if (!employee && employeeIdRaw) {
    const id = isNaN(employeeIdRaw) ? employeeIdRaw : Number(employeeIdRaw);
    employee = requestEmployees.find(emp => emp.id === id);
  }

  if (!employee) return 0; // no employee selected yet

  const employeeWorkdays = employee.workDays || [1, 1, 1, 1, 1, 0, 0]; // fallback Mon–Fri

  const yearLimit = new Date(year, 11, 31);
  yearLimit.setHours(0, 0, 0, 0);

  const finalDate = end > yearLimit ? yearLimit : end;

  let countedDays = 0;
  const d = new Date(start);
  let iterations = 0;

  while (d <= finalDate && iterations < 366) {
    const dayOfWeek = d.getDay(); // 0=Sun, 6=Sat
    const scheduled = employeeWorkdays[dayOfWeek] !== "never";

    const iso = d.toLocaleDateString("en-CA"); // YYYY-MM-DD
    const isHoliday = federalState ? holidayDates.includes(iso) : false;

    if (scheduled && !isHoliday) countedDays++;

    d.setDate(d.getDate() + 1);
    iterations++;
  }

  return countedDays;
}

function createDurationMessage(startDate, endDate, employee, vacationType, reducePTO = false) {
  const employeeWorkdays = employee.workDays;
  const effectiveDays = calculateDaysOff(startDate, endDate, employeeWorkdays);

  const typeLabels = {
    vac: "Urlaub",
    sik: "Genesung",
    spe: "Sonderurlaub",
    otc: "Ausgleichstag",
    but: "Geschäftsreise",
    par: "Elternzeit",
    hom: "Home-Office",
    unp: "unbezahlt"
  };

  const typeLabel = typeLabels[vacationType] || vacationType;
  let msg = `${effectiveDays}`;
  let msgUnit = ` Tage ${typeLabel}`;

  if (reducePTO) {
    switch (vacationType) {
      case 'vac':
        employee.remainingDaysOff -= effectiveDays;
        break;
      case 'otc':
        employee.overtime -= effectiveDays;
        break;
      case 'unp':
        const daysPerMonth = employeeWorkdays.filter(d => d !== 'never').length * 4;
        const claimLoss = Math.floor((employee.availableDaysOff / 12) * (effectiveDays / daysPerMonth));
        employee.availableDaysOff -= claimLoss;
        msg += ` (geschätzter Urlaubsanspruchsverlust: ${claimLoss} Tage)`;
        break;
    }

    storeEmployeeChange(api, employee, "update");
  }
  return { msg, msgUnit };
}

function renderRequesterList() {
  const requesterSelect = document.getElementById('requester-select');
  requesterSelect.classList.add("noto");

  requesterSelect.innerHTML = '';

  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';                  // no value
  placeholderOption.innerText = 'Mitarbeiter wählen';
  placeholderOption.selected = true;             // default visible
  placeholderOption.disabled = true;             // prevents selecting again
  requesterSelect.appendChild(placeholderOption);

  const validEmployees = filterEmployeesByEndDate(requestEmployees);
  validEmployees.forEach(employee => {
    if (['⊖', 'keine', '?', 'name'].includes(employee.personalEmoji)) return;

    const opt = document.createElement('option');
    const roleColor = getComputedStyle(document.body)
      .getPropertyValue(`--role-${employee.mainRoleIndex}-color`);

    opt.style.backgroundColor = roleColor;
    opt.classList.add("noto");
    opt.innerHTML = `${employee.personalEmoji} ⇨ ${employee.name}`;
    opt.title = employee.name;
    opt.value = employee.id;
    opt.dataset.displayName = employee.name;

    requesterSelect.appendChild(opt);
  });
}

function initRequestEventListener() {

  const requesterSelection = document.getElementById('requester-select');
  requesterSelection.addEventListener("change", (ev) => {
    switchRequester(ev);
    fireWarnings();
  });

  const requestTypeSelect = document.getElementById('request-type-select');
  requestTypeSelect.addEventListener("change", (ev) => {
    updateRequestType(ev);
    switchVacationType(ev);
    fireWarnings();
  });


  const requestShiftMorning = document.getElementById('request-morning');
  const requestShiftafternoon = document.getElementById('request-morning');

  const requesterMSG = document.getElementById('multiline-input');
  requesterMSG.addEventListener('keydown', (ev) => handleRequestMSG(ev));

  initDatePickers();
  initRequestSanityListener();

}

function isValidDate(dateString) {

  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;

  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

function scheduleCalendarJump(start, end, options = {}) {
  if (!start) return;
  if (calendarJumpTimer) clearTimeout(calendarJumpTimer);
  calendarJumpTimer = setTimeout(() => {
    calendarJumpTimer = null;
    jumpCalendarToRange(start, end, options);
  }, 180);
}

async function jumpCalendarToRange(start, end, options = {}) {
  if (!isValidDate(start)) return;

  try {
    await ensureCalendarReady(api);
  } catch (err) {
    console.warn("Calendar not ready for jump:", err);
    return;
  }

  const jumper = window.calendarJump;
  if (!jumper || typeof jumper.toDate !== 'function') return;

  if (end && isValidDate(end) && typeof jumper.toRange === 'function') {
    jumper.toRange(start, end, options);
  } else {
    jumper.toDate(start, options);
  }
}

function storeRequest() {

  const requestToStore = {};

  const startInput = document.getElementById('request-start-picker')?.value || "";
  const endInput = document.getElementById('request-end-picker')?.value || "";
  const previewStart = document.getElementById('request-preview-start')?.textContent || "";
  const previewEnd = document.getElementById('request-preview-end')?.textContent || "";

  requestToStore.start = startInput || parsePreviewDate(previewStart);
  requestToStore.end = endInput || parsePreviewDate(previewEnd);

  if (!requestToStore.start || !requestToStore.end) {
    console.error("❌ Invalid start/end dates:", previewStart, previewEnd);
    showError("Bitte wählen Sie gültige Start- und Enddaten");
    return;
  }

  requestToStore.employeeID = parseInt(document.getElementById('requester-select').value, 10) || currentEmployee?.id || "";
  requestToStore.id = Date.now().toString() + Math.floor(Math.random() * 1000).toString();
  requestToStore.requestedAt = new Date().toISOString().split('T')[0];
  requestToStore.requesterMSG = document.getElementById('multiline-input').value;
  requestToStore.shift = "full";
  requestToStore.status = "pending";
  requestToStore.vacationType = document.getElementById('request-type-select').value;
  requestToStore.approverMSG = "";
  requestToStore.decisionDate = "";
  requestToStore.effectiveDays = document.getElementById('request-durration').textContent;

  const date = new Date(requestToStore.start);
  const year = date.getFullYear();

  if (autoApprovedTypes.includes(requestToStore.vacationType)) {
    requestToStore.status = "approved";
    requestToStore.decisionDate = new Date().toISOString().split('T')[0];
    requestToStore.approverMSG = "Automatisch genehmigt";
  }

  if (isNaN(date)) {
    console.error("❌ Invalid startDate:", requestToStore.startDate);
    showError("Bitte wählen Sie ein gültiges Startdatum");
    return;
  }

  try {
    appendRequest(api, Number(year), requestToStore);
    resetRequestWarnings();
  } catch (err) {
    console.error(err);
    showError("Failed to save request to disk");
  }
  updateDurationPreview(true);
}

function handleRequestMSG(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    newRequest.msg = event.target.value;
  }
}

function resetRequestForm() {
  document.getElementById('request-type-select').selectedId = '0';
  document.getElementById('multiline-input').value = "";
  document.getElementById('request-vacation-left').innerHTML = "XX";
  document.getElementById('request-vacation-total').innerHTML = "XX";
  document.getElementById('request-vacation-used').innerHTML = "XX";
  document.getElementById('request-overtime').innerHTML = "X";
  document.getElementById('pick-request-start').value = "";
  document.getElementById('pick-request-end').value = "";
  document.getElementById('requester-emoji').innerHTML = "⊖";
  document.getElementById('requester-emoji').style.backgroundColor = "white";
  document.getElementById('vacation-type-emoji').innerHTML = "⊖";
  document.getElementById('vacation-type-emoji').style.backgroundColor = "white";
}

function switchRequester(ev) {
  const select = ev.target;
  const selectedId = select.value;
  const selectedOption = select.selectedOptions[0];
  let newRequester = requestEmployees.find(emp => emp.id == selectedId);

  if (selectedId === 'xy') {
    currentEmployee = null;
    newRequest.employeeID = null;

    document.getElementById('requester-emoji').innerHTML = '⊖';
    document.getElementById('request-vacation-left').innerHTML = 'xx';
    document.getElementById('request-vacation-total').innerHTML = 'xx';
    document.getElementById('request-vacation-used').innerHTML = "xx";
    document.getElementById('request-overtime').innerHTML = 'xx';

    recalcWarnings(saveButtonHeader, cachedRoles, allRequests, rules, requestEmployees);
    return;
  }

  currentEmployee = newRequester;
  newRequest.employeeID = newRequester.id; // ✅ updated line

  const requesterEmoji = document.getElementById('requester-emoji');
  requesterEmoji.innerHTML = newRequester.personalEmoji;
  const roleColor = getComputedStyle(document.body)
    .getPropertyValue(`--role-${newRequester.mainRoleIndex}-color`);
  requesterEmoji.style.backgroundColor = roleColor;
  requesterEmoji.classList.add("noto");

  const total = newRequester.availableDaysOff;
  const remaining = newRequester.remainingDaysOff;
  const used = total - remaining;

  document.getElementById('request-vacation-total').innerHTML = total;
  document.getElementById('request-vacation-left').innerHTML = remaining;
  document.getElementById('request-vacation-used').innerHTML = used;

  document.getElementById('request-overtime').innerHTML = newRequester.overtime;

  newRequest.id = Date.now();
  const formattedDate = formatDate(newRequest.id);
  newRequest.requestedAt = formattedDate;
  document.getElementById('request-id').innerHTML = formattedDate;

  document.getElementById('request-type-select').focus();
  updateDurationPreview();

  const originalText = selectedOption.innerHTML;
  const nameOnly = selectedOption.dataset.displayName;

  selectedOption.innerHTML = nameOnly;

  select.addEventListener('mousedown', () => {
    selectedOption.innerHTML = originalText;
  }, { once: true });
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function updateRequestType(event) {
  const selectedType = event.target.value;
  checkAutoApprovalWarning(selectedType);
  recalcWarnings(saveButtonHeader, cachedRoles, allRequests, rules, requestEmployees);
}

async function loadAndRenderRequests() {
  const yearInput = document.getElementById('request-year');
  const year = yearInput && !isNaN(parseInt(yearInput.value, 10))
    ? parseInt(yearInput.value, 10)
    : new Date().getFullYear();

  let validFiles = [];
  try {
    validFiles = await getAvailableRequestFiles(api);
  } catch (err) {
    console.warn("⚠️ Could not fetch available request files:", err);
  }

  let requests = [];

  if (!validFiles || validFiles.length === 0) {
    console.warn("⚠️ No valid request files found — loading sample or placeholder data");
    requests = await loadRequests(api, year);
  } else {
    const fileForYear = validFiles.find(f => f.year === year);
    if (fileForYear) {
      requests = await loadRequests(api, year);
    } else {
      console.warn(`ℹ️ No file found for ${year}, returning placeholder`);
      requests = [{ info: `Noch keine Anträge für ${year} gestellt` }];
    }
  }

  allRequests = requests.filter(r => r.start && r.employeeID);

  await establishBaselineViolations();
  await updateRequestRuleWarnings(allRequests);
  await computePendingRequestWhatIfDeltas(allRequests);

  initRequestsOnce(allRequests);
  renderRequestsTable(allRequests);
}

function filterRequests(requests) {
  const filters = {
    status: document.getElementById("status-filter")?.value || 'all',
    employee: document.getElementById("requester-filter")?.value || 'all',
    type: document.getElementById("decision-type-select")?.value || 'all',
    month: document.getElementById("month-filter")?.value || 'all',
  };

  if (filters.employee === 'all' &&
    filters.type === 'all' &&
    filters.month === 'all' &&
    filters.status === 'all') {
    return requests;
  }

  return requests.filter(request => {

    if (filters.employee !== "all" && String(request.employeeID) !== filters.employee) return false;
    if (filters.type !== "all" && request.vacationType !== filters.type) return false;
    if (filters.month !== "all") {
      const requestMonth = getRequestMonth(request);
      if (requestMonth !== filters.month) {
        return false;
      }
    }
    if (filters.status !== "all" && request.status !== filters.status) return false;

    return true;
  });
}

function initSingleClearFilterButtons() {
  document.querySelectorAll(".clear-filter").forEach(btn => {
    // Remove old listener to prevent duplicates
    btn.removeEventListener("click", handleClearFilterClick);
    btn.addEventListener("click", handleClearFilterClick);
  });
}


function handleClearFilterClick(e) {
  e.preventDefault();
  e.stopPropagation();

  const btn = e.currentTarget;

  const targetId = btn.dataset.target;
  if (!targetId) return;

  const filterEl = document.getElementById(targetId);
  if (!filterEl) return;

  filterEl.value = "all";

  filterEl.dispatchEvent(new Event('change', { bubbles: true }));
}

function updateFilterButtons() {
  document.querySelectorAll(".filter-wrapper").forEach(wrapper => {
    const select = wrapper.querySelector("select");
    const funnelBtn = wrapper.querySelector(".funnel"); // Your funnel button has class "funnel"
    const clearBtn = wrapper.querySelector(".clear-filter"); // Your clear button has class "clear-filter"

    if (!select || !funnelBtn || !clearBtn) return;

    const isDefault = select.value === "all";

    funnelBtn.classList.toggle("hidden", !isDefault); // Hide funnel when NOT default
    clearBtn.classList.toggle("hidden", isDefault); // Hide clear when default
  });
}

function initFunnelButtons() {
  document.querySelectorAll(".funnel").forEach(btn => {
    btn.removeEventListener("click", handleFunnelClick);
    btn.addEventListener("click", handleFunnelClick);
  });
}

function handleFunnelClick(e) {
  e.preventDefault();
  e.stopPropagation();

  const btn = e.currentTarget;
  const wrapper = btn.closest('.filter-wrapper');
  if (!wrapper) return;

  const select = wrapper.querySelector('select');
  if (!select) return;

  select.showPicker();
}

function clearAllFilters() {
  ["status-filter", "requester-filter", "decision-type-select", "month-filter"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = 'all';
  });

  handleFilterChange();
  updateFilterButtons();
}

function initDecisionEventListener() {

  document.querySelectorAll("select").forEach(select => {
    select.addEventListener("change", (e) => {
      if (e.target.value !== "all") {
        document.querySelectorAll("select").forEach(otherSelect => {
          if (otherSelect !== e.target) {
          }
        });
      }
    });
  });
}

function renderRequestsTable(requests) {

  const tbody = getTableBody();
  if (!tbody) return;

  clearTable(tbody);

  initAllRequests(requests);

  const filters = collectAvailableFilters(allRequests);
  initFiltersOnce(filters);

  if (requests.length === 0) {
    renderEmptyState(tbody);
    return;
  }

  requests.forEach(request => {
    const row = createRequestRow(request);
    tbody.appendChild(row);
  });

  setupTableEvents();
  initSingleClearFilterButtons()
  updateFilterAvailability(requests);
}

function getTableBody() {
  return document.querySelector("#decision-table tbody");
}

function clearTable(tbody) {
  tbody.innerHTML = "";
}

function renderEmptyState(tbody) {
  tbody.innerHTML = `
    <tr>
      <td colspan="9" class="text-center">
        No pending requests to display.
      </td>
    </tr>`;
}

function initAllRequests(requests) {
  if (allRequests.length > 0) return;

  allRequests = requests.filter(isValidRequest);
}

function isValidRequest(request) {
  if (!request || !request.start || !request.employeeID) {
    console.warn("Skipping non-request object:", request);
    return false;
  }
  return true;
}

function collectAvailableFilters(requests) {
  const filters = {
    employees: new Set(),
    types: new Set(),
    months: new Set(),
    statuses: new Set(),
    warnings: new Set()
  };

  requests.forEach(request => {
    filters.employees.add(request.employeeID);
    filters.types.add(request.vacationType);
    filters.statuses.add(request.status);

    const month = getRequestMonth(request);
    if (month) {
      filters.months.add(month);
    }

    if (request.violations > 0) {
      filters.warnings.add(request.violations > 1 ? "multi" : "single");
    }
  });

  return filters;
}

function updateFilterAvailability(requests) {
  const filters = collectAvailableFilters(requests);
  toggleFilterOptions("requester-filter", new Set([...filters.employees].map(String)));
  toggleFilterOptions("decision-type-select", new Set([...filters.types].map(String)));
  toggleFilterOptions("month-filter", new Set([...filters.months].map(String)));
  toggleFilterOptions("status-filter", new Set([...filters.statuses].map(String)));
}

function initFiltersOnce(filters) {
  populateEmployeeFilter([...filters.employees]); // This will now preserve selection

  if (filtersInitialized) return;

  toggleFilterOptions("requester-filter", new Set([...filters.employees].map(String)));
  toggleFilterOptions("decision-type-select", new Set([...filters.types].map(String)));
  toggleFilterOptions("month-filter", new Set([...filters.months].map(String)));
  toggleFilterOptions("status-filter", new Set([...filters.statuses].map(String)));

  filtersInitialized = true;
}

function createRequestRow(request) {
  const row = document.createElement("tr");

  ensureEffectiveDays(request);

  const start = request.start || "";
  const end = request.end || "";
  const dateLabel = `${formatDateDMY(start)} bis\n${formatDateDMY(end)}`;
  const dateTitle = `Kalender öffnen: ${formatDateDMY(start)} bis ${formatDateDMY(end)}`;

  row.innerHTML = `
    <td class='noto flex-row-2'>${renderStatusCell(request)}</td>
    <td class='noto'>${renderEmployeeCell(request)}</td>
    <td class='noto'>${getVacationIcon(request.vacationType)}</td>
    <td>
      <button
        type="button"
        class="request-date-jump"
        data-start="${start}"
        data-end="${end}"
        title="${escapeAttr(dateTitle)}"
        aria-label="${escapeAttr(dateTitle)}"
      >${dateLabel}</button>
    </td>
    <td>${renderEffectiveDays(request)}</td>
    <td class='request-msg-cell'>${request.requesterMSG || ""}</td>
    <td class='noto approverCell'>${request.approverMSG || ""}</td>
    <td>${getWarningsIcon(request)}</td>
  `;

  if (request.status === "pending") {
    attachApproverTextarea(row, request);
  }

  return row;
}

function ensureEffectiveDays(request) {
  if (!request.start || !request.end) {
    request.effectiveDays = 1;
    return;
  }

  if (request.effectiveDays != null && !Number.isNaN(request.effectiveDays)) {
    return;
  }

  const employee = getEmployeeById(request.employeeID);
  if (!employee) {
    request.effectiveDays = 1;
    return;
  }

  const start = new Date(request.start);
  const end = new Date(request.end);

  request.effectiveDays = Math.max(
    1,
    calculateDaysOff(start, end, employee.workdays)
  );

}

function renderStatusCell(request) {
  if (request.status === "pending") {
    return `
      <div class="flex-row-2">
        <button class="noto approveButton" data-id="${request.id}">✅</button>
        <button class="noto rejectButton" data-id="${request.id}">❌</button>
      </div>`;
  }

  return request.status === "approved"
    ? `<span class="noto request-status-pill request-approved">✅ genehmigt</span>`
    : `<span class="noto request-status-pill request-rejected">❌ abgelehnt</span>`;
}

function renderEmployeeCell(request) {
  const employee = requestEmployees.find(e => e.id === request.employeeID);
  return `${employee?.personalEmoji || "⊖"} ${employee?.name || "Unbekannt"}`;
}

function renderEffectiveDays(request) {
  const unit = request.effectiveDays > 1 ? "Tage" : "Tag";
  return `${request.effectiveDays} ${unit}`;
}

function attachApproverTextarea(row, request) {
  const textarea = document.createElement("textarea");
  textarea.value = request.approverMSG || "";
  textarea.placeholder = "Enter approver message…";

  const year = getSelectedYear();
  let debounceTimer;

  textarea.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      storeApproval(api, request.id, textarea.value, null, year);
    }, 600);
  });

  const cell = row.querySelector(".approverCell");
  cell.innerHTML = "";
  cell.appendChild(textarea);
}

function getSelectedYear() {
  const input = document.getElementById("request-year");
  const year = parseInt(input?.value, 10);
  return isNaN(year) ? new Date().getFullYear() : year;
}

function initRequestsOnce(requests) {
  if (allRequests.length === 0) {
    allRequests = requests.filter(isValidRequest);
  }
}


function setupTableEvents() {
  const table = document.getElementById("decision-table");
  if (!table) return;
  table.removeEventListener("click", handleTableClick);
  table.addEventListener("click", handleTableClick);
}


function getEmployeeById(employeeId) {
  return requestEmployees.find(emp => emp.id === employeeId) ?? null;
}

function formatDateDMY(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date)) return dateStr; // fallback if invalid
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0'); // months 0-11
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

async function handleTableClick(e) {
  const jumpButton = e.target.closest(".request-date-jump");
  if (jumpButton) {
    const start = jumpButton.dataset.start;
    const end = jumpButton.dataset.end;
    scheduleCalendarJump(start, end, { focus: "start" });
    return;
  }

  const target = e.target;

  const yearInput = document.getElementById('request-year');
  const year = yearInput && !isNaN(parseInt(yearInput.value, 10))
    ? parseInt(yearInput.value, 10)
    : new Date().getFullYear();

  if (target.classList.contains("approveButton")) {
    const id = target.dataset.id;
    await storeApproval(api, id, null, "approved", year);
    await loadAndRenderRequests();
  }

  if (target.classList.contains("rejectButton")) {
    const id = target.dataset.id;
    await storeApproval(api, id, null, "rejected", year);
    await loadAndRenderRequests();
  }
}

function populateEmployeeFilter(availableEmployeeIDs) {
  const filterSelect = document.getElementById("requester-filter");
  if (!filterSelect) return;

  // Store current selection before rebuilding
  const currentSelection = filterSelect.value;

  filterSelect.innerHTML = "";

  const defaultOption = document.createElement('option');
  defaultOption.value = 'all';
  defaultOption.innerText = 'Alle Mitarbeiter';
  filterSelect.appendChild(defaultOption);

  const validEmployees = filterEmployeesByEndDate(requestEmployees);

  validEmployees.forEach(employee => {
    if (['⊖', 'keine', '?', 'name'].includes(employee.personalEmoji)) return;

    const option = document.createElement('option');
    const roleColor = getComputedStyle(document.body).getPropertyValue(
      `--role-${employee.mainRoleIndex}-color`
    );
    option.style.backgroundColor = roleColor;
    option.classList.add("noto");

    if (currentSelection === String(employee.id)) {
      option.innerText = `✓ ${employee.personalEmoji} ⇨ ${employee.name}`;
    } else {
      option.innerText = `${employee.personalEmoji} ⇨ ${employee.name}`;
    }

    option.title = employee.name;
    option.value = employee.id;

    if (!availableEmployeeIDs.includes(employee.id)) {
      option.style.opacity = "0.7";
      option.title += " (keine Anträge in diesem Jahr)";
    }

    filterSelect.appendChild(option);
  });

  filterSelect.value = currentSelection && currentSelection !== 'all' &&
    Array.from(filterSelect.options).some(opt => opt.value === currentSelection)
    ? currentSelection : 'all';
}

function toggleFilterOptions(filterId, availableValues) {
  const selectElement = document.getElementById(filterId);
  if (!selectElement) return;

  const options = selectElement.querySelectorAll("option");

  options.forEach(option => {
    const value = option.value;
    const isAvailable = value === "all" || availableValues.has(value);

    option.disabled = !isAvailable;
    option.style.opacity = isAvailable ? "" : "0.3";
    option.style.cursor = isAvailable ? "" : "not-allowed";
    option.style.color = "";
    option.style.fontStyle = "";
  });
}

function getVacationIcon(type) {
  const icons = {
    "vac": "🏖️ Urlaub", "spe": "🎁 Sonderurlaub", "otc": "⚖️ Ausgleichstag", "but": "🚕  Geschäftreise",
    "hom": "🏠 Home Office", "sho": "📐 Berufsschule", "sik": "💉 Genesung", "par": "🧸 Elternzeit", "unp": "💸 unbezahlt"
  };
  return icons[type] || "⊖";
}

function getWarningsIcon(request) {
  if (!request || request.status === 'rejected') return '';

  if (request.status === 'pending') {
    return buildPendingWarningBadges(request);
  }

  const delta = getDeltaViolations(request);

  if (delta > 1) {
    return buildWarningIconMarkup('🛑', getDeltaWarningsText(request, delta));
  }
  if (delta === 1) {
    return buildWarningIconMarkup('⚠️', getDeltaWarningsText(request, delta));
  }
  return '';
}

function getDeltaViolations(request) {
  if (!request || request.status === 'rejected') return 0;

  if (request.status === 'pending' && Number.isFinite(request.whatIfDeltaViolations)) {
    return Math.max(0, request.whatIfDeltaViolations);
  }

  const baseline = baselineViolations.get(request.id) || 0;
  const current = request.violations || 0;
  return Math.max(0, current - baseline);
}

function getDeltaWarningsText(request, delta) {
  if (!request || request.status === 'rejected') return '';
  if (delta === 0) return 'Keine neuen Regelverstöße';

  if (request.status === 'pending') {
    const pendingLines = Array.isArray(request.whatIfNewLines) ? request.whatIfNewLines : [];
    if (pendingLines.length > 0) {
      return `Neue Regelverstöße bei Genehmigung: ${delta}\n${pendingLines.slice(0, 3).join('\n')}${pendingLines.length > 3 ? `\nWeitere: ${pendingLines.length - 3}` : ''}`;
    }
    return `${delta} zusätzliche Regelverstöße bei Genehmigung`;
  }

  const baseline = baselineViolations.get(request.id) || 0;
  const baselineDetails = baselineViolationDetails.get(request.id) || [];
  const currentLines = request.ruleWarningLines || [];
  const newViolations = currentLines.filter(line =>
    !baselineDetails.includes(line)
  );

  if (newViolations.length > 0) {
    return `Neue Regelverstöße bei Genehmigung: ${delta}\n${newViolations.slice(0, 3).join('\n')}${newViolations.length > 3 ? `\nWeitere: ${newViolations.length - 3}` : ''}`;
  }

  return `${delta} zusätzliche Regelverstöße bei Genehmigung`;
}

function buildPendingWarningBadges(request) {
  const delta = getDeltaViolations(request);
  const lines = getPendingWarningLines(request, delta);

  if (delta <= 0 || lines.length === 0) {
    return `
      <div class="request-warning-list" aria-label="What-If Delta">
        <span class="request-warning-badge request-warning-none noto">✓ keine Änderung</span>
      </div>
    `;
  }

  const maxLines = 6;
  const visible = lines.slice(0, maxLines);
  const badges = visible
    .map(line => `<span class="request-warning-badge request-warning-add noto">${escapeHtml(line)}</span>`)
    .join('');

  const more = lines.length > maxLines
    ? `<span class="request-warning-badge request-warning-more noto">+${lines.length - maxLines} weitere</span>`
    : '';

  return `<div class="request-warning-list" aria-label="What-If Delta">${badges}${more}</div>`;
}

function getPendingWarningLines(request, delta) {
  const pendingLines = Array.isArray(request?.whatIfNewLines)
    ? request.whatIfNewLines.filter(Boolean)
    : [];

  if (pendingLines.length > 0) {
    return pendingLines;
  }

  if (delta > 0) {
    return [`+${delta} zusätzliche Regelverstöße`];
  }

  return [];
}

function buildWarningIconMarkup(icon, text) {
  const safeText = escapeAttr(text || '');
  return `<span class="warning-icon noto" role="img" aria-label="${safeText}" title="${safeText}">${icon}</span>`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '&#10;');
}

function approveRequest(id) {
  handleRequestUpdate(id, "approved");
}

function rejectRequest(id) {
  handleRequestUpdate(id, "rejected");
}

async function handleRequestUpdate(id, newState) {
  const approverMessage = document.getElementById("selected-approver-comments")?.value.trim() || "";
  const decisionDate = new Date().toLocaleDateString("de-DE");

  try {
    await updateRequest(api, id, {
      status: newState,
      approverMSG: approverMessage,
      decisionDate,
    });

    await loadAndRenderRequests();

  } catch (error) {
    console.error("Failed to update request:", error);
  }
}

export function updateDurationPreview(savePTOchange = false) {
  const startInput = document.getElementById("request-start-picker");
  const endInput = document.getElementById("request-end-picker");
  const durEl = document.getElementById("request-durration");
  const durElUnit = document.getElementById('request-duration-unit');
  const startEl = document.getElementById("request-preview-start");
  const endEl = document.getElementById("request-preview-end");

  const startVal = startInput?.value;
  const endVal = endInput?.value;
  const vacationType = document.getElementById("request-type-select")?.value;

  recalcWarnings(saveButtonHeader, cachedRoles, allRequests, rules, requestEmployees);
  if (!currentEmployee) {
    const idRaw = document.getElementById("requester-select").value;
    const id = isNaN(idRaw) ? idRaw : Number(idRaw);
    currentEmployee = requestEmployees.find(emp => emp.id === id);
  }
  if (!currentEmployee) {
    console.warn(" no current employee available to calculate vacation durration");
    return;
  }

  calculateDaysOff(startVal, endVal, currentEmployee.workDays, publicHolidays);

  startEl.textContent = startVal || "--.--";
  endEl.textContent = endVal || "--.--";

  if (!startVal) {
    durEl.textContent = "?";
    durElUnit.textContent = 'Tage';
    return;
  }

  if (!endVal) {
    durEl.textContent = "1";
    durElUnit.textContent = 'Tag';
    return;
  }

  const startDate = new Date(startVal);
  const endDate = new Date(endVal);

  if (endDate < startDate) {
    durEl.textContent = "❌";
    durElUnit.textContent = 'ungültig';
  } else if (!currentEmployee) {
    durEl.textContent = "?";
    durElUnit.textContent = 'Tage';
  } else {
    const message = createDurationMessage(
      startVal,
      endVal,
      currentEmployee,
      vacationType,
      savePTOchange
    );

    durEl.textContent = message.msg;
    durElUnit.textContent = message.msgUnit;
  }
  recalcWarnings(saveButtonHeader, cachedRoles, allRequests, rules, requestEmployees);
}

function checkAutoApprovalWarning(selectedType) {

  recalcWarnings(saveButtonHeader, cachedRoles, allRequests, rules, requestEmployees);
}

function showError(message) {
  let popup = document.createElement("div");
  popup.className = "request-popup-error noto";
  popup.textContent = message;
  document.body.appendChild(popup);

  setTimeout(() => popup.remove(), 2500); // disappears after 2.5s
}

export async function refundReservedDays(api, request) {
  const employee = getEmployeeById(request.employeeID);
  const effectiveDays = calculateDaysOff(request.startDate, request.endDate, employee.workDays);

  switch (request.vacationType) {
    case 'vac':
      employee.remainingDaysOff += effectiveDays;
      break;
    case 'otc':
      employee.overtime += effectiveDays;
      break;
    case 'unp':
      const daysPerMonth = employee.workDays.filter(d => d !== 'never').length * 4;
      const claimLoss = Math.floor((employee.availableDaysOff / 12) * (effectiveDays / daysPerMonth));
      employee.availableDaysOff += claimLoss;
      break;
  }

  await storeEmployeeChange(api, employee, "update");
}

function parsePreviewDate(previewText) {
  if (!previewText || previewText.includes("--")) return null;

  const parts = previewText.split(".");
  if (parts.length !== 3) return null;

  const [d, m, y] = parts;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`; // ISO format for storage
}

function fireWarnings() {
  recalcWarnings(saveButtonHeader, cachedRoles, allRequests, rules, requestEmployees);
}

async function updateRequestRuleWarnings(requests, options = {}) {
  const { extraRequests = [], isBaseline = false } = options;

  if (!Array.isArray(requests) || requests.length === 0) return;

  try {
    rules = await loadRuleData(api);
  } catch (err) {
    console.warn("⚠️ Failed to load rules for request warnings:", err);
    return;
  }

  const range = getRequestRange(requests);
  if (!range) return;

  let attendanceByDate = null;
  const calendarReady = await ensureCalendarReady(api);
  if (calendarReady) {
    attendanceByDate = await computeAttendanceForRange(range.start, range.end, { extraRequests });
  }

  let ruleStatsDelta;

  if (!isBaseline && requestBeingEdited) {
    ruleStatsDelta = await computeRequestDelta(requests, requestBeingEdited, {
      uiRules: rules,
      employees: requestEmployees,
      extraRequests
    });
  } else {
    const ruleStats = await executeRulechecker(range.start, range.end, requests, {
      uiRules: rules,
      employees: requestEmployees,
      includePending: true,
      attendanceByDate
    });

    ruleStatsDelta = {
      delta: ruleStats,
      baseline: ruleStats
    };
  }
  const statsForViolations = ruleStatsDelta?.futureStats || ruleStatsDelta?.delta || ruleStatsDelta;
  applyRequestViolations(requests, statsForViolations, { isBaseline });

  if (!isBaseline) {
    setRuleCheckInfo(buildRuleCheckInfo(ruleStatsDelta));
  }

}

export async function establishBaselineViolations() {

  const approvedRequests = allRequests.filter(req =>
    req && req.status === 'approved' && req.start && req.end
  );

  if (approvedRequests.length === 0) {
    baselineViolations.clear();
    baselineViolationDetails.clear();
    return;
  }

  await updateRequestRuleWarnings(approvedRequests, { isBaseline: true });

}

function buildRuleCheckInfo(ruleStatsDelta) {
  if (ruleStatsDelta?.baselineStats && ruleStatsDelta?.futureStats) {
    return {
      baselineStats: ruleStatsDelta.baselineStats,
      futureStats: ruleStatsDelta.futureStats
    };
  }

  if (ruleStatsDelta?.baseline && ruleStatsDelta?.delta) {
    return ruleStatsDelta;
  }

  if (ruleStatsDelta?.failures) {
    return {
      baseline: { failures: [] },
      delta: { failures: ruleStatsDelta.failures }
    };
  }

  return null;
}

function buildDraftRequestFromForm() {
  const requester = document.getElementById('requester-select')?.value;
  const startInput = document.getElementById('request-start-picker')?.value;
  const endInput = document.getElementById('request-end-picker')?.value;
  const previewStart = document.getElementById('request-preview-start')?.textContent || '';
  const previewEnd = document.getElementById('request-preview-end')?.textContent || '';
  const type = document.getElementById('request-type-select')?.value;

  const start = startInput || parsePreviewDate(previewStart);
  const end = endInput || parsePreviewDate(previewEnd);

  if (!requester || requester === '' || requester === 'xy') return null;
  if (!type || type === '' || type === 'none') return null;

  if (!start || !end) return null;

  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate) return null;

  const employee = requestEmployees.find(emp => emp.id == requester);
  if (!employee) return null;

  const durationEl = document.querySelector("#request-durration");
  const effectiveDays = durationEl?.textContent ? parseFloat(durationEl.textContent) : 1;

  if (effectiveDays <= 0) return null;

  return {
    id: `draft_${Date.now()}`,
    employeeID: parseInt(requester, 10),
    start,
    end,
    shift: 'full',
    status: 'pending',
    vacationType: type,
    effectiveDays: effectiveDays,
    isDraft: true
  };
}

async function runDraftRequestRuleCheck() {
  const draft = buildDraftRequestFromForm();
  if (!draft) {
    requestBeingEdited = null;
    setRuleCheckInfo(null);
    return;
  }

  requestBeingEdited = draft;

  const approvedRequests = allRequests.filter(req =>
    req && req.status === 'approved' && req.start && req.end
  );

  const requests = [...approvedRequests, draft];

  if (baselineViolations.size === 0 && approvedRequests.length > 0) {
    await updateRequestRuleWarnings(approvedRequests, { isBaseline: true });
  }

  try {
    await updateRequestRuleWarnings(requests, { extraRequests: [draft] });
  } finally {
    requestBeingEdited = null;
  }
}

function scheduleDraftRuleCheck() {
  if (draftRuleCheckTimer) clearTimeout(draftRuleCheckTimer);
  draftRuleCheckTimer = setTimeout(async () => {
    draftRuleCheckTimer = null;
    try {
      await runDraftRequestRuleCheck();
    } catch (err) {
      console.warn('Draft rule check failed:', err);
    }
  }, 250);
}

function initRequestSanityListener() {
  if (sanityListenerInitialized) return;

  const requesterSelect = document.getElementById('requester-select');
  const requestTypeSelect = document.getElementById('request-type-select');
  const startPicker = document.getElementById('request-start-picker');
  const endPicker = document.getElementById('request-end-picker');

  function isFormReadyForValidation() {
    const requester = requesterSelect?.value;
    const type = requestTypeSelect?.value;
    const start = startPicker?.value;
    const end = endPicker?.value;
    const durationEl = document.querySelector("#request-durration");
    const effectiveDays = durationEl?.textContent ? parseFloat(durationEl.textContent) : 0;

    return requester &&
      requester !== '' &&
      requester !== 'xy' &&
      type &&
      type !== '' &&
      type !== 'none' &&
      start &&
      end &&
      effectiveDays > 0;
  }

  let validationTimer = null;
  function triggerValidationIfReady() {
    if (validationTimer) clearTimeout(validationTimer);

    validationTimer = setTimeout(() => {
      validationTimer = null;

      const createTab = document.getElementById('create-request-mode-btn');
      if (!createTab || !createTab.classList.contains('active')) return;

      if (isFormReadyForValidation()) {
        scheduleDraftRuleCheck();
      }
    }, 500);
  }

  if (requesterSelect) {
    requesterSelect.removeEventListener('change', triggerValidationIfReady);
    requesterSelect.addEventListener('change', triggerValidationIfReady);
  }

  if (requestTypeSelect) {
    requestTypeSelect.removeEventListener('change', triggerValidationIfReady);
    requestTypeSelect.addEventListener('change', triggerValidationIfReady);
  }

  if (startPicker) {
    startPicker.removeEventListener('change', triggerValidationIfReady);
    startPicker.addEventListener('change', triggerValidationIfReady);
  }

  if (endPicker) {
    endPicker.removeEventListener('change', triggerValidationIfReady);
    endPicker.addEventListener('change', triggerValidationIfReady);
  }

  const halfDayCheckbox = document.querySelector("#request-halfDay");
  if (halfDayCheckbox) {
    halfDayCheckbox.removeEventListener('change', triggerValidationIfReady);
    halfDayCheckbox.addEventListener('change', triggerValidationIfReady);
  }

  sanityListenerInitialized = true;
}

export function getRequestRange(requests) {
  let min = null;
  let max = null;

  requests.forEach(req => {
    const start = normalizeDate(req.start);
    const end = normalizeDate(req.end);
    if (!start || !end) return;

    if (!min || start < min) min = start;
    if (!max || end > max) max = end;
  });

  if (!min || !max) return null;
  return { start: min, end: max };
}

export function normalizeDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function applyRequestViolations(requests, ruleStats, options = {}) {
  const { isBaseline = false } = options;

  if (!Array.isArray(requests)) return;

  let failures = [];
  if (ruleStats && Array.isArray(ruleStats.failures)) {
    failures = ruleStats.failures;
  } else if (Array.isArray(ruleStats)) {
    failures = ruleStats;
  }

  const dailyFailures = failures.filter(f => f && f.scope === 'daily' && f.date);
  const weeklyFailures = failures.filter(f =>
    f && f.scope === 'weekly' && f.weekStart && f.weekEnd
  );

  const dailyByDate = new Map();

  dailyFailures.forEach(f => {
    const key = f.date;
    dailyByDate.set(key, (dailyByDate.get(key) || 0) + 1);
  });


  const dailyEntries = [...dailyByDate.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const weeklyBySpan = new Map();
  weeklyFailures.forEach(f => {
    const key = `${f.weekStart}|${f.weekEnd}|${f.weekNumber ?? ''}`;
    const current = weeklyBySpan.get(key);
    if (!current) {
      weeklyBySpan.set(key, {
        count: 1,
        weekStart: f.weekStart,
        weekEnd: f.weekEnd,
        weekNumber: f.weekNumber
      });
    } else {
      current.count += 1;
    }
  });
  const weeklyEntries = [...weeklyBySpan.values()]
    .sort((a, b) => String(a.weekStart).localeCompare(String(b.weekStart)));

  requests.forEach(req => {
    if (!req || req.status === 'rejected') {
      if (req) {
        req.violations = 0;
        req.ruleWarningText = '';
        req.ruleWarningLines = [];

        if (isBaseline && req.id && !req.id.toString().startsWith('draft_')) {
          baselineViolations.set(req.id, 0);
          baselineViolationDetails.set(req.id, []);
        }
      }
      return;
    }

    if (!req?.start || !req?.end) {
      req.violations = 0;
      req.ruleWarningText = '';
      req.ruleWarningLines = [];

      if (isBaseline && req.id && !req.id.toString().startsWith('draft_')) {
        baselineViolations.set(req.id, 0);
        baselineViolationDetails.set(req.id, []);
      }
      return;
    }

    const start = normalizeDate(req.start);
    const end = normalizeDate(req.end);
    if (!start || !end) {
      req.violations = 0;
      req.ruleWarningText = '';
      req.ruleWarningLines = [];

      if (isBaseline && req.id && !req.id.toString().startsWith('draft_')) {
        baselineViolations.set(req.id, 0);
        baselineViolationDetails.set(req.id, []);
      }
      return;
    }

    let total = 0;
    const lines = [];

    dailyEntries.forEach(entry => {
      const dateStr = entry.date;
      const count = entry.count;
      const d = normalizeDate(dateStr);
      if (!d) return;
      if (d < start || d > end) return;
      total += count;
      lines.push(`${formatDateDMY(dateStr)}: ${count} Regelverstöße`);
    });

    weeklyEntries.forEach(info => {
      const ws = normalizeDate(info.weekStart);
      const we = normalizeDate(info.weekEnd);
      if (!ws || !we) return;
      if (ws > end || we < start) return;
      total += info.count;
      const label = `KW ${info.weekNumber ?? '?'} (${formatDateDMY(info.weekStart)}–${formatDateDMY(info.weekEnd)})`;
      lines.push(`${label}: ${info.count} Regelverstöße`);
    });

    req.violations = total;
    req.ruleWarningLines = lines;
    req.ruleWarningText = buildWarningTooltipText(total, lines);

    if (isBaseline && req.id && !req.id.toString().startsWith('draft_')) {
      baselineViolations.set(req.id, total);
      baselineViolationDetails.set(req.id, [...lines]);
    }
  });
}

function buildWarningTooltipText(total, lines) {
  if (!total) return 'Keine Warnungen';
  const trimmed = Array.isArray(lines) ? lines.filter(Boolean) : [];
  const maxLines = 6;
  const out = [`Regelverstöße: ${total}`];
  trimmed.slice(0, maxLines).forEach(line => out.push(line));
  if (trimmed.length > maxLines) {
    out.push(`Weitere: ${trimmed.length - maxLines}`);
  }
  return out.join('\n');
}

async function computePendingRequestWhatIfDeltas(requests) {
  if (!Array.isArray(requests) || requests.length === 0) return;

  requests.forEach(clearPendingWhatIfData);

  const approvedRequests = requests.filter(req =>
    req &&
    req.status === 'approved' &&
    req.start &&
    req.end
  );

  const pendingRequests = requests.filter(req =>
    req &&
    req.status === 'pending' &&
    req.start &&
    req.end
  );

  if (pendingRequests.length === 0) return;

  if (!Array.isArray(rules) || rules.length === 0) {
    try {
      rules = await loadRuleData(api);
    } catch (err) {
      console.warn('Could not load rules for pending What-If deltas:', err);
      return;
    }
  }

  for (const pendingRequest of pendingRequests) {
    try {
      const stats = await computeRequestDelta(approvedRequests, pendingRequest, {
        uiRules: rules,
        employees: requestEmployees,
        extraRequests: [pendingRequest]
      });

      const baselineSummary = summarizeViolationsForRequest(
        pendingRequest,
        stats?.baselineStats?.failures || []
      );
      const futureSummary = summarizeViolationsForRequest(
        pendingRequest,
        stats?.futureStats?.failures || []
      );

      const delta = Math.max(0, futureSummary.total - baselineSummary.total);
      const addedLines = getAddedViolationLines(baselineSummary.lines, futureSummary.lines);

      pendingRequest.whatIfBaselineViolations = baselineSummary.total;
      pendingRequest.whatIfFutureViolations = futureSummary.total;
      pendingRequest.whatIfDeltaViolations = delta;
      pendingRequest.whatIfNewLines = addedLines;
    } catch (err) {
      console.warn('Pending What-If delta failed for request:', pendingRequest?.id, err);
      pendingRequest.whatIfBaselineViolations = 0;
      pendingRequest.whatIfFutureViolations = 0;
      pendingRequest.whatIfDeltaViolations = 0;
      pendingRequest.whatIfNewLines = [];
    }
  }
}

function summarizeViolationsForRequest(request, failures) {
  const start = normalizeDate(request?.start);
  const end = normalizeDate(request?.end);
  if (!start || !end) {
    return { total: 0, lines: [] };
  }

  const safeFailures = Array.isArray(failures) ? failures : [];
  const dailyFailures = safeFailures.filter(f => f && f.scope === 'daily' && f.date);
  const weeklyFailures = safeFailures.filter(f => f && f.scope === 'weekly' && f.weekStart && f.weekEnd);

  const dailyByDate = new Map();
  dailyFailures.forEach(f => {
    const key = f.date;
    dailyByDate.set(key, (dailyByDate.get(key) || 0) + 1);
  });

  const weeklyBySpan = new Map();
  weeklyFailures.forEach(f => {
    const key = `${f.weekStart}|${f.weekEnd}|${f.weekNumber ?? ''}`;
    const current = weeklyBySpan.get(key);
    if (!current) {
      weeklyBySpan.set(key, {
        count: 1,
        weekStart: f.weekStart,
        weekEnd: f.weekEnd,
        weekNumber: f.weekNumber
      });
      return;
    }
    current.count += 1;
  });

  let total = 0;
  const lines = [];

  [...dailyByDate.entries()]
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(entry => {
      const d = normalizeDate(entry.date);
      if (!d) return;
      if (d < start || d > end) return;
      total += entry.count;
      lines.push(`${formatDateDMY(entry.date)}: ${entry.count} Regelverstöße`);
    });

  [...weeklyBySpan.values()]
    .sort((a, b) => String(a.weekStart).localeCompare(String(b.weekStart)))
    .forEach(entry => {
      const ws = normalizeDate(entry.weekStart);
      const we = normalizeDate(entry.weekEnd);
      if (!ws || !we) return;
      if (ws > end || we < start) return;
      total += entry.count;
      lines.push(`KW ${entry.weekNumber ?? '?'} (${formatDateDMY(entry.weekStart)}–${formatDateDMY(entry.weekEnd)}): ${entry.count} Regelverstöße`);
    });

  return { total, lines };
}

function getAddedViolationLines(baselineLines, futureLines) {
  const before = new Set(Array.isArray(baselineLines) ? baselineLines : []);
  const after = Array.isArray(futureLines) ? futureLines : [];
  return after.filter(line => !before.has(line));
}

function clearPendingWhatIfData(request) {
  if (!request || request.status !== 'pending') return;
  request.whatIfBaselineViolations = 0;
  request.whatIfFutureViolations = 0;
  request.whatIfDeltaViolations = 0;
  request.whatIfNewLines = [];
}

