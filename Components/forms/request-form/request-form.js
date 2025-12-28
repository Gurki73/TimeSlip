import { loadRoleData } from '../../../js/loader/role-loader.js';
import { loadEmployeeData, filterEmployeesByEndDate, storeEmployeeChange } from '../../../js/loader/employee-loader.js';
import { loadOfficeDaysData, loadPublicHolidaysSimple, loadStateData } from '../../../js/loader/calendar-loader.js';
import { loadRequests, appendRequest, updateRequest, getAvailableRequestFiles, storeApproval } from '../../../js/loader/request-loader.js';
import { filterPublicHolidaysByYearAndState, getAllHolidaysForYear } from '../../../js/Utils/holidayUtils.js';
import { createHelpButton } from '../../../js/Utils/helpPageButton.js';
import { createWindowButtons } from '../../../js/Utils/minMaxFormComponent.js';
import { createBranchSelect, branchPresetsRoles } from '../../../js/Utils/branch-select.js';
import { createSaveAllButton, saveAll } from '../../../js/Utils/saveAllButton.js';
import { recalcWarnings, resetWarnings } from "./request-warnings.js";
import { createDateRangePicker } from '../../../Components/customDatePicker/customDatePicker.js';


let requestYear = 2000;
let api;
let currentEmployee;
let allRequests = [];
let requestEmployees = [];
let officeDays = [];
let publicHolidays = [];
let federalState = '';

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

  console.log("📌 Initializing request form...");
  console.log("Current dataMode:", api.dataMode);

  // 1️⃣ Load office days first (optional)
  try {
    officeDays = await loadOfficeDaysData(api);
    console.log("✅ Loaded office days:", officeDays.length);
  } catch (err) {
    console.warn("⚠️ Failed to load office days:", err);
    officeDays = [];
  }

  // 2️⃣ Load employees
  try {
    requestEmployees = await loadEmployeeData(api);
    console.log("✅ Loaded employees:", requestEmployees.length);
  } catch (err) {
    console.error("❌ Failed to load employees:", err);
    requestEmployees = [];
  }

  try {
    federalState = await loadStateData(api);
    console.log("✅ federal state:", federalState);
  } catch (err) {
    console.error("❌ Failed to load federal state:", err);
    federalState = '';
  }

  publicHolidays = await loadPublicHolidaysSimple(api);

  // 3️⃣ Prepare form container
  const formContainer = document.getElementById('form-container');
  if (!formContainer) return console.error("Form container not found");
  formContainer.innerHTML = ''; // clear old form

  try {
    const response = await fetch('Components/forms/request-form/request-form.html');
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    formContainer.innerHTML = await response.text();
  } catch (err) {
    console.error(`Failed to load request form HTML: ${err}`);
    return;
  }

  // 4️⃣ Year filter
  const yearFilter = document.getElementById('request-year');
  requestYear = parseInt(localStorage.getItem('RequestListDate'), 10) || new Date().getFullYear();
  if (yearFilter) {
    yearFilter.value = requestYear;
    yearFilter.title = "Jahr für Antragsliste wählen";
    yearFilter.addEventListener('change', async () => {
      const selectedYear = parseInt(yearFilter.value, 10) || new Date().getFullYear();
      localStorage.setItem('RequestListDate', selectedYear);
      await initializeRequestForm(api);
    });
  }

  // 5️⃣ Buttons
  const refreshBtn = document.getElementById('refresh-request-form');
  if (refreshBtn) refreshBtn.addEventListener('click', async () => await initializeRequestForm(api));

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

      initDecisionEventListener();
      initFilterListener();
      await loadAndRenderRequests();
    } else {
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

  // 6️⃣ Load last tab
  const lastTab = localStorage.getItem('requestForm_lastTab') || 'approve';
  await switchMode(lastTab);

  // 7️⃣ Finish
  updateDivider("bg-request");
  resetRequestWarnings();
}

function handleFilterChange() {
  const filteredRequests = filterRequests(allRequests);
  renderRequestsTable(filteredRequests);
}

