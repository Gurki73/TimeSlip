import { loadRoleData, roles, allRoles } from '../../js/loader/role-loader.js';
import { loadEmployeeData, employees } from '../../js/loader/employee-loader.js';
import { loadCalendarData, loadStateData, companyHolidays, officeDays } from '../../js/loader/calendar-loader.js';
import { getHolidayDetails, nonOfficialHolidays, monthNames, germanFixedHolidays, germanVariableHolidays } from '../../js/Utils/holidayUtils.js';
import { updateStateFlag } from '../../js/Utils/flagUtils.js';
import { loadRequests } from '../../js/loader/request-loader.js';

let currentMonthIndex;
let currentYear;
let weeks;
let isInOffice;
let currentState;

export async function initializeCalendar(api) {
  if (!api) {
    console.error('❌ window.api is not available in calendar.js');
    return;
  }

  Promise.all([
    loadRoleData(),
    loadEmployeeData(),
    loadCalendarData()
  ])
    .then(() => { })
    .catch((error) => {
      console.error('Error loading calendardata:', error);
    });

  currentState = await loadStateData();
  const navigator = document.getElementById('calendar-navigation2');
  if (!navigator) {
    console.warn("Calendar navigator not found in the top right corner.");
    return;
  }

  initializeCalendarData();
  createCalendarNavigation();
  // generateAndRenderCalendar(currentMonthIndex, currentYear);
  updateCalendarDisplay();
}


function initializeCalendarData() {
  isInOffice = true;
  const currentDate = new Date();
  currentMonthIndex = currentDate.getMonth() + 1;
  currentYear = currentDate.getFullYear();
}


function updateCalendarDisplay() {
  generateAndRenderCalendar(currentMonthIndex, currentYear);
  document.getElementById('calendar-month').textContent = monthNames[currentMonthIndex];
  document.getElementById('calendar-year').textContent = currentYear;;
}

function generateAndRenderCalendar(newMonthIndex, newYear) {

  // updateFeedback("current month:" + currentMonthIndex + "  current year:" + currentYear);
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
  let isInOffice = true;
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
  const myToogleAdvance = document.getElementById('toggle-attendance')
  if (isInOffice) {
    myToogleAdvance.textContent = 'Anwesend';
    myToogleAdvance.style.backgroundColor = 'cornflowerblue';
  } else {
    myToogleAdvance.textContent = 'Abwesend';
    myToogleAdvance.style.backgroundColor = 'pink';
  }
  generateAndRenderCalendar(currentMonthIndex, currentYear);
}

function getWeekNumber(date) {
  const tempDate = new Date(date);
  tempDate.setDate(tempDate.getDate() - tempDate.getDay() + 3);
  const firstThursday = new Date(tempDate.getFullYear(), 0, 1);
  return Math.ceil(((tempDate - firstThursday) / 86400000 + 1) / 7);
}

async function createCalendarNavigation() {

  const stateImage = document.getElementById('state-image');
  const monthLabel = document.getElementById('calendar-month');
  const yearLabel = document.getElementById('calendar-year');
  const toggleAttendanceButton = document.getElementById('toggle-attendance');
  const prevMonthButton = document.getElementById('prev-month');
  const nextMonthButton = document.getElementById('next-month');
  const prevYearButton = document.getElementById('prev-year');
  const nextYearButton = document.getElementById('next-year');

  currentMonthIndex = new Date().getMonth();
  currentYear = new Date().getFullYear();

  const monthNames = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'December'
  ];


  currentState = await loadStateData();;
  if (stateImage) {
    updateStateFlag(currentState, stateImage);
  }

  monthLabel.textContent = monthNames[currentMonthIndex];
  yearLabel.textContent = currentYear;

  toggleAttendanceButton.textContent = isInOffice ? 'Anwesend' : 'Abwesend';
  toggleAttendanceButton.style.backgroundColor = isInOffice ? 'cornflowerblue' : 'salmon';

  toggleAttendanceButton.addEventListener('click', () => {
    isInOffice = !isInOffice;
    setOfficeStatus(isInOffice);
    toggleAttendanceButton.textContent = isInOffice ? 'Anwesend' : 'Abwesend';
    toggleAttendanceButton.style.backgroundColor = isInOffice ? 'cornflowerblue' : 'salmon';
  });

  const updateCalendarNav = () => {
    monthLabel.textContent = monthNames[currentMonthIndex];
    yearLabel.textContent = currentYear;
  };

  prevMonthButton.addEventListener('click', () => {
    if (currentMonthIndex === 0) {
      currentMonthIndex = 11;
      currentYear--;
    } else {
      currentMonthIndex--;
    }
    updateCalendarNav();
    generateAndRenderCalendar(currentMonthIndex, currentYear);
  });

  nextMonthButton.addEventListener('click', () => {
    if (currentMonthIndex === 11) {
      currentMonthIndex = 0;
      currentYear++;
    } else {
      currentMonthIndex++;
    }
    updateCalendarNav();
    generateAndRenderCalendar(currentMonthIndex, currentYear);
  });

  prevYearButton.addEventListener('click', () => {
    currentYear--;
    updateCalendarNav();
    generateAndRenderCalendar(currentMonthIndex, currentYear);
  });

  nextYearButton.addEventListener('click', () => {
    currentYear++;
    updateCalendarNav();
    generateAndRenderCalendar(currentMonthIndex, currentYear);
  });
}

