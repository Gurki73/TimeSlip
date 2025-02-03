import { loadRoleData, roles } from '../../../js/loader/role-loader.js';
import { loadEmployeeData, employees } from '../../../js/loader/employee-loader.js';
import { createEmojiPicker } from '../../../Components/emojiPicker/emojiPicker.js';
import { loadOfficeDaysData } from '../../../js/loader/calendar-loader.js';

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

export async function initializeEmployeeForm(passedApi) {

  api = passedApi;
  if (!api) console.error(" Api was not passed ==> " + api);

  try {
    await loadEmployeeData();
    currentOfficeDays = await loadOfficeDaysData();

  } catch (error) {
    console.error('Failed to initialize employee form:', error);
  }

  const formContainer = document.getElementById('form-container');

  if (!formContainer) {
    console.error('Form container not found');
    return;
  }

  formContainer.innerHTML = '';

  try {
    const response = await fetch('Components/forms/employee-form/employee-form.html');
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const formContent = await response.text();
    formContainer.innerHTML = formContent;

  } catch (err) {
    console.error(`Loading rule form failed: ${err}`);
    return;
  }

  const container = document.getElementById('employee-form-container');
  if (!container) return console.error('Employee form container not found!');

  renderEmployeeListColumn(container);
  renderEmployeeList();
  selectEmployee(employees[0]);

}
function deleteEmoji(emoji) {
  const index = employeeEmojiOptions.indexOf(emoji);
  if (index > -1) {
    employeeEmojiOptions.splice(index, 1);
  } else {
    console.log(`Emoji "${emoji}" not found in the available list.`);
  }
}

function addEmoji(emoji) {
  if (emoji === "❓") return;
  if (!employeeEmojiOptions.includes(emoji)) {
    employeeEmojiOptions.push(emoji);
  } else {
    console.warn(`Emoji "${emoji}" is already in the available list.`);
  }
}

function changeEmployeeEmoji(employee, newEmoji) {
  const oldEmoji = employee.personalEmoji;

  deleteEmoji(newEmoji);
  addEmoji(oldEmoji);
  employee.personalEmoji = newEmoji;
}

function bindEmojiPickerToEmployee(employee) {

  const handleEmployeeEmojiSelectionChange = (selectedEmoji) => {
    if (selectedEmoji) {
      console.log(`Selected emoji for employee ${employee.name}:`, selectedEmoji);

      const oldEmoji = employee.personalEmoji;
      employee.personalEmoji = selectedEmoji;

      if (oldEmoji) addEmoji(oldEmoji);
      deleteEmoji(selectedEmoji);

      renderEmployeeList();
      console.log(`Emoji for ${employee.name} updated to ${selectedEmoji}`);
    } else {
      console.log(`No emoji selected for employee ${employee.name}.`);
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
    employee.shiftType = employee.shiftType ?? 'full';
    employee.birthday = employee.birthday ?? null;
  });

  if (errors.length > 0) {
    console.log("Validation errors found:", errors);
  }
}


function renderEmployeeListColumn(container) {
  const newEmployeeBtn = document.getElementById('employeeForm-new-btn');
  if (newEmployeeBtn) {
    newEmployeeBtn.addEventListener('click', createNewEmployee);
  }
}
function createNewEmployee() {
  employeeFormDataNew = true;

  console.log("new employee btn clicked");
  const lastIndex = employees.length - 1;
  const lastEmployee = employees[lastIndex];

  if (isValidEmployeeEmoji(lastEmployee.personalEmoji, null)) {
    selectEmployee(lastIndex);
    return;
  }
  if (isValidEmployeeName(lastEmployee.name), null) {
    selectEmployee(lastIndex);
    return;
  }
  if (isValidEmployeeMainRoleIndex(lastEmployee.mainRoleIndex), null) {
    selectEmployee(lastIndex);
    return;
  }
  const today = new Date();
  const tenYearsLater = new Date();
  tenYearsLater.setFullYear(today.getFullYear() + 10)

  const newEmployee = {
    id: lastIndex + 1,
    name: "neuer Mitarbeiter",
    personalEmoji: "❓",
    mainRoleIndex: -1,
    secondaryRoleIndex: -1,
    tertiaryRoleIndex: -1,
    availableDaysOff: 30,
    remainingDaysOff: 30,
    overtime: 0,
    workDays: [
      currentOfficeDays[0] != "never", // Mo
      currentOfficeDays[1] != "never", // Di
      currentOfficeDays[2] != "never", // Mi
      currentOfficeDays[3] != "never", // Do
      currentOfficeDays[4] != "never", // Fr
      currentOfficeDays[5] != "never", // Sa
      currentOfficeDays[6] != "never", // So
    ],
    roleSplitMain: 100,
    roleSplitSecondary: 0,
    roleSplitTertiary: 0,
    startDate: today,
    endDate: tenYearsLater,
    birthday: "00.00",
  };

  employees.push(newEmployee);
  selectEmployee(newEmployee);
}


