import { loadRoleData, roles, allRoles } from '../../js/loader/role-loader.js';
import { loadEmployeeData, employees } from '../../js/loader/employee-loader.js';
import { loadCalendarData, loadStateData, loadCompanyHolidayData, loadOfficeDaysData } from '../../js/loader/calendar-loader.js';
import { getHolidayDetails, nonOfficialHolidays, monthNames, germanFixedHolidays, germanVariableHolidays } from '../../js/Utils/holidayUtils.js';
import { updateStateFlag } from '../../js/Utils/flagUtils.js';
import { loadRequests } from '../../js/loader/request-loader.js';
import { keyToBools } from '../forms/calendar-form/calendar-form.js';

let currentMonthIndex;
let currentYear;
let weeks;
let isInOffice;
let currentState;
let officeDays;
let companyHolidays;
let cachedApi = null;
let rulesetMonth = [], rulesetWeek = [], rulesetDay = [], rulesetShift = [];

// MOK DATA FOR RULE TEST WITHOUT VALIDATION AND STORAGE
const MOKRule = {
  W: { id: "W0", bottomLimit: 0, upperLimit: Infinity },
  T: { id: "T2", indices: [1, 2, 3, 4, 5, 6] }, // Mon–Sat
  A: { id: "A0", bottomLimit: 2, upperLimit: 3 }, // Required chef count
  G: { id: "G0", indices: [4] }, // "1" = chef role index
  D: { id: "D0", uperLimit: 0, indices: 0 },
  E: { id: "obviate" },
  w: { id: "obviate", bottomLimit: 0, upperLimit: Infinity },
  t: { id: "obviate", calendarEntries: [] },
  a: { id: "obviate", bottomLimit: 0, upperLimit: Infinity },
  g: { id: "obviate", roleIndices: [] },
  d: { id: "obviate", upperLimit: 1, indices: [] }
};
const MOKRuleset = [MOKRule];


export async function initializeCalendar(api) {
  if (!api) {
    console.error('❌ window.api is not available in calendar.js');
    return;
  }
  cachedApi = api;
  let isOnboarding = false;
  // 🧠 Step 1: Check for path cache
  let dataFolder = localStorage.getItem('clientDefinedDataFolder');
  if (!dataFolder) {
    console.warn('⚠ No cached data folder found, attempting recovery...');
    dataFolder = await api.getRecoveredPath();

    if (dataFolder) {
      localStorage.setItem('clientDefinedDataFolder', dataFolder);
    } else {
      console.log('🗀 No recovery possible. Will fallback to sample data.');
      isOnboarding = true
    }
  }
  if (!currentYear) currentYear = new Date().getFullYear();
  try {
    const [roles, employees, calendarData, officeDaysData, companyHolidays] = await Promise.all([
      loadRoleData(),
      loadEmployeeData(),
      loadCalendarData(api, currentYear),
      loadOfficeDaysData(api, isOnboarding),
      loadCompanyHolidayData(api, currentYear)
    ]);


    currentState = await loadStateData();
    officeDays = officeDaysData;

    initializeCalendarData();
    createCalendarNavigation();
    updateCalendarDisplay();

    const colorTheme = localStorage.getItem('colorTheme');
    const zoomFactor = localStorage.getItem('zoomFactor');
    const clientDefinedDataFolder = localStorage.getItem('clientDefinedDataFolder');

    const cacheDump = {
      colorTheme: colorTheme ?? 'default (light)',
      zoomFactor: zoomFactor ?? 'default (1.0)',
      clientDefinedDataFolder: clientDefinedDataFolder ?? 'Not set',
    };

    api.send('update-cache', cacheDump);

  } catch (error) {
    console.error('❌ Error loading initial calendar data:', error);
  }
}

function initializeCalendarData() {
  isInOffice = true;
  const currentDate = new Date();
  currentMonthIndex = currentDate.getMonth() + 1;
  currentYear = currentDate.getFullYear();
}

