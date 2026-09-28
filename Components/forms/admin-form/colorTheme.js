// Components/forms/admin-form/colorTheme.js
//
// Custom Theme editor.
// Important contract:
// - Palette clicks change only the in-memory draft.
// - The current CSS variable is used to find the nearest palette cell.
// - Focus and selection are deliberately separate.
// - Only Save persists the draft.

const COLOR_THEME_SECTIONS = {
    roles: {
        title: 'Team- & Rollenfarben',
        items: Array.from({ length: 12 }, (_, index) => ({
            key: `role-${index + 1}-color`,
            label: `Rolle ${index + 1}`,
            family: ['blue', 'blue', 'blue', 'green', 'green', 'green', 'red', 'red', 'red', 'gray', 'gray', 'gray'][index]
        }))
    },
    calendar: {
        title: 'Kalenderfarben',
        items: [
            { key: 'calendar-day-regular-bg', label: 'Werktag' },
            { key: 'calendar-day-weekend-bg', label: 'Wochenende' },
            { key: 'calendar-day-holiday-bg', label: 'Feiertag' },
            { key: 'calendar-day-closed-bg', label: 'Geschlossen' },
            { key: 'calendar-shift-early-bg', label: 'Frühschicht' },
            { key: 'calendar-shift-day-bg', label: 'Tagschicht' },
            { key: 'calendar-shift-late-bg', label: 'Spätschicht' }
        ]
    },
    app: {
        title: 'App-Farben',
        items: [
            { key: 'bg-white', label: 'Hintergrund (hell)' },
            { key: 'bg-inactive', label: 'Inaktiv' },
            { key: 'button-active-color', label: 'Button aktiv' },
            { key: 'button-hover-color', label: 'Button Hover' },
            { key: 'text-color', label: 'Standardtext' }
        ]
    }
};

const TEAM_PALETTE_CONFIG = {
    red: { label: 'Rot', hueLeft: 350, hueRight: 20, light: 0.86, dark: 0.34, chroma: 0.17 },
    green: { label: 'Grün', hueLeft: 105, hueRight: 165, light: 0.86, dark: 0.34, chroma: 0.16 },
    blue: { label: 'Blau', hueLeft: 210, hueRight: 260, light: 0.86, dark: 0.34, chroma: 0.15 },
    gray: { label: 'Grau', hueLeft: 220, hueRight: 40, light: 0.86, dark: 0.30, chroma: 0.015 },
    rainbow: { label: 'Regenbogen', hueLeft: 0, hueRight: 360, light: 0.86, dark: 0.34, chroma: 0.16 }
};

let draftTheme = null;
let activeSection = 'roles';
let activeTargetIndex = 0;
let activePalette = 'blue';
let paletteCells = [];
let initialized = false;
let saving = false;

export async function initRoleColorTab(api) {
    if (initialized) {
        return;
    }

    initialized = true;

    try {
        const persistedTheme = await loadCustomTheme(api);
        window.__timeslipPersistedCustomTheme = structuredCloneSafe(persistedTheme);
        draftTheme = buildDraftTheme(persistedTheme);
        bindTabs();
        bindSave(api);
        renderEditor();
    } catch (err) {
        initialized = false;
        console.error('[ColorTheme] Failed to initialize color editor:', err);
    }
}

export async function initCustomThemeUI(theme) {
    if (initialized) {
        return;
    }

    window.__timeslipPersistedCustomTheme = structuredCloneSafe(theme);
    draftTheme = buildDraftTheme(theme);
    initialized = true;
    bindTabs();
    bindSave(window.api);
    renderEditor();
}

export async function loadCustomTheme(api = window.api) {
    if (!api?.invoke) {
        throw new Error('Custom theme API is unavailable');
    }

    return await api.invoke('get-custom-theme');
}

function buildDraftTheme(persistedTheme) {
    const draft = {
        roles: {},
        calendar: {},
        app: {}
    };

    for (const [section, definition] of Object.entries(COLOR_THEME_SECTIONS)) {
        for (const item of definition.items) {
            const persisted = persistedTheme?.[section]?.[item.key];
            const current = readCssVariable(item.key);
            draft[section][item.key] = normalizeCssColor(persisted || current) || '#ffffff';
        }
    }

    return draft;
}

