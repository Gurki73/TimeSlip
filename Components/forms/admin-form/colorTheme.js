// colorSchema.js
import { loadTeamnames, saveTeamnames } from "../../../js/loader/role-loader.js";

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

let teamnames = { blue: "Team Blau", green: "Team Grün", red: "Team Rot", black: "Team Schwarz" }

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

// In colorTheme.js - Speicher-Logik
async function saveCustomTheme() {
    // Aktuelle Farben aus den Pickern sammeln
    const theme = {
        roles: {
            'team-blue': getPickerColor('team-blue'),
            'team-green': getPickerColor('team-green'),
            'team-yellow': getPickerColor('team-yellow'),
            'team-red': getPickerColor('team-red'),
            'team-purple': getPickerColor('team-purple'),
            'team-orange': getPickerColor('team-orange'),
            'team-cyan': getPickerColor('team-cyan'),
            'team-pink': getPickerColor('team-pink'),
            'team-brown': getPickerColor('team-brown'),
            'team-grey': getPickerColor('team-grey')
        },
        calendar: {
            'weekday-bg': getPickerColor('weekday-bg'),
            'weekend-bg': getPickerColor('weekend-bg'),
            'today-bg': getPickerColor('today-bg'),
            'selected-bg': getPickerColor('selected-bg'),
            'holiday-bg': getPickerColor('holiday-bg'),
            'birthday-bg': getPickerColor('birthday-bg')
        },
        app: {
            'bg-primary': getPickerColor('bg-primary'),
            'bg-secondary': getPickerColor('bg-secondary'),
            'text-primary': getPickerColor('text-primary'),
            'text-secondary': getPickerColor('text-secondary'),
            'border-color': getPickerColor('border-color'),
            'hover-bg': getPickerColor('hover-bg'),
            'active-bg': getPickerColor('active-bg'),
            'shadow-color': getPickerColor('shadow-color'),
            'header-bg': getPickerColor('header-bg'),
            'footer-bg': getPickerColor('footer-bg')
        }
    };

    try {
        // Im localStorage speichern
        localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(theme));

        // Über IPC an den Main-Prozess senden
        await window.api.invoke('save-custom-theme', theme);

        // Theme auf 'custom' setzen
        setTheme('custom');

        showNotification('Custom-Theme erfolgreich gespeichert!', 'success');
    } catch (err) {
        console.error('Failed to save custom theme:', err);
        showNotification('Fehler beim Speichern des Themes', 'error');
    }
}

// Custom-Theme laden (für die Picker-Initialisierung)
async function loadCustomTheme() {
    try {
        // Versuche vom Main-Prozess zu laden
        const theme = await window.api.invoke('get-custom-theme');
        if (theme) {
            localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(theme));
            return theme;
        }

        // Fallback: Aus localStorage laden
        const raw = localStorage.getItem(CUSTOM_THEME_KEY);
        if (raw) {
            return JSON.parse(raw);
        }
    } catch (err) {
        console.warn('Failed to load custom theme:', err);
    }
    return null;
}

// In colorTheme.js - Custom-Theme UI
class SimpleColorPicker {
    // ============================================================
    // Team Palette
    // ============================================================
    //
    // Each team has a FIXED color family.
    // Each family contains:
    //
    //     12 hue variants × 8 brightness levels = 96 colors
    //
    // Columns:
    //     hue/family variation
    //
    // Rows:
    //     brightness
    //     top    = light
    //     bottom = dark
    //
    // The actual colors are generated dynamically in OKLCH.
    // No 96 individual hex values are stored.
    //

    const TEAM_PALETTE_CONFIG = {
        red: {
            label: 'Rot',

            // Allowed hue bandwidth for red.
            // The interpolation follows the shortest path around
            // the hue wheel.
            hueLeft: 350,
            hueRight: 20,

            // OKLCH lightness
            light: 0.86,
            dark: 0.34,

            // Chroma
            chroma: 0.17
        },

        green: {
            label: 'Grün',

            hueLeft: 105,
            hueRight: 165,

            light: 0.86,
            dark: 0.34,

            chroma: 0.16
        },

        blue: {
            label: 'Blau',

            hueLeft: 210,
            hueRight: 260,

            light: 0.86,
            dark: 0.34,

            chroma: 0.15
        },

        gray: {
            label: 'Grau',

            // Gray has almost no chroma.
            // The hue variation produces warm/cool grays
            // without leaving the gray family.
            hueLeft: 220,
            hueRight: 40,

            light: 0.86,
            dark: 0.30,

            chroma: 0.015
        }
    };

