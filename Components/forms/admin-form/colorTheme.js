import { loadTeamnames } from "../../../js/loader/role-loader.js";

const CUSTOM_THEME_KEY = "customColorTheme";

const TEAM_COLOR_RULES = {
  blue: { hue: [200, 220], sat: [30, 80], light: [30, 70] },
  green: { hue: [100, 140], sat: [30, 80], light: [30, 70] },
  red: { hue: [350, 10], sat: [30, 80], light: [30, 70] },
  black: { hue: [190, 240], sat: [5, 20], light: [5, 25] },
  trainee: { hue: [25, 45], sat: [40, 90], light: [40, 80] }
};

// State variables for picker
let currentTeamKey = null;
let currentVarKey = null;
let themeState = null;
let saveTimer = null;
let teamnames = {
  blue: "Team Blau",
  green: "Team Grün",
  red: "Team Rot",
  black: "Team Schwarz",
  trainee: "Azubi"
};

const THEME_KEYS = {
  roles: [
    "role-0-color",
    "role-1-color",
    "role-2-color",
    "role-3-color",
    "role-4-color",
    "role-5-color",
    "role-6-color",
    "role-7-color",
    "role-8-color",
    "role-9-color",
    "role-10-color",
    "role-11-color",
    "role-12-color",
    "role-13-color"
  ],
  calendar: [
    "calendar-day-closed-bg",
    "calendar-day-regular-bg",
    "calendar-day-weekend-bg",
    "calendar-day-holiday-bg",
    "calendar-shift-early-bg",
    "calendar-shift-day-bg",
    "calendar-shift-late-bg",
    "office-closed-color"
  ],
  app: [
    "button-active-color",
    "button-inactive-color",
    "button-hover-color",
    "accent-active",
    "accent-hover",
    "accent-inactive",
    "accent-muted",
    "bg-white",
    "bg-soft-white",
    "bg-inactive",
    "text-color"
  ]
};

const VAR_SECTION_MAP = new Map(
  Object.entries(THEME_KEYS).flatMap(([section, keys]) =>
    keys.map((key) => [key, section])
  )
);

const DAY_TYPE_META = {
  weekday: { label: "Werktag", varKey: "calendar-day-regular-bg" },
  weekend: { label: "Wochenende", varKey: "calendar-day-weekend-bg" },
  sunday: { label: "Sonntag", varKey: "calendar-day-holiday-bg" },
  holiday: { label: "Feiertag", varKey: "calendar-day-holiday-bg" },
  closed: { label: "Geschlossen", varKey: "calendar-day-closed-bg" }
};

const ROLE_TEAM_MAP = {
  1: "blue",
  2: "blue",
  3: "blue",
  4: "green",
  5: "green",
  6: "green",
  7: "red",
  8: "red",
  9: "red",
  10: "black",
  11: "black",
  12: "black",
  13: "trainee"
};

export async function initRoleColorTab(api) {
  try {
    await hydrateThemeState();
    await tryLoadTeamNames(api);
    initTabs();
    initRoleGrid();
    initCalendarTab();
    initAppTab();
    initPicker(); // Initialize the picker
  } catch (err) {
    console.error("[colorTheme] init failed", err);
  }
}

async function tryLoadTeamNames(api) {
  try {
    if (!api || !loadTeamnames) return;
    const loaded = await loadTeamnames(api);
    if (loaded && typeof loaded === "object") {
      teamnames = { ...teamnames, ...loaded };
    }
  } catch (err) {
    console.warn("[colorTheme] teamname load failed", err);
  }
}

