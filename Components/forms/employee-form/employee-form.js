import { loadRoleData } from '../../../js/loader/role-loader.js';
import { loadEmployeeData, storeEmployeeChange } from '../../../js/loader/employee-loader.js';
import { createEmojiPicker } from '../../../Components/emojiPicker/emojiPicker.js';
import { loadOfficeDaysData, officeDays } from '../../../js/loader/calendar-loader.js';
import { keyToBools } from '../calendar-form/calendar-form-utils.js';
import { createHelpButton } from '../../../js/Utils/helpPageButton.js';
import { createWindowButtons } from '../../../js/Utils/minMaxFormComponent.js';
import { createDataModeToggle } from '../../../js/Utils/DataMode-select.js';
import { createDateRangePicker } from '../../customDatePicker/customDatePicker.js';
import { loadEmojiData } from '../../../js/loader/custom-loader.js';
import { createSaveButton } from '../../../js/Utils/saveButton.js';
import { createEllipsis } from '../../../js/Utils/ellipsisButton.js';

const employeeEmojiOptions = [
  "⚽️", "🏀", "🏈", "🎾", "🐶", "🐱", "🐻",
  "🐼", "🦁", "🐸", "🐦", "🦋", "🌷", "🌵",
  "🍀", "🌸", "🌻", "🧩", "🎯", "🪁", "🏓",
  "🍎", "🍕", "🥗", "🍫", "🐢", "🦄", "🐒",
  "🌿", "🍌", "🍒", "🍇", "🍉", "🍓", "🥝",
  "☕", "🧢", "👢", "🧥", "🍏", "👜", "💍",
  "🪭", "❤️", "🏆", "👑", "🌞", "🌧️", "🌙",
  "🚀",
];

const employeeEmojis = [...employeeEmojiOptions];

let employeeFormDataNew = false;
let currentOfficeDays;
let api;
let currentEmployeeId;
let cachedEmployees = [];
let cachedRoles = [];
let deletionLock = false;
let isDividerUpdating = false;
let saveButtonHeader;

export async function initializeEmployeeForm(passedApi) {

  api = passedApi;
  if (!api) console.error("Api was not passed ==> " + api);

  try {
    cachedEmployees = await loadEmployeeData(api);

    cachedRoles = await loadRoleData(api);
    currentOfficeDays = await loadOfficeDaysData(api);
  } catch (error) {
    console.error("Failed to load initial data:", error);
    return;
  }

  const emojiData = await loadEmojiData(api);
  if (emojiData?.employeeEmojis?.length) {
    employeeEmojis.length = 0;
    employeeEmojis.push(...emojiData.employeeEmojis);
  }

  currentEmployeeId = cachedEmployees.length > 0 ? cachedEmployees[0].id : -1;

  const formContainer = document.getElementById("form-container");
  if (!formContainer) {
    console.error("Form container not found");
    return;
  }
  formContainer.innerHTML = "";

  try {
    const response = await fetch("Components/forms/employee-form/employee-form.html");
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    formContainer.innerHTML = await response.text();

    await new Promise((resolve) => requestAnimationFrame(resolve));
  } catch (err) {
    console.error(`Loading employee form failed: ${err}`);
    return;
  }
  const container = document.getElementById("employee-form-container");
  if (!container) {
    console.error("Employee form container not found!");
    return;
  }
  renderNewEmployeeBtn(container);
  renderEmployeeList();

  updateDivider("bg-employee");

  requestAnimationFrame(() => {
    const roleContainer = document.getElementById("employee-form-container");
    if (roleContainer) {
      void roleContainer.offsetHeight;
      window.dispatchEvent(new Event("resize"));
    } else {
      console.warn(
        "[EmployeeForm] ⚠️ 'employee-form-container' not found during paint enforcement."
      );
    }
  });
  initEventListenerRoleSelect();
  initEmployeeDatePickers();
  initPrivacyWarningToggle();
  populateShiftOptions();
  initDeleteBirthday();
}

function initDeleteBirthday() {
  const resetBtn = document.getElementById('employee-birthday-reset');
  if (resetBtn) {
    // Remove previous listener if it exists
    if (resetBtn._resetHandler) {
      resetBtn.removeEventListener('click', resetBtn._resetHandler);
    }

    // Create and store handler
    const handler = () => resetEmployeeBirthday();
    resetBtn.addEventListener('click', handler);
    resetBtn._resetHandler = handler;
  }
}

function getEmployeeById(employeeId) {
  return cachedEmployees.find(emp => emp.id === employeeId) ?? null;
}

function initEmployeeDatePickers() {
  let periodDriver = "end"; // UI-only flag

  // ───────────────────────────
  // DOM references
  // ───────────────────────────

  const durationInput = document.getElementById("employee-duration");
  if (!durationInput) return;

  // ───────────────────────────
  // Picker init
  // ───────────────────────────

  const picker = createDateRangePicker({
    startButton: "#pick-employee-start",
    endButton: "#pick-employee-end",
    startInput: "#employee-form-start-work",
    endInput: "#employee-form-end-work",
    previewStart: "#employee-preview-start",
    previewEnd: "#employee-preview-end",
    previewDuration: "#employee-preview-days",
    onChange: (start, end) => {
      // manual end-date change → sync duration
      if (periodDriver === "end") {
        syncDurationFromDates(start, end, durationInput);
      }

      validateEmployeeFields({
        startDate: start || "",
        endDate: end || ""
      });

      saveButtonHeader.setState("dirty");
    }
  });

  // ───────────────────────────
  // Duration → End date
  // ───────────────────────────

  durationInput.addEventListener("input", () => {
    const start = picker.getStart();
    const duration = parseFloat(durationInput.value);

    if (!start || !duration) return;

    periodDriver = "duration";

    const end = addYears(start, duration);
    picker.setEnd(end);
  });
}

function addYears(startDateStr, years) {
  const d = new Date(startDateStr);
  const whole = Math.floor(years);
  const months = Math.round((years - whole) * 12);

  d.setFullYear(d.getFullYear() + whole);
  d.setMonth(d.getMonth() + months);

  return d.toISOString().slice(0, 10);
}

function syncDurationFromDates(start, end, durationInput) {
  if (!start || !end) return;

  const years = diffYears(start, end);
  durationInput.value = roundToHalf(years);
}

function roundToHalf(years) {
  return Math.ceil(years * 2) / 2;
}

function diffYears(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const msPerYear = 1000 * 60 * 60 * 24 * 365.25;
  return (endDate - startDate) / msPerYear;
}


let privacyClickListener = null;
let lastPrivacyState = true;