    const TEAM_ROLE_RANGES = {
        blue: [1, 2, 3],
        green: [4, 5, 6],
        red: [7, 8, 9],
        gray: [10, 11, 12]
    };


// ============================================================
// Palette generator
// ============================================================

class TeamPalette {
    constructor(options) {
        this.element =
            typeof options.element === 'string'
                ? document.getElementById(options.element)
                : options.element;

        this.team = options.team;
        this.config = {
            ...TEAM_PALETTE_CONFIG[this.team],
            ...(options.config || {})
        };

        this.roleIndices =
            options.roleIndices ||
            TEAM_ROLE_RANGES[this.team] ||
            [];

        this.selectedRole = 0;

        this.onChange =
            options.onChange ||
            (() => { });

        this.cells = [];

        this.render();
    }

    render() {
        if (!this.element) {
            console.warn(`TeamPalette: element not found`);
            return;
        }

        this.element.innerHTML = '';

        const wrapper = document.createElement('div');
        wrapper.className = 'team-palette';

        // ----------------------------------------------------
        // Role selector
        // ----------------------------------------------------

        const roleBar = document.createElement('div');
        roleBar.className = 'team-palette-role-bar';

        this.roleButtons = [];

        this.roleIndices.forEach((roleIndex, index) => {
            const button = document.createElement('button');

            button.type = 'button';
            button.className = 'team-palette-role';
            button.textContent = `#${roleIndex}`;

            button.setAttribute(
                'aria-label',
                `Aufgabe ${roleIndex} auswählen`
            );

            button.addEventListener('click', () => {
                this.selectRole(index);
            });

            this.roleButtons.push(button);
            roleBar.appendChild(button);
        });

        wrapper.appendChild(roleBar);

        // ----------------------------------------------------
        // Palette table
        // ----------------------------------------------------

        const table = document.createElement('table');

        table.className = 'team-palette-grid';

        table.setAttribute(
            'aria-label',
            `${this.config.label} Farbpalette`
        );

        const tbody = document.createElement('tbody');

        this.cells = [];

        for (let row = 0; row < 8; row++) {
            const tr = document.createElement('tr');

            const rowCells = [];

            for (let col = 0; col < 12; col++) {
                const color = this.getColor(col, row);

                const td = document.createElement('td');

                const button = document.createElement('button');

                button.type = 'button';

                button.className = 'team-palette-cell';

                button.style.backgroundColor = color;

                button.dataset.column = col;
                button.dataset.row = row;
                button.dataset.color = color;

                button.tabIndex = -1;

                button.setAttribute(
                    'aria-label',
                    `${this.config.label}, Variante ${col + 1}, Helligkeit ${row + 1}`
                );

                button.addEventListener('click', () => {
                    this.selectColor(col, row);
                });

                button.addEventListener('keydown', event => {
                    this.handleKeyboard(event, col, row);
                });

                td.appendChild(button);
                tr.appendChild(td);

                rowCells.push(button);
            }

            tbody.appendChild(tr);
            this.cells.push(rowCells);
        }

        table.appendChild(tbody);
        wrapper.appendChild(table);

        this.element.appendChild(wrapper);

        this.updateSelection();

        // Make first cell keyboard-focusable.
        this.cells[0][0].tabIndex = 0;
    }


    // --------------------------------------------------------
    // Generate one color
    // --------------------------------------------------------

    getColor(column, row) {
        const hue = interpolateHue(
            this.config.hueLeft,
            this.config.hueRight,
            column / 11
        );

        const lightness = interpolate(
            this.config.light,
            this.config.dark,
            row / 7
        );

        return oklchToHex(
            lightness,
            this.config.chroma,
            hue
        );
    }