function initTabs() {
  const tabButtons = document.querySelectorAll(".tab-header");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetTab = button.dataset.tab;
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      tabContents.forEach((content) => content.classList.remove("active"));
      const activeContent = document.getElementById(`tab-${targetTab}`);
      if (activeContent) activeContent.classList.add("active");
    });
  });
}
function initRoleGrid() {
  const cells = document.querySelectorAll("#tab-roles td[data-role]");
  const teamNameEl = document.getElementById("limited-color-picker-teamname");
  const roleNameEl = document.getElementById("limited-color-picker-rolename");
  const pickerDisc = document.getElementById("limited-color-picker");

  let activeCell = null;

  cells.forEach((cell) => {
    const roleIndex = Number(cell.dataset.role);
    const varKey = `role-${roleIndex}-color`;
    const teamKey = resolveTeamKey(cell.dataset.team, roleIndex);

    const initialColor = getCssVar(varKey);
    cell.style.backgroundColor = initialColor;

    if (cell.querySelector(".role-color-editor")) return;

    const labelText = cell.textContent.trim() || `#${roleIndex}`;
    cell.textContent = "";

    const wrapper = document.createElement("div");
    wrapper.className = "role-color-editor";

    const label = document.createElement("span");
    label.className = "role-index";
    label.textContent = labelText;

    const preview = document.createElement("div");
    preview.className = "role-preview";
    preview.style.backgroundColor = initialColor;

    cell.addEventListener("click", () => {
      if (activeCell) activeCell.classList.remove("role-active");
      activeCell = cell;
      cell.classList.add("role-active");
      const name = teamnames[teamKey] || teamKey;
      if (teamNameEl) teamNameEl.textContent = name;
      if (roleNameEl) roleNameEl.textContent = `Aufgabe #${roleIndex}`;
      if (pickerDisc) pickerDisc.style.background = "";

      // Set current state for picker
      currentTeamKey = teamKey;
      currentVarKey = varKey;

      // Update picker
      setPickerHue(teamKey);
      updatePickerCursor(getCssVar(varKey));
    });

    // Only append label and preview, NOT the picker input
    wrapper.append(label, preview);
    cell.appendChild(wrapper);
  });

  const first = cells[0];
  if (first) first.click();
}

function initCalendarTab() {
  const calendarRoot = document.querySelector("#tab-calendar");
  if (!calendarRoot) return;

  const miniDays = calendarRoot.querySelectorAll(".mini-day");
  const preview = calendarRoot.querySelector(".mini-day-preview");
  const previewLabel = calendarRoot.querySelector(".preview-day-label");
  const previewType = calendarRoot.querySelector(".preview-day-type");
  const tagInput = calendarRoot.querySelector('input[data-var="calendar-day-regular-bg"]');
  const shiftInputs = calendarRoot.querySelectorAll(
    'input[data-var^="calendar-shift-"]'
  );
  const officeClosedInput = calendarRoot.querySelector(
    'input[data-var="office-closed-color"]'
  );

  let activeDayType = "weekday";

  const updateMiniDayStyles = () => {
    miniDays.forEach((btn) => {
      const meta = DAY_TYPE_META[btn.dataset.dayType] || DAY_TYPE_META.weekday;
      btn.style.backgroundColor = getCssVar(meta.varKey);
    });
  };

  const updatePreview = (dayType, labelText) => {
    const meta = DAY_TYPE_META[dayType] || DAY_TYPE_META.weekday;
    const color = getCssVar(meta.varKey);
    if (preview) preview.style.backgroundColor = color;
    if (previewLabel) previewLabel.textContent = labelText || "Tag";
    if (previewType) previewType.textContent = meta.label;
    if (tagInput) {
      tagInput.dataset.var = meta.varKey;
      tagInput.value = normalizeHex(color);
    }
  };

  updateMiniDayStyles();
  updatePreview(activeDayType, "Tag 1");

  miniDays.forEach((btn) => {
    btn.addEventListener("click", () => {
      miniDays.forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      activeDayType = btn.dataset.dayType || "weekday";
      updatePreview(activeDayType, `Tag ${btn.textContent}`);
    });
  });

  if (tagInput) {
    tagInput.addEventListener("input", () => {
      const key = tagInput.dataset.var;
      if (!key) return;
      setThemeVar(key, tagInput.value);
      updateMiniDayStyles();
      updatePreview(activeDayType, previewLabel?.textContent);
    });
  }

  shiftInputs.forEach((input) => {
    const varKey = input.dataset.var;
    if (!varKey) return;
    input.value = normalizeHex(getCssVar(varKey));
    input.addEventListener("input", () => {
      setThemeVar(varKey, input.value);
      updateShiftSwatches(calendarRoot);
    });
  });

  if (officeClosedInput) {
    officeClosedInput.value = normalizeHex(getCssVar("office-closed-color"));
    officeClosedInput.addEventListener("input", () => {
      setThemeVar("office-closed-color", officeClosedInput.value);
    });
  }

  updateShiftSwatches(calendarRoot);
  miniDays[0]?.classList.add("selected");
}

