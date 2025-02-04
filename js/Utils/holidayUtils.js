const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

const germanFixedHolidays = [
  { name: "Neujahrstag", emoji: "🎉", day: 1, month: 1, bundesländer: ["All States"] },
  { name: "Tag der Arbeit", emoji: "🌼", day: 1, month: 5, bundesländer: ["All States"] },
  { name: "Tag der Deutschen Einheit", emoji: "🏛️", day: 3, month: 10, bundesländer: ["All States"] },
  { name: "Weihnachtstag", emoji: "🎄", day: 25, month: 12, bundesländer: ["All States"] },
  { name: "Zweiter Weihnachtstag", emoji: "🎄", day: 26, month: 12, bundesländer: ["All States"] },
  { name: "Mariä Himmelfahrt", emoji: "👑", day: 15, month: 8, bundesländer: ["BY", "SL"] },
  { name: "Reformationstag", emoji: "📜", day: 31, month: 10, bundesländer: ["BB", "MV", "SN", "ST", "TH"] },
  { name: "Allerheiligen", emoji: "🌺", day: 1, month: 11, bundesländer: ["BW", "BY", "NW", "RP", "SL"] },
  { name: "Fronleichnam", emoji: "⛪", day: 8, month: 6, bundesländer: ["BY", "HE", "NW", "RP", "SL"] },
  { name: "Dreikönigstag", emoji: "👑", day: 6, month: 1, bundesländer: ["BY", "BW", "ST"] },
];

const germanVariableHolidays = [
  { name: "Karfreitag", emoji: "✝️", offset: -2, bundesländer: ["All States"] },
  { name: "Ostersonntag", emoji: "🐰", offset: 0, bundesländer: ["All States"] },
  { name: "Ostermontag", emoji: "🐰", offset: +1, bundesländer: ["All States"] },
  { name: "Pfingstmontag", emoji: "🌸", offset: +50, bundesländer: ["All States"] },
  { name: "Christi Himmelfahrt", emoji: "🌥️", offset: +39, bundesländer: ["All States"] },
  { name: "Buß- und Bettag", emoji: "🙏", offset: -7, bundesländer: ["SN"] },
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
  const [year, month, day] = date.split('-').map(Number);

  const matchingHoliday = germanFixedHolidays.find(h =>
    h.day === day &&
    h.month === month &&
    (h.bundesländer.includes(state) || h.bundesländer.includes("All States"))
  );

  if (matchingHoliday) {
    console.log("Fixed holiday match found:", matchingHoliday.name);
    return { isValid: true, emoji: matchingHoliday.emoji, name: matchingHoliday.name };
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
    console.log("Variable holiday match found:", variableHoliday.name);
    // return variableHoliday;
    return { isValid: true, emoji: variableHoliday.emoji, name: variableHoliday.name }
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
          date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          name: fixedHoliday.name,
          emoji: fixedHoliday.emoji
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
          date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
          name: variableHoliday.name,
          emoji: variableHoliday.emoji
        });
      }
    }
  }

  holidays.sort((a, b) => new Date(a.date) - new Date(b.date));

  return holidays;
}

function nonOfficialHolidays(year, state) {
  const holidays = [];

  const fixedHolidays = [
    { name: "Walpurgisnacht", emoji: "🧙‍♀️", day: 30, month: 4, bundesländer: ["TH", "NI"], renderOnly: true },
    { name: "Halloween", emoji: "🎃", day: 31, month: 10, bundesländer: ["All States"], renderOnly: true },
    { name: "Silvester", emoji: "🍾", day: 31, month: 12, bundesländer: ["All States"], renderOnly: true },
    { name: "Nikolaus", emoji: "🎅", day: 6, month: 12, bundesländer: ["All States"], renderOnly: true },
    { name: "Heiligabend", emoji: "🌟", day: 24, month: 12, bundesländer: ["All States"], renderOnly: true }
  ];

  fixedHolidays.forEach(h => {
    if (h.bundesländer.includes("All States") || h.bundesländer.includes(state)) {
      holidays.push({
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
      name: "Rosenmontag",
      emoji: "🤡",
      offset: -47,
      bundesländer: ["NW", "HE", "RP"],
      renderOnly: true
    },
    {
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


export {
  monthNames,
  germanFixedHolidays,
  germanVariableHolidays,
  getHolidayDetails,
  getAllHolidaysForYear,
  nonOfficialHolidays,
};
