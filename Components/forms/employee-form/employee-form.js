import { loadRoleData } from '../../../js/loader/role-loader.js';
import { loadEmployeeData, storeEmployeeChange } from '../../../js/loader/employee-loader.js';
import { createEmojiPicker } from '../../../Components/emojiPicker/emojiPicker.js';
import { loadOfficeDaysData, officeDays } from '../../../js/loader/calendar-loader.js';
import { keyToBools } from '../calendar-form/calendar-form-utils.js';
import { createHelpButton } from '../../../js/Utils/helpPageButton.js';
import { createWindowButtons } from '../../../js/Utils/minMaxFormComponent.js';
import { createBranchSelect } from '../../../js/Utils/branch-select.js';
import { createSaveAllButton, saveAll } from '../../../js/Utils/saveAllButton.js';
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

let employeeFormDataChanged;
let employeeFormDataNew;
let currentOfficeDays;
let api;
let currentEmployeeId;
let cachedEmployees = [];
let cachedRoles = [];
let deletionLock = false;
let isDividerUpdating = false;
let saveButtonHeader;

export async function initializeEmployeeForm(passedApi) {

  console.groupCollapsed(
    "[EmployeeForm] initializeEmployeeForm called"
  );
  console.trace();
  console.groupEnd();


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

  // NEW: Load custom emoji data
  const emojiData = await loadEmojiData(api);
  if (emojiData?.employeeEmojis?.length) {
    console.log("[EmployeeForm] Using custom employee emojis:", emojiData.employeeEmojis);
    employeeEmojis.length = 0;
    employeeEmojis.push(...emojiData.employeeEmojis);
    console.log(emojiData);
    console.log(employeeEmojis);
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

  //selectEmployee(getEmployeeById(currentEmployeeId));
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
  setButtonVisibility({ delete: false, store: false, reset: false });
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
  createDateRangePicker({
    startButton: "#pick-employee-start",
    endButton: "#pick-employee-end",
    startInput: "#employee-form-start-work",
    endInput: "#employee-form-end-work",
    previewStart: "#employee-preview-start",
    previewEnd: "#employee-preview-end",
    previewDuration: "#employee-duration",
    onChange: (startVal, endVal) => {
      const employee = {
        startDate: startVal || "",
        endDate: endVal || ""
      };
      validateEmployeeFields(employee);
      setButtonVisibility({ store: true });
    }
  });
}


let privacyClickListener = null;
let lastPrivacyState = true;

export function initPrivacyWarningToggle() {
  const button = document.getElementById('privacy-warn-chev');
  const fieldset = document.getElementById('privacy-warning-collapsible');
  if (!button || !fieldset) return;

  // restore last cached state
  const isActive = lastPrivacyState;

  button.classList.toggle('active', isActive);
  fieldset.classList.toggle('active', isActive);
  button.textContent = isActive ? '▼' : '▶';

  if (privacyClickListener) {
    button.removeEventListener('click', privacyClickListener);
  }

  privacyClickListener = () => {
    const isActive = fieldset.classList.toggle('active');
    button.classList.toggle('active', isActive);
    button.textContent = isActive ? '▼' : '▶';
    lastPrivacyState = isActive; // update cache
  };

  button.addEventListener('click', privacyClickListener);
}

function renderNewEmployeeForm() {
  // mark form as "new"
  window.employeeFormDataNew = true;

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

  // reset form fields and rebind events
  resetEmployeeForm(newEmployeeDefaults);
  rebindEmployeeFormEvents(newEmployeeDefaults);

  // log for debugging
  console.log("office data:", officeDays);

  // hide delete/reset/store buttons for new employee (corrected the copy/paste bug)
  const deleteButton = document.getElementById("employee-delete-button");
  if (deleteButton) deleteButton.style.display = "none";

  const resetButton = document.getElementById("employee-reset-button");
  if (resetButton) resetButton.style.display = "none"; // <--- fixed

  const storeButton = document.getElementById("employee-store-button");
  if (storeButton) storeButton.style.display = ""; // allow store button to show for new

  fillRoleDropdowns(newEmployeeDefaults);
  initEventListenerRoleSelect();

  // ensure the button wiring reflects "new" mode
  setButtonVisibility({ delete: false, store: true, reset: false });
}

function rebindEmployeeFormEvents(employee) {
  bindNameInputToEmployee(employee);
  bindEmojiClick(employee);
  bindEmployeeDateAndNumberInputs(employee);
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
    mainRoleIndex: parseInt(document.getElementById("employee-details-role-main")?.value),
    secondaryRoleIndex: parseInt(document.getElementById("employee-details-role-secondary")?.value) || 0,
    tertiaryRoleIndex: parseInt(document.getElementById("employee-details-role-trinary")?.value) || 0,
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
    action = "update"; // treat as update for saving
  }
  storeEmployeeChange(api, employeeData, action);
  setButtonVisibility({ delete: false, store: false, reset: false });
}

