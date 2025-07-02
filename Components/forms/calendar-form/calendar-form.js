/**
 * ================================
 * Besondere Tage: Dialects & Schützenfest (Future Enhancements)
 * ================================
 * 
 * Summary:
 * We've brainstormed unique and regionalized titles/tooltips for "Besondere Tage"
 * that reflect the local flavor and culture. These playful additions 
 * (especially in dialects!) aim to make the app feel more personal and fun 
 * for users, even though they are not strictly necessary for functionality.
 * 
 * The idea is to go beyond functionality to delight users, showing "love" 
 * in small ways that could enhance brand perception.
 * 
 * Dialect-Specific Tooltip Examples:
 * ----------------------------------
 * 1. Bavaria: "Hier feiern wir gern doppelt" (Playful Bavarian tone)
 * 2. Thuringia: "Hexen in der Walpurgisnacht" (Highlighting Walpurgisnacht)
 * 3. Berlin: "FeiertagsVibes: Extra-Tage im Kalender" (Urban/modern vibe)
 * 4. Baden-Württemberg: "Deine goldenen Gelegenheiten" (Sophisticated mood)
 * 5. NRW: "Heimliche Favoriten im Kalender" (Playful but simple)
 * 6. Hesse: "Feiertags-Upgrades" (Concise and upbeat)
 * 7. Default: "Brückentage und Besondere Tage" (Neutral fallback)
 * 
 * Schützenfest:
 * -------------
 * We decided to add Schützenfest as a regional celebration for:
 *  - North Rhine-Westphalia
 *  - Lower Saxony
 * 
 * Emoji: 🎯 (target), 🔫 (toy gun), or 🥨 (festive pretzel vibe).
 * Timing: Tentative default to July 15th for simplicity (could be refined to 
 * actual festival dates or calculated dynamically later).
 * Tooltips:
 *  - NRW: "Treffsicher durch den Sommer – Schützenfestzeit!"
 *  - Lower Saxony: "Zielen, Feiern und Gemeinschaft – unser Schützenfest."
 */
import { loadCalendarData, saveStateData, loadStateData, loadCompanyHolidayData, setBranch, updateOfficeDays, loadOfficeDaysData } from '../../../js/loader/calendar-loader.js';
import { getHolidayDetails, getAllHolidaysForYear, nonOfficialHolidays, monthNames, germanFixedHolidays, germanVariableHolidays } from '../../../js/Utils/holidayUtils.js';
import { updateStateFlag } from '../../../js/Utils/flagUtils.js';
import { GetSchoolHoliday, apiHealthCheck, DownloadSchoolHoliday } from '../../../js/Utils/schoolHollydayUpdater.js';
import { updateCalendarDisplay, setDateRemote } from '../../calendar/calendar.js';

const dayIds = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

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
let ruleFormState;
let api;
let companyHolidays = [];

export async function initializeCalendarForm(passedApi) {

  api = passedApi;
  if (!api) console.error(" Api was not passed ==> " + api);

  Promise.all([
    getAllHolidaysForYear,
    updateStateFlag,
    GetSchoolHoliday()
  ])
    .then(() => { })
    .catch((error) => {
      console.error('Error loading data:', error);
    });

  companyHolidays = await loadCompanyHolidayData(api, currentYear);

  ruleFormState = loadStateData();
  applyStateChange(ruleFormState);
  const formContainer = document.getElementById('form-container');
  if (!formContainer) {
    console.error('Form container not found');
    return;
  }

  formContainer.innerHTML = '';

  try {
    const response = await fetch('Components/forms/calendar-form/calendar-form.html');
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const formContent = await response.text();
    formContainer.innerHTML = formContent;

  } catch (err) {
    console.error(`Loading role form failed: ${err}`);
    return;
  }

  const stateSelect = document.getElementById('state-select');
  const stateFlagElement = document.getElementById('calendar-form-state-flag');
  const yearSpan = document.getElementById('calendar-form-year');

  if (yearSpan) {
    yearSpan.value = currentYear;
  } else {
    // updateFeedback('Year span element not found!');
  }

  if (stateSelect) {
    stateSelect.addEventListener('change', handleStateChange);
  } else {
    // updateFeedback('State select element not found!');
    console.log('State select element not found!');
  }

  createEventListener();
  updateHolidaysForYear(currentYear, ruleFormState);
  updateBridgeDaysForYear(currentYear, ruleFormState);
  renderCompanyHolidays(api, currentYear);
  checkAndRenderSchoolHolidays(api);
}