export function initPrivacyWarningToggle() {

  const button = document.getElementById('privacy-warn-chev');
  const root = document.getElementById('privacy-warning-collapsible');
  if (!button || !root) {
    console.error("no privacy warning found in dom ");
    return;
  }
  // Initialize state
  let isOpen = lastPrivacyState ?? true;
  setExpanded(isOpen);

  // Single click handler
  button.addEventListener('click', () => {
    isOpen = !isOpen;
    setExpanded(isOpen);
    lastPrivacyState = isOpen;
  });

  function setExpanded(value) {
    root.setAttribute('aria-expanded', value);
    button.setAttribute('aria-expanded', value);
    root.classList.toggle('active', value);
  }
}

function renderNewEmployeeForm() {
  window.employeeFormDataNew = true;
  document.getElementById('employee-form-details').classList.remove('employee-opaque');
  saveButtonHeader.setState('clean');
  const today = new Date();
  const tenYearsLater = new Date();
  tenYearsLater.setFullYear(today.getFullYear() + 35);

  const newEmployeeDefaults = {
    id: Date.now(), // temp ID
    name: "Name eingeben",
    personalEmoji: "⊖",
    mainRoleIndex: 0,
    secondaryRoleIndex: 0,
    tertiaryRoleIndex: 0,
    availableDaysOff: 30,
    remainingDaysOff: 30,
    overtime: 0,
    // IMPORTANT: keep workDays as strings (same shape as CSV expects)
    // earlier code used booleans (shift !== 'never') — that produced wrong CSV values
    workDays: Array.isArray(officeDays) ? officeDays.slice() : ["never", "never", "never", "never", "never", "never", "never"],
    shifts: {
      mon: officeDays[0] ?? "never",
      tue: officeDays[1] ?? "never",
      wed: officeDays[2] ?? "never",
      thu: officeDays[3] ?? "never",
      fri: officeDays[4] ?? "never",
      sat: officeDays[5] ?? "never",
      sun: officeDays[6] ?? "never"
    },
    roleSplitMain: 100,
    roleSplitSecondary: 0,
    roleSplitTertiary: 0,
    startDate: new Date().toISOString().slice(0, 10),
    endDate: (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 35); return d.toISOString().slice(0, 10); })(),
    birthday: "0",
    birthMonth: "0"
  };

  resetEmployeeForm(newEmployeeDefaults);
  rebindEmployeeFormEvents(newEmployeeDefaults);

  const deleteButton = document.getElementById("employee-delete-button");
  if (deleteButton) deleteButton.style.display = "none";

  const resetButton = document.getElementById("employee-reset-button");
  if (resetButton) resetButton.style.display = "none";
  const storeButton = document.getElementById("employee-store-button");
  if (storeButton) storeButton.style.display = "";

  fillRoleDropdowns(newEmployeeDefaults);
  initEventListenerRoleSelect();
}

function rebindEmployeeFormEvents(employee) {
  bindNameInputToEmployee(employee);
  bindEmojiClick(employee);
  bindEmployeeDateAndNumberInputs(employee);
  bindEmployeeVacationInputs(employee);
}

function resetEmployeeForm(defaults = {}) {
  const clear = (id, val = "") => {
    const el = document.getElementById(id);
    if (!el) return;
    if ("value" in el) el.value = val;
    else el.textContent = val;
  };

  clear("employee-name", defaults.name ?? "?");
  clear("employee-id", defaults.id ?? Date.now());
  clear("available-days-off", defaults.availableDaysOff ?? 30);
  clear("remaining-days-off", defaults.remainingDaysOff ?? 30);
  clear("overtime", defaults.overtime ?? 0);
  clear("employee-form-birthday-day", defaults.birthday ?? "");
  clear("employee-form-birthday-month", defaults.birthMonth ?? "");

  const startFormatted = formatDateInput(defaults.startDate);
  const endFormatted = formatDateInput(defaults.endDate);
  clear("employee-form-start-work", startFormatted);
  clear("employee-form-end-work", endFormatted);
  clear("employee-preview-start", startFormatted);
  clear("employee-preview-end", endFormatted);

  const emojiBtn = document.getElementById("employee-emoji-picker-btn");
  if (emojiBtn) {
    emojiBtn.innerHTML = defaults.personalEmoji ?? "⊖";
    emojiBtn.setAttribute("data-role", defaults.mainRoleIndex ?? 0);
    const newEmojiBtn = emojiBtn.cloneNode(true);
    emojiBtn.replaceWith(newEmojiBtn);
  }

  const dayIds = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  dayIds.forEach((day, i) => {
    const select = document.getElementById(`employee-form-shift-${day}`);
    if (!select) return;

    // Set default shift from officeDays
    const shiftValue = defaults.shifts?.[day] ?? "never";
    select.value = shiftValue;

    // Ensure workDays boolean matches
    if (defaults.workDays) defaults.workDays[i] = shiftValue !== "never";

    // Optional: update preview spans if any
    const preview = document.getElementById(`employee-preview-shift-${day}`);
    if (preview) preview.textContent = shiftValue;
  });

  clear('employee-details-icon-main', `<span class="noto">🚫</span>`);
  clear('employee-details-icon-trinary', `<span class="noto">🚫</span>`);
  clear('employee-details-icon-secondary', `<span class="noto">🚫</span>`);
}

function gatherEmployeeData(api, action = "create") {

  const employeeRegularSchedule = [];
  const dayIds = [
    "employee-form-shift-mon",
    "employee-form-shift-tue",
    "employee-form-shift-wed",
    "employee-form-shift-thu",
    "employee-form-shift-fri",
    "employee-form-shift-sat",
    "employee-form-shift-sun"
  ];
  for (let i = 0; i < 7; i++) {
    const el = document.getElementById(dayIds[i]);
    if (!el) {
      console.error("shift " + dayIds[i] + " doesnt exsit in DOM ");
    } else {
      employeeRegularSchedule[i] = el.value;
    }
  }
  let newStartDate = document.getElementById("employee-form-start-work")?.value || new Date().toISOString().split("T")[0];
  let newEndDate = document.getElementById("employee-form-end-work")?.value || "2099-12-31";

  const employeeData = {
    id: document.getElementById("employee-id")?.textContent || Date.now(),
    name: document.getElementById("employee-name")?.value || "Unnamed",
    personalEmoji: document.getElementById("employee-emoji-picker-btn")?.textContent || "👤",
    mainRoleIndex: getRoleIndexFromSelect("employee-details-role-main", 0),
    secondaryRoleIndex: getRoleIndexFromSelect("employee-details-role-secondary", 0),
    tertiaryRoleIndex: getRoleIndexFromSelect("employee-details-role-trinary", 0),
    roleSplitMain: parseFloat(document.getElementById("role1-value")?.value) || 1,
    roleSplitSecondary: parseFloat(document.getElementById("role2-value")?.value) || 0,
    roleSplitTertiary: parseFloat(document.getElementById("role3-value")?.value) || 0,
    availableDaysOff: parseFloat(document.getElementById("available-days-off")?.value) || 30,
    remainingDaysOff: parseFloat(document.getElementById("remaining-days-off")?.value) || 30,
    overtime: parseFloat(document.getElementById("overtime")?.value) || 0,
    workDays: employeeRegularSchedule,
    startDate: newStartDate,
    endDate: newEndDate,
    birthday: document.getElementById("employee-form-birthday-day")?.value || "",
    birthMonth: document.getElementById("employee-form-birthday-month")?.value || "",
  };

  if (action === "delete") {
    employeeData.personalEmoji = "🗑️";
    action = "update";
  }
  storeEmployeeChange(api, employeeData, action);
}