function updateShiftSwatches(root) {
  const swatches = root.querySelectorAll(".shift-swatch");
  swatches.forEach((swatch) => {
    const shift = swatch.dataset.shift;
    if (shift === "early") swatch.style.backgroundColor = getCssVar("calendar-shift-early-bg");
    if (shift === "day") swatch.style.backgroundColor = getCssVar("calendar-shift-day-bg");
    if (shift === "late") swatch.style.backgroundColor = getCssVar("calendar-shift-late-bg");
  });
}

function initAppTab() {
  const appRoot = document.querySelector("#tab-app");
  if (!appRoot) return;
  const inputs = appRoot.querySelectorAll("input[type='color'][data-var]");
  inputs.forEach((input) => {
    const varKey = input.dataset.var;
    input.value = normalizeHex(getCssVar(varKey));
    input.addEventListener("input", () => {
      setThemeVar(varKey, input.value);
    });
  });
}

// Initialize the color picker
function initPicker() {
  const picker = document.getElementById("limited-color-picker");
  const cursor = picker?.querySelector(".picker-cursor");

  if (!picker || !cursor) {
    console.warn("[colorTheme] Picker elements not found");
    return;
  }

  // Create canvas for color gradient
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  // Set canvas size to match picker
  const pickerRect = picker.getBoundingClientRect();
  canvas.width = pickerRect.width || 200;
  canvas.height = pickerRect.height || 200;

  // Store canvas on picker element for easy access
  picker._canvas = canvas;
  picker._ctx = ctx;

  // Initial draw with default hue
  redrawPicker(picker, ctx, 210);

  // Add event listeners
  picker.addEventListener("mousedown", (e) => {
    handlePickerClick(e, picker, cursor);
  });

  picker.addEventListener("touchstart", (e) => {
    e.preventDefault();
    handlePickerClick(e.touches[0], picker, cursor);
  });
}

