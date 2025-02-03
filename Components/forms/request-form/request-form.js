import { loadRoleData, roles, allRoles, generateRoleCSV } from '../../../js/loader/role-loader.js';
import { employees } from '../../../js/loader/employee-loader.js';
import { officeDays } from '../../../js/loader/calendar-loader.js';
import { loadRequests, appendRequestToCSV, updateRequest, getAvailableRequestFiles } from '../../../js/loader/request-loader.js';

let requestYear = 2000;
let api;
let currentEployee;
let allRequests = [];

const warningList = [];

const posWarnings = {
  past: { rank: 5, warn: "📝 Der Start-Termin liegt in der Vergangenheit" },
  over: { rank: 4, warn: "📝 Nicht genügend Überstunden" },
  vacx: { rank: 3, warn: "⚠️ Nicht genügend Urlaubsanspruch" },
  auto: { rank: 3, warn: "⚠️ Dieser Antrag wird automatisch genehmigt." },
  urgn: { rank: 1, warn: "🚨 Eilig, Abwesenheit startet bald" },
  nobo: { rank: 2, warn: "🛑 kein Angestellter ausgewählt" },
  stat: { rank: 2, warn: "🛑 kein start Termin ausgewählt" },
  shif: { rank: 2, warn: "🛑 halber Tag frei nur an Einzeltagen " },

};

const vacationTypes = {
  vac: { autoApprove: false, reduceFrom: "vacation", warnKey: "vacx" }, // 🏖️ Urlaub
  sik: { autoApprove: true, reduceFrom: "none", warnKey: 'auto' },       // 💉 Genesung
  spe: { autoApprove: false, reduceFrom: "none", warnKey: null },       // 🎁 Sonderurlaub
  otc: { autoApprove: false, reduceFrom: "overtime", warnKey: "over" }, // ⚖️ Ausgleichstag
  but: { autoApprove: true, reduceFrom: "none", warnKey: 'auto' },        // 🚕 Geschäftreise
  par: { autoApprove: false, reduceFrom: "none", warnKey: null },        // 🧸 Elternzeit
  hom: { autoApprove: false, reduceFrom: "none", warnKey: null },        // 🏠 Home-Office
  unp: { autoApprove: false, reduceFrom: "none", warnKey: null }        // 💸 Unbezahlt
};


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

function checkBalance(type, warnKey) {
  let availableDays = 0;

  if (!currentEployee) {
    addWarning('nobo');
    return;
  }
  removeWarning('nobo');

  if (type === "vacation") {
    availableDays = currentEployee.availableDaysOff;
  } else if (type === "overtime") {
    availableDays = currentEployee.overtime;
  }

  if (newRequest.totalDays > availableDays) {
    addWarning(warnKey);
  } else {
    removeWarning(warnKey);
  }
}

function resetNewRequest() {
  newRequest.id = "";                  // Unique ID (timestamp when request was made)
  newRequest.employeeID = "";          // Employee ID
  newRequest.vacationType = "vac";     // Type of leave (was: DayOffType)
  newRequest.start = "";               // Start date
  newRequest.end = "";                 // End date
  newRequest.shift = "";               // Shift day (true = half-day)
  newRequest.requesterMSG = "";        // Optional message from requester
  newRequest.approverMSG = "";         // Optional message from approver
  newRequest.status = "pending";       // 'pending', 'approved', 'rejected'
  newRequest.decisionDate = "";        // When it was approved/rejected
  newRequest.daysRequested = 0;        // Raw days requested (before adjustments)
  newRequest.daysDeducted = 0;         // Adjusted days deducted (was: days)
  newRequest.requestedAt = "";         // Timestamp when the request was created
}