function renderEmployeeList() {
  const listContainer = document.getElementById('employee-list');
  if (!listContainer) return console.error('Employee list container not found!');

  listContainer.innerHTML = '';

  employees.forEach(employee => {

    deleteEmoji(employee.personalEmoji);
    const listItem = document.createElement('li');
    listItem.classList.add('employee-item');

    if (employee.mainRoleIndex === 0) {
      listItem.classList.add('employee-role-select-warning');
      const warningIcon = document.createElement('span');
      warningIcon.classList.add('noto');
      warningIcon.innerHTML = "❗"
      listItem.appendChild(warningIcon);
    }
    const emojiElement = document.createElement('span');
    emojiElement.classList.add('employee-emoji', 'noto');
    emojiElement.textContent = employee.personalEmoji;

    emojiElement.setAttribute('data-role', employee.mainRoleIndex);
    listItem.appendChild(emojiElement);
    listItem.appendChild(document.createTextNode(" ⇨ " + employee.name));

    listItem.addEventListener('click', () => selectExsitingEmployee(employee));
    listContainer.appendChild(listItem);
  });
}

function selectExsitingEmployee(employee) {
  employeeFormDataNew = false;
  selectEmployee(employee);
}

function isValidEmployeeEmoji(emoji, emojiField) {
  const isValid = emoji !== "❓";
  if (emojiField) emojiField.classList.toggle('invalid-field', !isValid);
  return isValid;
}

function isValidEmployeeName(name, nameField) {
  const isValid = name !== "name" &&
    name !== "" &&
    name !== "neuer Mitarbeiter" &&
    name !== "undefined" &&
    name !== null;
  if (nameField) nameField.classList.toggle('invalid-field', !isValid);
  return isValid;
}

function isValidEmployeeMainRoleIndex(mainRoleIndex, mainRoleField) {
  const isValid = mainRoleIndex >= 0 && mainRoleIndex <= 11;
  if (mainRoleField) mainRoleField.classList.toggle('invalid-field', !isValid);
  return isValid;
}