function handlePickerClick(e, picker, cursor) {
  const rect = picker.getBoundingClientRect();
  const ctx = picker._ctx;
  const canvas = picker._canvas;

  if (!ctx || !canvas) return;

  const x = Math.floor(e.clientX - rect.left);
  const y = Math.floor(e.clientY - rect.top);

  // Ensure coordinates are within bounds
  const clampedX = Math.max(0, Math.min(x, canvas.width - 1));
  const clampedY = Math.max(0, Math.min(y, canvas.height - 1));

  // Get color at position
  const pixel = ctx.getImageData(clampedX, clampedY, 1, 1).data;
  const hex = rgbToHex(pixel[0], pixel[1], pixel[2]);

  // Update cursor position
  cursor.style.left = `${clampedX}px`;
  cursor.style.top = `${clampedY}px`;

  // Apply color if we have current vars
  if (currentVarKey && currentTeamKey) {
    const clamped = clampToTeam(hex, currentTeamKey);
    setThemeVar(currentVarKey, clamped);
    // Update active cell if exists
    const activeCell = document.querySelector(".role-active");
    if (activeCell) {
      const preview = activeCell.querySelector(".role-preview");
      const input = activeCell.querySelector('input[type="color"]');
      if (preview) preview.style.backgroundColor = clamped;
      if (input) input.value = clamped;
      activeCell.style.backgroundColor = clamped;
    }
  }

  // Add move listeners for drag
  const moveHandler = (moveEvent) => {
    const clientX = moveEvent.clientX || (moveEvent.touches && moveEvent.touches[0].clientX);
    const clientY = moveEvent.clientY || (moveEvent.touches && moveEvent.touches[0].clientY);

    if (clientX && clientY) {
      const moveX = Math.floor(clientX - rect.left);
      const moveY = Math.floor(clientY - rect.top);
      const clampedMoveX = Math.max(0, Math.min(moveX, canvas.width - 1));
      const clampedMoveY = Math.max(0, Math.min(moveY, canvas.height - 1));

      const movePixel = ctx.getImageData(clampedMoveX, clampedMoveY, 1, 1).data;
      const moveHex = rgbToHex(movePixel[0], movePixel[1], movePixel[2]);

      cursor.style.left = `${clampedMoveX}px`;
      cursor.style.top = `${clampedMoveY}px`;

      if (currentVarKey && currentTeamKey) {
        const clamped = clampToTeam(moveHex, currentTeamKey);
        setThemeVar(currentVarKey, clamped);

        const activeCell = document.querySelector(".role-active");
        if (activeCell) {
          const preview = activeCell.querySelector(".role-preview");
          const input = activeCell.querySelector('input[type="color"]');
          if (preview) preview.style.backgroundColor = clamped;
          if (input) input.value = clamped;
          activeCell.style.backgroundColor = clamped;
        }
      }
    }
  };

  const upHandler = () => {
    document.removeEventListener("mousemove", moveHandler);
    document.removeEventListener("touchmove", moveHandler);
    document.removeEventListener("mouseup", upHandler);
    document.removeEventListener("touchend", upHandler);
  };

  document.addEventListener("mousemove", moveHandler);
  document.addEventListener("touchmove", moveHandler);
  document.addEventListener("mouseup", upHandler, { once: true });
  document.addEventListener("touchend", upHandler, { once: true });
}

function redrawPicker(picker, ctx, hue) {
  const w = picker.clientWidth || 200;
  const h = picker.clientHeight || 200;

  // Update canvas size if needed
  if (ctx.canvas.width !== w || ctx.canvas.height !== h) {
    ctx.canvas.width = w;
    ctx.canvas.height = h;
  }

  // Clear canvas
  ctx.clearRect(0, 0, w, h);

  // Base color
  ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
  ctx.fillRect(0, 0, w, h);

  // White → transparent (saturation)
  const whiteGrad = ctx.createLinearGradient(0, 0, w, 0);
  whiteGrad.addColorStop(0, "#fff");
  whiteGrad.addColorStop(1, "transparent");
  ctx.fillStyle = whiteGrad;
  ctx.fillRect(0, 0, w, h);

  // Transparent → black (lightness)
  const blackGrad = ctx.createLinearGradient(0, 0, 0, h);
  blackGrad.addColorStop(0, "transparent");
  blackGrad.addColorStop(1, "#000");
  ctx.fillStyle = blackGrad;
  ctx.fillRect(0, 0, w, h);

  // Ensure no stale inline background color overrides the gradient image.
  picker.style.background = "";
  // Update picker background
  picker.style.backgroundImage = `url(${ctx.canvas.toDataURL()})`;
}

function updatePickerCursor(color) {
  const picker = document.getElementById("limited-color-picker");
  const cursor = picker?.querySelector(".picker-cursor");

  if (!picker || !cursor) return;

  const ctx = picker._ctx;
  if (!ctx) return;

  // Convert color to HSL
  const hsl = toHSL(color);
  const hue = hsl.h;

  // Redraw picker with current hue if needed
  const currentHue = parseInt(picker.style.getPropertyValue("--picker-hue") || "210");
  if (Math.abs(currentHue - hue) > 5) {
    redrawPicker(picker, ctx, hue);
  }

  // Position cursor based on saturation and lightness
  const w = picker.clientWidth || 200;
  const h = picker.clientHeight || 200;

  // Saturation: 0% = left, 100% = right
  const satPercent = hsl.s / 100;
  // Lightness: 0% = bottom, 100% = top (inverted because 0% is black at bottom)
  const lightPercent = 1 - (hsl.l / 100);

  const x = Math.max(0, Math.min(satPercent * w, w - 1));
  const y = Math.max(0, Math.min(lightPercent * h, h - 1));

  cursor.style.left = `${x}px`;
  cursor.style.top = `${y}px`;
}