function updateDivider(className) {
  if (isDividerUpdating) return;
  isDividerUpdating = true;
  const divider = document.getElementById('horizontal-divider');
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

  const branchSelect = createBranchSelect({
    onChange: (val) => {
      console.log('Branch changed to:', val);
      // applyBranchPreset(val);
    }
  });
  saveButtonHeader = createSaveButton({ onSave: () => storeAllEmployees(api) });

  const windowBtns = createWindowButtons(); // your new min/max buttons

  buttonContainer.append(saveButtonHeader.el, helpBtn, branchSelect, windowBtns);

  divider.append(leftGap, h2, buttonContainer);
}

function storeAllEmployees(api) {
  console.log("store all employees");
}

function initSliderListeners(employee) {
  const roles = [employee.mainRoleIndex, employee.secondaryRoleIndex, employee.tertiaryRoleIndex];

  // Special case: Apprentice (role 13) must have secondary role
  if (employee.mainRoleIndex === 13 && employee.secondaryRoleIndex === 0) {
    // Force apprentice to have a secondary role
    employee.secondaryRoleIndex = 1; // Default to first available role
    fillRoleDropdowns(employee);
  }

  // Special case: No main role (0) - should not happen but handle it
  if (employee.mainRoleIndex === 0) {
    initializeNoRoleSliders();
    return;
  }


  const activeRoles = roles.filter(r => r && r != 0).length;

  // Rebind all sliders
  [1, 2, 3].forEach(i => {
    const slider = document.getElementById(`employee-form-role${i}`);
    if (!slider) return;

    const newSlider = slider.cloneNode(true);
    slider.parentNode.replaceChild(newSlider, slider);
  });

  // Initialize based on active roles
  if (activeRoles === 1) {
    initializeSingleRoleSliders(employee);
  } else if (activeRoles === 2) {
    initializeTwoRoleSliders(employee);
  } else if (activeRoles === 3) {
    initializeThreeRoleSliders(employee);
  }
}

function initializeThreeRoleSliders(employee) {
  // Apprentice cannot have three roles - revert to two-role mode
  if (employee.mainRoleIndex === 13 || employee.secondaryRoleIndex === 13) {
    initializeTwoRoleSliders(employee);
    return;
  }

  const s1 = document.getElementById("employee-form-role1");
  const s2 = document.getElementById("employee-form-role2");
  const s3 = document.getElementById("employee-form-role3");

  // Set initial values with proper constraints
  let mainValue = employee.roleSplitMain || 4;
  let secondaryValue = employee.roleSplitSecondary || 3;
  let tertiaryValue = employee.roleSplitTertiary || 3;

  // Normalize to ensure constraints
  [mainValue, secondaryValue, tertiaryValue] = normalizeThreeSliders(mainValue, secondaryValue, tertiaryValue);

  s1.value = mainValue;
  s2.value = secondaryValue;
  s3.value = tertiaryValue;

  enableSliders([1, 2, 3]);

  // Remove old listeners and add new ones
  s1.oninput = null;
  s2.oninput = null;
  s3.oninput = null;

  s1.addEventListener("input", () => onThreeRoleSliderChange("employee-form-role1", +s1.value));
  s2.addEventListener("input", () => onThreeRoleSliderChange("employee-form-role2", +s2.value));
  s3.addEventListener("input", () => onThreeRoleSliderChange("employee-form-role3", +s3.value));

  updateSliderLabels();
}