function bindTabs() {
    document.querySelectorAll('.color-tab[data-tab]').forEach(button => {
        button.addEventListener('click', () => {
            switchSection(button.dataset.tab);
        });
    });
}

function bindSave(api) {
    const button = document.getElementById('save-custom-theme');

    if (!button || button.dataset.bound === 'true') {
        return;
    }

    button.dataset.bound = 'true';
    button.addEventListener('click', () => saveDraft(api));
}

function switchSection(section) {
    if (!COLOR_THEME_SECTIONS[section]) {
        return;
    }

    activeSection = section;
    activeTargetIndex = 0;
    activePalette = COLOR_THEME_SECTIONS[section].items[0]?.family || 'rainbow';
    renderEditor();
}

function renderEditor() {
    renderTabs();
    renderTargets();
    renderPaletteFamilies();
    renderPalette();
    updateTargetSummary();
    updateDirtyState();
}

function renderTabs() {
    document.querySelectorAll('.color-tab[data-tab]').forEach(button => {
        const active = button.dataset.tab === activeSection;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
    });
}

function renderTargets() {
    const list = document.getElementById('color-target-list');
    const title = document.getElementById('target-panel-title');

    if (!list || !title) {
        return;
    }

    const definition = COLOR_THEME_SECTIONS[activeSection];
    title.textContent = definition.title;
    list.replaceChildren();

    definition.items.forEach((item, index) => {
        const color = draftTheme[activeSection][item.key];
        const button = document.createElement('button');

        button.type = 'button';
        button.className = 'color-target';
        button.setAttribute('role', 'option');
        button.setAttribute('aria-selected', String(index === activeTargetIndex));
        button.dataset.targetIndex = String(index);

        const chip = document.createElement('span');
        chip.className = 'color-target-chip';
        chip.style.backgroundColor = color;

        const text = document.createElement('span');
        text.className = 'color-target-text';
        text.textContent = item.label;

        const value = document.createElement('code');
        value.textContent = color;

        button.append(chip, text, value);
        button.addEventListener('click', () => {
            activeTargetIndex = index;
            activePalette = item.family || 'rainbow';
            renderTargets();
            renderPaletteFamilies();
            renderPalette();
            updateTargetSummary();
        });

        list.appendChild(button);
    });
}

function renderPaletteFamilies() {
    const container = document.getElementById('palette-family-buttons');

    if (!container) {
        return;
    }

    container.replaceChildren();

    Object.entries(TEAM_PALETTE_CONFIG).forEach(([family, config]) => {
        const button = document.createElement('button');

        button.type = 'button';
        button.className = 'palette-family';
        button.classList.toggle('active', family === activePalette);
        button.textContent = config.label;
        button.setAttribute('aria-pressed', String(family === activePalette));

        button.addEventListener('click', () => {
            activePalette = family;
            renderPalette();
            renderPaletteFamilies();
        });

        container.appendChild(button);
    });
}

function renderPalette() {
    const container = document.getElementById('team-palette');
    const target = getActiveTarget();

    if (!container || !target) {
        return;
    }

    const config = TEAM_PALETTE_CONFIG[activePalette];
    paletteCells = [];
    container.replaceChildren();

    let bestMatch = { column: 0, row: 0, distance: Number.POSITIVE_INFINITY };
    const currentColor = draftTheme[activeSection][target.key];

    for (let row = 0; row < 8; row += 1) {
        for (let column = 0; column < 12; column += 1) {
            const color = getPaletteColor(config, column, row);
            const distance = colorDistance(currentColor, color);

            if (distance < bestMatch.distance) {
                bestMatch = { column, row, distance };
            }

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'universal-palette-cell';
            button.dataset.column = String(column);
            button.dataset.row = String(row);
            button.dataset.color = color;
            button.style.backgroundColor = color;
            button.setAttribute('role', 'gridcell');
            button.setAttribute('aria-label', `${config.label}, Variante ${column + 1}, Helligkeit ${row + 1}, ${color}`);
            button.tabIndex = -1;

            button.addEventListener('click', () => selectColor(column, row));
            button.addEventListener('keydown', event => handlePaletteKeydown(event, column, row));

            container.appendChild(button);
            paletteCells.push(button);
        }
    }

    const focusIndex = bestMatch.row * 12 + bestMatch.column;
    const focusCell = paletteCells[focusIndex];

    if (focusCell) {
        focusCell.tabIndex = 0;
    }

    container.setAttribute('aria-rowcount', '8');
    container.setAttribute('aria-colcount', '12');

    document.getElementById('palette-title').textContent = `${config.label} Palette`;
    document.getElementById('palette-hint').textContent = '96 Farben';
}