async function renderCalendarMonth(weeks) {

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
    monthRequests = await loadRequests(currentYear, formattedMonth);
  } catch (error) {
    console.error("Error loading month requests:");
  }


  weeks.forEach(week => {
    const weekRow = renderWeekRow(week, monthRequests);
    calendarMonth.appendChild(weekRow);
  });
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

    if (day === 'So') headerCell.classList.add('sunday');
    headerRow.appendChild(headerCell);
  });

  return { headerRow, columnWidths };
}

function renderDayCell(day, index, officeDayStatus, monthRequests) {

  const fullDate = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const holidayDetails = getHolidayDetails(fullDate, currentState);
  const companyClosed = getCompanyHoliday(fullDate);
  const dayCell = document.createElement('div');
  dayCell.className = 'day-column';

  if (!day) {
    dayCell.classList.add('empty');
    if (officeDayStatus === 'never') {
      dayCell.classList.add('shrink');
      dayCell.style.background = 'transparent';
    }
    return { cell: dayCell, render: false };
  }
  const dayCellHeaderObject = createDayCellHeader(day, dayCell, holidayDetails, companyClosed);

  dayCell.appendChild(dayCellHeaderObject.hRow);

  if (!dayCellHeaderObject.isValid) return { cell: dayCell, render: false };

  let renderEmployees = true;

  if (officeDayStatus === 'never') {
    dayCell.classList.add('shrink');
    renderEmployees = false;
  }

  if (index === 6) dayCell.classList.add('sunday');
  if (officeDayStatus === 'morning') dayCell.classList.add('morning-shift');
  if (officeDayStatus === 'aftenoon') dayCell.classList.add('afternoon-shift');

  if (renderEmployees) {
    const shifts = createShifts(day, index, monthRequests);
    dayCell.appendChild(shifts);
  }
  return { cell: dayCell, render: true };
}

function createShifts(day, index, monthRequests) {
  const shifts = document.createElement('div');
  shifts.style.width = "100%";
  const moringShift = createMorningShift(day, index, monthRequests);
  shifts.appendChild(moringShift);
  const dayShift = createDayShift(day, index, monthRequests);
  shifts.appendChild(dayShift);
  const afternoonShift = createAfternoonShift(day, index, monthRequests);
  shifts.appendChild(afternoonShift);

  return shifts;
}

function createMorningShift(day, index, monthRequests) {
  const morningShift = document.createElement('span');
  morningShift.classList.add('shift', 'noto');
  morningShift.title = 'vormittags';


  if (officeDays[index] === 'afternoon') {
    morningShift.innerHTML = "🔒";
    morningShift.title = "vormittags geschlossen";
    morningShift.style.background = "lightpink";
    return morningShift;
  }
  morningShift.classList.add('morning-shift');
  morningShift.innerHTML = '.';
  populateShift('morning', morningShift, day, index, monthRequests);
  return morningShift;
}

function createAfternoonShift(day, index, monthRequests) {
  const afternoonShift = document.createElement('span');
  afternoonShift.classList.add('shift', 'noto');
  afternoonShift.title = "nachmittags";

  if (officeDays[index] === 'morning') {
    afternoonShift.innerHTML = "🔒";
    afternoonShift.title = "nachmittags geschlossen";
    afternoonShift.style.background = "lightpink";
    return afternoonShift;
  }
  afternoonShift.classList.add('afternoon-shift');
  afternoonShift.innerHTML = '.';
  populateShift('afternoon', afternoonShift, day, index, monthRequests);
  return afternoonShift;
}

