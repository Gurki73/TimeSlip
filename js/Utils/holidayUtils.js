const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const germanFixedHolidays = [
  { id: "newy", name: "Neujahrstag", emoji: "🎉", day: 1, month: 1, bundesländer: ["All States"] },
  { id: "may1", name: "Tag der Arbeit", emoji: "🌼", day: 1, month: 5, bundesländer: ["All States"] },
  { id: "unit", name: "Tag der Einheit", emoji: "🏛️", day: 3, month: 10, bundesländer: ["All States"] },
  { id: "xma1", name: "Weihnachtstag", emoji: "🎄", day: 25, month: 12, bundesländer: ["All States"] },
  { id: "xma2", name: "2. Weihnachtstag", emoji: "🎄", day: 26, month: 12, bundesländer: ["All States"] },
  { id: "asmp", name: "M. Himmelfahrt", emoji: "🪽", day: 15, month: 8, bundesländer: ["BY", "SL"] },
  { id: "refm", name: "Reformationstag", emoji: "📜", day: 31, month: 10, bundesländer: ["BB", "MV", "SN", "ST", "TH"] },
  { id: "allh", name: "Allerheiligen", emoji: "🕯️", day: 1, month: 11, bundesländer: ["BW", "BY", "NW", "RP", "SL"] },
  { id: "epip", name: "Dreikönigstag", emoji: "👑", day: 6, month: 1, bundesländer: ["BY", "BW", "ST"] },
];

const germanVariableHolidays = [
  { id: "good", name: "Karfreitag", emoji: "✝️", offset: -2, bundesländer: ["All States"] },
  { id: "easr", name: "Ostersonntag", emoji: "🐰", offset: 0, bundesländer: ["All States"] },
  { id: "easm", name: "Ostermontag", emoji: "🐰", offset: +1, bundesländer: ["All States"] },
  { id: "pent", name: "Pfingstsonntag", emoji: "🕊️", offset: 49, bundesländer: ["All States"] },
  { id: "pmon", name: "Pfingstmontag", emoji: "🌸", offset: +50, bundesländer: ["All States"] },
  { id: "body", name: "Fronleichnam", emoji: "⛪", offset: 60, bundesländer: ["BY", "HE", "NW", "RP", "SL"] },
  { id: "ascn", name: "Himmelfahrt", emoji: "🌥️", offset: +39, bundesländer: ["All States"] },
  // { id: "pray", name: "Buß- & Bettag", emoji: "🙏", offset: -7, bundesländer: ["SN"] },
];

function calculateEasterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function getHolidayDetails(date, state) {
  if (state === 'XX') {
    return { isValid: false, id: 'none', emoji: '🏝️', name: 'No holidays here!' };
  }
  const [year, month, day] = date.split('-').map(Number);

  const matchingHoliday = germanFixedHolidays.find(h =>
    h.day === day &&
    h.month === month &&
    (h.bundesländer.includes(state) || h.bundesländer.includes("All States"))
  );

  if (matchingHoliday) {
    return { isValid: true, id: matchingHoliday.id, emoji: matchingHoliday.emoji, name: matchingHoliday.name };
  }

  const easterSunday = calculateEasterSunday(year);

  const variableHoliday = germanVariableHolidays.find(h => {
    const holidayDate = new Date(easterSunday);
    holidayDate.setDate(easterSunday.getDate() + h.offset);

    const holidayDay = holidayDate.getDate();
    const holidayMonth = holidayDate.getMonth() + 1;

    return (holidayDay === day && holidayMonth === month &&
      (h.bundesländer.includes(state) || h.bundesländer.includes("All States")))
      ? { isValid: true, emoji: h.emoji, name: h.name }
      : false;
  });

  if (variableHoliday) {
    return { isValid: true, id: variableHoliday.id, emoji: variableHoliday.emoji, name: variableHoliday.name };
  }

  return { isValid: false }; // No holiday found
}


function getAllHolidaysForYear(year, state) {
  const holidays = [];

  const easterSunday = calculateEasterSunday(year);


  // Iterate over all 12 months
  for (let month = 1; month <= 12; month++) {
    // Get the number of days in the current month
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      // Check for fixed holidays
      const fixedHoliday = germanFixedHolidays.find(h =>
        h.day === day &&
        h.month === month &&
        (h.bundesländer.includes(state) || h.bundesländer.includes("All States"))
      );

      if (fixedHoliday) {
        holidays.push({
          id: fixedHoliday.id,
          date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          name: fixedHoliday.name,
          emoji: fixedHoliday.emoji,
          bundesländer: fixedHoliday.bundesländer,
        });
        continue; // Skip to next day since we found a holiday
      }

      // Check for variable holidays
      const variableHoliday = germanVariableHolidays.find(h => {
        const holidayDate = new Date(easterSunday);
        holidayDate.setDate(easterSunday.getDate() + h.offset); return holidayDate.getDate() === day &&
          holidayDate.getMonth() + 1 === month && (h.bundesländer.includes(state) || h.bundesländer.includes("All States"));
      });
      if (variableHoliday) {
        holidays.push({
          id: variableHoliday.id,
          date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          name: variableHoliday.name,
          emoji: variableHoliday.emoji,
          bundesländer: variableHoliday.bundesländer,
        });
      }
    }
  }

  holidays.sort((a, b) => new Date(a.date) - new Date(b.date));

  return holidays;
}