function initFilterListener() {
  const statusFilter = document.getElementById("status-filter");
  const employeeFilter = document.getElementById("requester-filter");
  const typeFilter = document.getElementById("decision-type-select");
  const monthFilter = document.getElementById("month-filter");

  [statusFilter, employeeFilter, typeFilter, monthFilter].forEach(select => {
    if (!select) return;
    select.removeEventListener("change", handleFilterChange);
    select.addEventListener("change", handleFilterChange);
  });
}

function resetRequestWarnings() {
  resetNewRequest();
  resetRequestForm();
  recalcWarnings();
  updateDurationPreview();
}

function updateDivider(className) {
  const divider = document.getElementById('horizontal-divider');
  divider.innerHTML = '';

  const leftGap = document.createElement('div');
  leftGap.className = 'left-gap';

  const h2 = document.createElement('h2');
  h2.id = 'role-form-title';
  h2.className = 'sr-only';
  h2.innerHTML = `<span class="noto">📋</span> Urlaubsanträge stellen & genehmigen <span class="noto">✍🏻</span>`;

  const buttonContainer = document.createElement('div');
  buttonContainer.id = 'form-buttons';

  const helpBtn = createHelpButton('chapter-requests');
  helpBtn.setAttribute('aria-label', 'Hilfe öffnen für Rollen-Formular');

  const branchSelect = createBranchSelect({
    onChange: (val) => {
      console.log('Branch changed to:', val);
      // applyBranchPreset(val);
    }
  });
  // --- New global window buttons ---
  const windowBtns = createWindowButtons(); // your new min/max buttons

  // Compose: add branchSelect, helpBtn, saveBtn, then windowBtns
  buttonContainer.append(branchSelect, helpBtn, windowBtns);

  divider.append(leftGap, h2, buttonContainer);
}

