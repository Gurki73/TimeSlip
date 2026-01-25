// colorSchema.js
import { loadTeamnames, saveTeamnames } from "../../../js/loader/role-loader.js";

const TEAM_COLOR_RULES = {
    blue: { hue: [200, 220], sat: [30, 80], light: [30, 70] },
    green: { hue: [100, 140], sat: [30, 80], light: [30, 70] },
    red: { hue: [350, 10], sat: [30, 80], light: [30, 70] },
    black: { hue: [190, 240], sat: [5, 20], light: [5, 25] },
    trainee: { hue: [25, 45], sat: [40, 90], light: [40, 80] }
};


const colorCustomTheme = {
    roles: {
        label: "Aufgaben / Teams",
        description: "Farbzuordnung für Aufgaben und Teams",
        items: [
            { key: "role-1-color", label: "Team 1 – Aufgabe 1", group: "Team blue" },
            { key: "role-2-color", label: "Team 1 – Aufgabe 2", group: "Team blue" },
            { key: "role-3-color", label: "Team 1 – Aufgabe 2", group: "Team blue" },
            { key: "role-4-color", label: "Team 1 – Aufgabe 2", group: "Team green" },
            { key: "role-5-color", label: "Team 1 – Aufgabe 2", group: "Team green" },
            { key: "role-6-color", label: "Team 1 – Aufgabe 2", group: "Team green" },
            { key: "role-7-color", label: "Team 1 – Aufgabe 2", group: "Team red" },
            { key: "role-8-color", label: "Team 1 – Aufgabe 2", group: "Team red" },
            { key: "role-9-color", label: "Team 1 – Aufgabe 2", group: "Team red" },
            { key: "role-10-color", label: "Team 1 – Aufgabe 2", group: "Team black" },
            { key: "role-11-color", label: "Team 1 – Aufgabe 2", group: "Team black" },
            { key: "role-12-color", label: "Team 1 – Aufgabe 2", group: "Team black" },
            { key: "role-13-color", label: "Team 5 – Aufgabe 13", group: "Team trainee" }
        ]
    },

    calendar: {
        label: "Kalender",
        items: [
            { key: "calendar-day-regular-bg", label: "Werktag" },
            { key: "calendar-day-weekend-bg", label: "Wochenende" },
            { key: "calendar-day-holiday-bg", label: "Feiertag" },
            { key: "calendar-day-closed-bg", label: "Geschlossen" },

            { key: "calendar-shift-early-bg", label: "Frühschicht" },
            { key: "calendar-shift-day-bg", label: "Tagschicht" },
            { key: "calendar-shift-late-bg", label: "Spätschicht" }
        ]
    },

    app: {
        label: "App Design",
        items: [
            { key: "bg-white", label: "Hintergrund (hell)" },
            { key: "bg-inactive", label: "Inaktiv" },
            { key: "button-active-color", label: "Button aktiv" },
            { key: "button-hover-color", label: "Button Hover" },
            { key: "text-color", label: "Standard Text" }
        ]
    }
};

const ROLE_OFFSETS = {
    1: -12,
    2: 0,
    3: +12
};

let teamnames = { blue: "Team Blau", green: "Team Grün", red: "Team Rot", black: "Team Schwarz" }

function deriveRoleColor(baseColor, roleOffset) {
    const { h, s, l } = toHSL(baseColor);
    return `hsl(${h}, ${s}%, ${clamp(l + roleOffset, 5, 90)}%)`;
}

function clampToTeam(color, team) {
    const rules = TEAM_COLOR_RULES[team];
    let { h, s, l } = toHSL(color);

    h = clampHue(h, rules.hue);
    s = clamp(s, rules.sat[0], rules.sat[1]);
    l = clamp(l, rules.light[0], rules.light[1]);

    return `hsl(${h}, ${s}%, ${l}%)`;
}

export async function initRoleColorTab(api) {
    // team names reuse your existing logic
    // teamnames = await loadTeamnames(api);

    const cells = document.querySelectorAll('#tab-roles td[data-role]');

    cells.forEach(cell => {
        const roleIndex = cell.dataset.role;
        const varName = `--role-${roleIndex}-color`;

        const currentColor =
            getComputedStyle(document.documentElement)
                .getPropertyValue(varName)
                .trim();

        const wrapper = document.createElement('div');
        wrapper.className = 'role-color-editor';

        const preview = document.createElement('div');
        preview.className = 'role-preview';
        preview.style.backgroundColor = currentColor;

        const label = document.createElement('span');
        label.className = 'role-index';
        label.textContent = `#${roleIndex}`;

        const picker = document.createElement('input');
        picker.type = 'color';
        picker.value = normalizeHex(currentColor);

        picker.addEventListener('input', () => {
            document.documentElement
                .style
                .setProperty(varName, picker.value);

            preview.style.backgroundColor = picker.value;
        });

        wrapper.append(label, preview, picker);
        cell.appendChild(wrapper);
    });

    initTabs();
}

function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-header');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab; // roles / calendar / app

            // Remove "active" from all buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));

            // Add "active" to clicked button
            button.classList.add('active');

            // Hide all tab contents
            tabContents.forEach(content => content.classList.remove('active'));

            // Show the clicked tab content
            const activeContent = document.getElementById(`tab-${targetTab}`);
            if (activeContent) activeContent.classList.add('active');
        });
    });
}


function normalizeHex(color) {
    if (color.startsWith('#')) return color;
    // rgb → hex fallback
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = color;
    return ctx.fillStyle;
}