export function getAllHolidaysForYearWithoutState(year) {
  const holidays = [];
  const easterSunday = calculateEasterSunday(year);

  // --- Fixed holidays (nationwide only) ---
  germanFixedHolidays.forEach(h => {
    if (h.bundesländer.includes("All States")) {
      holidays.push({
        id: h.id,
        date: `${year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`,
        name: h.name,
        emoji: h.emoji
      });
    }
  });

  // --- Variable holidays (exclude Buß- und Bettag) ---
  germanVariableHolidays.forEach(h => {
    if (h.id !== "pray") {
      const holidayDate = new Date(easterSunday);
      holidayDate.setDate(easterSunday.getDate() + h.offset);
      holidays.push({
        id: h.id,
        date: `${holidayDate.getFullYear()}-${String(holidayDate.getMonth() + 1).padStart(2, '0')}-${String(holidayDate.getDate()).padStart(2, '0')}`,
        name: h.name,
        emoji: h.emoji
      });
    }
  });

  // --- Add Buß- und Bettag correctly ---
  const bettagDate = calculateBußUndBettag(year);
  holidays.push({
    id: "pray",
    date: `${bettagDate.getFullYear()}-${String(bettagDate.getMonth() + 1).padStart(2, '0')}-${String(bettagDate.getDate()).padStart(2, '0')}`,
    name: "Buß- & Bettag",
    emoji: "🙏"
  });

  // --- Non-official holidays (All States) ---
  const nonOfficial = nonOfficialHolidays(year, "All States");
  nonOfficial.forEach(h => {
    holidays.push({
      id: h.id,
      date: h.date,
      name: h.name,
      emoji: h.emoji
    });
  });

  // --- Sort by date ---
  holidays.sort((a, b) => new Date(a.date) - new Date(b.date));

  return holidays;
}



function nonOfficialHolidays(year, state) {
  const holidays = [];

  const fixedHolidays = [
    { id: "walp", name: "Walpurgisnacht", emoji: "🧙‍♀️", day: 30, month: 4, bundesländer: ["TH", "NI"], renderOnly: true },
    { id: "hwen", name: "Halloween", emoji: "🎃", day: 31, month: 10, bundesländer: ["All States"], renderOnly: true },
    { id: "nyev", name: "Silvester", emoji: "🍾", day: 31, month: 12, bundesländer: ["All States"], renderOnly: true },
    { id: "niko", name: "Nikolaus", emoji: "🎅", day: 6, month: 12, bundesländer: ["All States"], renderOnly: true },
    { id: "xma0", name: "Heiligabend", emoji: "🌟", day: 24, month: 12, bundesländer: ["All States"], renderOnly: true }
  ];

  fixedHolidays.forEach(h => {
    if (h.bundesländer.includes("All States") || h.bundesländer.includes(state)) {
      holidays.push({
        id: h.id,
        name: h.name,
        emoji: h.emoji,
        date: `${year}-${String(h.month).padStart(2, '0')}-${String(h.day).padStart(2, '0')}`,
        renderOnly: h.renderOnly
      });
    }
  });

  const easterSunday = calculateEasterSunday(year);

  const dynamicHolidays = [
    {
      id: "rose",
      name: "Rosenmontag",
      emoji: "🤡",
      offset: -47,
      bundesländer: ["NW", "HE", "RP"],
      renderOnly: true
    },
    {
      id: "oktf",
      name: "Oktoberfest",
      emoji: "🍺",
      startOffset: -16, // Example: starts 16 days before the first Sunday in October
      bundesländer: ["BY"],
      renderOnly: true
    }
  ];

  dynamicHolidays.forEach(h => {
    if (h.bundesländer.includes("All States") || h.bundesländer.includes(state)) {
      let holidayDate;

      if (h.name === "Rosenmontag") {
        const date = new Date(easterSunday);
        date.setDate(easterSunday.getDate() + h.offset);
        holidayDate = date;
      } else if (h.name === "Oktoberfest") {
        const firstSundayInOctober = new Date(year, 9, 1); // October 1
        while (firstSundayInOctober.getDay() !== 0) {
          firstSundayInOctober.setDate(firstSundayInOctober.getDate() + 1);
        }
        holidayDate = new Date(firstSundayInOctober);
        holidayDate.setDate(firstSundayInOctober.getDate() + h.startOffset);
      }

      holidays.push({
        id: h.id,
        name: h.name,
        emoji: h.emoji,
        date: `${holidayDate.getFullYear()}-${String(holidayDate.getMonth() + 1).padStart(2, '0')}-${String(holidayDate.getDate()).padStart(2, '0')}`,
        renderOnly: h.renderOnly
      });
    }
  });

  return holidays.sort((a, b) => new Date(a.date) - new Date(b.date));
}