function setPickerHue(teamKey) {
  const picker = document.getElementById("limited-color-picker");
  const ctx = picker?._ctx;

  if (!picker || !ctx) return;

  const rules = TEAM_COLOR_RULES[teamKey] || TEAM_COLOR_RULES.blue;
  const hue = averageHue(rules.hue);

  // Update CSS variable
  picker.style.setProperty("--picker-hue", `${hue}deg`);

  // Redraw picker
  redrawPicker(picker, ctx, hue);
}

// Theme state management functions
async function hydrateThemeState() {
  try {
    const base = buildThemeFromCss();
    const stored = await readStoredTheme();
    themeState = mergeTheme(base, stored);
    applyTheme(themeState);
    scheduleSave();
  } catch (err) {
    console.warn("[colorTheme] hydrateThemeState failed", err);
    themeState = createEmptyTheme();
  }
}

function buildThemeFromCss() {
  const theme = createEmptyTheme();
  Object.entries(THEME_KEYS).forEach(([section, keys]) => {
    keys.forEach((key) => {
      theme[section][key] = normalizeHex(getCssVar(key));
    });
  });
  theme.updatedAt = new Date().toISOString();
  return theme;
}

function createEmptyTheme() {
  return {
    version: 1,
    updatedAt: null,
    roles: {},
    calendar: {},
    app: {}
  };
}

function mergeTheme(base, stored) {
  if (!stored || typeof stored !== "object") return base;
  const merged = createEmptyTheme();
  Object.entries(THEME_KEYS).forEach(([section, keys]) => {
    keys.forEach((key) => {
      const incoming = stored?.[section]?.[key];
      merged[section][key] = isValidColor(incoming) ? incoming : base[section][key];
    });
  });
  merged.updatedAt = stored.updatedAt || base.updatedAt;
  return merged;
}

function applyTheme(theme) {
  if (!theme) return;
  Object.entries(THEME_KEYS).forEach(([section, keys]) => {
    keys.forEach((key) => {
      const value = theme?.[section]?.[key];
      if (value) setCssVar(key, value);
    });
  });
}

function setThemeVar(key, value) {
  const section = VAR_SECTION_MAP.get(key);
  if (!section) return;
  const normalized = normalizeHex(value);
  setCssVar(key, normalized);
  if (!themeState) themeState = createEmptyTheme();
  if (!themeState[section]) themeState[section] = {};
  themeState[section][key] = normalized;
  themeState.updatedAt = new Date().toISOString();
  scheduleSave();
}

function setCssVar(key, value) {
  document.documentElement.style.setProperty(`--${key}`, value);
}

function getCssVar(key) {
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue(`--${key}`)
      .trim() || "#000000"
  );
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    persistTheme(themeState);
  }, 200);
}

async function readStoredTheme() {
  try {
    let raw = localStorage.getItem(CUSTOM_THEME_KEY);
    if (!raw && window.cacheAPI?.getCacheValue) {
      raw = await window.cacheAPI.getCacheValue(CUSTOM_THEME_KEY);
      if (raw && typeof raw === "string") {
        localStorage.setItem(CUSTOM_THEME_KEY, raw);
      }
    }
    if (!raw) return null;
    if (typeof raw === "object") return raw;
    return JSON.parse(raw);
  } catch (err) {
    console.warn("[colorTheme] failed to read stored theme", err);
    return null;
  }
}