function applyCalendarStyles() {
  const calendarContainer = document.querySelector('.calendar-container');
  if (!calendarContainer) return;

  const totalCols = 8.5;
  const shrinkCells = officeDays.filter(day => day === 'never').length + 1;
  const regularCells = totalCols - shrinkCells; // Exclude KW column

  const shrinkWidthPercent = 5; // e.g., 5% for closed days
  const remainingWidthPercent = 100 - (shrinkWidthPercent * shrinkCells);
  const regularWidthPercent = remainingWidthPercent / regularCells;

  calendarContainer.style.setProperty('--regular-width', `${regularWidthPercent}%`);
  calendarContainer.style.setProperty('--shrink-width', `${shrinkWidthPercent}%`);
}

export function setDateRemote(year, month = currentMonthIndex) {
  currentYear = year;
  currentMonthIndex = month;
  updateCalendarDisplay();
}

export function updateCalendarDisplay() {
  generateAndRenderCalendar(currentMonthIndex, currentYear);
  document.getElementById('calendar-month').textContent = monthNames[currentMonthIndex];
  document.getElementById('calendar-year').textContent = currentYear;

  // Trigger fade animation via class toggle
  const feedback = document.getElementById('calendar-feedback');
  if (!feedback) return;

  feedback.classList.add('active');

  setTimeout(() => {
    feedback.classList.remove('active');
  }, 1700); // fade out after 700ms
}