function calculateRosenmontag(year) {
  const easterSunday = calculateEasterSunday(year);
  const rosenmontagDate = new Date(easterSunday);
  rosenmontagDate.setDate(easterSunday.getDate() - 47);
  return rosenmontagDate; // Will handle February and leap years automatically
}

function calculateOktoberfestStart(year) {
  const september15th = new Date(year, 8, 15); // September 15th
  const firstSaturday = new Date(september15th);
  firstSaturday.setDate(september15th.getDate() + (6 - september15th.getDay() + 7) % 7); // Calculate the first Saturday after September 15th
  return firstSaturday;
}

export function getHolidayGreetingForToday() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  const allHolidays = getAllHolidaysForYearWithoutState(year);
  const todayHoliday = allHolidays.find(h => h.date === todayStr);
  if (!todayHoliday) return null;

  const greetingsMap = {
    "Weihnachtstag": "Frohe Weihnachten!",
    "Zweiter Weihnachtstag": "Frohe Weihnachten und schöne Feiertage!",
    "Neujahrstag": "Ein glückliches neues Jahr!",
    "Tag der Arbeit": "Einen schönen Tag der Arbeit!",
    "Tag der Deutschen Einheit": "Frohen Tag der Deutschen Einheit!",
    "Mariä Himmelfahrt": "Gesegneten Mariä Himmelfahrt!",
    "Allerheiligen": "Einen besinnlichen Allerheiligen-Tag!",
    "Fronleichnam": "Gesegneten Fronleichnam!",
    "Dreikönigstag": "Frohen Dreikönigstag!",
    "Ostersonntag": "Frohe Ostern!",
    "Karfreitag": "Einen besinnlichen Karfreitag!",
    "Ostermontag": "Frohen Ostermontag!",
    "Christi Himmelfahrt": "Gesegneten Christi Himmelfahrt!",
    "Pfingstsonntag": "Frohen Pfingstsonntag!",
    "Pfingstmontag": "Frohen Pfingstmontag!",
    "Buß- und Bettag": "Einen besinnlichen Buß- und Bettag!",
    "Rosenmontag": "Helau und Alaaf zum Rosenmontag!",
    "Oktoberfest": "O’zapft is!",
    "Heiligabend": "Frohe Weihnachten!",
    "Walpurgisnacht": "Fröhliche Walpurgisnacht!",
    "Halloween": "Happy Halloween!",
    "Silvester": "Einen guten Rutsch ins neue Jahr!",
    "Nikolaus": "Fröhlichen Nikolaus!"
  };

  const greeting = greetingsMap[todayHoliday.name];
  return greeting ? `<span class="noto"> ${todayHoliday.emoji} </span> ${greeting} <span class="noto"> ${todayHoliday.emoji} </span>` : null;
}

export function filterPublicHolidaysByYearAndState(year, state) {
  let holidays = getAllHolidaysForYear(year, state);
  const result = holidays
    .filter(h => h.bundesländer && (h.bundesländer.includes(state) || h.bundesländer.includes("All States")))
    .map(h => ({ ...h, isOpen: !!h.isOpen }));
  return result;
}

function calculateBußUndBettag(year) {
  const christmas = new Date(year, 11, 25); // Dec 25
  // Find the 4th Sunday before Christmas
  let firstAdvent = new Date(christmas);
  firstAdvent.setDate(christmas.getDate() - 28); // Go back 4 weeks
  firstAdvent.setDate(firstAdvent.getDate() - firstAdvent.getDay()); // Go to Sunday
  // Wednesday before that Sunday
  const bußUndBettag = new Date(firstAdvent);
  bußUndBettag.setDate(firstAdvent.getDate() - 4); // Wednesday before
  return bußUndBettag;
}


export {
  monthNames,
  germanFixedHolidays,
  germanVariableHolidays,
  getHolidayDetails,
  getAllHolidaysForYear,
  nonOfficialHolidays,
};