function updateDivider(className) {
  if (isDividerUpdating) return;
  isDividerUpdating = true;

  const divider = document.getElementById('horizontal-divider-box');
  divider.innerHTML = '';

  const leftGap = document.createElement('div');
  leftGap.className = 'left-gap';

  const h2 = document.createElement('h2');
  h2.id = 'role-form-title';
  h2.className = 'sr-only';
  h2.innerHTML = `<span class="noto">👩</span> Mitarbeiter Übersicht <span class="noto">🧑‍🦳</span>`;

  const buttonContainer = document.createElement('div');
  buttonContainer.id = 'form-buttons';

  const helpBtn = createHelpButton('chapter-employees');
  helpBtn.setAttribute('aria-label', 'Hilfe öffnen für Rollen-Formular');

  saveButtonHeader = createSaveButton({ onSave: () => storeAllEmployees(api) });
  saveButtonHeader.setState('blocked');

  const windowBtns = createWindowButtons(); // Min/Max buttons
  const dataModeToggle = createDataModeToggle({
    onChange: async () => {
      await initializeRequestForm(api);
    }
  });

  buttonContainer.append(
    saveButtonHeader.el,
    helpBtn,
    dataModeToggle,
    windowBtns
  );

  divider.append(leftGap, h2, buttonContainer);

  isDividerUpdating = false;
}


function storeAllEmployees(api) { }

function deleteEmoji(emoji) {
  const index = employeeEmojiOptions.indexOf(emoji);
  if (index > -1) {
    employeeEmojiOptions.splice(index, 1);
  }
}

function addEmoji(emoji) {
  if (emoji === "⊖") return;
  if (!employeeEmojiOptions.includes(emoji)) {
    employeeEmojiOptions.push(emoji);
  } else {
    console.warn(`Emoji "${emoji}" is already in the available list.`);
  }
}

function bindNameInputToEmployee(employee) {
  const nameInput = document.getElementById('employee-name');
  if (!nameInput) return;

  nameInput.removeEventListener('keydown', nameInput._keydownHandler);

  const handler = (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      employee.name = nameInput.value.trim();
      validateEmployeeFields(employee);
    }
  };

  nameInput.addEventListener('keydown', handler);
  nameInput._keydownHandler = handler;
}

function bindEmojiPickerToEmployee(employee) {
  const handleEmployeeEmojiSelectionChange = (selectedEmoji) => {
    if (selectedEmoji) {

      const oldEmoji = employee.personalEmoji;
      employee.personalEmoji = selectedEmoji;

      if (oldEmoji) addEmoji(oldEmoji);
      deleteEmoji(selectedEmoji);

      const emojiBtn = document.getElementById('employee-emoji-picker-btn');
      if (emojiBtn) {
        emojiBtn.textContent = selectedEmoji;
      }
      renderEmployeeList();
      validateEmployeeFields(employee);
    } else {
      console.warn(`No emoji selected for employee ${employee.name}.`);
    }
  };

  const emojiButton1 = document.getElementById('employee-emoji-picker-btn');
  createEmojiPicker(employeeEmojiOptions, emojiButton1, employee.mainRoleIndex, handleEmployeeEmojiSelectionChange);
}

function validateEmployeeData(employees) {
  const errors = [];
  employees.forEach((employee, index) => {
    const { id, name, emoji, mainRoleIndex } = employee;

    if (!name) errors.push(`Employee at index ${index} is missing a name.`);
    if (mainRoleIndex === undefined) errors.push(`Employee ${name || `at index ${index}`} is missing a main role.`);
    if (!emoji) errors.push(`Employee ${name || `at index ${index}`} is missing an emoji.`);

    employee.secondaryRoleIndex = employee.secondaryRoleIndex ?? null;
    employee.tertiaryRoleIndex = employee.tertiaryRoleIndex ?? null;
    employee.availableDaysOff = employee.availableDaysOff ?? 30.0;
    employee.remainingDaysOff = employee.remainingDaysOff ?? 30.0;
    employee.overtime = employee.overtime ?? 0.0;
    employee.startDate = employee.startDate ?? new Date().toISOString().split('T')[0];
    employee.endDate = employee.endDate ?? null;
    employee.teamIndex = employee.teamIndex ?? null;
    employee.shiftType = employee.shiftType ?? 'day';
    employee.birthday = employee.birthday ?? null;
  });

  if (errors.length > 0) {
    console.warn("Validation errors found:", errors);
  }
}

function renderNewEmployeeBtn(container) {
  const newEmployeeBtn = document.getElementById('employeeForm-new-btn');
  if (newEmployeeBtn) {
    newEmployeeBtn.addEventListener('click', () => renderNewEmployeeForm());
  }
}

function createNewEmployee() {
  employeeFormDataNew = true;

  const employees = cachedEmployees;
  const lastIndex = employees.length;
  const today = new Date();
  const tenYearsLater = new Date();
  tenYearsLater.setFullYear(today.getFullYear() + 35);

  const newEmployee = {
    id: Date.now(),
    name: "neuer Mitarbeiter",
    personalEmoji: "⊖",
    mainRoleIndex: -1,
    secondaryRoleIndex: -1,
    tertiaryRoleIndex: -1,
    availableDaysOff: 30,
    remainingDaysOff: 30,
    overtime: 0,
    workDays: currentOfficeDays.map(day => day),
    roleSplitMain: 100,
    roleSplitSecondary: 0,
    roleSplitTertiary: 0,
    startDate: today,
    endDate: tenYearsLater,
    birthday: "00.00",
  };

  return newEmployee;
}