    // --------------------------------------------------------
    // Role selection
    // --------------------------------------------------------

    selectRole(index) {
        if (index < 0 || index >= this.roleIndices.length) {
            return;
        }

        this.selectedRole = index;

        this.updateSelection();
    }


    // --------------------------------------------------------
    // Color selection
    // --------------------------------------------------------

    selectColor(column, row) {
        const button = this.cells?.[row]?.[column];

        if (!button) {
            return;
        }

        const roleIndex = this.roleIndices[this.selectedRole];

        const color = button.dataset.color;

        this.updateSelection(column, row);

        this.onChange({
            team: this.team,
            roleIndex,
            rolePosition: this.selectedRole,
            column,
            row,
            color
        });
    }


    // --------------------------------------------------------
    // Visual selection state
    // --------------------------------------------------------

    updateSelection(column = null, row = null) {
        this.cells.forEach(rowCells => {
            rowCells.forEach(cell => {
                cell.classList.remove('selected');
                cell.classList.remove('active-role');
            });
        });

        // Mark the current role button.
        this.roleButtons?.forEach((button, index) => {
            button.classList.toggle(
                'active',
                index === this.selectedRole
            );
        });

        if (column !== null && row !== null) {
            const cell = this.cells[row]?.[column];

            if (cell) {
                cell.classList.add('selected');
                cell.focus();
            }
        }
    }


    // --------------------------------------------------------
    // Keyboard navigation
    // --------------------------------------------------------