async function persistTheme(theme) {
  try {
    const raw = JSON.stringify(theme);
    localStorage.setItem(CUSTOM_THEME_KEY, raw);
    if (window.cacheAPI?.setCacheValue) {
      await window.cacheAPI.setCacheValue(CUSTOM_THEME_KEY, raw);
    }
  } catch (err) {
    console.warn("[colorTheme] failed to persist theme", err);
  }
}

function resolveTeamKey(teamRaw, roleIndex) {
  if (teamRaw === "orange") return "trainee";
  if (teamRaw) return teamRaw;
  return ROLE_TEAM_MAP[roleIndex] || "blue";
}

// Color manipulation functions
function clampToTeam(color, teamKey) {
  const rules = TEAM_COLOR_RULES[teamKey] || TEAM_COLOR_RULES.blue;
  let { h, s, l } = toHSL(color);
  h = clampHue(h, rules.hue);
  s = clamp(s, rules.sat[0], rules.sat[1]);
  l = clamp(l, rules.light[0], rules.light[1]);
  return fromHSL(h, s, l);
}

function clampHue(h, range) {
  const [min, max] = range;
  const inRange = isHueInRange(h, min, max);
  if (inRange) return h;

  if (min <= max) {
    return h < min ? min : max;
  }

  const distToMin = circularDistance(h, min);
  const distToMax = circularDistance(h, max);
  return distToMin <= distToMax ? min : max;
}

function isHueInRange(h, min, max) {
  if (min <= max) return h >= min && h <= max;
  return h >= min || h <= max;
}

function circularDistance(a, b) {
  const diff = Math.abs(a - b) % 360;
  return Math.min(diff, 360 - diff);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isValidColor(value) {
  return typeof value === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

function normalizeHex(color) {
  if (!color) return "#000000";
  if (color.startsWith("#")) {
    if (color.length === 4) {
      const r = color[1];
      const g = color[2];
      const b = color[3];
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return color.toLowerCase();
  }
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.fillStyle = color;
  return ctx.fillStyle.toLowerCase();
}

function toHSL(color) {
  const { r, g, b } = parseColorToRgb(color);
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const delta = max - min;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    switch (max) {
      case rNorm:
        h = (gNorm - bNorm) / delta + (gNorm < bNorm ? 6 : 0);
        break;
      case gNorm:
        h = (bNorm - rNorm) / delta + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / delta + 4;
        break;
      default:
        h = 0;
    }
    h *= 60;
  }

  return {
    h: Math.round(h),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

function fromHSL(h, s, l) {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h >= 0 && h < 60) [r, g, b] = [c, x, 0];
  else if (h >= 60 && h < 120) [r, g, b] = [x, c, 0];
  else if (h >= 120 && h < 180) [r, g, b] = [0, c, x];
  else if (h >= 180 && h < 240) [r, g, b] = [0, x, c];
  else if (h >= 240 && h < 300) [r, g, b] = [x, 0, c];
  else[r, g, b] = [c, 0, x];

  const r255 = Math.round((r + m) * 255);
  const g255 = Math.round((g + m) * 255);
  const b255 = Math.round((b + m) * 255);
  return rgbToHex(r255, g255, b255);
}

function parseColorToRgb(color) {
  if (color.startsWith("#")) return hexToRgb(color);
  const rgbMatch = color.match(/rgb\\((\d+),\s*(\d+),\s*(\d+)\\)/i);
  if (rgbMatch) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3])
    };
  }
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.fillStyle = color;
  return hexToRgb(ctx.fillStyle);
}

function hexToRgb(hex) {
  let raw = hex.replace("#", "");
  if (raw.length === 3) {
    raw = raw
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const intVal = parseInt(raw, 16);
  return {
    r: (intVal >> 16) & 255,
    g: (intVal >> 8) & 255,
    b: intVal & 255
  };
}

function rgbToHex(r, g, b) {
  const toHex = (val) => val.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toLowerCase();
}

function averageHue([min, max]) {
  return min <= max
    ? Math.round((min + max) / 2)
    : Math.round(((min + max + 360) / 2) % 360);
}