//#region event listener
function createEventListener() {
  initCheckboxLockToggles();
  initCollapseExpandToggles();
  initBranchSelectLogic();
  createCompanyHolidayEventListeners();
  createCalendarFormYearSelect();
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

      console.log(" check box and id: ", sectionId);
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
  return boolsToKey({ early, day, late });
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

  document.querySelectorAll('.collapsible-toggle').forEach(toggleBtn => {
    const id = toggleBtn.id;
    const savedState = localStorage.getItem(`collapseState-${id}`);

    if (savedState !== null) {
      const parsed = savedState === 'true';
      console.log(`[Collapsible] Restoring saved state for "${id}":`, parsed);
      applyCollapseState(toggleBtn, parsed);
    } else {
      const defaultState = defaultExpandedStates[id] ?? true;
      console.log(`[Collapsible] No saved state for "${id}", using default:`, defaultState);
      applyCollapseState(toggleBtn, defaultState);
    }


    toggleBtn.addEventListener('click', () => {
      const id = toggleBtn.id; // <= anonymus function doesnt know id
      const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
      const newState = !isExpanded;

      console.log(`[Collapsible] Toggling "${id}": ${newState ? 'Expanding' : 'Collapsing'}`);
      applyCollapseState(toggleBtn, newState);
      localStorage.setItem(`collapseState-${id}`, newState);
      console.log(`[Collapsible] Saved state for "${id}" = ${newState}`);
    });
  });
}

function applyCollapseState(toggleBtn, expanded) {
  const fieldset = toggleBtn.closest('fieldset');
  if (!fieldset) {
    console.warn('[Collapsible] No fieldset found for toggle button:', toggleBtn);
    return;
  }

  toggleBtn.setAttribute('aria-expanded', expanded);
  toggleBtn.classList.toggle('expanded', expanded);

  const expandedElement = fieldset.querySelector(
    '.shift-expanded, .weekday-expanded, .holiday-expanded, .bridge-expanded, .closed-expanded'
  );
  const collapsedElement = fieldset.querySelector(
    '.shift-list-collapsed, .weekday-list-collapsed, .holiday-list-collapsed, .bridgeday-list-collapsed, .closed-list-collapsed, .school-list-collapsed'
  );

  if (expandedElement && collapsedElement) {
    expandedElement.classList.toggle('hidden', !expanded);
    collapsedElement.classList.toggle('hidden', expanded);
    console.log(`[Collapsible] Applied state to elements in "${toggleBtn.id}": ${expanded ? 'Expanded' : 'Collapsed'}`);
  } else {
    console.warn(`[Collapsible] Missing collapse/expand elements in "${toggleBtn.id}"`);
  }
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
    console.log(newValue);
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

  // Helper to update preview display
  function updatePreview(type, date) {
    const previewId = type === "start" ? "preview-start" : "preview-end";
    const previewElement = document.getElementById(previewId);
    if (previewElement) {
      previewElement.textContent = date;
    }
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
    console.log("Picked start date:", pickedDate);
    updatePreview("start", pickedDate);
    validateDates(pickedDate, endDatePicker.value);
  }

  function onEndDateChange() {
    const pickedDate = endDatePicker.value;
    console.log("Picked end date:", pickedDate);
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
    const bools = keyToBools(key);
    aggregate.early = aggregate.early || bools.early;
    aggregate.day = aggregate.day || bools.day;
    aggregate.late = aggregate.late || bools.late;
  });

  // 3) Convert aggregate bools back to shift key
  const combinedShiftKey = boolsToKey(aggregate);

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