function selectExsitingEmployee(id) {
  employeeFormDataNew = false;
  const selectedEmployee = getEmployeeById(id);
  selectEmployee(selectedEmployee);
}

function isValidEmployeeEmoji(emoji, emojiField) {
  const isValid = emoji !== "⊖";
  if (emojiField) emojiField.classList.toggle('invalid-field', !isValid);
  return isValid;
}

function isValidEmployeeName(name, nameField) {
  const isValid =
    name !== "?" &&
    name !== "" &&
    name !== "neuer Mitarbeiter" &&
    name !== "undefined" &&
    name !== "Name eingeben" &&
    name !== null;

  if (nameField) {
    nameField.classList.toggle('invalid-field', !isValid);
  }

  return isValid;
}

function isValidEmployeeMainRoleIndex(mainRoleIndex, mainRoleField) {
  const isValid = mainRoleIndex >= 0 && mainRoleIndex <= 11;
  if (mainRoleField) mainRoleField.classList.toggle('invalid-field', !isValid);
  return isValid;
}

function populateShiftOptions() {
  const dayIds = [
    "employee-form-shift-mon",
    "employee-form-shift-tue",
    "employee-form-shift-wed",
    "employee-form-shift-thu",
    "employee-form-shift-fri",
    "employee-form-shift-sat",
    "employee-form-shift-sun"];

  dayIds.forEach((id, dayIndex) => {
    const select = document.getElementById(id);
    select.classList.add('noto');
    if (!select) return;
    select.innerHTML = "";

    function updateSelectBg() {
      const opt = select.options[select.selectedIndex];
      select.style.backgroundColor = opt.style.backgroundColor || "";
      saveButtonHeader.setState('dirty');
    }

    if (currentOfficeDays[dayIndex] === "never") {
      select.style.display = "none";
      let label = document.getElementById(id + "-closed-label");
      if (!label) {
        label = document.createElement("label");
        label.id = id + "-closed-label";
        label.classList.add("flex-row");
        label.innerHTML = `<span class="noto">🔒</span> geschlossen`;
        label.style.backgroundColor = getComputedStyle(document.body).getPropertyValue("--calendar-day-closed-bg"); // Insert label right after the select element 
        select.insertAdjacentElement("afterend", label);
      }
      return;
    }

    select.style.display = "inline-block";
    const oldLabel = document.getElementById(id + "-closed-label");
    if (oldLabel) oldLabel.remove();
    const neverOpt = document.createElement("option");
    neverOpt.value = "never";
    neverOpt.textContent = "nicht eingeplant";
    neverOpt.style.backgroundColor = getComputedStyle(document.body).getPropertyValue("--calendar-day-weekend-bg");
    select.appendChild(neverOpt);

    if (currentOfficeDays[dayIndex]) {
      const shiftKeys = keyToBools(currentOfficeDays[dayIndex]);

      if (shiftKeys.early) {
        const opt = document.createElement("option");
        opt.value = "early";
        opt.innerHTML = "🐓 früh/vormittag";
        opt.classList.add('noto');
        opt.style.backgroundColor = getComputedStyle(document.body).getPropertyValue("--calendar-shift-early-bg");
        select.appendChild(opt);
      }

      if (shiftKeys.day) {
        const opt = document.createElement("option");
        opt.value = "day";
        opt.textContent = "🍴 voll/ganztag";
        opt.classList.add("noto");
        opt.style.backgroundColor = getComputedStyle(document.body).getPropertyValue("--calendar-shift-day-bg");
        select.appendChild(opt);
      }

      if (shiftKeys.late) {
        const opt = document.createElement("option");
        opt.value = "late";
        opt.textContent = "🌛 spät/abend";
        opt.classList.add("noto");
        opt.style.backgroundColor = getComputedStyle(document.body).getPropertyValue("--calendar-shift-late-bg");
        select.appendChild(opt);
      }
    }

    updateSelectBg();
    select.addEventListener("change", updateSelectBg);
  });
}

function populateWeekdaySelection(employee) {
  const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

  weekdays.forEach((day, index) => {
    const selectElement = document.getElementById(`employee-form-shift-${day}`);
    if (!selectElement) return;

    selectElement.classList.remove('shift-warning');
    selectElement.style.backgroundColor = '';
    const warningTextId = `warning-${day}`;
    let warningText = document.getElementById(warningTextId);
    if (warningText) warningText.remove();

    const selectedShift = employee.shifts?.[day];

    const isApprentice = [employee.mainRoleIndex, employee.secondaryRoleIndex, employee.trinaryRoleIndex].includes(13);
    if (isApprentice && !Array.from(selectElement.options).some(opt => opt.value === 'school')) {
      const schoolOption = document.createElement('option');
      schoolOption.value = 'school';
      schoolOption.style.backgroundColor = getComputedStyle(document.body)
        .getPropertyValue('--role-13-color');
      schoolOption.textContent = '📐 Berufsschule';
      schoolOption.classList.add('noto', 'employee-shift-school');
      selectElement.appendChild(schoolOption);
    }

    const optionToSelect = Array.from(selectElement.options).find(opt => opt.value === selectedShift);
    if (optionToSelect) {
      optionToSelect.selected = true;
      selectElement.style.backgroundColor = optionToSelect.style.backgroundColor || '';
    } else if (selectedShift) {
      let warningMessage = 'ungültige Schicht';
      let bgColor = 'yellow';

      const officeClosed = currentOfficeDays[index] === 'never';

      if (officeClosed) {
        warningMessage = 'Büro geschlossen – Einteilung prüfen';
        bgColor = '#ffd6d6';
      }

      selectElement.classList.add('shift-warning');
      selectElement.style.backgroundColor = bgColor;
      selectElement.style.border = '2px solid red';

      warningText = document.createElement('span');
      warningText.id = warningTextId;
      warningText.textContent = warningMessage;
      warningText.style.color = 'red';
      warningText.backgroundColor = 'yellow';
      warningText.style.fontWeight = 'bold';
      warningText.style.display = 'block';
      warningText.style.marginTop = '4px';

      selectElement.parentNode.insertBefore(
        warningText,
        selectElement.nextSibling
      );
    }
  });
}

function updateSelectColor(selectElement) {
  const value = selectElement.value;
  selectElement.classList.remove('employee-shift-early', 'employee-shift-day', 'employee-shift-late', 'employee-shift-closed', 'employee-shift-school');

  switch (value) {
    case 'early':
      selectElement.classList.add('employee-shift-early');
      break;
    case 'day':
      selectElement.classList.add('employee-shift-day');
      break;
    case 'late':
      selectElement.classList.add('employee-shift-late');
      break;
    case 'never':
      selectElement.classList.add('employee-shift-closed');
      break;
    case 'school':
      selectElement.classList.add('employee-shift-school');
      break;
  }
}