function populateWeekdaySelection(employee) {
  let index = 0;
  const weekdays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  currentOfficeDays.forEach(day => {
    const selectElement = document.getElementById(`employee-form-shift-${weekdays[index]}`);

    if (selectElement) {

      selectElement.innerHTML = "";
      selectElement.classList.add('noto', 'employee-weekday-selector');
      // let optionElement = document.createElement("option");

      if (employee.mainRoleIndex === 13 ||
        employee.secondaryRoleIndex === 13 ||
        employee.trinaryRoleIndex === 13) {
        if (index !== 7) {
          const optionElement = document.createElement("option");
          optionElement.textContent = '📐 Berufsschule';
          optionElement.classList.add("noto")
          optionElement.value = 'school';
          optionElement.selected = employee.workDays[index] === 'school';
          selectElement.appendChild(optionElement);
        }
      }

      switch (day) {
        case ('never'):
          const optionElement1 = document.createElement("option");
          optionElement1.textContent = '🔒 geschlossen';
          optionElement1.classList.add('noto');
          optionElement1.value = 'never';
          optionElement1.selected = employee.workDays[index] === 'never';
          selectElement.appendChild(optionElement1);
          break;
        case ('full'):
          const optionElement2 = document.createElement("option");
          optionElement2.textContent = '🚫 niemals';
          optionElement2.classList.add('noto');
          optionElement2.value = 'never';
          optionElement2.selected = employee.workDays[index] === 'never';
          selectElement.appendChild(optionElement2);

          const optionElement3 = document.createElement("option");
          optionElement3.textContent = '☕ vormittags';
          optionElement3.classList.add('noto');
          optionElement3.value = 'morning';
          optionElement3.selected = employee.workDays[index] === 'morning';
          selectElement.appendChild(optionElement3);

          const optionElement4 = document.createElement("option");
          optionElement4.textContent = '🥗 ganztags'
          optionElement4.classList.add('noto');
          optionElement4.value = 'full';
          optionElement4.selected = employee.workDays[index] === 'full';
          optionElement4.selected = true;
          selectElement.appendChild(optionElement4);

          const optionElement5 = document.createElement("option");
          optionElement5.textContent = '🫖 nachmittags';
          optionElement5.classList.add('noto');
          optionElement5.value = 'afternoon';
          optionElement5.selected = employee.workDays[index] === 'afternoon';
          selectElement.appendChild(optionElement5);
          break;

        case ('morning'):
          const optionElement6 = document.createElement("option");
          optionElement6.textContent = '🚫 niemals';
          optionElement6.classList.add('noto');
          optionElement6.value = 'never';
          optionElement6.selected = employee.workDays[index] === 'never';
          selectElement.appendChild(optionElement6);

          const optionElement7 = document.createElement("option");
          optionElement7.textContent = '☕ vormittags';
          optionElement7.classList.add('noto');
          optionElement7.value = 'morning';
          optionElement7.selected = employee.workDays[index] === 'morning';
          selectElement.appendChild(optionElement7);
          break;

        case ('afternoon'):
          const optionElement8 = document.createElement("option");
          optionElement8.textContent = '🚫 niemals';
          optionElement8.classList.add('noto');
          optionElement8.value = 'never';
          optionElement8.selected = employee.workDays[index] === 'never';
          selectElement.appendChild(optionElement8);

          const optionElement9 = document.createElement("option");
          optionElement9.textContent = '🫖 nachmittags';
          optionElement9.classList.add('noto');
          optionElement9.value = 'afternoon';
          optionElement9.selected = employee.workDays[index] === 'afternoon';
          selectElement.appendChild(optionElement9);
          break;
      }
      index++;
    }
  });
}

function selectEmployee(employee) {
  const form = document.getElementById('employee-form-details');
  if (!form) {
    console.log('Employee details form not found!');
    return;
  }
  const resetButton = document.querySelector('.reset-button');
  const storeButton = document.querySelector('.store-button');
  const deleteButton = document.querySelector('.delete-button');
  const employeeEmojiSelect = document.getElementById('employee-emoji-picker-btn');
  employeeEmojiSelect.innerHTML = employee.personalEmoji;
  employeeEmojiSelect.setAttribute('data-role', employee.mainRoleIndex);

  const employeeNameField = document.getElementById('employee-name');
  employeeNameField.value = employee.name;

  const vacationLeft = document.getElementById('employee-form-vacation-left');
  vacationLeft.value = employee.remainingDaysOff;

  const vacationTotal = document.getElementById('employee-form-vacation-total');
  vacationTotal.value = employee.availableDaysOff;

  const overTime = document.getElementById('employee-form-overtime-input');
  overTime.value = employee.overtime;

  const employeeStart = document.getElementById('employee-form-start-work');
  employeeStart.value = employee.startDate;

  const employeeEnd = document.getElementById('employee-form-end-work');
  employeeEnd.value = employee.endDate;

  const employeeBirthDay = document.getElementById('employee-form-birthday-day');
  employeeBirthDay.value = employee.birthday;

  const employeeBirthMonth = document.getElementById('employee-form-birthday-month');
  employeeBirthMonth.value = employee.birthMonth;



  const mainRoleIcon = document.getElementById("employee-details-icon-main");
  mainRoleIcon.setAttribute('data-role', employee.mainRoleIndex);
  mainRoleIcon.innerHTML = roles[employee.mainRoleIndex].emoji;
  const secondaryRoleIcon = document.getElementById("employee-details-icon-secondary");
  secondaryRoleIcon.setAttribute('data-role', employee.secondaryRoleIndex);
  secondaryRoleIcon.innerHTML = roles[employee.secondaryRoleIndex].emoji;
  const trinaryRoleIcon = document.getElementById("employee-details-icon-trinary");
  trinaryRoleIcon.setAttribute('data-role', employee.tertiaryRoleIndex);
  trinaryRoleIcon.innerHTML = roles[employee.tertiaryRoleIndex].emoji;

  const mainRoleSelect = document.getElementById("employee-details-role-main");
  const secondaryRoleSelect = document.getElementById("employee-details-role-secondary");
  const trinaryRoleselect = document.getElementById("employee-details-role-trinary");

  populateRoleSelects(employee, mainRoleSelect, secondaryRoleSelect, trinaryRoleselect);

  const mainRoleRatio = document.getElementById("employee-form-role1");
  mainRoleRatio.setAttribute('data-role', employee.mainRoleIndex);
  mainRoleRatio.value = employee.roleSplitMain;

  const secondaryRoleRatio = document.getElementById("employee-form-role2");
  secondaryRoleRatio.setAttribute('data-role', employee.secondaryRoleIndex);
  secondaryRoleRatio.value = employee.roleSplitSecondary;

  const trinaryRoleRatio = document.getElementById("employee-form-role3");
  trinaryRoleRatio.setAttribute('data-role', employee.tertiaryRoleIndex);
  trinaryRoleRatio.value = employee.roleSplitTertiary

  checkRatios(employee, mainRoleRatio, secondaryRoleRatio, trinaryRoleRatio);
  populateWeekdaySelection(employee);

  resetButton.addEventListener('click', () => resetForm(employee));
  storeButton.addEventListener('click', () => storeFormData(employee));
  deleteButton.addEventListener('click', () => deleteEmployee(employee));

  employeeEmojiSelect.addEventListener('click', function () {
    bindEmojiPickerToEmployee(employee);
  });

  const emojiValid = isValidEmployeeEmoji(employee.personalEmoji, employeeEmojiSelect);
  const nameValid = isValidEmployeeName(employee.name, employeeNameField);
  const mainRoleValid = isValidEmployeeMainRoleIndex(employee.mainRoleIndex, mainRoleField);

  updateButtonVisibility(emojiValid, nameValid, mainRoleValid, employee);
}