function initializeSingleRoleSliders(employee) {
  // Special case: Apprentice with only main role (shouldn't happen but handle it)
  if (employee.mainRoleIndex === 13) {
    // Apprentice must have secondary role - force two-role mode
    initializeTwoRoleSliders(employee);
    return;
  }

  document.getElementById("employee-form-role1").value = 10;
  document.getElementById("employee-form-role2").value = 0;
  document.getElementById("employee-form-role3").value = 0;

  disableSlidersExcept(1);
  updateSliderLabels();
}

function initializeTwoRoleSliders(employee) {
  const s1 = document.getElementById("employee-form-role1");
  const s2 = document.getElementById("employee-form-role2");
  const s3 = document.getElementById("employee-form-role3");

  // Special apprentice rules
  if (employee.mainRoleIndex === 13) {
    // Apprentice: main role (school) gets fixed percentage
    const apprenticeMainValue = 4; // Fixed 40% for school
    const apprenticeSecondaryValue = 6; // Remaining 60% for work

    s1.value = apprenticeMainValue;
    s2.value = apprenticeSecondaryValue;
    s3.value = 0;

    // Apprentice sliders are fixed - cannot be changed
    s1.disabled = true;
    s2.disabled = true;
    s3.disabled = true;

    updateSliderLabels();
    return;
  }

  // Normal two-role case
  let mainValue = employee.roleSplitMain || 5;
  let secondaryValue = employee.roleSplitSecondary || 5;

  // Ensure they sum to 10
  if (mainValue + secondaryValue !== 10) {
    mainValue = 5;
    secondaryValue = 5;
  }

  s1.value = mainValue;
  s2.value = secondaryValue;
  s3.value = 0;

  enableSliders([1, 2]);

  // Remove old listeners and add new ones
  s1.oninput = null;
  s2.oninput = null;

  s1.addEventListener("input", () => onTwoRoleSliderChange("employee-form-role1", +s1.value));
  s2.addEventListener("input", () => onTwoRoleSliderChange("employee-form-role2", +s2.value));

  updateSliderLabels();
}


function initializeNoRoleSliders() {
  // When no main role is selected, disable everything
  document.getElementById("employee-form-role1").value = 0;
  document.getElementById("employee-form-role2").value = 0;
  document.getElementById("employee-form-role3").value = 0;

  disableSlidersExcept(-1); // Disable all
  updateSliderLabels();
}



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
  nameInput._keydownHandler = handler; // store reference for cleanup
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
      setButtonVisibility({ store: true });
    }

    // --- CASE: "never" => show label, hide dropdown --- 
    if (currentOfficeDays[dayIndex] === "never") {
      select.style.display = "none"; // hide dropdown 
      let label = document.getElementById(id + "-closed-label");
      if (!label) {
        label = document.createElement("label");
        label.id = id + "-closed-label";
        label.classList.add("flex-row");
        label.innerHTML = `<span class="noto">🔒</span> geschlossen`;
        label.style.backgroundColor = getComputedStyle(document.body).getPropertyValue("--calendar-day-closed-bg"); // Insert label right after the select element 
        select.insertAdjacentElement("afterend", label);
      }
      return; // skip the rest
    }

    // --- CASE: normal shifts => show dropdown, remove label --- 
    select.style.display = "inline-block";
    const oldLabel = document.getElementById(id + "-closed-label");
    if (oldLabel) oldLabel.remove(); // never option 
    const neverOpt = document.createElement("option");
    neverOpt.value = "never";
    neverOpt.textContent = "nicht eingeplant";
    neverOpt.style.backgroundColor = getComputedStyle(document.body).getPropertyValue("--calendar-day-weekend-bg");
    select.appendChild(neverOpt);

    // shift options 
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


// Also add this function to properly initialize the employee selection:
function selectEmployee(employee) {
  const form = document.getElementById("employee-form-details");
  if (!form) {
    console.warn("Employee details form not found!");
    return;
  }
  if (!employee || typeof employee !== "object") {
    console.warn("[selectEmployee] Invalid employee object:", employee);
    return;
  }

  currentEmployeeId = employee.id; // SET THE CURRENT EMPLOYEE ID!
  employee.mainRoleIndex = Number(employee.mainRoleIndex) || 0;

  updateBasicInfo(employee);
  fillRoleDropdowns(employee);
  populateWeekdaySelection(employee);
  rebindEmployeeFormEvents(employee);
  initSliderListeners(employee); // ADD THIS LINE!
  setButtonVisibility({ delete: true, store: false, reset: false });
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
        const newValue = e.target.value;
        handleRoleChange(type, newValue);
        setButtonVisibility({ store: true });
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
    input.addEventListener('input', handler);
    input.addEventListener('change', handler);
    input._validateHandler = handler;
  });
}