function initDatePickers() {
  // Initialize the date picker for Vacation Request form
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

function handleDateChange() {
  console.log("handle date change");

  const start = document.querySelector("#request-start-picker")?.value;
  let end = document.querySelector("#request-end-picker")?.value; // let, so we can override

  if (!start) {
    document.querySelector("#request-durration").textContent = "";
    return;
  }
  let days;
  if (!end) {
    end = start;
    days = 1;
  } else {
    days = calculateDaysOff(start, end);
  }
  document.querySelector("#request-durration").textContent = days;
  document.querySelector('#request-duration-unit').textContent = days < 2 ? 'Tag' : 'Tage';

  fireWarnings(); // ⚡ recalcWarnings + update UI
}

function calculateDaysOff(startDate, endDate, federalState) {
  if (!startDate) return 0;

  const start = new Date(startDate);
  const end = new Date(endDate || startDate); // default: single-day request

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (isNaN(start) || isNaN(end) || start > end) return 0;

  const year = start.getFullYear();

  // --- Safe holiday lookup ---
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

  // --- Safe employee lookup ---
  let employee = currentEmployee;
  const employeeIdRaw = document.getElementById("requester-select")?.value;

  if (!employee && employeeIdRaw) {
    const id = isNaN(employeeIdRaw) ? employeeIdRaw : Number(employeeIdRaw);
    employee = requestEmployees.find(emp => emp.id === id);
  }

  if (!employee) return 0; // no employee selected yet

  const employeeWorkdays = employee.workDays || [1, 1, 1, 1, 1, 0, 0]; // fallback Mon–Fri

  // --- Loop through days ---
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

  requesterSelect.innerHTML = ''; // clear old options

  // 1️⃣ Placeholder option
  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';                  // no value
  placeholderOption.innerText = 'Mitarbeiter wählen';
  placeholderOption.selected = true;             // default visible
  placeholderOption.disabled = true;             // prevents selecting again
  requesterSelect.appendChild(placeholderOption);

  // 2️⃣ Add valid employees
  const validEmployees = filterEmployeesByEndDate(requestEmployees);
  console.log("🔹 renderRequesterList -> validEmployees:", validEmployees);

  validEmployees.forEach(employee => {
    if (['❓', 'keine', '?', 'name'].includes(employee.personalEmoji)) return;

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

  const requestStoreButton = document.getElementById('requestStoreButton');
  requestStoreButton.addEventListener('click', () => storeRequest());
  requestStoreButton.title = "Antrag speichern";

  const requesterSelection = document.getElementById('requester-select');
  requesterSelection.addEventListener("change", (ev) => {
    switchRequester(ev);
    fireWarnings();
  });

  const requestTypeSelect = document.getElementById('request-type-select');
  requestTypeSelect.addEventListener("change", (ev) => {
    updateRequestType(ev);
    fireWarnings();
  });


  const requestShiftMorning = document.getElementById('request-morning');
  const requestShiftafternoon = document.getElementById('request-morning');

  const requesterMSG = document.getElementById('multiline-input');
  requesterMSG.addEventListener('keydown', (ev) => handleRequestMSG(ev));

  initDatePickers();

}

function isValidDate(dateString) {

  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;

  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

function storeRequest() {

  const requestToStore = {};

  const previewStart = document.getElementById('request-preview-start').textContent;
  const previewEnd = document.getElementById('request-preview-end').textContent;

  requestToStore.start = parsePreviewDate(previewStart);
  requestToStore.end = parsePreviewDate(previewEnd);

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

  console.log(" new request before passing: ", requestToStore);

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

function afterTypePicked() {
  // Enable hints or anything else if needed
  recalcWarnings(); // trigger warning update
}

function afterRequesterSelected() {
  setEnabled(document.getElementById('request-type-select'), true);
  setEnabled(document.getElementById('pick-request-start'), true);
  setEnabled(document.getElementById('pick-request-end'), false);
  setEnabled(document.getElementById('multiline-input'), false);
  setEnabled(document.getElementById('requestStoreButton'), false);
  setStepActive("step1", true);

  recalcWarnings(); // ⚡ trigger warnings safely here
}

function afterStartDatePicked() {
  setEnabled(document.getElementById('pick-request-end'), true);
  setEnabled(document.getElementById('multiline-input'), true);
  setStepActive("step2", true);

  setTimeout(() => {
    const warningContainer = document.querySelector(".request-form-warn");
    if (warningContainer) warningContainer.style.opacity = 1;
    recalcWarnings(); // ⚡ trigger warnings after container visible
  }, 1500);
}

function afterEndDatePicked() {
  setEnabled(document.getElementById('requestStoreButton'), true);
  recalcWarnings(); // ⚡ final recalculation
}


function resetRequestForm() {
  document.getElementById('request-type-select').selectedId = '0';
  document.getElementById('multiline-input').value = "";
  document.getElementById('request-vacation-left').innerHTML = "XX";
  document.getElementById('request-vacation-total').innerHTML = "XX";
  document.getElementById('request-overtime').innerHTML = "X";
  document.getElementById('pick-request-start').value = "";
  document.getElementById('pick-request-end').value = "";
  document.getElementById('requester-emoji').innerHTML = "❓";
  document.getElementById('requester-emoji').style.backgroundColor = "white";
}

function switchRequester(ev) {
  const select = ev.target;
  const selectedId = select.value;
  const selectedOption = select.selectedOptions[0];
  let newRequester = requestEmployees.find(emp => emp.id == selectedId);

  if (selectedId === 'xy') {
    currentEmployee = null;
    resetRequestForm();
    resetNewRequest();
    recalcWarnings();
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

  document.getElementById('request-vacation-left').innerHTML = newRequester.remainingDaysOff;
  document.getElementById('request-vacation-total').innerHTML = newRequester.availableDaysOff;
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
  recalcWarnings();
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

  // 🧭 If no valid files found, try loading manually (onboarding or fallback)
  if (!validFiles || validFiles.length === 0) {
    console.warn("⚠️ No valid request files found — loading sample or placeholder data");
    requests = await loadRequests(api, year);
  } else {
    // ✅ Folder exists; try to load data for selected year
    const fileForYear = validFiles.find(f => f.year === year);
    if (fileForYear) {
      requests = await loadRequests(api, year);
    } else {
      console.warn(`ℹ️ No file found for ${year}, returning placeholder`);
      requests = [{ info: `Noch keine Anträge für ${year} gestellt` }];
    }
  }
  const filteredRequests = filterRequests(requests);

  console.log("📄 Loaded requests:", filteredRequests.length);

  renderRequestsTable(filteredRequests);
}


function filterRequests(requests) {

  const filters = {
    status: document.getElementById("status-filter")?.value || 'all',
    employee: document.getElementById("requester-filter")?.value || 'all', // NEW
    type: document.getElementById("decision-type-select")?.value || 'all',
    month: document.getElementById("month-filter")?.value || 'all',
  };

  if (filters.employee === 'all' && filters.type === 'all' && filters.month === 'all' && filters.status === 'all') {
    return requests;
  }

  return requests.filter(request => {
    if (filters.employee !== "all" && String(request.employeeID) !== filters.employee) return false; // filter employee
    if (filters.type !== "all" && request.vacationType !== filters.type) return false;
    if (filters.month !== "all") {
      const requestMonth = request.start?.substring(5, 7);
      if (requestMonth !== filters.month) return false;
    }
    if (filters.status !== "all" && request.status !== filters.status) return false;

    return true;
  });
}

function initDecisionEventListener() {

  document.querySelectorAll("select").forEach(select => {
    select.addEventListener("change", (e) => {
      if (e.target.value !== "all") {
        document.querySelectorAll("select").forEach(otherSelect => {
          if (otherSelect !== e.target) {
            otherSelect.value = "all";
          }
        });
        loadAndRenderRequests();
      }
    });
  });
}

function renderRequestsTable(requests) {
  const tbody = document.querySelector("#decision-table tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  // Collect available filters
  const availableEmployees = new Set();
  const availableTypes = new Set();
  const availableMonths = new Set();
  const availableStatuses = new Set();
  const availableWarnings = new Set();



  if (allRequests.length < 1) {
    allRequests = requests.filter(r => r.start && r.employeeID);
  }

  console.log("all request ==> ", allRequests);

  allRequests.forEach(request => {

    if (!request || !request.start || !request.employeeID) {
      console.warn("Skipping non-request object:", request);
      return;
    }

    availableStatuses.add(request.status);
    availableEmployees.add(request.employeeID);
    availableTypes.add(request.vacationType);
    availableMonths.add(request.start.substring(5, 7)); // <== line 683
    if (request.violations > 0)
      availableWarnings.add(request.violations > 1 ? "multi" : "single");
  });

  disableAllOptions();

  const employeeFilter = document.getElementById("requester-filter");
  if (employeeFilter) {
    populateEmployeeFilter([...availableEmployees]);
  }
  toggleFilterOptions("requester-filter", new Set([...availableEmployees].map(String)));
  toggleFilterOptions("decision-type-select", new Set([...availableTypes].map(String)));
  toggleFilterOptions("month-filter", new Set([...availableMonths].map(String)));
  toggleFilterOptions("status-filter", new Set([...availableStatuses].map(String)));

  if (requests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center">No pending requests to display.</td></tr>`;
    return;
  }

  requests.forEach(request => {
    const row = document.createElement("tr");

    // ✅ Create button container (if pending)
    let firstColContent = "";
    if (request.status === "pending") {
      firstColContent = `
        <div class="flex-row-2">
          <button class="noto approveButton" data-id="${request.id}">✅</button>
          <button class="noto rejectButton" data-id="${request.id}">❌</button>
        </div>`;
    } else {
      firstColContent =
        request.status === "approved"
          ? `<span class="noto request-status-pill request-approved">✅ genehmigt</span>`
          : `<span class="noto request-status-pill request-rejected">❌ abgelehnt</span>`;
    }

    const startFormatted = formatDateDMY(request.start);
    const endFormatted = formatDateDMY(request.end);

    if (request.effectiveDays == null || Number.isNaN(request.effectiveDays)) {
      const employeeToFix = getEmployeeById(request.employeeID);
      if (employeeToFix && request.start && request.end) {
        const startDate = new Date(request.start);
        const endDate = new Date(request.end);
        request.effectiveDays = calculateDaysOff(startDate, endDate, employeeToFix.workdays);

        const yearToFix = startDate.getFullYear();
        updateRequest(api, request.id, request, yearToFix);
      } else {
        request.effectiveDays = 1;
      }
    }
    if (request.effectiveDays < 1) request.effectiveDays = 1;
    const effectiveDaysUnit = request.effectiveDays > 1 ? 'Tage' : 'Tag';
    row.innerHTML = `
      <td class='noto flex-row-2'>${firstColContent}</td>
      <td class='noto'>${(requestEmployees.find(e => e.id === request.employeeID)?.personalEmoji) || '❓'} ${(requestEmployees.find(e => e.id === request.employeeID)?.name) || 'Unbekannt'}</td>
      <td class='noto'>${getVacationIcon(request.vacationType)}</td>
      <td>${startFormatted} bis<br>${endFormatted}</td>
      <td>${request.effectiveDays} ${effectiveDaysUnit}</td>
      <td class='request-msg-cell'>${request.requesterMSG || ""}</td>
      <td class='noto approverCell'>${request.approverMSG || ""}</td>
      <td>${getWarningsIcon(request)}</td>
    `;

    if (request.status === "pending") {
      const approverTextarea = document.createElement("textarea");
      approverTextarea.value = request.approverMSG || "";
      approverTextarea.placeholder = "Enter approver message…";

      const yearInput = document.getElementById('request-year');
      const year = yearInput && !isNaN(parseInt(yearInput.value, 10))
        ? parseInt(yearInput.value, 10)
        : new Date().getFullYear();

      let debounceTimer;
      approverTextarea.addEventListener("input", () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          storeApproval(api, request.id, approverTextarea.value, null, year);
        }, 600); // Wait 600ms after typing stops
      });
      row.querySelector(".approverCell").innerHTML = "";
      row.querySelector(".approverCell").appendChild(approverTextarea);
    }

    tbody.appendChild(row);
  });

  const table = document.getElementById("decision-table");

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

  filterSelect.innerHTML = ""; // clear old options

  const defaultOption = document.createElement('option');
  defaultOption.value = 'all';
  defaultOption.innerText = 'Alle Mitarbeiter';
  filterSelect.appendChild(defaultOption);

  requestEmployees.forEach(employee => {
    if (!availableEmployeeIDs.includes(employee.id)) return; // skip if not in current requests

    const option = document.createElement('option');
    const roleColor = getComputedStyle(document.body).getPropertyValue(
      `--role-${employee.mainRoleIndex}-color`
    );
    option.style.backgroundColor = roleColor;
    option.classList.add("noto");
    option.innerText = `${employee.personalEmoji} ⇨ ${employee.name}`;
    option.title = employee.name;
    option.value = employee.id;
    filterSelect.appendChild(option);
  });
}

function disableAllOptions() {

  const selects = document.querySelectorAll("select");
  selects.forEach(select => {
    const options = select.querySelectorAll("option");
    options.forEach(option => {
      if (option.value !== "all") {
        // option.disabled = true;
        option.style.color = "lightgray";
        option.style.fontStyle = "italic";
      }
    });
  });
}

function toggleFilterOptions(filterId, availableValues) {
  const selectElement = document.getElementById(filterId);
  const options = selectElement.querySelectorAll("option");

  options.forEach(option => {
    const value = option.value;
    if (value === "all" || availableValues.has(value)) {
      option.disabled = false;
      option.style.color = "";
      option.style.fontStyle = "";
    }
  });
}

function getVacationIcon(type) {
  const icons = {
    "vac": "🏖️ Urlaub", "spe": "🎁 Sonderurlaub", "otc": "⚖️ Ausgleichstag", "but": "🚕  Geschäftreise",
    "hom": "🏠 Home Office", "sho": "📐 Berufsschule", "sik": "💉 Genesung", "par": "🧸 Elternzeit", "unp": "💸 unbezahlt"
  };
  return icons[type] || "❓";
}

function getWarningsIcon(request) {
  if (request.violations > 1) return "🛑";
  if (request.violations === 1) return "⚠️";
  return "";
}

function getWarningsText(request) {
  return request.violations > 0 ? `Regelverstöße: ${request.violations}` : "Keine Warnungen";
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

  recalcWarnings();
  if (!currentEmployee) {
    const idRaw = document.getElementById("requester-select").value;
    const id = isNaN(idRaw) ? idRaw : Number(idRaw);
    currentEmployee = requestEmployees.find(emp => emp.id === id);
  }
  if (!currentEmployee) {
    console.warn(" no current employee available to calculate vacation durration");
    return;
  }

  console.log("currentEmployee:", currentEmployee);
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
  recalcWarnings();
}

function checkAutoApprovalWarning(selectedType) {

  recalcWarnings();
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