function populateRoleSelects(employee, first, secondary, trinary) {

  first.innerHTML = '';
  secondary.innerHTML = '';
  trinary.innerHTML = '';

  if (employee.mainRoleIndex === 0) {
    first.classList.add('employee-role-select-warning');
  } else {
    first.classList.remove('employee-role-select-warning');
  }

  function populateDropdown(dropdown, roles, selectedIndex) {
    roles.forEach((role, index) => {
      const option = document.createElement("option");
      option.value = role.name;
      option.textContent = `${role.emoji} ⇨ ${role.name}`;
      option.classList.add('employee-details-role-selector', 'noto');

      const roleColor = getComputedStyle(document.documentElement)
        .getPropertyValue(`--role-${role.colorIndex}-color`)
        .trim();
      option.style.backgroundColor = roleColor;

      if (index === selectedIndex) {
        option.selected = true;
      }

      dropdown.appendChild(option);
    });
  }

  populateDropdown(first, roles, employee.mainRoleIndex);

  if (employee.mainRoleIndex !== 0) {
    const secondRoles = roles.filter((_, index) => index !== employee.mainRoleIndex);
    populateDropdown(secondary, secondRoles, employee.secondaryRoleIndex);
  }

  if (employee.mainRoleIndex !== 0) {
    const thirdRoles = roles.filter(
      (_, index) => index !== employee.mainRoleIndex && index !== employee.secondaryRoleIndex
    );
    populateDropdown(trinary, thirdRoles, employee.trinaryRoleIndex);
  }
}


function updateButtonVisibility(emojiValid, nameValid, mainRoleValid, employee) {
  const resetButton = document.querySelector('.reset-button');
  const storeButton = document.querySelector('.store-button');
  const deleteButton = document.querySelector('.delete-button');

  if (employeeFormDataNew) {
    deleteButton.style.display = "none";
  } else {
    deleteButton.style.display = "";
  }

  if (emojiValid && nameValid && mainRoleValid && employeeFormDataChanged) {
    storeButton.disabled = false;
  } else {
    storeButton.disabled = true;
  }

  if (employeeFormDataChanged) {
    resetButton.style.display = "";
  } else {
    resetButton.style.display = "none";
  }
}

