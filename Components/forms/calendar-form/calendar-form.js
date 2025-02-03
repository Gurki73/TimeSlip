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
import { loadCalendarData, saveStateData, state, companyHolidays, officeDays } from '../../../js/loader/calendar-loader.js';
import { getHolidayDetails, getAllHolidaysForYear, nonOfficialHolidays, monthNames, germanFixedHolidays, germanVariableHolidays } from '../../../js/Utils/holidayUtils.js';
import { updateStateFlag } from '../../../js/Utils/flagUtils.js';
import { GetSchoolHoliday } from '../../../js/Utils/schoolHollydayUpdater.js';


let currentYear = new Date().getFullYear();
let ruleFormState;
let api;

export async function initializeCalendarForm(passedApi) {

  api = passedApi;
  if (!api) console.error(" Api was not passed ==> " + api);

  Promise.all([
    state,
    getAllHolidaysForYear,
    updateStateFlag,
    GetSchoolHoliday
  ])
    .then(() => { })
    .catch((error) => {
      console.error('Error loading data:', error);
    });
  ruleFormState = state;
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
  const yearSpan = document.getElementById('calendar-year');

  if (yearSpan) {
    yearSpan.value = currentYear;
  } else {
    updateFeedback('Year span element not found!');
  }

  if (stateSelect) {
    stateSelect.addEventListener('change', handleStateChange);
  } else {
    updateFeedback('State select element not found!');
    console.log('State select element not found!');
  }

  updateHolidaysForYear(currentYear, ruleFormState);
  checkAndRenderSchoolHolidays();
}

function handleStateChange(event) {
  const selectedState = event.target.value;
  ruleFormState = event.target.value;
  const stateFlagElement = document.getElementById('calendar-form-state-flag');

  if (stateFlagElement) {
    updateStateFlag(selectedState, stateFlagElement);
  } else {
    console.error('State flag element not found!');
  }

  ruleFormState = selectedState;
  console.log("new current state: " + ruleFormState);
  updateStateFlag(selectedState, stateFlagElement);
  updateHolidaysForYear(currentYear, selectedState);
  checkAndRenderSchoolHolidays();
}


function updateHolidaysForYear(year) {
  try {
    const data = getAllHolidaysForYear(currentYear, ruleFormState);
    // updateFeedback(`Holidays for ${year}:`, data);

    const holidays = getAllHolidaysForYear(currentYear, ruleFormState);
    const holidayList = document.getElementById('public-holidays');
    if (!holidayList) {
      console.warn('Holiday list container not found!');
      return;
    }

    holidayList.innerHTML = '';

    holidays.forEach(holiday => {
      const listItem = document.createElement('li');
      listItem.classList.add('holiday-item');

      const gab = "&nbsp;"; // Non-breaking space for HTML
      const emoji = document.createElement('span');
      emoji.classList.add('holiday-emoji', 'noto');
      emoji.innerHTML = gab + holiday.emoji + gab + "⇨" + gab;

      const holidayDate = new Date(holiday.date);
      const formattedDate = `${String(holidayDate.getDate()).padStart(2, '0')}.${String(holidayDate.getMonth() + 1).padStart(2, '0')}`;

      const hollyDate = document.createElement('span');
      hollyDate.innerHTML = formattedDate;

      const name = document.createElement('span');
      name.innerHTML = holiday.name;

      listItem.appendChild(hollyDate);
      listItem.appendChild(emoji);
      listItem.appendChild(name);

      holidayList.appendChild(listItem);
    });


    console.log(data);
  } catch (error) {
    updateFeedback('Failed to load holidays:', error);
  }
}

async function checkAndRenderSchoolHolidays() {

  let csvFilePath = `./data/schoolHolidays/DE-${ruleFormState}_${currentYear}_holidays.csv`;

  console.log(csvFilePath);
  try {
    const response = await fetch(csvFilePath, { method: 'HEAD' });

    if (response.ok) {
      console.log('CSV found! Displaying holidays...');
      renderSchoolHolidays(ruleFormState, currentYear);
    } else {
      console.log('CSV not found. Showing download button...');
      showDownloadButton();
    }
  } catch (error) {
    console.log('Error checking CSV file:', error);
    showDownloadButton();
  }
}

async function renderSchoolHolidays(ruleFormState, currentYear) {

  const schoolContainer = document.getElementById('school-holiday-container');
  schoolContainer.innerHTML = '';
  const schoolHolidaysList = document.createElement('ul');

  let csvFilePath = `data/schoolHolidays/DE-${ruleFormState}_${currentYear}_holidays.csv`;

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
  downloadButton.classList.add('noto');
  downloadButton.innerHTML = '🌐 aus dem Netz laden ';
  downloadButton.addEventListener('click', handleDownload);

  schoolContainer.appendChild(downloadButton);
}

async function handleDownload() {
  console.log(`Fetching holidays for ${ruleFormState} ${currentYear}`);


  const downloadButton = document.getElementById('downloadButton');

  if (downloadButton) {
    downloadButton.style.display = 'none';
  }

  try {
    const holidays = await GetSchoolHoliday(api, ruleFormState, currentYear);
    console.log('Holidays data fetched:', holidays);

    waitForCsvCreation();
  } catch (error) {
    console.error('Error fetching holidays:', error);
    updateFeedback('Failed to fetch holidays. Please try again.');
  }
}

async function waitForCsvCreation() {
  let attempts = 0;
  let csvFilePath = `data/schoolHolidays/DE-${ruleFormState}_${currentYear}_holidays.csv`;

  const checkExistence = async () => {
    try {
      const response = await fetch(csvFilePath, { method: 'HEAD' });

      if (response.ok) {
        console.log('CSV created! Displaying holidays...');
        renderSchoolHolidays(ruleFormState, currentYear);
      } else if (attempts < 10) {
        attempts++;
        setTimeout(checkExistence, 500);
      } else {
        const schoolContainer = document.getElementById('school-holiday-container');
        schoolContainer.innerHTML = '<h3> Schulferien für $(currentYear) noch nicht verfügbar </h3> <br> bitte in einem Jahr noch einmal versuchen';
      }
    } catch (error) {
      console.error('Error checking CSV creation:', error);
    }
  };

  checkExistence();
}
