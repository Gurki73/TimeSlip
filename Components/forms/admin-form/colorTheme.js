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
    constructor(options) {
        this.element = options.element;
        this.initialColor = options.initialColor || '#3498db';
        this.onChange = options.onChange || (() => { });
        this.hueLimit = options.hueLimit || null;
        this.colorKey = options.colorKey || '';
        this.init();
    }

    init() {
        // Slider-Elemente finden
        this.hueSlider = this.element.querySelector('.hue-slider');
        this.saturationSlider = this.element.querySelector('.saturation-slider');
        this.lightnessSlider = this.element.querySelector('.lightness-slider');
        this.preview = this.element.querySelector('.color-preview');
        this.hexInput = this.element.querySelector('.color-hex-input');

        // Initiale Farbe setzen
        const hsl = this.hexToHsl(this.initialColor);
        this.hue = hsl.h;
        this.saturation = hsl.s;
        this.lightness = hsl.l;

        // Slider-Werte setzen
        if (this.hueSlider) this.hueSlider.value = this.hue;
        if (this.saturationSlider) this.saturationSlider.value = this.saturation;
        if (this.lightnessSlider) this.lightnessSlider.value = this.lightness;
        if (this.hexInput) this.hexInput.value = this.initialColor;

        // Event-Listener
        this.hueSlider?.addEventListener('input', () => this.updateColor());
        this.saturationSlider?.addEventListener('input', () => this.updateColor());
        this.lightnessSlider?.addEventListener('input', () => this.updateColor());
        this.hexInput?.addEventListener('change', () => this.updateFromHex());

        // Initial anzeigen
        this.updatePreview();
    }

    updateColor() {
        let hue = parseInt(this.hueSlider?.value || 0);

        // Hue-Limit anwenden
        if (this.hueLimit) {
            hue = Math.min(Math.max(hue, this.hueLimit.min), this.hueLimit.max);
            if (this.hueSlider) this.hueSlider.value = hue;
        }

        this.hue = hue;
        this.saturation = parseInt(this.saturationSlider?.value || 50);
        this.lightness = parseInt(this.lightnessSlider?.value || 50);

        this.updatePreview();

        const hexColor = this.hslToHex(this.hue, this.saturation, this.lightness);
        if (this.hexInput) this.hexInput.value = hexColor;

        this.onChange(hexColor);
    }

    updateFromHex() {
        const hex = this.hexInput?.value || '#000000';
        const hsl = this.hexToHsl(hex);
        this.hue = hsl.h;
        this.saturation = hsl.s;
        this.lightness = hsl.l;

        if (this.hueSlider) this.hueSlider.value = this.hue;
        if (this.saturationSlider) this.saturationSlider.value = this.saturation;
        if (this.lightnessSlider) this.lightnessSlider.value = this.lightness;

        this.updatePreview();
        this.onChange(hex);
    }

    updatePreview() {
        const color = `hsl(${this.hue}, ${this.saturation}%, ${this.lightness}%)`;
        if (this.preview) {
            this.preview.style.background = color;
        }
        // Werte anzeigen
        const valueDisplay = this.element.querySelector('.color-values');
        if (valueDisplay) {
            valueDisplay.textContent = `${this.hue}° ${this.saturation}% ${this.lightness}%`;
        }
    }

    getColor() {
        return this.hslToHex(this.hue, this.saturation, this.lightness);
    }

    // Farbkonvertierung
    hexToHsl(hex) {
        let r = parseInt(hex.slice(1, 3), 16) / 255;
        let g = parseInt(hex.slice(3, 5), 16) / 255;
        let b = parseInt(hex.slice(5, 7), 16) / 255;

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }

        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }

    hslToHex(h, s, l) {
        h = h / 360;
        s = s / 100;
        l = l / 100;

        let r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }

        const toHex = (x) => {
            const hex = Math.round(x * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };

        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }
}

// Custom-Theme UI initialisieren
async function initCustomThemeUI() {
    // Custom-Theme laden
    const customTheme = await loadCustomTheme();

    // Picker für Rollen-Farben initialisieren
    const roleColors = customTheme?.roles || {
        'team-blue': '#3498db',
        'team-green': '#2ecc71',
        // ... weitere Farben
    };

    // Picker erstellen
    const pickers = {};

    // Team-Blau (nur Blau-Töne)
    pickers['team-blue'] = new SimpleColorPicker({
        element: document.getElementById('team-blue-picker'),
        initialColor: roleColors['team-blue'] || '#3498db',
        hueLimit: { min: 180, max: 260 },
        colorKey: 'team-blue',
        onChange: (color) => updateThemeColor('team-blue', color)
    });

    // Team-Grün (nur Grün-Töne)
    pickers['team-green'] = new SimpleColorPicker({
        element: document.getElementById('team-green-picker'),
        initialColor: roleColors['team-green'] || '#2ecc71',
        hueLimit: { min: 80, max: 160 },
        colorKey: 'team-green',
        onChange: (color) => updateThemeColor('team-green', color)
    });

    // Weitere Picker...

    // Speichern-Button
    document.getElementById('save-custom-theme')?.addEventListener('click', async () => {
        const themeData = collectThemeData(pickers);
        const result = await saveCustomTheme(themeData);
        if (result.success) {
            showNotification('Custom-Theme erfolgreich gespeichert!', 'success');
        } else {
            showNotification('Fehler beim Speichern: ' + result.error, 'error');
        }
    });

    return pickers;
}

// Theme-Farbe aktualisieren
function updateThemeColor(key, color) {
    // Temporär anwenden für Live-Preview
    document.documentElement.style.setProperty(`--${key}`, color);
}

// Alle Farben sammeln
function collectThemeData(pickers) {
    const theme = {
        roles: {},
        calendar: {},
        app: {}
    };

    Object.entries(pickers).forEach(([key, picker]) => {
        const color = picker.getColor();
        if (key.startsWith('team-')) {
            theme.roles[key] = color;
        } else if (key.startsWith('weekday-') || key.includes('bg')) {
            theme.calendar[key] = color;
        } else {
            theme.app[key] = color;
        }
    });

    return theme;
}

// Hilfsfunktion für Notifications
function showNotification(message, type = 'info') {
    // Implementierung abhängig von eurem UI-System
    console.log(`[${type}] ${message}`);
}

// Export für admin-form.js
export { initCustomThemeUI, loadCustomTheme, saveCustomTheme, SimpleColorPicker };