export async function initializeRequestForm(passedApi) {

  api = passedApi;
  if (!api) console.error(" Api was not passed ==> " + api);

  Promise.all([
    roles,
    officeDays
  ])
    .then(() => { })
    .catch((error) => {
      console.error('Error loading data:', error);
    });

  const formContainer = document.getElementById('form-container');
  if (!formContainer) {
    console.error('Form container not found');
    return;
  }

  formContainer.innerHTML = '';

  try {
    const response = await fetch('Components/forms/request-form/request-form.html');
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const formContent = await response.text();
    formContainer.innerHTML = formContent;

  } catch (err) {
    console.error(`Loading request form failed: ${err}`);
    return;
  }

  const requestFormContainer = document.getElementById("request-form-container");
  if (!requestFormContainer) {
    console.warn(" request container not found");
    return
  }

  const yearFilter = document.getElementById('year-filter');
  requestYear = requestYear > 2000 ? requestYear : new Date().getFullYear();
  if (yearFilter) yearFilter.value = requestYear;

  const approveRequestBtn = document.getElementById("create-request-mode-btn");
  const createRequestBtn = document.getElementById("approve-request-mode-btn");

  const decisionContainer = document.getElementById("request-enter-container");
  const requestEnter = document.getElementById("decision");

  const switchMode = (mode) => {
    if (mode === "approve") {
      createRequestBtn.classList.remove("active");
      createRequestBtn.classList.add("inactive");

      approveRequestBtn.classList.add("active");
      approveRequestBtn.classList.remove("inactive");

      requestEnter.classList.add("inactive");
      requestEnter.classList.remove("active");

      decisionContainer.classList.remove("inactive");
      decisionContainer.classList.add("active");

      renderRequesterList();
      initRequestEventListener();

    } else {
      createRequestBtn.classList.add("active");
      createRequestBtn.classList.remove("inactive");

      approveRequestBtn.classList.remove("active");
      approveRequestBtn.classList.add("inactive");

      requestEnter.classList.remove("inactive");
      requestEnter.classList.add("active");

      decisionContainer.classList.add("inactive");
      decisionContainer.classList.remove("active");

      initDecisionEventListener();
      loadAndRenderRequests();
    }
  };

  createRequestBtn.addEventListener("click", () => switchMode("create"));
  approveRequestBtn.addEventListener("click", () => switchMode("approve"));

  switchMode("approve");
}

function calculateTotalDays() {
  if (!newRequest.start || !newRequest.end) return;

  const startDate = new Date(newRequest.start);
  const endDate = new Date(newRequest.end);

  let totalDays = 0;

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const weekdayIndex = d.getDay(); // 0 = Sunday, 6 = Saturday

    const officeSchedule = officeDays[weekdayIndex];
    const employeeSchedule = currentEployee.workdays[weekdayIndex];

    if (employeeSchedule === "never") continue; // Employee does not work this day

    let dayValue = 0; // How much to deduct

    if (officeSchedule === "never") continue; // Office closed, no deduction

    if (officeSchedule === "full" && employeeSchedule === "full") {
      dayValue = 1; // Both require a full day off
    } else if (officeSchedule === "morning" || officeSchedule === "afternoon" ||
      employeeSchedule === "morning" || employeeSchedule === "afternoon") {
      dayValue = 0.5; // If either is part-time, deduct half a day
    }

    totalDays += dayValue;
  }

  newRequest.totalDays = totalDays;

  checkBalance(vacationTypes[newRequest.vacationType].reduceFrom, vacationTypes[newRequest.vacationType].warnKey);
}


function renderRequesterList() {
  const requesterSelect = document.getElementById('requester-select');
  requesterSelect.classList.add("noto");
  const requesterOption = document.createElement('option');
  requesterOption.innerHTML = "bitte wählen";
  requesterOption.value = 'xy';
  requesterSelect.appendChild(requesterOption);

  employees.forEach(employee => {
    if (['❓', 'keine', '?', 'name'].includes(employee.personalEmoji)) return;

    const requesterOption = document.createElement('option');
    const roleColor = getComputedStyle(document.documentElement).getPropertyValue(
      `--role-${employee.mainRoleIndex}-color`
    );

    requesterOption.style.backgroundColor = roleColor;
    requesterOption.classList.add("noto");
    requesterOption.innerHTML = `${employee.personalEmoji} ⇨ ${employee.name}`;
    requesterOption.title = employee.name;
    requesterOption.value = employee.id;
    requesterSelect.appendChild(requesterOption);
  });
}


function initRequestEventListener() {

  const requestStoreButton = document.getElementById('requestStoreButton');
  requestStoreButton.addEventListener('click', () => storeRequest());

  const requesterSelection = document.getElementById('requester-select');
  requesterSelection.addEventListener("change", (ev) => switchRequester(ev));

  const requestTypeSelect = document.getElementById('request-type-select');
  requestTypeSelect.addEventListener("change", (ev) => updateRequestType(ev));

  const requestStartDate = document.getElementById('request-start');
  requestStartDate.addEventListener("change", (ev) => updateRequestStartDate(ev, requestStartDate));

  const requestEndDate = document.getElementById('request-end');
  requestEndDate.addEventListener("change", (ev) => { newRequest.end = ev.target.value });


  const requestShiftMorning = document.getElementById('request-morning');
  const requestShiftafternoon = document.getElementById('request-morning');

  requestShiftMorning.addEventListener("change", (ev) => switchShifts(ev, 'morning', requestShiftMorning, requestShiftafternoon));
  requestShiftafternoon.addEventListener("change", (ev) => switchShifts(ev, 'afternoon', requestShiftMorning, requestShiftafternoon));

  const requesterMSG = document.getElementById('multiline-input');
  requesterMSG.addEventListener('keydown', (ev) => handleRequestMSG(ev));
}