function saveEmployee(employee) {
  const name = document.getElementById('employee-name').value;
  const emoji = document.getElementById('emoji-picker-btn').textContent;
  const mainRole = parseInt(document.getElementById('main-role').value, 10);
  const birthday = document.getElementById('employee-birthday').value;

  employee.name = name;
  employee.emoji = emoji;
  employee.mainRoleIndex = mainRole;
  employee.birthday = birthday;

  validateEmployeeData(employees);
  renderEmployeeList();
}

function deleteEmployee(employee) {
  const index = employees.indexOf(employee);
  if (index > -1) {
    employees.splice(index, 1);
    renderEmployeeList();
    document.getElementById('employee-details-form').innerHTML = '';
  }
}

function validateEmployeeForm(employee) {
  const errors = [];
  const form = document.getElementById('employee-details-form');

  if (!form) return console.error('Employee details form not found!');

  Array.from(form.elements).forEach(el => {
    el.style.backgroundColor = '';
    el.style.border = '';
    const errorText = el.nextElementSibling;
    if (errorText && errorText.classList.contains('error-text')) {
      errorText.remove();
    }
  });

  const nameInput = document.getElementById('employee-name');
  if (!nameInput.value.trim()) {
    addValidationError(nameInput, 'Name is required.');
    errors.push('Name is missing.');
  }

  const emojiPickerBtn = document.getElementById('emoji-picker-btn');
  if (!emojiPickerBtn.textContent || emojiPickerBtn.textContent === 'Pick Emoji') {
    addValidationError(emojiPickerBtn, 'Emoji is required.');
    errors.push('Emoji is missing.');
  }

  const mainRoleInput = document.getElementById('main-role');
  if (!mainRoleInput.value.trim()) {
    addValidationError(mainRoleInput, 'Main role is required.');
    errors.push('Main role is missing.');
  }

  const weekdayCheckboxes = form.querySelectorAll('input[name="days"]:checked');
  const weekdaysSelected = Array.from(weekdayCheckboxes).map(cb => cb.value);
  if (weekdaysSelected.includes('Sunday') && !officeDays.includes('Sunday')) {
    addValidationError(form, 'Sundays are office-closed days.');
    errors.push('Employee is scheduled to work on Sunday.');
  }

  if (employee.secondaryRoleIndex || employee.tertiaryRoleIndex) {
    const ratio = parseFloat(document.getElementById('role-ratio').value || 0);
    if (isNaN(ratio) || ratio <= 0 || ratio > 1) {
      addValidationError(
        document.getElementById('role-ratio'),
        'Secondary/Tertiary role ratio must be between 0 and 1.'
      );
      errors.push('Invalid secondary/tertiary role ratio.');
    }
  }

  if (errors.length > 0) {
    console.warn('Validation errors:', errors);
  }

  return errors.length === 0;
}

function addValidationError(element, message) {
  element.style.backgroundColor = 'yellow';
  element.style.border = '2px solid red';
  element.style.borderRadius = '4px';

  const errorText = document.createElement('div');
  errorText.classList.add('error-text');
  errorText.style.color = 'gray';
  errorText.style.fontStyle = 'italic';
  errorText.textContent = message;
  element.insertAdjacentElement('afterend', errorText);

  element.title = message;
}

function deleteCurrentEmployee() {
  console.log("🚮 Delete Current Employee button clicked.");
}

function storeCurrentEmployee() {
  console.log("💾 Store Current Employee button clicked.");
}

// function renderDetails() {
//   
//   fillGlobalEmployeeDetails();
//   renderEmployeeDetailIcon();
//   showEmployeeDetailName();
//   showEmployeeDetailVacation();
//   showEmployeeDetailRange();
//   showEmployeeDetailbirthday();
// }
// 
// function fillGlobalEmployeeDetails() {
//   fillWeekdayOptions();
//   fillRoleOptions();
// }
// 
// function fillRoleOptions () {
//   const isRoleUsed = false;
//   isRoleUsed = fillRoleOption('main');
//   if (isRoleUsed) {
//     isRoleUsed = fillRoleOption('secondary');
//   } else {
//     setRoleOptionInactive('secondary');
//   }
//   if (isRoleUsed ) {
//     fillRoleOption('trinary');
//   } else {
//     setRoleOptionInactive('trinary')
//   }
// }