function resetEmployeeBirthday() {
  const employee = getEmployeeById(currentEmployeeId);
  console.log("remove birthday");
  if (!employee) return;
  const bdayDay = document.getElementById('employee-form-birthday-day');
  const bdayMonth = document.getElementById('employee-form-birthday-month');

  if (bdayDay) bdayDay.value = ''; // or '0' if you prefer
  if (bdayMonth) bdayMonth.value = ''; // or '0' if you prefer

  // Update employee object
  employee.birthday = '';
  employee.birthMonth = '';

  validateEmployeeFields(employee); // keep validation consistent
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
    setButtonVisibility({ delete: false, store: false, reset: false });
    return;
  }

  if (isDefaultEmoji) {
    emojiBtn.focus();
    setButtonVisibility({ delete: false, store: false, reset: false });
    return;
  }

  setButtonVisibility({ delete: false, store: true, reset: false });
  saveBtn.focus();
}

function clearDropdown(dropdown) {
  dropdown.innerHTML = '';
}

function fillMainRoleDropdown(employee) {
  if (!employee) {
    console.error("[employee-form] details main: no employee passed");
    return null;
  }

  let roleOptions = [...cachedRoles];

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

  if (!employee.mainRoleIndex) employee.mainRoleIndex = 0;
  if (employee.mainRoleIndex === 0) {
    emoji.classList.add('invalid-field');
    dropDown.classList.add('invalid-field');
  }

  if (!roleOptions.find(r => r.colorIndex === 13)) {
    roleOptions.push({ name: "Azubi", emoji: "✏️", colorIndex: 13 });
  }

  const selectedRole = roleOptions.find(
    ro => Number(ro.colorIndex) === Number(employee.mainRoleIndex)
  ) || roleOptions[0];


  if (!selectedRole) {
    console.warn("[eployeee-form] Details, no employee selected");
    return;
  }

  if (selectedRole !== 0) roleOptions = roleOptions.filter(r => r.colorIndex !== 0);

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
  option.value = role.colorIndex;
  option.textContent = `${role.emoji} ⇨ ${role.name} `;
  option.classList.add("employee-details-role-selector", "noto");

  const roleColor = getComputedStyle(document.body)
    .getPropertyValue(`--role-${role.colorIndex}-color`)
    .trim();
  if (roleColor) option.style.backgroundColor = roleColor;

  option.selected = Number(role.colorIndex) === selectedValue;
  return option;
}
function fillSecondaryRoleDropdown(employee) {
  if (!employee) {
    console.error("[employee-form] details main: no employee passed");
    return null;
  }

  let roleOptions = [...cachedRoles];

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

  if (!employee.secondaryRoleIndex) employee.secondaryRoleIndex = 0;

  // Special apprentice handling
  if (employee.mainRoleIndex === 13) {
    // For apprentice, secondary role is mandatory
    dropDown.classList.remove('invalid-field');
    emoji.classList.remove('invalid-field');

    // Filter out invalid roles for apprentice secondary
    roleOptions = roleOptions.filter(r => r.colorIndex !== 0 && r.colorIndex !== 13);

    if (!employee.secondaryRoleIndex || employee.secondaryRoleIndex === 0) {
      employee.secondaryRoleIndex = roleOptions[0]?.colorIndex || 1;
    }
  } else {
    // Normal case
    if (employee.mainRoleIndex === 13 && employee.secondaryRoleIndex === 0) {
      emoji.classList.add('invalid-field');
      dropDown.classList.add('invalid-field');
    }
  }

  roleOptions = roleOptions.filter(r => r.colorIndex !== employee.mainRoleIndex);

  if (!roleOptions.find(r => r.colorIndex === 0)) {
    roleOptions.unshift({ name: "Keine", emoji: "🚫", colorIndex: 0 });
  }

  if (employee.mainRoleIndex !== 13) {
    roleOptions = roleOptions.filter(r => r.colorIndex !== 13);
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

// Update the disableSlidersExcept function to handle apprentice case
function disableSlidersExcept(indexToKeep) {
  for (let i = 1; i <= 3; i++) {
    const slider = document.getElementById(`employee-form-role${i}`);
    const label = document.getElementById(`role${i}-value`);
    if (!slider) continue;

    if (i === indexToKeep) {
      slider.disabled = true;
      if (indexToKeep === 1) slider.value = 10;
      if (label) label.textContent = `Präferenz ${slider.value * 10}%`;
    } else {
      slider.disabled = true;
      slider.value = 0;
      if (label) label.textContent = "Präferenz 0%";
    }
  }
}

function enableSliders(indexArray) {
  for (let i = 1; i <= 3; i++) {
    const slider = document.getElementById(`employee-form-role${i}`);
    if (!slider) continue;

    const shouldEnable = indexArray.includes(i);
    slider.disabled = !shouldEnable;

    if (shouldEnable && slider.value === "") {
      slider.value = 1;
    }
  }
}

function updateSliderLabels() {
  for (let i = 1; i <= 3; i++) {
    const slider = document.getElementById(`employee-form-role${i}`);
    const label = document.getElementById(`role${i}-value`);
    if (slider && label) {
      const value = Number(slider.value);
      label.textContent = `Präferenz ${value * 10}%`;
    }
  }
  setButtonVisibility({ delete: false, store: true, reset: false });
}

function handleRoleChange(roleType, newValue) {
  const employee = getEmployeeById(currentEmployeeId);
  if (!employee) return;

  const numericValue = Number(newValue);

  switch (roleType) {
    case 'main':
      // Special case: Changing to/from apprentice role
      const wasApprentice = employee.mainRoleIndex === 13;
      const isNowApprentice = numericValue === 13;

      employee.mainRoleIndex = numericValue;

      // If changing to apprentice, ensure secondary role exists
      if (isNowApprentice && employee.secondaryRoleIndex === 0) {
        employee.secondaryRoleIndex = 1; // Default to first available role
      }

      // If changing from apprentice, clear special rules
      if (wasApprentice && !isNowApprentice) {
        // Reset to normal slider behavior
      }
      break;

    case 'secondary':
      employee.secondaryRoleIndex = numericValue;

      // Special case: If main is apprentice and secondary is removed
      if (employee.mainRoleIndex === 13 && numericValue === 0) {
        employee.secondaryRoleIndex = 1; // Force secondary role for apprentice
      }
      break;

    case 'trinary':
      employee.tertiaryRoleIndex = numericValue;
      break;

    default:
      return;
  }

  // Reinitialize sliders with new role configuration
  fillRoleDropdowns(employee);
  initSliderListeners(employee);
  setButtonVisibility({ store: true });
}

function fillRoleDropdowns(employee) {
  employee = fillMainRoleDropdown(employee);
  employee = fillSecondaryRoleDropdown(employee);
  employee = fillTrinaryRoleDropdown(employee);
  return employee;
}

function fillTrinaryRoleDropdown(employee) {
  if (!employee) return null;

  let roleOptions = [...cachedRoles];
  const emoji = document.getElementById('employee-details-icon-trinary');
  const slider = document.getElementById('employee-form-role3');
  const sliderLabel = document.getElementById('role3-value');
  const dropDown = document.getElementById('employee-details-role-trinary');

  if (!emoji || !slider || !sliderLabel || !dropDown) return employee;

  clearDropdown(dropDown);

  roleOptions = roleOptions.filter(r => r.colorIndex !== employee.mainRoleIndex);
  roleOptions = roleOptions.filter(r => r.colorIndex !== employee.secondaryRoleIndex);

  if (!roleOptions.find(r => r.colorIndex === 0)) {
    roleOptions.unshift({ name: "Keine", emoji: "🚫", colorIndex: 0 });
  }
  roleOptions = roleOptions.filter(r => r.colorIndex !== 13);

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

function onTwoRoleSliderChange(changedSliderId, value) {
  const s1 = document.getElementById("employee-form-role1");
  const s2 = document.getElementById("employee-form-role2");

  // Special case: Apprentice mode - sliders are fixed
  const employee = getEmployeeById(currentEmployeeId);
  if (employee && employee.mainRoleIndex === 13) {
    // Restore fixed values for apprentice
    s1.value = 4;
    s2.value = 6;
    updateSliderLabels();
    return;
  }

  let mainValue = +s1.value;
  let secondaryValue = +s2.value;

  if (changedSliderId === "employee-form-role1") {
    // Main slider changed - adjust secondary
    secondaryValue = Math.max(1, 10 - value);
    s2.value = secondaryValue;
  } else {
    // Secondary slider changed - adjust main
    mainValue = Math.max(1, 10 - value);
    s1.value = mainValue;
  }

  // Ensure hierarchy: main >= secondary
  if (mainValue < secondaryValue) {
    if (changedSliderId === "employee-form-role1") {
      s2.value = mainValue;
    } else {
      s1.value = secondaryValue;
    }
  }

  updateSliderLabels();
  updateEmployeeFromSliders();
}
function updateEmployeeFromSliders() {
  const employee = getEmployeeById(currentEmployeeId);
  if (!employee) return;

  employee.roleSplitMain = +document.getElementById("employee-form-role1").value;
  employee.roleSplitSecondary = +document.getElementById("employee-form-role2").value;
  employee.roleSplitTertiary = +document.getElementById("employee-form-role3").value;

  setButtonVisibility({ store: true });
}

function enforceHierarchy(s1, s2, s3) {
  // Ensure s3 <= s2 <= s1
  const sorted = [s1, s2, s3].sort((a, b) => b - a);
  return [sorted[0], sorted[1], sorted[2]];
}

function onThreeRoleSliderChange(changedId, value) {
  let s1 = Number(document.getElementById("employee-form-role1").value);
  let s2 = Number(document.getElementById("employee-form-role2").value);
  let s3 = Number(document.getElementById("employee-form-role3").value);

  if (changedId === "employee-form-role1") s1 = value;
  if (changedId === "employee-form-role2") s2 = value;
  if (changedId === "employee-form-role3") s3 = value;

  // Ensure sum = 10 and order constraint
  [s1, s2, s3] = normalizeThreeSliders(s1, s2, s3);

  document.getElementById("employee-form-role1").value = s1;
  document.getElementById("employee-form-role2").value = s2;
  document.getElementById("employee-form-role3").value = s3;
  updateSliderLabels();
  setButtonVisibility({ store: true });
}

// FIXED normalizeThreeSliders function:
function normalizeThreeSliders(s1, s2, s3) {
  // Step 1: Ensure minimum of 1 for all active roles
  s1 = Math.max(1, s1);
  s2 = Math.max(1, s2);
  s3 = Math.max(1, s3);

  // Step 2: Enforce hierarchy: s3 <= s2 <= s1
  [s1, s2, s3] = enforceHierarchy(s1, s2, s3);

  // Step 3: Adjust sum to exactly 10
  let sum = s1 + s2 + s3;

  while (sum !== 10) {
    if (sum > 10) {
      // Reduce from the largest possible while maintaining hierarchy
      if (s1 > s2 && s1 > 1) {
        s1--;
      } else if (s2 > s3 && s2 > 1) {
        s2--;
      } else if (s3 > 1) {
        s3--;
      } else {
        // If we can't reduce further, break to avoid infinite loop
        break;
      }
    } else {
      // Increase the smallest possible while maintaining hierarchy
      if (s3 < s2) {
        s3++;
      } else if (s2 < s1) {
        s2++;
      } else {
        s1++;
      }
    }

    // Re-enforce hierarchy after adjustments
    [s1, s2, s3] = enforceHierarchy(s1, s2, s3);
    sum = s1 + s2 + s3;

    // Safety break
    if (sum < 3 || sum > 30) break;
  }

  return [s1, s2, s3];
}


function setButtonVisibility(options = {}) {

  const storeLock = createButtonLock(5000);
  const deleteLock = createButtonLock(5000);

  const buttons = [
    {
      id: 'employee-reset-button',
      key: 'reset',
      callback: () => resetEmployeeForm(),
    },
    {
      id: 'employee-store-button',
      key: 'store',
      callback: async () => {
        if (storeLock.isLocked()) return;
        storeLock.lock();
        try {
          // If the form is in "new" mode, send create; otherwise update
          const action = (window.employeeFormDataNew === true) ? 'create' : 'update';
          await gatherEmployeeData(api, action);
        } finally {
          storeLock.unlock();
        }
      }
    },
    {
      id: 'employee-delete-button',
      key: 'delete',
      callback: debounceDelete(async () => {
        if (deleteLock.isLocked()) return;

        deleteLock.lock();
        try {
          await gatherEmployeeData(api, 'delete');
        } finally {
          deleteLock.unlock();
        }
      })
    }
  ];

  buttons.forEach(({ id, key, callback }) => {
    const btn = document.getElementById(id);
    if (!btn) return;

    const shouldShow = options.hasOwnProperty(key) ? options[key] : null;
    if (shouldShow !== null) {
      btn.style.display = shouldShow ? '' : 'none';
      btn.disabled = !shouldShow;
    }

    if (btn._clickHandler) {
      btn.removeEventListener('click', btn._clickHandler);
    }

    if (shouldShow) {
      btn.addEventListener('click', callback);
      btn._clickHandler = callback;
    } else {
      delete btn._clickHandler;
    }
  });
}

function debounceDelete(fn, delay = 300) {
  let timeout;
  return (...args) => {
    if (timeout) return;          // prevent double-tap
    timeout = setTimeout(() => timeout = null, delay);
    fn(...args);
  };
}


function saveEmployee(employee) {
  const name = document.getElementById('employee-name').textContent;
  const emoji = document.getElementById('emoji-picker-btn').textContent;
  const mainRole = parseInt(document.getElementById('main-role').value, 10);
  const birthday = document.getElementById('employee-birthday').value;

  employee.name = name;
  employee.emoji = emoji;
  employee.mainRoleIndex = mainRole;
  employee.birthday = birthday;

  validateEmployeeData(cachedEmployees);
  renderEmployeeList();
}

function formatDateInput(date) {
  if (!date) return "";
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0'); // month is 0-based
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function deleteEmployee(employee) {
  const index = cachedEmployees.indexOf(employee);
  if (index > -1) {
    cachedEmployees.splice(index, 1);
    renderEmployeeList();
    document.getElementById('employee-details-form').innerHTML = '';
  }
}

function deleteCurrentEmployee() {
  console.log("🗑️ Delete Current Employee button clicked.");
}

function storeCurrentEmployee() {
  console.log("💾 Store Current Employee button clicked.");
}

function sanityCheckEmployee(employee) {
  if (!employee) {
    console.warn('[employee-form] sanity check called without valid employee');
    return false;
  }

  employee.corrupt = false;
  employee.warning = '';

  console.group(`[sanityCheck] Employee: ${employee.id || 'NO-ID'} | Name: "${employee.name}" | Emoji: "${employee.personalEmoji}"`);

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
    console.groupEnd();
    return false;
  }

  console.log('[sanityCheck] PASS');
  console.groupEnd();
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

  console.log(`[roles] MainRoleIndex: ${employee.mainRoleIndex}, SecondaryRoleIndex: ${employee.secondaryRoleIndex}, TertiaryRoleIndex: ${employee.tertiaryRoleIndex}`);

  if (employee.mainRoleIndex === 13 && employee.secondaryRoleIndex === 0) {
    console.warn('[roles] Main role is 13 with no secondary role, marked as fail');
    return true;
  }

  if (employee.mainRoleIndex < 1 || employee.mainRoleIndex > 13) {
    console.warn('[roles] Main role out of bounds, attempting self-heal');
    result = true;
    // trySelfhealRoles(employee);
    console.log(`[roles] After self-heal: MainRoleIndex=${employee.mainRoleIndex}, SecondaryRoleIndex=${employee.secondaryRoleIndex}, TertiaryRoleIndex=${employee.tertiaryRoleIndex}`);
  }

  return result;
}

function sanityCheckEmployeeShifts(employee) {

  console.log("Sanity check shifts: ", officeDays);

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

  console.log('[shifts] Shifts valid');
  return false;
}

function trySelfhealRoles(employee) {
  if (employee.secondaryRoleIndex > 0) {
    employee.mainRoleIndex = employee.secondaryRoleIndex;
    employee.secondaryRoleIndex = 0;
    if (employee.trinaryRoleIndex > 0) {
      employee.secondaryRoleIndex = employee.trinaryRoleIndex;
      employee.trinaryRoleIndex = 0;
    }
  } else if (employee.tertiaryRoleIndex > 0) {
    employee.mainRoleIndex = employee.tertiaryRoleIndex;
    employee.tertiaryRoleIndex = 0;
  } else {
    employee.mainRoleIndex = 0;
  }
}

function normalizePriorityValues(employee) {
  const normalize = (v) => (isNaN(v) ? 0 : Math.max(0, Math.min(10, Math.round(v))));
  const before = [employee.roleSplitMain, employee.roleSplitSecondary, employee.roleSplitTertiary].join(',');

  employee.roleSplitMain = normalize(employee.roleSplitMain);
  employee.roleSplitSecondary = normalize(employee.roleSplitSecondary);
  employee.roleSplitTertiary = normalize(employee.roleSplitTertiary);

  let sum = employee.roleSplitMain + employee.roleSplitSecondary + employee.roleSplitTertiary;
  if (sum === 0) {
    employee.roleSplitMain = 10;
  } else if (sum !== 10) {
    const scale = 10 / sum;
    employee.roleSplitMain = Math.round(employee.roleSplitMain * scale);
    employee.roleSplitSecondary = Math.round(employee.roleSplitSecondary * scale);
    employee.roleSplitTertiary = Math.max(0, 10 - (employee.roleSplitMain + employee.roleSplitSecondary));
  }

  const after = [employee.roleSplitMain, employee.roleSplitSecondary, employee.roleSplitTertiary].join(',');
  return before !== after;
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

    const listItem = document.createElement('li');
    listItem.classList.add('employee-item');
    listItem.classList.remove('employee-role-select-warning');
    if (!valid || employee.corrupt) {
      listItem.classList.add('employee-role-select-warning');
      const warningIcon = document.createElement('span');
      warningIcon.classList.add('noto');
      warningIcon.innerHTML = '❗';
      warningIcon.title = employee.warning || 'Daten unvollständig oder fehlerhaft';
      listItem.appendChild(warningIcon);
    }


    const emojiElement = document.createElement('span');
    emojiElement.classList.add('employee-emoji', 'noto');
    emojiElement.textContent = employee.personalEmoji;

    emojiElement.setAttribute('data-role', employee.mainRoleIndex);
    listItem.appendChild(emojiElement);
    listItem.appendChild(document.createTextNode(` ⇨ ${employee.name}`));

    listItem.addEventListener('click', (e) => {
      e.stopPropagation();
      selectExsitingEmployee(employee.id);
    });
    listItem.classList.add('employee-item');

    const content = document.createElement('div');
    content.className = 'employee-content';

    content.appendChild(emojiElement);
    content.appendChild(document.createTextNode(` ⇨ ${employee.name}`));

    listItem.appendChild(content);
    listItem.appendChild(createEmployeeEllipsis(employee));


    listContainer.appendChild(listItem);
  });
}

function getEmployeeEllipsisActions(employee) {
  const actions = ['delete', 'copy'];

  if (employee.warning || employee.corrupt) {
    actions.unshift('inspect', 'repair');
  }

  return actions;
}

function createEmployeeEllipsis(employee) {
  return createEllipsis(
    getEmployeeEllipsisActions(employee),
    {
      delete: () => deleteEmployeeSafely(employee.id),

      copy: () => {
        const copyData = {
          roles: employee.roles,
          shifts: employee.shifts,
          availability: employee.availability
        };
        navigator.clipboard.writeText(JSON.stringify(copyData, null, 2));
      },

      repair: () => autoRepairEmployee(employee),

      inspect: () => showEmployeeWarnings(employee)
    }
  );
}

function deleteEmployeeSafely(employeeId) {
  if (deletionLock) return;
  deletionLock = true;

  // Disable old big delete button too
  const btn = document.getElementById("employee-delete-button");
  if (btn) btn.disabled = true;

  setTimeout(() => { deletionLock = false; if (btn) btn.disabled = false; }, 1500);

  performDelete(employeeId);
}

function performDelete(employeeId) {
  const employee = cachedEmployees.find(e => String(e.id) === String(employeeId));
  if (!employee) return console.error("Cannot delete: employee not found");

  const api = window.api; // same as existing code

  const employeeData = {
    ...employee,
    personalEmoji: "🗑️",
    endDate: new Date().toISOString().split("T")[0] // auto overwrite end date ← TASK 2.9
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

      // Auto-heal safety release
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

