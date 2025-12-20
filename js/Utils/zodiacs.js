export function getZodiac(date, style = "symbol") {
    if (style === "none") return document.createElement("span");

    const zodiacRanges = [
        { name: "Widder", sign: "Aries", symbol: "♈", icon: "🐏", start: [3, 21], end: [4, 19] },
        { name: "Stier", sign: "Taurus", symbol: "♉", icon: "🐂", start: [4, 20], end: [5, 20] },
        { name: "Zwillinge", sign: "Gemini", symbol: "♊", icon: "👯", start: [5, 21], end: [6, 20] },
        { name: "Krebs", sign: "Cancer", symbol: "♋", icon: "🦀", start: [6, 21], end: [7, 22] },
        { name: "Löwe", sign: "Leo", symbol: "♌", icon: "🦁", start: [7, 23], end: [8, 22] },
        { name: "Jungfrau", sign: "Virgo", symbol: "♍", icon: "👩‍🌾", start: [8, 23], end: [9, 22] },
        { name: "Waage", sign: "Libra", symbol: "♎", icon: "⚖️", start: [9, 23], end: [10, 22] },
        { name: "Skorpion", sign: "Scorpio", symbol: "♏", icon: "🦂", start: [10, 23], end: [11, 21] },
        { name: "Schütze", sign: "Sagittarius", symbol: "♐", icon: "🏹", start: [11, 22], end: [12, 21] },
        { name: "Steinbock", sign: "Capricorn", symbol: "♑", icon: "🐐", start: [12, 22], end: [1, 19] },
        { name: "Wassermann", sign: "Aquarius", symbol: "♒", icon: "🌊", start: [1, 20], end: [2, 18] },
        { name: "Fische", sign: "Pisces", symbol: "♓", icon: "🐟", start: [2, 19], end: [3, 20] },
    ];

    const m = date.getMonth() + 1;
    const d = date.getDate();

    function inRange(start, end) {
        const [sm, sd] = start;
        const [em, ed] = end;

        if (sm < em) {
            return (m > sm || (m === sm && d >= sd)) &&
                (m < em || (m === em && d <= ed));
        } else {
            // Range wraps across new year (e.g. Capricorn)
            return (m > sm || (m === sm && d >= sd)) ||
                (m < em || (m === em && d <= ed));
        }
    }

    const zodiac = zodiacRanges.find(z => inRange(z.start, z.end));
    const span = document.createElement("span");

    if (!zodiac) return span;

    span.textContent = style === "icon" ? zodiac.icon : zodiac.symbol;
    span.title = zodiac.name || zodiac.sign;

    return span;
}