function selectEmployee(employee) {
  document.getElementById('employee-form-details').classList.remove('employee-opaque');
  saveButtonHeader.setState('clean');
  const form = document.getElementById("employee-form-details");
  if (!form) {
    console.warn("Employee details form not found!");
    return;
  }
  if (!employee || typeof employee !== "object") {
    console.warn("[selectEmployee] Invalid employee object:", employee);
    return;
  }

  currentEmployeeId = employee.id;
  employee.mainRoleIndex = Number(employee.mainRoleIndex) || 0;

  updateBasicInfo(employee);
  fillRoleDropdowns(employee);
  populateWeekdaySelection(employee);
  rebindEmployeeFormEvents(employee);
}

function updateBasicInfo(employee) {

  const emojiBtn = document.getElementById('employee-emoji-picker-btn');
  if (emojiBtn) {
    emojiBtn.textContent = employee.personalEmoji || '⊖';
    emojiBtn.setAttribute('data-role', employee.mainRoleIndex ?? '');
  }

  const idEl = document.getElementById('employee-id');
  if (idEl) idEl.textContent = employee.id ?? '';

  const nameInput = document.getElementById('employee-name');
  if (nameInput) nameInput.value = employee.name ?? '';

  const vacationLeft = document.getElementById('employee-form-vacation-left');
  if (vacationLeft) vacationLeft.value = employee.remainingDaysOff ?? '';

  const vacationTotal = document.getElementById('employee-form-vacation-total');
  if (vacationTotal) vacationTotal.value = employee.availableDaysOff ?? '';

  const overtimeInput = document.getElementById('employee-form-overtime-input');
  if (overtimeInput) overtimeInput.value = employee.overtime ?? '';

  const startWork = document.getElementById('employee-form-start-work');
  if (startWork) startWork.value = employee.startDate ?? '';

  const endWork = document.getElementById('employee-form-end-work');
  if (endWork) endWork.value = employee.endDate ?? '';

  const bdayDay = document.getElementById('employee-form-birthday-day');
  if (bdayDay) bdayDay.value = employee.birthday ?? '';

  const bdayMonth = document.getElementById('employee-form-birthday-month');
  if (bdayMonth) bdayMonth.value = employee.birthMonth ?? '';

  const vacationUsed = document.getElementById('employee-form-vacation-used');
  if (vacationUsed) {
    const total = Number(vacationTotal?.value) || 0;
    const remaining = Number(vacationLeft?.value) || 0;
    vacationUsed.value = total - remaining;
  }

}

function initEventListenerRoleSelect() {

  const roleMappings = [
    { type: "main", selectId: "employee-details-role-main", sliderId: "employee-form-role1" },
    { type: "secondary", selectId: "employee-details-role-secondary", sliderId: "employee-form-role2" },
    { type: "trinary", selectId: "employee-details-role-trinary", sliderId: "employee-form-role3" },
  ];

  roleMappings.forEach(({ type, selectId, sliderId }) => {
    const selectEl = document.getElementById(selectId);

    if (selectEl) {
      const newSelectEl = selectEl.cloneNode(true);
      selectEl.parentNode.replaceChild(newSelectEl, selectEl);

      newSelectEl.addEventListener("change", (e) => {
        const selected = e.target.options?.[e.target.selectedIndex];
        const newValue = selected?.dataset?.colorIndex ?? e.target.value;
        handleRoleChange(type, newValue);
        saveButtonHeader.setState('dirty');
      });
    } else {
      console.warn(`⚠️ Missing select element: #${selectId}`);
    }
  });
}

function bindEmojiClick(employee) {
  const emojiBtn = document.getElementById('employee-emoji-picker-btn');
  emojiBtn.addEventListener('click', () => bindEmojiPickerToEmployee(employee));
}

function bindEmployeeDateAndNumberInputs(employee) {
  const fieldIds = [
    'employee-form-start-work',
    'employee-form-end-work',
    'employee-form-birthday-day',
    'employee-form-birthday-month',
  ];

  fieldIds.forEach(id => {
    const input = document.getElementById(id);
    if (!input) return;

    if (input._validateHandler) {
      input.removeEventListener('input', input._validateHandler);
      input.removeEventListener('change', input._validateHandler);
    }

    const handler = () => {
      employee.startDate = document.getElementById('employee-form-start-work')?.value || '';
      employee.endDate = document.getElementById('employee-form-end-work')?.value || '';
      employee.birthday = document.getElementById('employee-form-birthday-day')?.value || '';
      employee.birthMonth = document.getElementById('employee-form-birthday-month')?.value || '';
      validateEmployeeFields(employee);
    };
    const isSelect = input.tagName === "SELECT";
    if (isSelect) {
      input.addEventListener('change', handler);
    } else {
      input.addEventListener('input', handler);
      input.addEventListener('change', handler);
    }
    input._validateHandler = handler;
  });
}

function bindEmployeeVacationInputs(employee) {
  const totalInput = document.getElementById('employee-form-vacation-total');
  const leftInput = document.getElementById('employee-form-vacation-left');
  const usedInput = document.getElementById('employee-form-vacation-used');

  if (!totalInput || !leftInput || !usedInput) return;

  // prevent double-binding
  [totalInput, leftInput, usedInput].forEach(input => {
    if (input._vacationHandler) {
      input.removeEventListener('input', input._vacationHandler);
      input.removeEventListener('change', input._vacationHandler);
    }
  });

  const handler = (ev) => {
    const source = ev.target.id;

    let total = Number(totalInput.value) || 0;
    let left = Number(leftInput.value) || 0;
    let used = Number(usedInput.value) || 0;

    if (source === 'employee-form-vacation-total') {
      // total changed → keep used, recalc remaining
      left = Math.max(0, total - used);
      leftInput.value = left;

    } else if (source === 'employee-form-vacation-left') {
      // remaining changed → recalc used
      used = Math.max(0, total - left);
      usedInput.value = used;

    } else if (source === 'employee-form-vacation-used') {
      // used changed → recalc remaining
      left = Math.max(0, total - used);
      leftInput.value = left;
    }

    // update employee model (canonical fields only!)
    employee.availableDaysOff = total;
    employee.remainingDaysOff = left;

    validateEmployeeFields(employee); // marks dirty + enables save
  };

  [totalInput, leftInput, usedInput].forEach(input => {
    input.addEventListener('input', handler);
    input.addEventListener('change', handler);
    input._vacationHandler = handler;
  });
}