export function keyToBools(key) {
  switch (key) {
    case 'never': return { early: false, day: false, late: false };
    case 'morning': return { early: true, day: false, late: false };
    case 'day': return { early: false, day: true, late: false };
    case 'afternoon': return { early: false, day: false, late: true };
    case 'two': return { early: true, day: false, late: true };
    case 'earlyDay': return { early: true, day: true, late: false };
    case 'lateDay': return { early: false, day: true, late: true };
    case 'full': return { early: true, day: true, late: true };
    default:
      throw new Error(`Unknown shift key: ${key}`);
  }
}

function boolsToKey({ early, day, late }) {
  if (!early && !day && !late) return 'never';
  if (early && !day && !late) return 'morning';
  if (!early && day && !late) return 'day';
  if (!early && !day && late) return 'afternoon';
  if (early && !day && late) return 'two';
  if (early && day && !late) return 'earlyDay';
  if (!early && day && late) return 'lateDay';
  if (early && day && late) return 'full';
  // (should never reach here)
  throw new Error(`Invalid shift booleans: ${early},${day},${late}`);
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

function showBranchWarning(onConfirm, onCancel) {
  const dialog = document.getElementById('branch-warning-dialog');
  dialog.classList.remove('hidden');

  const confirmBtn = document.getElementById('dialog-confirm');
  const cancelBtn = document.getElementById('dialog-cancel');

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





function handleStateChange(event) {
  const selectedState = event.target.value;
  applyStateChange(selectedState);
}

function applyStateChange(selectedState) {
  ruleFormState = selectedState;

  const stateSelect = document.getElementById('state-select');
  if (stateSelect) {
    stateSelect.value = selectedState;
  } else {
    console.warn('State select element not found!');
  }

  const stateFlagElement = document.getElementById('calendar-form-state-flag');
  if (stateFlagElement) {
    updateStateFlag(selectedState, stateFlagElement);
  } else {
    console.error('State flag element not found!');
  }

  const altFlagElement = document.getElementById('state-image'); // ✅ fixed ID
  if (altFlagElement) {
    updateStateFlag(selectedState, altFlagElement);
  }

  saveStateData(selectedState);
  updateCalendarDisplay();
  updateHolidaysForYear(currentYear, selectedState);
  checkAndRenderSchoolHolidays(api);

  console.log("new current state: " + ruleFormState);
}

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
    const holidays = getAllHolidaysForYear(year, ruleFormState);
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
      labelText.classList.add('label-text', 'noto');
      labelText.innerHTML = `${formattedDate} ${holiday.emoji} ⇨ ${holiday.name}`;

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

async function checkAndRenderSchoolHolidays(api) {

  let csvFilePath = `./samples/schoolHolidays/DE-${ruleFormState}_${currentYear}_holidays.csv`;

  const response = await GetSchoolHoliday(api, ruleFormState, currentYear);
  if (response) {
    console.log('CSV found! Displaying holidays...');
    renderSchoolHolidays(ruleFormState, currentYear);
  } else {
    console.log('CSV not found. Showing download button...');
    showDownloadButton();
  }
}

function renderCompanyHolidays(api, year) {
  const holidaysForYear = companyHolidays.filter(period =>
    new Date(period.startDate).getFullYear() === year
  );

  renderCompanyExpanded(api, year, holidaysForYear);
  renderCompanyCollapsed(holidaysForYear);
}

function renderCompanyExpanded(api, year, holidaysForYear) {
  const companyHolidayExtended = document.getElementById("companyHolidayExpanded");
  if (!companyHolidayExtended) return;

  companyHolidayExtended.innerHTML = '';

  if (holidaysForYear.length === 0) {
    companyHolidayExtended.innerHTML = "Keine Betriebsferien hinterlegt";
    return;
  }

  holidaysForYear.forEach(period => {
    const container = document.createElement('div');
    container.className = 'company-holiday-period';

    const today = new Date();
    if (new Date(period.endDate) < today) {
      container.classList.add('past');
    }

    const start = formatShortDate(period.startDate);
    const end = formatShortDate(period.endDate);

    // Text container
    const textWrapper = document.createElement('span');
    if (start === end) {
      textWrapper.innerHTML = `<i class="noto">🔜</i> ${start}`;
    } else {
      textWrapper.innerHTML = `<i class="noto">🔜</i> ${start} <i class="noto">🔚</i> ${end}`;
    }

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.classList.add('noto');
    deleteBtn.title = "Löschen";
    deleteBtn.textContent = "🗑️";
    deleteBtn.addEventListener('click', () => {
      removeCompanyHoliday(api, year, period);
    });

    container.appendChild(textWrapper);
    container.appendChild(deleteBtn);

    companyHolidayExtended.appendChild(container);
  });
}


function renderCompanyCollapsed(holidaysForYear) {
  const companyHolidayCollapsed = document.getElementById("companyHolidayCollapsed");
  if (!companyHolidayCollapsed) return;

  // Clear existing content
  companyHolidayCollapsed.innerHTML = '';

  holidaysForYear.forEach(period => {
    const box = document.createElement('div');
    box.className = 'collapsed-company-holiday-box noto';

    const start = formatShortDate(period.startDate);
    const end = formatShortDate(period.endDate);

    const startLine = document.createElement('div');
    startLine.innerHTML = `<i class="noto">🔜</i> ${start}`;
    box.appendChild(startLine);

    if (start !== end) {
      const endLine = document.createElement('div');
      endLine.innerHTML = `<i class="noto">🔚</i> ${end}`;
      box.appendChild(endLine);
    }

    companyHolidayCollapsed.appendChild(box);
  });
}


function removeCompanyHoliday(api, year, period) {

}

function formatShortDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

async function renderSchoolHolidays(ruleFormState, currentYear) {

  const schoolContainer = document.getElementById('school-holiday-container');
  schoolContainer.innerHTML = '';
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
    schoolContainer.appendChild(schoolHolidaysList);
  } catch (error) {
    console.error('Error loading CSV:', error);
  }
}

function showDownloadButton() {
  const schoolContainer = document.getElementById('school-holiday-container');
  schoolContainer.innerHTML = '';

  const downloadButton = document.createElement('button');
  downloadButton.id = 'downloadButton';
  downloadButton.classList.add('noto', 'download-school-data-btn');
  downloadButton.setAttribute('aria-label', 'Schulferien aus dem Netz laden');

  downloadButton.innerHTML = `
    <div class="download-btn-content">
      <div class="download-emoji" aria-hidden="true">🌐</div>
      <div class="download-text">
        <span>Schulferien</span>
        <span>aktualisieren</span>
      </div>
    </div>
  `;

  downloadButton.addEventListener('click', handleDownload);
  window.addEventListener('checklist-update', (e) => {
    const { step, status } = e.detail;
    updateChecklist(step, status); // Your UI logic
  });

  schoolContainer.appendChild(downloadButton);
}

async function handleDownload() {
  clearSchoolHolidayError();
  initChecklist();

  updateChecklistStep('online', navigator.onLine ? 'success' : 'failure');

  if (!navigator.onLine) {
    showSchoolHolidayError('Keine Internetverbindung. Bitte prüfen Sie Ihre Verbindung.');
    document.getElementById('downloadButton').style.display = 'inline-block';
    return;
  }

  const downloadButton = document.getElementById('downloadButton');
  if (downloadButton) {
    downloadButton.style.display = 'none';
  }

  const apiUrl = 'https://openholidaysapi.org';
  const healthResult = await apiHealthCheck(api, apiUrl);
  updateChecklistStep('apiReachable', healthResult.success ? 'success' : 'failure');
  if (!healthResult.success) {
    throw new Error('API Webseite nicht erreichbar: ' + (healthResult.message || healthResult.status));
  }

  const holidays = await DownloadSchoolHoliday(api, ruleFormState, currentYear);
  updateChecklistStep('apiResponse', 'success');

  if (!holidays || holidays.length === 0) {
    updateChecklistStep('dataReceived', 'failure');
    throw new Error('Keine Daten erhalten');
  } else {
    updateChecklistStep('dataReceived', 'success');
  }

  // Assuming holidays parsing is trivial here
  try {
    holidays.forEach(h => {
      if (!h.name || !h.startDate || !h.endDate) {
        throw new Error('Ungültige Datenstruktur');
      }
    });
    updateChecklistStep('dataParsed', 'success');
  } catch {
    updateChecklistStep('dataParsed', 'failure');
    throw new Error('Daten konnten nicht korrekt übersetzt werden');
  }

  await waitForCsvCreation();
}

/*
async function handleDownload() {
  clearSchoolHolidayError();
 
  const downloadButton = document.getElementById('downloadButton');
  if (downloadButton) {
    downloadButton.style.display = 'none';
  }
 
  console.log(`Trying to load holidays for ${ruleFormState} ${currentYear}`);
 
  try {
    const holidays = await GetSchoolHoliday(api, ruleFormState, currentYear);
    console.log('Holidays data fetched:', holidays);
 
    if (!holidays || holidays.length === 0) {
      throw new Error('No holiday data received from API');
    }
 
    await waitForCsvCreation();
 
  } catch (error) {
    console.error('Error fetching holidays:', error);
 
    showSchoolHolidayError(
      error.message.includes('offline')
        ? 'Keine Internetverbindung. Bitte überprüfen Sie Ihre Verbindung.'
        : error.message.includes('No holiday data')
          ? `Keine Schulferien-Daten gefunden für ${currentYear}.`
          : 'Fehler beim Laden der Schulferien. Bitte versuchen Sie es erneut.'
    );
 
    // Show the download button again so user can retry
    if (downloadButton) {
      downloadButton.style.display = 'inline-block';
    }
  }
}
*/

async function waitForCsvCreation() {
  let attempts = 0;
  const maxAttempts = 10;
  const retryDelayMs = 500;
  let csvFilePath = `schoolHolidays/DE-${ruleFormState}_${currentYear}_holidays.csv`;

  return new Promise((resolve, reject) => {
    const checkExistence = async () => {
      try {
        const response = await fetch(csvFilePath, { method: 'HEAD' });

        if (response.ok) {
          console.log('CSV created! Displaying holidays...');
          clearSchoolHolidayError();
          renderSchoolHolidays(ruleFormState, currentYear);
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
    const schoolContainer = document.getElementById('school-holiday-container');
    errorDiv = document.createElement('div');
    errorDiv.id = 'schoolHolidayError';
    errorDiv.className = 'error-message';
    errorDiv.setAttribute('role', 'alert');
    errorDiv.setAttribute('aria-live', 'assertive');
    schoolContainer.appendChild(errorDiv);
  }
  errorDiv.textContent = message;
}

function clearSchoolHolidayError() {
  const errorDiv = document.getElementById('schoolHolidayError');
  if (errorDiv) {
    errorDiv.textContent = '';
  }
}

function initChecklist() {
  const schoolContainer = document.getElementById('school-holiday-container');
  let checklist = document.getElementById('holiday-checklist');

  if (!checklist) {
    checklist = document.createElement('div');
    checklist.id = 'holiday-checklist';
    checklist.className = 'holiday-checklist';
    checklist.setAttribute('aria-live', 'polite');
    checklist.setAttribute('role', 'status');

    checklist.innerHTML = `
      <ul>
        <li data-step="online">
          <span class="status-indicator">⏳</span> Internet verfügbar
        </li>
        <li data-step="apiReachable">
          <span class="status-indicator">⏳</span> Openholidaysapi.org
        </li>
        <li data-step="apiResponse">
          <span class="status-indicator">⏳</span> Api antwortet
        </li>
        <li data-step="dataReceived">
          <span class="status-indicator">⏳</span> Daten erhalten
        </li>
        <li data-step="dataParsed" >
          <span class="status-indicator">⏳</span> Daten übersetzt
        </li>
        <li data-step="dataStored" >
          <span class="status-indicator">⏳</span> Daten gespeichert
        </li>
      </ul>
    `;

    schoolContainer.appendChild(checklist);
  }
}

function updateChecklistStep(stepName, status) {
  // status: 'success', 'failure', or 'pending'
  const checklist = document.getElementById('holiday-checklist');
  if (!checklist) return;

  const stepItem = checklist.querySelector(`li[data-step="${stepName}"]`);
  if (!stepItem) return;

  stepItem.classList.remove('pending', 'success', 'failure');
  stepItem.classList.add(status);
}

function updateChecklist(step, status) {
  const row = document.querySelector(`[data-step="${step}"]`);
  console.log(" download status update: ", step, status);
  if (!row) {
    console.warn(`⚠️ No checklist row found for step: ${step}`);
    return;
  }

  // Optional: reset styles
  row.classList.remove('status-success', 'status-failure', 'status-pending');

  switch (status) {
    case 'success':
      row.classList.add('status-success');
      row.querySelector('.status-indicator').textContent = '✅';
      break;
    case 'failure':
      row.classList.add('status-failure');
      row.querySelector('.status-indicator').textContent = '❌';
      break;
    case 'pending':
    default:
      row.classList.add('status-pending');
      row.querySelector('.status-indicator').textContent = '⏳';
  }
}

function onSave() {
  const allShiftsUnchecked = [...document.querySelectorAll('.shift-controls input[type="checkbox"]')].every(cb => !cb.checked);
  const allWeekdaysUnchecked = [...document.querySelectorAll('.weekday-controls input[type="checkbox"]')].every(cb => !cb.checked);

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

function formatDate(date) {
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function findBridgeDays(holidays) {
  const bridgeDays = [];

  const holidayDates = new Set(holidays.map(h => h.date)); // For quick lookup
  const holidayMap = new Map(holidays.map(h => [h.date, h]));

  holidays.forEach(holiday => {
    const holidayDate = new Date(holiday.date);

    // === Check next day ===
    const nextDay = addDays(holidayDate, 1);
    const nextDayStr = nextDay.toISOString().split("T")[0];

    if (!holidayDates.has(nextDayStr)) {
      const dayAfterNext = addDays(nextDay, 1);
      const dayAfterIndex = getWeekdayIndex(dayAfterNext);
      if (isOfficeClosed(dayAfterIndex) || holidayDates.has(dayAfterNext.toISOString().split("T")[0])) {
        const nextDayIndex = getWeekdayIndex(nextDay);
        if (!isOfficeClosed(nextDayIndex)) {
          bridgeDays.push({
            date: nextDayStr,
            context: `Brückentag nach ${holiday.name}`
          });
        }
      }
    }

    // === Check previous day ===
    const prevDay = addDays(holidayDate, -1);
    const prevDayStr = prevDay.toISOString().split("T")[0];

    if (!holidayDates.has(prevDayStr)) {
      const dayBeforePrev = addDays(prevDay, -1);
      const dayBeforeIndex = getWeekdayIndex(dayBeforePrev);
      if (isOfficeClosed(dayBeforeIndex) || holidayDates.has(dayBeforePrev.toISOString().split("T")[0])) {
        const prevDayIndex = getWeekdayIndex(prevDay);
        if (!isOfficeClosed(prevDayIndex)) {
          bridgeDays.push({
            date: prevDayStr,
            context: `Brückentag vor ${holiday.name}`
          });
        }
      }
    }
  });

  return bridgeDays;
}

function updateBridgeDaysForYear(year, state) {
  const holidays = getAllHolidaysForYear(year, state);
  const bridgeDays = findBridgeDays(holidays);

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
    <mark class="noto">🌉<mark> <span title="${tooltip}">
      ${formatDate(date)} ${directionEmoji}
    </span>
    <label style="margin-left: 1em;">
      <input type="checkbox" data-bridge-day="${item.date}" checked>
    </label>
  `;

    bridgeList.appendChild(li);
  });
}