function checkRatios(employee, first, second, third) {
  if (
    !employee ||
    typeof employee !== "object" ||
    !("mainRoleIndex" in employee) ||
    !("secondaryRoleIndex" in employee) ||
    !("trinaryRoleIndex" in employee) ||
    !("mainRoleRatio" in employee) ||
    !("secondaryRoleRatio" in employee) ||
    !("trinaryRoleRatio" in employee)
  ) {
    console.warn("Invalid employee object");
    return;
  }

  if (employee.mainRoleIndex === 0) {
    first.setAttribute("data-role", 0);
    second.setAttribute("data-role", 0);
    third.setAttribute("data-role", 0);

    first.value = 0;
    second.value = 0;
    third.value = 0;
    return;
  }

  if (employee.secondaryRoleIndex === 0) {
    first.setAttribute("data-role", employee.mainRoleIndex);
    second.setAttribute("data-role", 0);
    third.setAttribute("data-role", 0);

    first.value = 10;
    second.value = 0;
    third.value = 0;
    return;
  }

  if (employee.trinaryRoleIndex === 0) {
    third.setAttribute("data-role", 0);

    // Swap roles if necessary (two roles)
    if (employee.mainRoleRatio < employee.secondaryRoleRatio) {
      [employee.mainRoleRatio, employee.secondaryRoleRatio] = [employee.secondaryRoleRatio, employee.mainRoleRatio];
      [employee.mainRoleIndex, employee.secondaryRoleIndex] = [employee.secondaryRoleIndex, employee.mainRoleIndex];

      selectEmployee(employee);
    }

    employee.mainRoleRatio = Math.max(1, Math.min(9, employee.mainRoleRatio));
    employee.secondaryRoleRatio = Math.max(1, Math.min(5, employee.secondaryRoleRatio));

    const totalRatio = employee.mainRoleRatio + employee.secondaryRoleRatio;
    if (totalRatio < 10) {
      employee.mainRoleRatio += 10 - totalRatio;
    } else if (totalRatio > 10) {
      employee.secondaryRoleRatio -= totalRatio - 10;
    }

    first.setAttribute("data-role", employee.mainRoleIndex);
    second.setAttribute("data-role", employee.secondaryRoleIndex);

    first.value = employee.mainRoleRatio;
    second.value = employee.secondaryRoleRatio;
    third.value = 0;
    return;
  }

  // Handle three roles
  if (employee.trinaryRoleIndex !== 0) {
    // Swap roles if ratios are out of order (main < secondary, etc.)
    if (employee.mainRoleRatio < employee.secondaryRoleRatio) {
      [employee.mainRoleRatio, employee.secondaryRoleRatio] = [employee.secondaryRoleRatio, employee.mainRoleRatio];
      [employee.mainRoleIndex, employee.secondaryRoleIndex] = [employee.secondaryRoleIndex, employee.mainRoleIndex];
    }
    if (employee.secondaryRoleRatio < employee.trinaryRoleRatio) {
      [employee.secondaryRoleRatio, employee.trinaryRoleRatio] = [employee.trinaryRoleRatio, employee.secondaryRoleRatio];
      [employee.secondaryRoleIndex, employee.trinaryRoleIndex] = [employee.trinaryRoleIndex, employee.secondaryRoleIndex];
    }

    // Clamp ratios to bounds
    employee.mainRoleRatio = Math.max(4, Math.min(8, employee.mainRoleRatio)); // 40%-80%
    employee.secondaryRoleRatio = Math.max(1, Math.min(4, employee.secondaryRoleRatio)); // 10%-40%
    employee.trinaryRoleRatio = Math.max(1, Math.min(3, employee.trinaryRoleRatio)); // 10%-30%

    // Normalize to ensure total = 10
    const totalRatio = employee.mainRoleRatio + employee.secondaryRoleRatio + employee.trinaryRoleRatio;
    if (totalRatio < 10) {
      employee.mainRoleRatio += 10 - totalRatio; // Add remaining to main
    } else if (totalRatio > 10) {
      employee.trinaryRoleRatio -= totalRatio - 10; // Reduce excess from tertiary
    }

    // Set the role data
    first.setAttribute("data-role", employee.mainRoleIndex);
    second.setAttribute("data-role", employee.secondaryRoleIndex);
    third.setAttribute("data-role", employee.trinaryRoleIndex);

    first.value = employee.mainRoleRatio;
    second.value = employee.secondaryRoleRatio;
    third.value = employee.trinaryRoleRatio;
  }
}