function isValidDate(dateString) {

  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;

  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

function storeRequest() {

  let isRequestComplete = true;

  if (newRequest.employeeID === 'xy' || newRequest.employeeID === '') {
    isRequestComplete = false;
    addWarning('nobo');
  } else {
    removeWarning('nobo');
  }

  if (!isValidDate(newRequest.start)) {
    isRequestComplete = false;
    addWarning('stat');
  } else {
    removeWarning('stat');
  }

  if (isValidDate(newRequest.end && newRequest.shift !== 'full')) {
    isRequestComplete = false;
    addWarning('shif');
  } else {
    removeWarning('shif');
  }

  updateWarningsUI();
  if (!isRequestComplete) {
    console.log('request failed ');
    return;
  }

  if (!isValidDate(newRequest.end && (newRequest.shift === 'morning' || newRequest.shift === 'afternoon'))) {
    newRequest.shift = 'full';
    newRequest.end = newRequest.start;
    isRequestComplete = false;
  }

  if (!isValidDate(newRequest.end)) {
    newRequest.end = newRequest.start;
    newRequest.day = 1;
  }

  if (newRequest.shift === "morning" || newRequest.shift === 'afternoon') {
    newRequest.end = newRequest.start;
    newRequest.day = 0.5;
  }
  appendRequestToCSV(api, newRequest);
}

function handleRequestMSG(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    newRequest.msg = event.target.value;
  }
}
function switchShifts(event, ident, shiftMorning, shiftAfternoon) {

  if (ident === 'morning') {
    if (event.target.checked) {
      shiftAfternoon.checked = false;
      newRequest.shift = "morning";
      return;
    }

    newRequest.shift = "none";

    if (event.target.checked) {
      shiftMorning.checked = false;
      newRequest.shift = "afternoon";
    }
  }
}

function updateRequestStartDate(event, element) {
  element.classList.remove("request-date-warning");
  newRequest.start = event.target.value;

  const startDate = new Date(newRequest.start);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Remove time part for accurate comparison

  removeWarning('stat');

  if (startDate < today) {
    element.classList.add("request-date-warning");
    addWarning("past");
  } else {
    removeWarning("past");
  }

  updateWarningsUI();
}

function addWarning(type) {
  if (!warningList.includes(type)) {
    warningList.push(type);
  }
}

function removeWarning(type) {
  const index = warningList.indexOf(type);
  if (index !== -1) {
    warningList.splice(index, 1);
  }
}

function updateWarningsUI() {
  const warningContainer = document.querySelector(".request-form-warn");
  warningContainer.innerHTML = "⚠️ Warnungen ⚠️<ul>";

  if (warningList.length === 0) {
    warningContainer.innerHTML += "-";
  } else {
    warningList
      .sort((a, b) => posWarnings[b].rank - posWarnings[a].rank) // Sort by rank (higher first)
      .forEach((type) => {
        warningContainer.innerHTML += `<li>${posWarnings[type].warn}</li>`;
      });
  }

  warningContainer.innerHTML += "</ul>";
}


function resetRequestForm() {

  document.getElementById('request-type-select').selectedId = 'vac';
  document.getElementById('multiline-input').value = "";
  document.getElementById('request-vacation-left').innerHTML = "XX";
  document.getElementById('request-vacation-total').innerHTML = "XX";
  document.getElementById('request-overtime').innerHTML = "X";
  document.getElementById('request-start').value = "";
  document.getElementById('request-start').classList.add('request-date-warning');
  document.getElementById('request-end').value = "";
  document.getElementById('request-morning').checked = false;
  document.getElementById('request-afternoon').checked = false;
  document.getElementById('requester-emoji').innerHTML = "❓";
  document.getElementById('requester-emoji').style.backgroundColor = "white";

}