function resetEmployeeBirthday() {
  const employee = getEmployeeById(currentEmployeeId);
  if (!employee) return;
  const bdayDay = document.getElementById('employee-form-birthday-day');
  const bdayMonth = document.getElementById('employee-form-birthday-month');

  if (bdayDay) bdayDay.value = '';
  if (bdayMonth) bdayMonth.value = '';

  employee.birthday = '';
  employee.birthMonth = '';

  validateEmployeeFields(employee);
}

function validateEmployeeFields(employee) {
  const emojiBtn = document.getElementById('employee-emoji-picker-btn');
  const nameInput = document.getElementById('employee-name');
  const saveBtn = document.getElementById('employee-store-button');

  if (!emojiBtn || !nameInput || !saveBtn) return;

  const emoji = employee.personalEmoji;
  const name = nameInput.value.trim();

  const nameValid = isValidEmployeeName(name, nameInput);
  const defaultEmojis = ['⊖', '👤'];
  const isDefaultEmoji = defaultEmojis.includes(emoji);

  if (!nameValid) {
    nameInput.focus();
    saveButtonHeader.setState('blocked');
    return;
  }

  if (isDefaultEmoji) {
    emojiBtn.focus();
    saveButtonHeader.setState('blocked');
    return;
  }

  saveButtonHeader.setState('dirty');
  saveBtn.focus();
}

function clearDropdown(dropdown) {
  dropdown.innerHTML = '';
}