    handleKeyboard(event, column, row) {
        let nextColumn = column;
        let nextRow = row;

        switch (event.key) {
            case 'ArrowLeft':
                nextColumn--;
                break;

            case 'ArrowRight':
                nextColumn++;
                break;

            case 'ArrowUp':
                nextRow--;
                break;

            case 'ArrowDown':
                nextRow++;
                break;

            case 'Home':
                nextColumn = 0;
                break;

            case 'End':
                nextColumn = 11;
                break;

            case 'Enter':
            case ' ':
                event.preventDefault();
                this.selectColor(column, row);
                return;

            default:
                return;
        }

        event.preventDefault();

        nextColumn = Math.max(0, Math.min(11, nextColumn));
        nextRow = Math.max(0, Math.min(7, nextRow));

        const nextCell = this.cells[nextRow]?.[nextColumn];

        if (!nextCell) {
            return;
        }

        this.cells.forEach(rowCells => {
            rowCells.forEach(cell => {
                cell.tabIndex = -1;
            });
        });

        nextCell.tabIndex = 0;
        nextCell.focus();
    }
}


// ============================================================
// Math helpers
// ============================================================

function interpolate(a, b, t) {
    return a + (b - a) * t;
}


// Hue interpolation.
//
// Handles the circular 360° hue wheel correctly.
// Example:
//
//     350° → 20°
//
// becomes:
//
//     350 → 355 → 0 → 5 → 10 → 15 → 20
//

function interpolateHue(a, b, t) {
    let delta = ((b - a + 540) % 360) - 180;

    let hue = a + delta * t;

    hue %= 360;

    if (hue < 0) {
        hue += 360;
    }

    return hue;
}


// ============================================================
// OKLCH → sRGB → HEX
// ============================================================
//
// No library required.
//
// OKLCH gives us a much more useful lightness axis than HSL.
// The final conversion includes simple gamut handling.
//

function oklchToHex(L, C, H) {
    const hRad = H * Math.PI / 180;

    const a = C * Math.cos(hRad);
    const b = C * Math.sin(hRad);

    // OKLab → XYZ
    const l = L + 0.3963377774 * a + 0.2158037573 * b;
    const m = L - 0.1055613458 * a - 0.0638541728 * b;
    const s = L - 0.0894841775 * a - 1.2914855480 * b;

    const l3 = l * l * l;
    const m3 = m * m * m;
    const s3 = s * s * s;

    const X =
        1.2270138511 * l3 -
        0.5577999807 * m3 +
        0.2812561490 * s3;

    const Y =
        -0.0405801784 * l3 +
        1.1122568696 * m3 -
        0.0716766787 * s3;

    const Z =
        -0.0763812845 * l3 -
        0.4214819784 * m3 +
        1.5861632204 * s3;

    // XYZ → linear sRGB
    let r =
        3.2409699419 * X -
        1.5373831776 * Y -
        0.4986107603 * Z;

    let g =
        -0.9692436363 * X +
        1.8759675015 * Y +
        0.0415550574 * Z;

    let blue =
        0.0556300797 * X -
        0.2039769589 * Y +
        1.0569715142 * Z;

    // --------------------------------------------------------
    // Simple gamut mapping.
    //
    // If a color falls outside sRGB, progressively reduce
    // chroma until it fits.
    // --------------------------------------------------------

    if (
        r < 0 || r > 1 ||
        g < 0 || g > 1 ||
        blue < 0 || blue > 1
    ) {
        const originalChroma = C;

        for (let factor = 0.98; factor >= 0; factor -= 0.02) {
            const mapped = oklchToLinearRgb(
                L,
                originalChroma * factor,
                H
            );

            if (
                mapped.r >= 0 && mapped.r <= 1 &&
                mapped.g >= 0 && mapped.g <= 1 &&
                mapped.b >= 0 && mapped.b <= 1
            ) {
                r = mapped.r;
                g = mapped.g;
                blue = mapped.b;
                break;
            }
        }
    }

    return rgbToHex(
        linearToSrgb(r),
        linearToSrgb(g),
        linearToSrgb(blue)
    );
}


function oklchToLinearRgb(L, C, H) {
    const hRad = H * Math.PI / 180;

    const a = C * Math.cos(hRad);
    const b = C * Math.sin(hRad);

    const l = L + 0.3963377774 * a + 0.2158037573 * b;
    const m = L - 0.1055613458 * a - 0.0638541728 * b;
    const s = L - 0.0894841775 * a - 1.2914855480 * b;

    const l3 = l * l * l;
    const m3 = m * m * m;
    const s3 = s * s * s;

    const X =
        1.2270138511 * l3 -
        0.5577999807 * m3 +
        0.2812561490 * s3;

    const Y =
        -0.0405801784 * l3 +
        1.1122568696 * m3 -
        0.0716766787 * s3;

    const Z =
        -0.0763812845 * l3 -
        0.4214819784 * m3 +
        1.5861632204 * s3;

    return {
        r:
            3.2409699419 * X -
            1.5373831776 * Y -
            0.4986107603 * Z,

        g:
            -0.9692436363 * X +
            1.8759675015 * Y +
            0.0415550574 * Z,

        b:
            0.0556300797 * X -
            0.2039769589 * Y +
            1.0569715142 * Z
    };
}


function linearToSrgb(value) {
    value = Math.max(0, Math.min(1, value));

    if (value <= 0.0031308) {
        return 12.92 * value;
    }

    return (
        1.055 * Math.pow(value, 1 / 2.4) -
        0.055
    );
}


function rgbToHex(r, g, b) {
    const toHex = value =>
        Math.round(value * 255)
            .toString(16)
            .padStart(2, '0');

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// ============================================================
// Palette color matching
// ============================================================
//
// Finds the closest color in one of the generated 96-color
// palettes.
//
// Accepts:
//   #rrggbb
//   #rgb
//   rgb(...)
//   rgba(...)
//   CSS named colors such as "salmon", "cornflowerblue"
//
// Matching is done in OKLab, which is much more appropriate
// for perceptual color distance than RGB distance.
//


// ------------------------------------------------------------
// Public API
// ------------------------------------------------------------

export function findBestPaletteMatch(color, team) {
    const config = TEAM_PALETTE_CONFIG[team];

    if (!config) {
        throw new Error(`Unknown team palette: ${team}`);
    }

    const rgb = parseCssColor(color);

    if (!rgb) {
        throw new Error(`Cannot parse color: ${color}`);
    }

    const target = rgbToOklab(
        rgb.r,
        rgb.g,
        rgb.b
    );

    let best = null;

    for (let row = 0; row < 8; row++) {
        for (let column = 0; column < 12; column++) {

            const paletteColor = oklchToHex(
                interpolate(
                    config.light,
                    config.dark,
                    row / 7
                ),

                config.chroma,

                interpolateHue(
                    config.hueLeft,
                    config.hueRight,
                    column / 11
                )
            );

            const paletteRgb = parseCssColor(paletteColor);

            const paletteLab = rgbToOklab(
                paletteRgb.r,
                paletteRgb.g,
                paletteRgb.b
            );

            const distance = colorDistanceOklab(
                target,
                paletteLab
            );

            if (!best || distance < best.distance) {
                best = {
                    team,
                    row,
                    column,
                    color: paletteColor,
                    distance
                };
            }
        }
    }

    return best;
}


// ------------------------------------------------------------
// Search all four team palettes
// ------------------------------------------------------------

export function findBestTeamPaletteMatch(color) {
    const matches = [];

    for (const team of Object.keys(TEAM_PALETTE_CONFIG)) {
        const match = findBestPaletteMatch(color, team);

        matches.push(match);
    }

    matches.sort(
        (a, b) => a.distance - b.distance
    );

    return matches[0];
}


// ------------------------------------------------------------
// CSS color parser
// ------------------------------------------------------------
//
// We deliberately let the browser parse named CSS colors.
// This means we don't need a giant list of CSS color names.
//
// Canvas understands:
//   salmon
//   cornflowerblue
//   rgb(...)
//   rgba(...)
//   #...
//

function parseCssColor(value) {
    if (!value || typeof value !== 'string') {
        return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
        return null;
    }

    ctx.clearRect(0, 0, 1, 1);

    ctx.fillStyle = '#000000';
    ctx.fillStyle = value;

    const normalized = ctx.fillStyle;

    // Browser normally converts named colors and rgb/rgba
    // into rgb(...).
    const match = normalized.match(
        /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/
    );

    if (!match) {
        // Handle hexadecimal output from the browser.
        if (/^#[0-9a-f]{6}$/i.test(normalized)) {
            return {
                r: parseInt(normalized.slice(1, 3), 16),
                g: parseInt(normalized.slice(3, 5), 16),
                b: parseInt(normalized.slice(5, 7), 16)
            };
        }

        return null;
    }

    return {
        r: Number(match[1]),
        g: Number(match[2]),
        b: Number(match[3])
    };
}


// ------------------------------------------------------------
// RGB → OKLab
// ------------------------------------------------------------

function rgbToOklab(r, g, b) {
    r = srgbToLinear(r / 255);
    g = srgbToLinear(g / 255);
    b = srgbToLinear(b / 255);

    const l =
        0.4122214708 * r +
        0.5363325363 * g +
        0.0514459929 * b;

    const m =
        0.2119034982 * r +
        0.6806995451 * g +
        0.1073969566 * b;

    const s =
        0.0883024619 * r +
        0.2817188376 * g +
        0.6299787005 * b;

    const lRoot = Math.cbrt(l);
    const mRoot = Math.cbrt(m);
    const sRoot = Math.cbrt(s);

    return {
        L:
            0.2104542553 * lRoot +
            0.7936177850 * mRoot -
            0.0040720468 * sRoot,

        a:
            1.9779984951 * lRoot -
            2.4285922050 * mRoot +
            0.4505937099 * sRoot,

        b:
            0.0259040371 * lRoot +
            0.7827717662 * mRoot -
            0.8086757660 * sRoot
    };
}


function srgbToLinear(value) {
    if (value <= 0.04045) {
        return value / 12.92;
    }

    return Math.pow(
        (value + 0.055) / 1.055,
        2.4
    );
}


// ------------------------------------------------------------
// Perceptual distance
// ------------------------------------------------------------

function colorDistanceOklab(a, b) {
    const dL = a.L - b.L;
    const da = a.a - b.a;
    const db = a.b - b.b;

    return Math.sqrt(
        dL * dL +
        da * da +
        db * db
    );
}

// Export für admin-form.js
export { initCustomThemeUI, loadCustomTheme, saveCustomTheme, SimpleColorPicker };