function switchRequester(ev) {

  const selectedId = ev.target.value;
  let newRequester = employees.find(emp => emp.id == selectedId);

  if (ev.target.value === 'xy') {
    currentEployee = "";
    addWarning('nobo');
    updateWarningsUI();
    resetRequestForm();
    resetNewRequest();
    return;
  }
  removeWarning('nobo');
  updateWarningsUI();
  console.log(newRequester);
  currentEployee = newRequester;
  newRequest.employeeID = newRequester.id;
  const requesterEmoji = document.getElementById('requester-emoji');
  requesterEmoji.innerHTML = newRequester.personalEmoji;
  const roleColor = getComputedStyle(document.documentElement).getPropertyValue(
    `--role-${newRequester.mainRoleIndex}-color`
  );
  requesterEmoji.style.backgroundColor = roleColor;

  document.getElementById('request-vacation-left').innerHTML = newRequester.remainingDaysOff;
  document.getElementById('request-vacation-total').innerHTML = newRequester.availableDaysOff;
  document.getElementById('request-overtime').innerHTML = newRequester.overtime;

  newRequest.id = Date.now();

  const formattedDate = formatDate(newRequest.id);
  newRequest.requestedAt = formattedDate;
  document.getElementById('request-id').innerHTML = formattedDate;
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
  newRequest.vacationType = selectedType;

  const typeInfo = vacationTypes[selectedType];

  if (!typeInfo) return;

  if (typeInfo.autoApprove) {
    addWarning('auto');
  } else {
    removeWarning('auto');
  }

  if (typeInfo.reduceFrom === "none") {
    console.log("ℹ️ Keine Reduktion von Urlaub oder Überstunden.");
    removeWarning(typeInfo.warnKey);
  } else {
    checkBalance(typeInfo.reduceFrom, typeInfo.warnKey);
  }

  updateWarningsUI();
}

async function loadAndRenderRequests() {

  try {
    const validFiles = await getAvailableRequestFiles(api);
    let requests = [];

    console.log(validFiles);

    for (const { year, month } of validFiles) {
      const formattedMonth = String(month).padStart(2, '0');

      const requestData = await loadRequests(year, formattedMonth);
      requests = [...requests, ...requestData];
    }
    allRequests = requests;

    const filteredRequests = filterRequests(allRequests);
    console.log(filteredRequests);

    renderRequestsTable(filteredRequests)

  } catch (error) {
    console.warn("🚨 Error fetching request files:", error);
  }
}

function filterRequests(requests) {

  const requestsCopy = [...requests];

  const filters = {
    type: document.getElementById("decision-type-select").value,
    month: document.getElementById("month-filter").value,
    status: document.getElementById("status-filter").value,
  };

  if (filters.type === 'all' &&
    filters.vacationType === 'all' &&
    filters.status === 'all') return requests;

  return requestsCopy.filter(request => {

    if (filters.type !== "all" && request.vacationType !== filters.type) return false;

    if (filters.month !== "all") {
      const requestMonth = request.start.substring(5, 7);
      if (requestMonth !== filters.month) {
        console.log(`Request ${request.id} skipped by month filter: ${requestMonth}`);
        return false;
      }
    }

    if (filters.status !== "all" && request.status !== filters.status) return false;

    return true;
  });
}