function toRoleIndex(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function getRoleIndexFromSelect(selectId, fallback = 0) {
  const select = document.getElementById(selectId);
  if (!select) return fallback;

  const selected = select.options?.[select.selectedIndex];
  if (!selected) return fallback;

  const fromData = toRoleIndex(selected.dataset?.colorIndex, NaN);
  if (Number.isInteger(fromData)) return fromData;

  return toRoleIndex(select.value, fallback);
}

function getRoleColorIndex(role) {
  if (!role || typeof role !== 'object') return -1;
  const rawIndex =
    role.colorIndex ??
    role.roleColorIndex ??
    role.rolecolorindex ??
    role.roleIndex ??
    role.index;
  return toRoleIndex(rawIndex, -1);
}

function getRoleDisplayName(role) {
  if (!role || typeof role !== 'object') return '';
  const rawName = role.name ?? role.roleName ?? role.rolename;
  return typeof rawName === 'string' ? rawName.trim() : '';
}

function getRoleDisplayEmoji(role) {
  if (!role || typeof role !== 'object') return '';
  const rawEmoji = role.emoji ?? role.roleEmoji ?? role.icon;
  return typeof rawEmoji === 'string' ? rawEmoji.trim() : '';
}

function getNormalizedRoleOptions() {
  const byIndex = new Map();

  (cachedRoles || []).forEach((role) => {
    const idx = getRoleColorIndex(role);
    if (idx < 0) return;
    byIndex.set(idx, {
      name: getRoleDisplayName(role),
      emoji: getRoleDisplayEmoji(role),
      colorIndex: idx
    });
  });

  const all = [];
  for (let idx = 0; idx <= 13; idx++) {
    const fromData = byIndex.get(idx) || {};
    const fallbackName =
      idx === 0 ? 'Keine'
        : idx === 13 ? 'Azubi'
          : `Aufgabe ${idx}`;
    const fallbackEmoji =
      idx === 0 ? '🚫'
        : idx === 13 ? '✏️'
          : '🧩';

    const safeName = fromData.name && fromData.name !== '?' ? fromData.name : fallbackName;
    const safeEmoji = fromData.emoji || fallbackEmoji;
    all.push({ name: safeName, emoji: safeEmoji, colorIndex: idx });
  }

  return all;
}

function fillMainRoleDropdown(employee) {
  if (!employee) {
    console.error("[employee-form] details main: no employee passed");
    return null;
  }

  let roleOptions = getNormalizedRoleOptions();

  const emoji = document.getElementById('employee-details-icon-main');
  const slider = document.getElementById('employee-form-role1');
  const sliderLabel = document.getElementById('role1-value');
  const dropDown = document.getElementById('employee-details-role-main');

  if (!emoji || !slider || !sliderLabel || !dropDown) {
    console.warn("[employee-form] details-main: missing one or more UI elements in DOM");
    return employee;
  }

  clearDropdown(dropDown);

  emoji.classList.remove('invalid-field');
  dropDown.classList.remove('invalid-field');

  employee.mainRoleIndex = toRoleIndex(employee.mainRoleIndex, 0);
  if (employee.mainRoleIndex === 0) {
    emoji.classList.add('invalid-field');
    dropDown.classList.add('invalid-field');
  }

  if (!roleOptions.find(r => Number(r.colorIndex) === 13)) {
    roleOptions.push({ name: "Azubi", emoji: "✏️", colorIndex: 13 });
  }

  const selectedRole = roleOptions.find(
    ro => Number(ro.colorIndex) === Number(employee.mainRoleIndex)
  ) || roleOptions[0];


  if (!selectedRole) {
    console.warn("[eployeee-form] Details, no employee selected");
    return;
  }

  if (Number(selectedRole.colorIndex) !== 0) {
    roleOptions = roleOptions.filter(r => Number(r.colorIndex) !== 0);
  }

  const roleColor = getComputedStyle(document.body)
    .getPropertyValue(`--role-${employee.mainRoleIndex}-color`)
    .trim();

  emoji.textContent = selectedRole.emoji;
  emoji.style.backgroundColor = roleColor;

  roleOptions.forEach(r => {
    const option = createRoleOption(r, employee.mainRoleIndex);
    dropDown.appendChild(option);
  });

  return employee;
}

function createRoleOption(role, selectedValue) {
  const option = document.createElement("option");
  option.value = String(role.colorIndex ?? 0);
  option.dataset.colorIndex = String(role.colorIndex);
  option.textContent = `${role.emoji} ⇨ ${role.name} `;
  option.classList.add("employee-details-role-selector", "noto");

  const roleColor = getComputedStyle(document.body)
    .getPropertyValue(`--role-${role.colorIndex}-color`)
    .trim();
  if (roleColor) option.style.backgroundColor = roleColor;

  option.selected = Number(role.colorIndex) === Number(selectedValue);
  return option;
}
function fillSecondaryRoleDropdown(employee) {
  if (!employee) {
    console.error("[employee-form] details main: no employee passed");
    return null;
  }

  let roleOptions = getNormalizedRoleOptions();

  const emoji = document.getElementById('employee-details-icon-secondary');
  const slider = document.getElementById('employee-form-role2');
  const sliderLabel = document.getElementById('role2-value');
  const dropDown = document.getElementById('employee-details-role-secondary');

  if (!emoji || !slider || !sliderLabel || !dropDown) {
    console.warn("[employee-form] details-main: missing one or more UI elements in DOM");
    return employee;
  }

  clearDropdown(dropDown);

  emoji.classList.remove('invalid-field');
  dropDown.classList.remove('invalid-field');

  employee.secondaryRoleIndex = toRoleIndex(employee.secondaryRoleIndex, 0);
  employee.mainRoleIndex = toRoleIndex(employee.mainRoleIndex, 0);

  if (employee.mainRoleIndex === 13) {
    dropDown.classList.remove('invalid-field');
    emoji.classList.remove('invalid-field');

    roleOptions = roleOptions.filter(r => Number(r.colorIndex) !== 0 && Number(r.colorIndex) !== 13);

    if (!employee.secondaryRoleIndex || employee.secondaryRoleIndex === 0) {
      employee.secondaryRoleIndex = toRoleIndex(roleOptions[0]?.colorIndex, 1);
    }
  } else {
    if (employee.mainRoleIndex === 13 && employee.secondaryRoleIndex === 0) {
      emoji.classList.add('invalid-field');
      dropDown.classList.add('invalid-field');
    }
  }

  roleOptions = roleOptions.filter(r => Number(r.colorIndex) !== Number(employee.mainRoleIndex));

  if (!roleOptions.find(r => Number(r.colorIndex) === 0)) {
    roleOptions.unshift({ name: "Keine", emoji: "🚫", colorIndex: 0 });
  }

  if (employee.mainRoleIndex !== 13) {
    roleOptions = roleOptions.filter(r => Number(r.colorIndex) !== 13);
  }

  const selectedRole = roleOptions.find(
    ro => Number(ro.colorIndex) === Number(employee.secondaryRoleIndex)
  ) || roleOptions[0];

  if (!selectedRole) {
    console.warn("[employee-form] Details, no employee selected");
    return;
  }

  const roleColor = getComputedStyle(document.body)
    .getPropertyValue(`--role-${employee.secondaryRoleIndex}-color`)
    .trim();

  emoji.textContent = selectedRole.emoji;
  emoji.style.backgroundColor = roleColor;

  slider.value = employee.roleSplitSecondary;
  slider.style.setProperty('--slider-color', roleColor);

  const newVal = employee.roleSplitSecondary * 10;
  sliderLabel.innerHTML = `Präferenz: ${newVal}%`;

  roleOptions.forEach(r => {
    const option = createRoleOption(r, employee.secondaryRoleIndex);
    dropDown.appendChild(option);
  });

  return employee;
}

function handleRoleChange(roleType, newValue) {
  const employee = getEmployeeById(currentEmployeeId);
  if (!employee) return;

  const numericValue = Number(newValue);

  switch (roleType) {
    case 'main':
      const wasApprentice = employee.mainRoleIndex === 13;
      const isNowApprentice = numericValue === 13;

      employee.mainRoleIndex = numericValue;

      if (isNowApprentice && employee.secondaryRoleIndex === 0) {
        employee.secondaryRoleIndex = 1;
      }

      if (wasApprentice && !isNowApprentice) {
      }
      break;

    case 'secondary':
      employee.secondaryRoleIndex = numericValue;

      if (employee.mainRoleIndex === 13 && numericValue === 0) {
        employee.secondaryRoleIndex = 1;
      }
      break;

    case 'trinary':
      employee.tertiaryRoleIndex = numericValue;
      break;

    default:
      return;
  }

  fillRoleDropdowns(employee);
  saveButtonHeader.setState('dirty');
}

function fillRoleDropdowns(employee) {
  employee = fillMainRoleDropdown(employee);
  employee = fillSecondaryRoleDropdown(employee);
  employee = fillTrinaryRoleDropdown(employee);
  return employee;
}

function fillTrinaryRoleDropdown(employee) {
  if (!employee) return null;

  let roleOptions = getNormalizedRoleOptions();
  const emoji = document.getElementById('employee-details-icon-trinary');
  const slider = document.getElementById('employee-form-role3');
  const sliderLabel = document.getElementById('role3-value');
  const dropDown = document.getElementById('employee-details-role-trinary');

  if (!emoji || !slider || !sliderLabel || !dropDown) return employee;

  employee.mainRoleIndex = toRoleIndex(employee.mainRoleIndex, 0);
  employee.secondaryRoleIndex = toRoleIndex(employee.secondaryRoleIndex, 0);
  employee.tertiaryRoleIndex = toRoleIndex(employee.tertiaryRoleIndex, 0);

  clearDropdown(dropDown);

  roleOptions = roleOptions.filter(r => Number(r.colorIndex) !== Number(employee.mainRoleIndex));
  roleOptions = roleOptions.filter(r => Number(r.colorIndex) !== Number(employee.secondaryRoleIndex));

  if (!roleOptions.find(r => Number(r.colorIndex) === 0)) {
    roleOptions.unshift({ name: "Keine", emoji: "🚫", colorIndex: 0 });
  }
  roleOptions = roleOptions.filter(r => Number(r.colorIndex) !== 13);

  const selectedRole = roleOptions.find(ro => Number(ro.colorIndex) === Number(employee.tertiaryRoleIndex)) || roleOptions[0];

  const roleColor = getComputedStyle(document.body).getPropertyValue(`--role-${employee.tertiaryRoleIndex}-color`).trim();
  emoji.textContent = selectedRole.emoji;
  emoji.style.backgroundColor = roleColor;

  slider.value = employee.roleSplitTertiary || 0;
  slider.style.setProperty('--slider-color', roleColor);
  sliderLabel.innerHTML = `Präferenz: ${(employee.roleSplitTertiary || 0) * 10}%`;

  roleOptions.forEach(r => {
    const option = createRoleOption(r, employee.tertiaryRoleIndex);
    dropDown.appendChild(option);
  });

  return employee;
}

function formatDateInput(date) {
  if (!date) return "";
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0'); // month is 0-based
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function sanityCheckEmployee(employee) {
  if (!employee) {
    console.warn('[employee-form] sanity check called without valid employee');
    return false;
  }

  employee.corrupt = false;
  employee.warning = '';

  const failMandatory = sanityCheckEmployeeMandatory(employee);
  const failRoles = sanityCheckEmployeeRoles(employee);
  const failShifts = sanityCheckEmployeeShifts(employee);

  let warnings = '';
  if (failMandatory) warnings += 'Name oder Emoji fehlen.\n';
  if (failRoles) warnings += 'Keine gültige Hauptaufgabe gewählt.\n';
  if (failShifts) warnings += 'Ungültige oder fehlende Schichtauswahl.\n';

  if (failMandatory || failRoles || failShifts) {
    markEmployeeAsCorrupt(employee, warnings);
    console.warn(`[sanityCheck] FAIL: ${warnings.replace(/\n/g, '; ')}`);
    return false;
  }

  return true;
}

function sanityCheckEmployeeMandatory(employee) {
  let fixed = false;

  if (!employee.id) {
    employee.id = Date.now();
    fixed = true;
    console.info(`[mandatory] Assigned new ID: ${employee.id}`);
  }

  const forbiddenNames = ['?', 'neuer Mitarbeiter', '', 'Name eingeben'];
  const forbiddenEmojies = ['', '👤', '⊖'];

  if (!employee.name || forbiddenNames.includes(employee.name.trim())) {
    console.warn(`[mandatory] Invalid name: "${employee.name}"`);
    return true;
  }

  if (!employee.personalEmoji || forbiddenEmojies.includes(employee.personalEmoji.trim())) {
    console.warn(`[mandatory] Invalid emoji: "${employee.personalEmoji}"`);
    return true;
  }

  if (fixed) console.info(`[mandatory] Self-healed ID for ${employee.name}`);
  return false;
}

function sanityCheckEmployeeRoles(employee) {
  let result = false;

  if (employee.mainRoleIndex === 13 && employee.secondaryRoleIndex === 0) {
    console.warn('[roles] Main role is 13 with no secondary role, marked as fail');
    return true;
  }

  if (employee.mainRoleIndex < 1 || employee.mainRoleIndex > 13) {
    console.warn('[roles] Main role out of bounds, attempting self-heal');
    result = true;
  }

  return result;
}

function sanityCheckEmployeeShifts(employee) {

  if (!employee || !employee.shifts) {
    console.warn('[shifts] No shifts defined');
    return true;
  }

  if (employee.workDays.every(day => day === 'never')) {
    console.warn('[shifts] No work days assigned');
    return true;
  }

  const weekDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  let warnings = [];

  weekDays.forEach((day, i) => {
    const officeKey = officeDays[i] || 'never';
    const empKey = employee.shifts[day] || 'never';

    const office = keyToBools(officeKey);
    const emp = keyToBools(empKey);

    const invalid =
      (emp.early && !office.early) ||
      (emp.day && !office.day) ||
      (emp.late && !office.late);

    if (invalid) {
      warnings.push(`${day.toUpperCase()}: ${empKey} not allowed (office=${officeKey})`);
    }
  });

  if (warnings.length > 0) {
    console.warn('[shifts] Shift sanity warnings:', warnings);
    markEmployeeAsCorrupt(employee, warnings.join('\n'));
    return false;
  }

  return false;
}

function markEmployeeAsCorrupt(employee, warningText) {
  console.warn(`[employee-form] Corrupt employee detected: ${employee.name}`, warningText);
  employee.corrupt = true;
  employee.warning = warningText;
}

function renderEmployeeList() {
  const listContainer = document.getElementById('employee-list');
  if (!listContainer) return console.error('Employee list container not found!');

  listContainer.innerHTML = '';

  cachedEmployees.forEach(employee => {

    if (employee.personalEmoji === '🗑️') return;

    employee.corrupt = false;
    employee.warning = '';
    const valid = sanityCheckEmployee(employee);
    const listItem = document.createElement('div');

    listItem.classList.add('employee-item');
    listItem.classList.remove('corrupt');

    if (!valid || employee.corrupt) {
      listItem.classList.add('corrupt');
    }

    const emojiElement = document.createElement('span');
    emojiElement.classList.add('employee-emoji', 'noto');
    emojiElement.textContent = employee.personalEmoji;
    emojiElement.setAttribute('data-role', employee.mainRoleIndex);
    listItem.appendChild(emojiElement);

    listItem.appendChild(document.createTextNode(`${employee.name}`));

    listItem.addEventListener('click', (e) => {
      e.stopPropagation();
      selectExsitingEmployee(employee.id);
    });

    const ellipses = createEmployeeEllipsis(employee);

    listItem.appendChild(ellipses);

    listContainer.appendChild(listItem);
  });
}

function createEmployeeEllipsis(employee) {

  const context = {
    delete: () => deleteEmployeeSafely(employee.id),
    copy: () => copyEmployee(employee)
  };

  if (employee.warnings?.length > 0) {
    context.inspect = () => showEmployeeWarnings(employee);
  }

  if (employee.warnings?.includes('Keine gültige Hauptaufgabe gewählt.') ||
    employee.warnings?.includes('Ungültige oder fehlende Schichtauswahl.')) {
    context.repair = () => autoRepair(employee);
  }

  const actions = Object.keys(context);

  return createEllipsis(actions, context);
}


function autoRepair(employee) {
  if (employee.warnings.includes('Keine gültige Hauptaufgabe gewählt.')) {
    autorepairEmployeeRole(employee);
  }
  if (employee.warnings.includes('Ungültige oder fehlende Schichtauswahl.')) {
    autoRepairEmployeeShift(employee);
  }
}


function copyEmployee(employee) {
  console.log("copy exsiting employee");
}

function showEmployeeWarnings(employee) {
  console.log(" show warning details ")
}

function autoRepairEmployeeShift(employee) {
  console.log(" auto repair employee shift");
}

function autorepairEmployeeRole(employee) {
  console.log(" auto repair employee role");
}

function deleteEmployeeSafely(employeeId) {
  if (deletionLock) return;
  deletionLock = true;

  const btn = document.getElementById("employee-delete-button");
  if (btn) btn.disabled = true;

  setTimeout(() => { deletionLock = false; if (btn) btn.disabled = false; }, 1500);

  performDelete(employeeId);
}

function performDelete(employeeId) {
  const employee = cachedEmployees.find(e => String(e.id) === String(employeeId));
  if (!employee) return console.error("Cannot delete: employee not found");

  const employeeData = {
    ...employee,
    personalEmoji: "🗑️",
    endDate: new Date().toISOString().split("T")[0]
  };

  storeEmployeeChange(api, employeeData, "delete");
}

function createButtonLock(timeoutMs = 5000) {
  let locked = false;
  let timer = null;

  return {
    isLocked() {
      return locked;
    },

    lock() {
      locked = true;

      timer = setTimeout(() => {
        console.warn("⚠ UI lock auto-released after timeout");
        locked = false;
      }, timeoutMs);
    },

    unlock() {
      locked = false;
      if (timer) clearTimeout(timer);
      timer = null;
    }
  };
}