function focusPaletteCell(column, row) {
    const clampedColumn = Math.max(0, Math.min(11, column));
    const clampedRow = Math.max(0, Math.min(7, row));
    const cell = paletteCells[clampedRow * 12 + clampedColumn];

    if (!cell) {
        return;
    }

    paletteCells.forEach(item => {
        item.tabIndex = -1;
    });

    cell.tabIndex = 0;
    cell.focus();
}

function handlePaletteKeydown(event, column, row) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectColor(column, row);
        return;
    }

    let nextColumn = column;
    let nextRow = row;

    if (event.key === 'ArrowLeft') nextColumn -= 1;
    else if (event.key === 'ArrowRight') nextColumn += 1;
    else if (event.key === 'ArrowUp') nextRow -= 1;
    else if (event.key === 'ArrowDown') nextRow += 1;
    else if (event.key === 'Home') nextColumn = 0;
    else if (event.key === 'End') nextColumn = 11;
    else return;

    event.preventDefault();
    focusPaletteCell(nextColumn, nextRow);
}

function selectColor(column, row) {
    const cell = paletteCells[row * 12 + column];
    const target = getActiveTarget();

    if (!cell || !target) {
        return;
    }

    const color = cell.dataset.color;
    draftTheme[activeSection][target.key] = color;

    applyDraftColor(target.key, color);
    updateTargetSummary();
    renderTargets();
    renderPalette();
    updateDirtyState();
}

function applyDraftColor(key, color) {
    document.documentElement.style.setProperty(`--${key}`, color);
}

function getActiveTarget() {
    const items = COLOR_THEME_SECTIONS[activeSection]?.items || [];
    return items[activeTargetIndex] || null;
}

function updateTargetSummary() {
    const target = getActiveTarget();
    if (!target) return;

    const color = draftTheme[activeSection][target.key];
    const label = document.getElementById('active-target-label');
    const value = document.getElementById('current-color-value');
    const chip = document.getElementById('current-color-chip');

    if (label) label.textContent = target.label;
    if (value) value.textContent = color;
    if (chip) chip.style.backgroundColor = color;
}

function updateDirtyState() {
    const indicator = document.getElementById('dirty-indicator');
    const dirty = JSON.stringify(draftTheme) !== JSON.stringify(buildDraftTheme(window.__timeslipPersistedCustomTheme));

    if (indicator) {
        indicator.hidden = !dirty;
    }
}

async function saveDraft(api) {
    if (saving || !draftTheme || !api?.invoke) {
        return;
    }

    saving = true;
    const button = document.getElementById('save-custom-theme');
    if (button) button.disabled = true;

    try {
        const result = await api.invoke('save-custom-theme', draftTheme);

        if (result !== true) {
            throw new Error('Main process did not confirm the custom theme save.');
        }

        window.__timeslipPersistedCustomTheme = structuredCloneSafe(draftTheme);
        updateDirtyState();

        if (typeof window.__timeslipApplyCustomTheme === 'function') {
            window.__timeslipApplyCustomTheme(draftTheme);
        }

        if (typeof window.__timeslipShowSuccess === 'function') {
            window.__timeslipShowSuccess('✅ Custom-Theme gespeichert');
        }
    } catch (err) {
        console.error('[ColorTheme] Save failed:', err);
        if (typeof window.__timeslipShowFailure === 'function') {
            window.__timeslipShowFailure('❌ Custom-Theme konnte nicht gespeichert werden');
        } else {
            showTemporaryColorMessage('failure', '❌ Custom-Theme konnte nicht gespeichert werden');
        }
    } finally {
        saving = false;
        if (button) button.disabled = false;
    }
}