function initDecisionEventListener() {
  const toggleDurationBtn = document.getElementById("decisionDurationBtn");
  toggleDurationBtn.addEventListener("click", () => {
    toggleDurationBtn.dataset.order = toggleDurationBtn.dataset.order === "asc" ? "desc" : "asc";
    toggleDurationBtn.innerText = toggleDurationBtn.dataset.order === "asc" ? "↥ aufsteigend" : "↧ absteigend";
    loadAndRenderRequests();
  });

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
  tbody.innerHTML = "";

  let availableTypes = new Set();
  let availableMonths = new Set();
  let availableStatuses = new Set();
  let availableWarnings = new Set();

  allRequests.forEach(request => {
    availableTypes.add(request.vacationType);   // Collect unique vacation types
    availableMonths.add(request.start.substring(5, 7)); // Extract month from the date
    availableStatuses.add(request.status);      // Collect unique statuses
    if (request.violations > 0) availableWarnings.add(request.violations > 1 ? "multi" : "single");
  });

  disableAllOptions();

  // toggleFilterOptions("requester-filter", availableEmployees);
  toggleFilterOptions("decision-type-select", availableTypes);
  toggleFilterOptions("month-filter", availableMonths);
  toggleFilterOptions("status-filter", availableStatuses);
  // toggleFilterOptions("warning-filter", availableWarnings);

  if (requests.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center;">No pending requests to display.</td></tr>`;
    return;
  }

  requests.forEach(request => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td class='noto'>${employees[request.employeeID].personalEmoji} ${employees[request.employeeID].name}</td>
      <td class='noto'>${getVacationIcon(request.vacationType)}</td>
      <td class='noto'>${request.start} - ${request.end}</td>
      <td class='noto'>${request.shift ? "½ Tag" : "Ganzer Tag"}</td>
      <td class='noto'>${getStatusIcon(request.status)}</td>
      <td class='noto'>${request.requesterMSG ? "🗨️" : ""}</td>
      <td class='noto'>${request.approverMSG ? "🗨️" : ""}</td>
      <td class='noto' style="display: flex; flex-direction: row;">
          ${request.status === "pending" ? `
              <button class='noto' onclick="approveRequest('${request.id}')">✅</button>
              <button class='noto' onclick="rejectRequest('${request.id}')">❌</button>
          ` : ""}
      </td>
      <td>${getWarningsIcon(request)}</td>
    `;
    row.addEventListener("mouseenter", () => showMessages(request));
    row.addEventListener("mouseleave", clearMessages);
    tbody.appendChild(row);
  });
}


function disableAllOptions() {

  const selects = document.querySelectorAll("select");
  selects.forEach(select => {
    const options = select.querySelectorAll("option");
    options.forEach(option => {
      if (option.value !== "all") {
        option.disabled = true;
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


function showMessages(request) {
  document.getElementById("selected-request-warnings").value = getWarningsText(request);
  document.getElementById("selected-requester-comment").value = request.requesterMSG || "";
  document.getElementById("selected-approver-comments").value = request.approverMSG || "";
}

function clearMessages() {
  document.getElementById("selected-request-warnings").value = "";
  document.getElementById("selected-requester-comment").value = "";
  document.getElementById("selected-approver-comments").value = "";
}

function getVacationIcon(type) {
  const icons = {
    "vac": "🏖️ Urlaub", "spe": "🎁 Sonderurlaub", "otc": "⚖️ Ausgleichstag", "but": "🚕  Geschäftreise",
    "hom": "🏠 Home Office", "sho": "📐 Berufsschule", "sik": "💉 Genesung", "par": "🧸 Elternzeit", "unp": "💸 unbezahlt"
  };
  return icons[type] || "❓";
}

function getStatusIcon(status) {
  return status === "pending" ? "⏳" : status === "approved" ? "✅" : "❌";
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
  const buttonApprove = document.querySelector(`button[onclick="approveRequest('${id}')"]`);
  const buttonReject = document.querySelector(`button[onclick="rejectRequest('${id}')"]`);
  const messageInput = document.getElementById("selected-approver-comments");

  // Disable buttons to prevent duplicate actions
  buttonApprove.disabled = true;
  buttonReject.disabled = true;

  const approverMessage = messageInput.value.trim();
  const decisionDate = new Date().toLocaleDateString("de-DE"); // Format: dd/mm/yyyy

  try {
    await updateRequest(api, id, {
      status: newState,
      approverMSG: approverMessage,
      decisionDate: decisionDate
    });

    console.log(`Request ${id} updated to ${newState}`);
    loadAndRenderRequests(); // Ensure UI reflects the changes
  } catch (error) {
    console.error("Failed to update request:", error);
  } finally {
    // Enable buttons again after update
    buttonApprove.disabled = false;
    buttonReject.disabled = false;
  }
}

function handleDecision(requestId, newStatus) {

  const messageInput = document.getElementById("selected-approver-comments");
  const approverMessage = messageInput ? messageInput.value.trim() : "";
  const decisionDate = new Date().toLocaleDateString("de-DE");

  const request = allRequests.find(r => r.id === requestId);
  if (!request) {
    console.error(`Request with ID ${requestId} not found.`);
    return;
  }

  const [year, month] = request.start ? request.start.split('-') : [null, null];

  if (!year || !month) {
    console.error("Missing start date for request:", request);
    return;
  }

  updateRequest(api, requestId, {
    status: newStatus,
    approverMSG: approverMessage,
    decisionDate,
    start: request.start // Ensure the update function gets `start`
  }).then(() => {
    console.log(`Request ${requestId} updated to ${newStatus}`);
    loadAndRenderRequests(); // Reload data
  }).catch(err => console.error("Update failed:", err));
}