function generateAndRenderCalendar(newMonthIndex, newYear) {

  applyCalendarStyles();
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
    myToogleAdvance.style.backgroundColor = 'var(--accent-active)';
  } else {
    myToogleAdvance.textContent = 'Abwesend';
    myToogleAdvance.style.backgroundColor = 'var(--calendar-day-holiday-bg)';
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
  toggleAttendanceButton.style.backgroundColor = isInOffice ? 'var(--accent-active)' : 'salmon';

  toggleAttendanceButton.addEventListener('click', () => {
    isInOffice = !isInOffice;
    setOfficeStatus(isInOffice);
    toggleAttendanceButton.textContent = isInOffice ? 'Anwesend' : 'Abwesend';
    toggleAttendanceButton.style.backgroundColor = isInOffice ? 'var(--accent-active)' : 'salmon';
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

  updateRuleset();

  calendarMonth.innerHTML = '';
  const { headerRow, columnWidths } = renderCalendarHeader();
  calendarMonth.appendChild(headerRow);
  calendarMonth.style.gridTemplateColumns = `50px ${columnWidths.join(' ')}`;

  let monthRequests = [];

  try {
    const formattedMonth = String(currentMonthIndex + 1).padStart(2, '0');
    monthRequests = await loadRequests(cachedApi, currentYear, formattedMonth);
    monthRequests = filterRequestsByMonth(monthRequests, formattedMonth, currentYear);
  } catch (error) {
    console.warn("Error loading month requests:");
    monthRequests = [];
  }


  weeks.forEach(week => {
    const weekRow = renderWeekRow(week, monthRequests);
    calendarMonth.appendChild(weekRow);
  });
}

function filterRequestsByMonth(requests, month, year) {
  return requests.filter(req => {
    const startDate = new Date(req.start);
    const endDate = new Date(req.end);

    // Month is 1-based string, convert to number:
    const targetMonth = Number(month) - 1; // JS months: 0-11
    const targetYear = Number(year);

    // Get start and end of the month:
    const monthStart = new Date(targetYear, targetMonth, 1);
    const monthEnd = new Date(targetYear, targetMonth + 1, 0);

    // Check if request overlaps this month:
    const overlaps = startDate <= monthEnd && endDate >= monthStart;

    // Filter out rejected:
    const isApprovedOrPending = req.status !== 'rejected';

    return overlaps && isApprovedOrPending;
  });
}


function getUsedShiftsInWeek(officeDays) {
  let isEarly = false, isDay = false, isLate = false;

  officeDays.forEach(dayKey => {
    if (dayKey === 'never') return;

    try {
      const { early, day, late } = keyToBools(dayKey);
      if (early) isEarly = true;
      if (day) isDay = true;
      if (late) isLate = true;
    } catch (err) {
      console.warn(`Invalid shift key: ${dayKey}`);
    }
  });

  return { isEarly, isDay, isLate };
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

function renderDayCell(day, index, shiftStatusForDay, usedShifts, monthRequests) {

  const fullDate = `${currentYear}-${String(currentMonthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const holidayDetails = getHolidayDetails(fullDate, currentState);
  const companyClosed = getCompanyHoliday(fullDate);
  const dayCell = document.createElement('div');
  const attendance = createEmptyAttendanceMatrix();

  dayCell.className = 'day-column';

  const isNever = !shiftStatusForDay.early && !shiftStatusForDay.day && !shiftStatusForDay.late;

  let renderEmployees = true;

  if (!day) {
    dayCell.classList.add('empty');
    if (isNever) {
      dayCell.classList.add('shrink');
      dayCell.style.background = 'transparent';
    }
    return { cell: dayCell, render: false, attendance };
  }

  if (isNever) {
    dayCell.classList.add('shrink');
    renderEmployees = false;
  }

  const dayCellHeaderObject = createDayCellHeader(day, dayCell, holidayDetails, companyClosed);
  dayCell.appendChild(dayCellHeaderObject.hRow);
  if (!dayCellHeaderObject.isValid) return { cell: dayCell, render: false, attendance };


  if (index === 6) dayCell.classList.add('sunday');

  if (shiftStatusForDay.early && !shiftStatusForDay.day && !shiftStatusForDay.late) {
    dayCell.classList.add('morning-shift');
  }
  if (shiftStatusForDay.late && !shiftStatusForDay.day && !shiftStatusForDay.early) {
    dayCell.classList.add('afternoon-shift');
  }

  if (renderEmployees) {
    const shiftResult = createShifts(day, index, monthRequests, shiftStatusForDay, usedShifts);
    dayCell.appendChild(shiftResult.shifts);
    mergeAttendance(attendance, shiftResult.attendance);

    // WARNING: We query inside the virtual dayCell element here,
    // because it’s not yet attached to the real DOM, so document.getElementById would return null.
    const warningSpan = dayCell.querySelector(`#day-${day}-warning`);

    if (warningSpan) {
      // 👇 Debug info: raw attendance counts for role 4
      // warningSpan.textContent = `${attendance[4][0]}/${attendance[4][1]}/${attendance[4][2]}`;

      // ✅ Rule validation
      const violations = checkRulesForDay(index, attendance);
      violations.forEach(v => {
        const icon = document.createElement('span');
        icon.innerHTML = v.icon;
        icon.title = v.title;
        icon.classList.add('violation-icon');
        warningSpan.appendChild(icon);
      });
    }

    return { cell: dayCell, render: true, attendance };
  }
  // If we reach here, no employees to render but still return dayCell
  return { cell: dayCell, render: false, attendance };
}



function createShifts(day, index, monthRequests, shiftStatusForDay, usedShifts) {
  const shifts = document.createElement('div');
  shifts.style.width = "100%";

  const attendance = createEmptyAttendanceMatrix();

  if (usedShifts.isEarly) {
    const { shiftElement: morningShift, attendance: attendanceMorning } = createMorningShift(day, index, monthRequests, shiftStatusForDay.early);
    mergeAttendance(attendance, attendanceMorning);
    shifts.appendChild(morningShift);
  }
  if (usedShifts.isDay) {
    const { shiftElement: dayShift, attendance: attendanceDay } = createDayShift(day, index, monthRequests, shiftStatusForDay.day);
    mergeAttendance(attendance, attendanceDay);
    shifts.appendChild(dayShift);
  }
  if (usedShifts.isLate) {
    const { shiftElement: lateShift, attendance: attendanceAfternoon } = createAfternoonShift(day, index, monthRequests, shiftStatusForDay.late);
    mergeAttendance(attendance, attendanceAfternoon);
    shifts.appendChild(lateShift);
  }

  return { shifts, attendance };
}


function createMorningShift(day, index, monthRequests, isOpen) {

  const shift = document.createElement('span');

  shift.classList.add('shift', 'noto');
  shift.title = 'vormittags';

  if (!isOpen) {
    shift.innerHTML = "🔒";
    shift.title = "vormittags geschlossen";
    shift.style.background = "var(--calendar-day-closed-bg)";
    const attendance = createEmptyAttendanceMatrix();
    return { shiftElement: shift, attendance };
  }

  shift.classList.add('morning-shift');
  shift.innerHTML = '';
  const attendance = populateShift('morning', shift, day, index, monthRequests);
  return { shiftElement: shift, attendance };
}

function createAfternoonShift(day, index, monthRequests, isOpen) {

  const afternoonShift = document.createElement('span');
  afternoonShift.classList.add('shift', 'noto');
  afternoonShift.title = "nachmittags";

  if (!isOpen) {
    afternoonShift.innerHTML = "🔒";
    afternoonShift.title = "nachmittags geschlossen";
    afternoonShift.style.background = "var(--calendar-day-closed-bg)";
    const attendance = createEmptyAttendanceMatrix();
    return { shiftElement: afternoonShift, attendance };
  }
  afternoonShift.classList.add('afternoon-shift');
  afternoonShift.innerHTML = '';
  const attendance = populateShift('afternoon', afternoonShift, day, index, monthRequests);
  return { shiftElement: afternoonShift, attendance };
}

function createDayShift(day, index, monthRequests, isOpen) {

  const dayShift = document.createElement('span');
  dayShift.innerHTML = "";
  dayShift.title = 'ganztags';
  dayShift.classList.add('shift', 'noto');
  if (!isOpen) {
    dayShift.style.background = "var(--calendar-day-closed-bg)";
    dayShift.innerHTML = "🔒";
    dayShift.title = "halbtags geschlossen"
    const attendance = createEmptyAttendanceMatrix();
    return { shiftElement: dayShift, attendance };
  }
  dayShift.classList.add('day-shift');
  const attendance = populateShift('full', dayShift, day, index, monthRequests);
  return { shiftElement: dayShift, attendance };
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
  const attendance = createEmptyAttendanceMatrix();

  employees.forEach(employee => {
    if (employee.workDays[index] === 'never') return;

    const checkResult = checkEmployeeRequested(employee, monthRequests, day);

    if (checkResult.overlap !== isInOffice || checkResult.status === 'pending') {
      // Check if employee's scheduled shift matches current type or is full day when office is partially open
      if (
        employee.workDays[index] === type ||
        (employee.workDays[index] === 'full' && officeDays[index] !== 'full')
      ) {
        // Create emoji element for UI
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

        // --- ATTENDANCE COUNTING ---
        // Determine rank index: replace this with your actual rank logic
        // For example, employee might have employee.rankIndex or some preference order
        const rankIndex = employee.rankIndex !== undefined ? employee.rankIndex : 0;

        // Increment attendance count for role and rank
        if (
          attendance[employee.mainRoleIndex] !== undefined &&
          attendance[employee.mainRoleIndex][rankIndex] !== undefined
        ) {
          attendance[employee.mainRoleIndex][rankIndex] += 1;
        } else {
          console.warn(
            `Invalid attendance index: role=${employee.mainRoleIndex}, rank=${rankIndex}`
          );
        }
      }
    }
  });

  return attendance;
}

function createDayCellHeader(day, dayCell, holidayDetails, companyClosed) {

  const dayCellHeader = document.createElement('div');
  dayCellHeader.classList.add('day-class-header');

  const dayDate = document.createElement('span');
  dayDate.classList.add('day-number');
  dayDate.innerHTML = day;

  dayCellHeader.appendChild(dayDate);

  const warningIndicator = document.createElement('span');
  warningIndicator.classList = 'warning-icon noto';
  warningIndicator.innerHTML = '';
  warningIndicator.id = `day-${day}-warning`;
  dayCellHeader.appendChild(warningIndicator);

  const specialDay = document.createElement('div');
  specialDay.className = 'special-day noto';
  let renderEmployees = true;

  if (holidayDetails.isValid) {
    specialDay.textContent = holidayDetails.emoji;
    specialDay.title = holidayDetails.name;
    dayCell.classList.add('holiday');
    dayCell.classList.add('closed-office');
    renderEmployees = false;
  } else if (companyClosed) {
    specialDay.textContent = '🔒';
    specialDay.title = 'Betriebsferien';
    dayCell.classList.add('closed-office');
    renderEmployees = false;
  }

  dayCellHeader.appendChild(specialDay);

  return { isValid: renderEmployees, hRow: dayCellHeader };
}

function checkRulesForWeek(weeklyAttendance) {
  const violations = [];

  rulesetWeek.forEach(rule => {
    // No weekday filtering, as it's for the whole week

    const relevantRoles = rule.G?.indices || [];

    const min = rule.A?.bottomLimit ?? 0;
    const max = rule.A?.upperLimit ?? Infinity;

    // Sum attendance for all relevant roles across the week
    let total = 0;
    relevantRoles.forEach(roleIndex => {
      const roleAttendance = weeklyAttendance[roleIndex] || [0, 0, 0];
      total += roleAttendance[0] + roleAttendance[1] + roleAttendance[2];
    });

    const roleNames = relevantRoles.map(index => roles[index]?.name || `Rolle ${index}`);

    if (total < min) {
      violations.push({
        icon: "🚨",
        title: `Zu wenige ${roleNames.join(", ")} in der Woche: ${total} von min. ${min}`
      });
    }
    if (total > max) {
      violations.push({
        icon: "⚠️",
        title: `Zu viele ${roleNames.join(", ")} in der Woche: ${total} von max. ${max}`
      });
    }
  });

  return violations;
}


function checkRulesForDay(weekdayIndex, attendance) {
  const violations = [];

  // 🧨 Office Closed Check
  if (officeDays[weekdayIndex] === 'never') {
    const totalAttendance = Object.values(attendance).reduce((sum, roleAttendance) => {
      const [a, b, c] = roleAttendance || [0, 0, 0];
      return sum + a + b + c;
    }, 0);

    if (totalAttendance > 0) {
      violations.push({
        icon: "💥",
        title: `Achtung! ${totalAttendance} Mitarbeitende geplant, aber Büro ist geschlossen.`,
        critical: true
      });
    }
  }
  if (officeDays[weekdayIndex] === 'never') {
    return violations;
  }

  // ... existing rule checks
  rulesetDay.forEach(rule => {
    const validDays = rule.T?.indices || [];
    if (!validDays.includes(weekdayIndex)) return;

    const relevantRoles = rule.G?.indices || [];

    const min = rule.A?.bottomLimit ?? 0;
    const max = rule.A?.upperLimit ?? Infinity;

    let total = 0;
    relevantRoles.forEach(roleIndex => {
      const roleAttendance = attendance[roleIndex] || [0, 0, 0];
      total += roleAttendance[0] + roleAttendance[1] + roleAttendance[2];
    });

    const roleNames = relevantRoles.map(index => roles[index]?.name || `Rolle ${index}`);

    if (total < min) {
      violations.push({
        icon: "🚨",
        title: `Zu wenige ${roleNames.join(", ")}: ${total} von min. ${min}`
      });
    }
    if (total > max) {
      violations.push({
        icon: "⚠️",
        title: `Zu viele ${roleNames.join(", ")}: ${total} von max. ${max}`
      });
    }
  });

  return violations;
}


function renderWeekRow(week, monthRequests) {
  const weekRow = document.createElement('div');
  weekRow.classList.add('calendar-row');

  const kwCell = document.createElement('div');
  kwCell.className = 'kw-column';

  const kwNumberLabel = document.createElement('div');
  kwNumberLabel.textContent = `KW ${week.weekNumber}`;
  kwCell.appendChild(kwNumberLabel);

  // NEW: Add warning span under the label
  const weekWarningSpan = document.createElement('div');
  weekWarningSpan.classList = 'warning-icon noto';
  weekWarningSpan.id = `week-${week.weekNumber}-warning`;
  weekWarningSpan.innerHTML = 'test'; // Empty, to fill later
  kwCell.appendChild(weekWarningSpan);

  weekRow.appendChild(kwCell);

  const usedShifts = getUsedShiftsInWeek(officeDays); // or scoped slice if needed
  const shiftStatusForDayForWeek = week.days.map((_, index) => keyToBools(officeDays[index]));

  const weeklyAttendance = createEmptyAttendanceMatrix();

  week.days.forEach((day, index) => {
    const shiftStatusForDay = shiftStatusForDayForWeek[index];
    const dayCellObj = renderDayCell(day, index, shiftStatusForDay, usedShifts, monthRequests);

    weekRow.appendChild(dayCellObj.cell);

    if (dayCellObj.attendance) {
      mergeAttendance(weeklyAttendance, dayCellObj.attendance);
    }
  });
  const weeklyViolations = checkRulesForWeek(weeklyAttendance);
  const warningSpan = weekRow.querySelector(`#week-${week.weekNumber}-warning`);

  if (warningSpan) {
    weeklyViolations.forEach(v => {
      const icon = document.createElement('span');
      icon.innerHTML = v.icon;
      icon.title = v.title;
      icon.classList.add('violation-icon');
      warningSpan.appendChild(icon);
    });
  }

  return weekRow;
}


function getCompanyHoliday(date) {

  if (!companyHolidays) return false;

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

function showCalendarUpdateFeedback() {
  const feedbackEl = document.querySelector('.fade-feedback');
  feedbackEl.classList.add('active');
  setTimeout(() => {
    feedbackEl.classList.remove('active');
  }, 1000);
}

function updateRuleset() {
  rulesetMonth = [];
  rulesetWeek = [];
  rulesetDay = [];
  rulesetShift = [];

  const ruleset = MOKRuleset;

  ruleset.forEach(rule => {
    const timeframes = [];

    // T and t may be defined with IDs like "T2" or "t2"
    if (rule.T?.id && rule.T.id !== "obviate") {
      const tf = rule.T.id.match(/\d+/)?.[0]; // Extract number part
      if (tf) timeframes.push(tf);
    }

    if (rule.t?.id && rule.t.id !== "obviate") {
      const tf = rule.t.id.match(/\d+/)?.[0]; // Extract number part
      if (tf) timeframes.push(tf);
    }

    for (const T of timeframes) {
      switch (T) {
        case "1":
          rulesetShift.push(rule);
          break;
        case "2":
          rulesetDay.push(rule);
          break;
        case "3":
          rulesetWeek.push(rule);
          break;
        case "4":
          rulesetMonth.push(rule);
          break;
        case "5":
          rulesetDay.push(rule); // e.g., holidays or special
          break;
        default:
          break;
      }
    }
  });
}

function createEmptyAttendanceMatrix() {
  return Array(14).fill(null).map(() => [0, 0, 0]);
}

function mergeAttendance(target, source) {
  for (let role = 0; role < target.length; role++) {
    for (let rank = 0; rank < target[role].length; rank++) {
      target[role][rank] += source[role][rank];
    }
  }
}