function readCssVariable(key) {
    const bodyStyle = getComputedStyle(document.body);
    const bodyValue = bodyStyle.getPropertyValue(`--${key}`).trim();

    if (bodyValue) {
        return bodyValue;
    }

    return getComputedStyle(document.documentElement).getPropertyValue(`--${key}`).trim();
}

function normalizeCssColor(value) {
    if (!value) return null;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) return null;

    const sentinel = 'rgb(1, 2, 3)';
    context.fillStyle = sentinel;
    context.fillStyle = value;

    if (context.fillStyle === sentinel) {
        return null;
    }

    return context.fillStyle;
}

function colorToRgb(value) {
    const normalized = normalizeCssColor(value);

    if (!normalized) {
        return null;
    }

    const match = normalized.match(/^#([0-9a-f]{6})$/i);
    if (match) {
        return [
            parseInt(match[1].slice(0, 2), 16),
            parseInt(match[1].slice(2, 4), 16),
            parseInt(match[1].slice(4, 6), 16)
        ];
    }

    const rgbMatch = normalized.match(/^rgb\\?a?\\?\\(([^)]+)\\)$/i);
    if (!rgbMatch) {
        return null;
    }

    const values = rgbMatch[1]
        .split(/[,\\s]+/)
        .slice(0, 3)
        .map(Number);

    return values.length === 3 && values.every(Number.isFinite) ? values : null;
}

function colorDistance(first, second) {
    const a = colorToRgb(first);
    const b = colorToRgb(second);

    if (!a || !b) {
        return Number.POSITIVE_INFINITY;
    }

    return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function getPaletteColor(config, column, row) {
    const hue = interpolateHue(config.hueLeft, config.hueRight, column / 11);
    const lightness = interpolate(config.light, config.dark, row / 7);

    return oklchToHex(lightness, config.chroma, hue);
}

function interpolate(a, b, t) {
    return a + (b - a) * t;
}

function interpolateHue(a, b, t) {
    const delta = ((b - a + 540) % 360) - 180;
    const hue = (a + delta * t) % 360;
    return hue < 0 ? hue + 360 : hue;
}

function oklchToHex(L, C, H) {
    const hRad = H * Math.PI / 180;
    const a = C * Math.cos(hRad);
    const b = C * Math.sin(hRad);

    const l = L + 0.3963377774 * a + 0.2158037573 * b;
    const m = L - 0.1055613458 * a - 0.0638541728 * b;
    const s = L - 0.0894841775 * a - 1.2914855480 * b;

    const l3 = l ** 3;
    const m3 = m ** 3;
    const s3 = s ** 3;

    const X = 1.2270138511 * l3 - 0.5577999807 * m3 + 0.2812561490 * s3;
    const Y = -0.0405801784 * l3 + 1.1122568696 * m3 - 0.0716766787 * s3;
    const Z = -0.0763812845 * l3 - 0.4214819784 * m3 + 1.5861632204 * s3;

    const redLinear = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
    const greenLinear = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
    const blueLinear = 0.0557 * X - 0.2040 * Y + 1.0570 * Z;

    const toSrgb = value => {
        const clamped = Math.max(0, Math.min(1, value));
        return clamped <= 0.0031308
            ? 12.92 * clamped
            : 1.055 * clamped ** (1 / 2.4) - 0.055;
    };

    const red = Math.round(toSrgb(redLinear) * 255);
    const green = Math.round(toSrgb(greenLinear) * 255);
    const blue = Math.round(toSrgb(blueLinear) * 255);

    return `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
}

function structuredCloneSafe(value) {
    return JSON.parse(JSON.stringify(value));
}

function showTemporaryColorMessage(type, message) {
    const popup = document.createElement('div');
    popup.className = type === 'success'
        ? 'request-popup-success noto'
        : 'request-popup-failure noto';
    popup.setAttribute('role', 'status');
    popup.setAttribute('aria-live', 'polite');
    popup.textContent = message;
    document.body.appendChild(popup);

    window.setTimeout(() => popup.remove(), type === 'success' ? 2500 : 3000);
}