function createDayShift(day, index, monthRequests) {
  const dayShift = document.createElement('span');
  dayShift.innerHTML = ".";
  dayShift.title = 'ganztags';
  dayShift.classList.add('shift', 'noto');
  if (officeDays[index] === 'morning' || officeDays[index] === 'afternoon') {
    dayShift.style.background = "lightpink";
    dayShift.innerHTML = "🔒";
    dayShift.title = "halbtags geschlossen"
    return dayShift;
  }
  dayShift.classList.add('day-shift');
  populateShift('full', dayShift, day, index, monthRequests);
  return dayShift;
}

function checkEmployeeRequested(employee, monthRequests, day) {

  if (!Array.isArray(monthRequests)) {
    return { overlap: false, vacationType: null, shift: null };
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
          status: req.status
        };
      }
    }
  }
  return { overlap: false, vacationType: null, shift: null };
}


function populateShift(type, shift, day, index, monthRequests) {
  employees.forEach(employee => {

    if (employee.workDays[index] === 'never') return;

    const checkResult = checkEmployeeRequested(employee, monthRequests, day)
    if (checkResult.overlap !== isInOffice || checkResult.status === 'pending') {
      if (employee.workDays[index] === type ||
        (employee.workDays[index] === 'full' && officeDays[index] !== 'full')
      ) {
        const emoji = document.createElement('mark');
        emoji.title = employee.name;
        emoji.innerHTML = employee.personalEmoji;
        emoji.classList.add('noto', 'calendar-emoji');

        if (checkResult.status === 'pending') {
          emoji.innerHTML += "⌛";
          emoji.title = `${employee.name}´s Antrag steht aus`;
        }

        if (Number(employee.birthday) === day && Number(employee.birthMonth) === currentMonthIndex) {
          emoji.innerHTML += "🎂";
          emoji.title = `${employee.name}´s Geburtstag`;
        }
        const roleColor = getComputedStyle(document.documentElement)
          .getPropertyValue(`--role-${employee.mainRoleIndex}-color`)
          .trim();
        emoji.style.backgroundColor = roleColor;

        shift.appendChild(emoji);
      }
    }
  });
}


function createDayCellHeader(day, dayCell, holidayDetails, companyClosed) {

  const dayCellHeader = document.createElement('div');
  dayCellHeader.classList.add('day-class-header');

  const dayDate = document.createElement('span');
  dayDate.classList.add('day-number');
  dayDate.innerHTML = day;

  dayCellHeader.appendChild(dayDate);

  const warningIndicator = document.createElement('div');
  warningIndicator.classList.add = 'warning-indicator noto';
  warningIndicator.textContent = 'test';
  dayCellHeader.appendChild(warningIndicator);

  const specialDay = document.createElement('div');
  specialDay.className = 'special-day noto';
  let renderEmployees = true;

  // console.log(holidayDetails);

  if (holidayDetails.isValid) {
    specialDay.textContent = holidayDetails.emoji;
    specialDay.title = holidayDetails.name;
    dayCell.classList.add('holiday');
    dayCell.style.backgroundColor = 'tomato';
    renderEmployees = false;
  } else if (companyClosed) {
    specialDay.textContent = '🔒';
    specialDay.title = 'Betriebsferien';
    dayCell.classList.add('closed-office');
    dayCell.style.backgroundColor = '#F08080';
    renderEmployees = false;
  }

  dayCellHeader.appendChild(specialDay);

  return { isValid: renderEmployees, hRow: dayCellHeader };
}

function renderWeekRow(week, monthRequests) {
  const weekRow = document.createElement('div');
  weekRow.classList.add('calendar-row');

  const kwCell = document.createElement('div');
  kwCell.textContent = `${week.weekNumber}`;
  kwCell.className = 'kw-column shrink';
  weekRow.appendChild(kwCell);

  week.days.forEach((day, index) => {
    const officeDayStatus = officeDays[index];
    const dayCellObj = renderDayCell(day, index, officeDayStatus, monthRequests);

    weekRow.appendChild(dayCellObj.cell);
  });

  return weekRow;
}

function getCompanyHoliday(date) {

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

