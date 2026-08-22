// renderer.js
import { initializeHelp } from '../Components/help/help.js';
import { loadRoleData } from './loader/role-loader.js';
import { loadEmployeeData, checkEmployeesEndingToday } from './loader/employee-loader.js';
import { loadCalendarData, loadStateData, loadCompanyHolidayData, loadOfficeDaysData } from './loader/calendar-loader.js';
import { loadRequests } from './loader/request-loader.js';
import { checkOnboardingState } from './Utils/onboarding.js';
import { initializeLegend } from '../Components/legend/legend.js';
import { createPresenceSelector, setOfficeStatus } from '../Components/calendar/calendar.js';
import { createWindowButtons } from './Utils/minMaxFormComponent.js';
import { resizeFormContainer, resizeByPreferredForm, startDrag, handleDrag, stopDrag } from './resizer.js';
// resizerLookup.js

const SHIFT_SYMBOL_PRESETS = {
  empty: ["", "", ""],
  letters: ["ϝ", "τ", "s"],
  emoji: ["🐓", "🍴", "🌙"]
};

let isRefreshing = false;
let latestMode = null;

if (!localStorage.getItem('dataMode')) {
  localStorage.setItem('dataMode', 'auto');
}


// --- PRESENCE UI SWITCHER ---
function switchPresenceUIMode(newMode) {
  const container = document.getElementById('presence-container');
  if (!container) return;

  // Remove old selector
  container.innerHTML = '';

  // Get saved isInOffice state (boolean)
  let isInOffice = localStorage.getItem('presenceState');
  isInOffice = isInOffice === null ? true : isInOffice === 'true';

  // Create new selector
  const selector = createPresenceSelector({
    mode: newMode,
    defaultValue: isInOffice,
    onChange: (value) => {
      localStorage.setItem('presenceState', String(value));
      setOfficeStatus(value);  // existing calendar update
    }
  });

  container.appendChild(selector);

  // Save user preference
  localStorage.setItem('presenceUIMode', newMode);
}

function applyModeClass(mode) {
  document.body.classList.toggle('mode-sample', mode === 'sample');
  document.body.classList.toggle('mode-client', mode === 'client');
}

window.addEventListener('api-ready', async () => {
  try {
    // ✅ Wait until DOM is guaranteed to exist
    await domReady();

    // ✅ Load data (these are real async risks)
    await loadRoleData(window.api);
    await loadEmployeeData(window.api);
    await loadCalendarData(window.api);
    await loadStateData(window.api);
    await loadCompanyHolidayData(window.api);
    await loadOfficeDaysData(window.api);
    await loadRequests(window.api);

    const { isOnboarding, dataFolder } =
      await checkOnboardingState(window.api);

    const legendContainer = document.getElementById('legend');
    if (!legendContainer) {
      console.warn('⚠️ Legend container not found at startup');
      return;
    }

    await initializeLegend(window.api);

  } catch (err) {
    console.error('❌ Startup sequence failed:', err);
  }
  window.addEventListener('resize', resizeFormContainer);
});

let formInitializers = {};

// ----------- Module Loading -----------

async function loadFormModules() {
  try {
    const [
      { initializeRoleForm },
      { initializeRuleForm },
      { initializeEmployeeForm },
      { initializeRequestForm },
      { initializeCalendarForm },
      { initializeAdminForm },
    ] = await Promise.all([
      import('../Components/forms/role-form/role-form2.js'),
      import('../Components/forms/rule-form/rule-form.js'),
      import('../Components/forms/employee-form/employee-form.js'),
      import('../Components/forms/request-form/request-form.js'),
      import('../Components/forms/calendar-form/calendar-form.js'),
      import('../Components/forms/admin-form/admin-form.js'),
    ]);

    formInitializers = {
      welcome: () => loadWelcomePage(),   // new ←
      'role-form': initializeRoleForm,
      'rule-form': initializeRuleForm,
      'employee-form': initializeEmployeeForm,
      'request-form': initializeRequestForm,
      'calendar-form': initializeCalendarForm,
      'admin-form': initializeAdminForm,
    };

  } catch (err) {
    console.error('✗ Error loading form modules:', err);
  }
}

export async function loadCalendarIntoContainer(container) {
  try {
    const response = await fetch('./Components/calendar/calendar.html');
    if (!response.ok) throw new Error(`Failed to load calendar.html: ${response.status}`);

    const html = await response.text();
    container.innerHTML = html;

    const { initializeCalendar } = await import('../Components/calendar/calendar.js');
    initializeCalendar(window.api);
  } catch (err) {
    console.error('❌ Error loading calendar:', err);
    container.innerHTML = `<p>Error loading calendar. Please try again later.</p>`;
  }
}

function setupResizers() {
  document.querySelectorAll('.horizontal-resizer').forEach(resizer => {
    resizer.addEventListener('mousedown', startDrag);
  });
}

function setupNavButtons() {
  document.querySelectorAll('.nav-button').forEach(button => {
    button.addEventListener('click', e => {
      const formName = e.currentTarget.getAttribute('data-form');
      window.api.loadForm(formName);
      localStorage.setItem('selectedForm', formName);
    });
  });
}

function restoreLayoutFromLocalStorage() {
  // Restore left panel width
  const savedLeftWidth = localStorage.getItem('ui-left-panel-width');
  if (savedLeftWidth) {
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');
    leftPanel.style.setProperty('--left-panel-width', savedLeftWidth);

    const leftWidthNum = parseFloat(savedLeftWidth);
    rightPanel.style.width = `${100 - leftWidthNum}%`;
  }

  // Restore top section height
  const savedTopHeight = localStorage.getItem('ui-top-section-height');
  if (savedTopHeight) {
    const horizontalResizer = document.querySelector('.horizontal-resizer');
    if (horizontalResizer) {
      const parent = horizontalResizer.parentElement;
      const topSection = parent.children[0];
      const bottomSection = parent.children[2];

      topSection.style.height = savedTopHeight;
      const topHeightNum = parseFloat(savedTopHeight);
      bottomSection.style.height = `${100 - topHeightNum}%`;
    }
  }
}

function setupFormLoader() {

  window.electron.onFormLoaded(async (event, { formName, htmlContent }) => {

    const formContainer = document.getElementById('form-container');
    if (!formContainer) {
      console.error('❌ form-container not found!');
      alert('Formular konnte nicht geladen werden.');
      return;
    }

    if (Object.keys(formInitializers).length === 0) {
      console.warn("⚠️ Waiting for formInitializers to load...");
      await loadFormModules();
    }

    formContainer.innerHTML = htmlContent;

    const initializer = formInitializers[formName];
    if (initializer) {
      try {
        initializer(window.api);
      } catch (err) {
        console.error(`✗ Error initializing ${formName}:`, err);
      }
    } else {
      console.warn(`⚠ No initializer found for form: ${formName}`);
    }
    resizeByPreferredForm(formName);

  });
}

// ----------- Theme Handling -----------

const CUSTOM_THEME_KEY = 'customColorTheme';

// Theme setzen
function setTheme(themeName) {
  document.body.classList.remove("theme-dark", "theme-default", "theme-pastel", "theme-greyscale", "theme-custom");

  if (themeName === 'custom') {
    document.body.classList.add('theme-custom');
    applyCustomThemeFromStorage();
  } else {
    document.body.classList.add(`theme-${themeName}`);
    resetCustomThemeVariables();
  }

  localStorage.setItem('colorTheme', themeName);

  // Über cacheAPI setzen (nicht send)
  if (window.cacheAPI) {
    window.cacheAPI.setCacheValue('colorTheme', themeName);
  }
}

// Custom-Theme aus localStorage anwenden
function applyCustomThemeFromStorage() {
  try {
    const raw = localStorage.getItem(CUSTOM_THEME_KEY);
    if (!raw) return;
    const theme = JSON.parse(raw);
    if (!theme || typeof theme !== 'object') return;
    applyThemeVariables(theme);
  } catch (err) {
    console.warn('Failed to apply custom theme from storage:', err);
  }
}

// Theme-Variablen auf das Dokument anwenden
function applyThemeVariables(theme) {
  if (!theme || typeof theme !== 'object') return;

  ['roles', 'calendar', 'app'].forEach((section) => {
    const vars = theme[section];
    if (!vars || typeof vars !== 'object') return;
    Object.entries(vars).forEach(([key, value]) => {
      if (typeof value === 'string') {
        document.documentElement.style.setProperty(`--${key}`, value);
      }
    });
  });
}

// Custom-Theme-Variablen zurücksetzen
function resetCustomThemeVariables() {
  const customVars = [
    'team-blue', 'team-green', 'team-yellow', 'team-red', 'team-purple',
    'team-orange', 'team-cyan', 'team-pink', 'team-brown', 'team-grey',
    'weekday-bg', 'weekend-bg', 'today-bg', 'selected-bg', 'holiday-bg', 'birthday-bg',
    'bg-primary', 'bg-secondary', 'text-primary', 'text-secondary',
    'border-color', 'hover-bg', 'active-bg', 'shadow-color', 'header-bg', 'footer-bg'
  ];

  customVars.forEach(varName => {
    document.documentElement.style.removeProperty(`--${varName}`);
  });
}

// IPC-Events empfangen - MIT receive (nicht on)
function setupThemeListeners() {
  // Prüfen ob window.api.receive existiert
  if (typeof window.api?.receive === 'function') {
    // Theme-Änderungen empfangen
    window.api.receive('set-theme', (themeName) => {
      console.log('[Theme] Received set-theme:', themeName);
      setTheme(themeName);
    });

    // Custom-Theme-Empfang
    window.api.receive('set-custom-theme', (themeData) => {
      console.log('[Theme] Received set-custom-theme');
      try {
        // Custom-Theme im localStorage speichern
        localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(themeData));

        // Auch im Cache speichern
        if (window.cacheAPI) {
          window.cacheAPI.setCacheValue('customColorTheme', JSON.stringify(themeData));
        }

        // Wenn aktuell Custom-Theme aktiv, sofort anwenden
        if (document.body.classList.contains('theme-custom')) {
          applyThemeVariables(themeData);
        }
      } catch (err) {
        console.warn('[Theme] Failed to apply custom theme:', err);
      }
    });
  } else {
    console.warn('[Theme] window.api.receive not available');
  }
}

// Custom-Theme laden (für die Picker-Initialisierung)
async function loadCustomTheme() {
  try {
    // Versuche vom Cache zu laden
    if (window.cacheAPI) {
      const cached = await window.cacheAPI.getCacheValue('customColorTheme');
      if (cached) {
        const theme = typeof cached === 'string' ? JSON.parse(cached) : cached;
        localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(theme));
        return theme;
      }
    }

    // Fallback: Aus localStorage laden
    const raw = localStorage.getItem(CUSTOM_THEME_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[Theme] Failed to load custom theme:', err);
  }
  return null;
}

// Custom-Theme speichern
async function saveCustomTheme(themeData) {
  try {
    // Im localStorage speichern
    localStorage.setItem(CUSTOM_THEME_KEY, JSON.stringify(themeData));

    // Im Cache speichern
    if (window.cacheAPI) {
      await window.cacheAPI.setCacheValue('customColorTheme', JSON.stringify(themeData));
    }

    // Allen Fenstern das neue Theme mitteilen
    if (window.api) {
      window.api.send('update-cache', {
        colorTheme: 'custom',
        customTheme: themeData
      });
    }

    return { success: true };
  } catch (err) {
    console.error('[Theme] Failed to save custom theme:', err);
    return { success: false, error: err.message };
  }
}

// Initialisierung
document.addEventListener('DOMContentLoaded', () => {
  // Theme aus localStorage laden
  const savedTheme = localStorage.getItem('colorTheme') || 'default';
  setTheme(savedTheme);

  // Theme-Listener einrichten
  setupThemeListeners();

  console.log('[Theme] Initialized with theme:', savedTheme);
});

function setZoom(factor) {
  document.body.style.fontSize = `${factor}rem`;
  localStorage.setItem('zoomFactor', factor);
  window.api.send('update-cache', { zoomFactor: factor });
}



function initTheme() {
  setTheme(localStorage.getItem('colorTheme') || 'default');
  applyCustomThemeFromStorage();
  setZoom(localStorage.getItem('zoomFactor') || 1.0);
}

function showFnKeyHintIfLaptop() {
  const hint = document.getElementById('fn-key-hint');
  if (!hint) return;

  // "Chromebook/laptop" heuristic — show if width < 1600 or height < 1000
  if (window.screen.width < 1500 || window.screen.height < 960) {
    hint.classList.remove('visually-hidden');
  }
}
// ----------- IPC Event Handlers -----------

function setupIPCListeners() {

  window.api.receive('checklist-update', (step, status) => {
    const event = new CustomEvent('checklist-update', { detail: { step, status } });
    window.dispatchEvent(event);
  });

  window.api.receive('resize-response', data => {
  });

  window.api.receive('set-theme', themeName => {
    setTheme(themeName);
  });

  window.api.receive('set-presence-ui-mode', async (mode) => {
    await window.cacheAPI.setCacheValue('presenceUIMode', mode);
    document.dispatchEvent(new CustomEvent('presence-ui-mode-changed', { detail: mode }));
    switchPresenceUIMode(mode);
  });



  window.api.receive('get-cache-dump', async (requestId) => {
    const clientDataFolder = await window.cacheAPI.getCacheValue('clientDataFolder');
    const colorTheme = await window.cacheAPI.getCacheValue('colorTheme');
    const customColorTheme = await window.cacheAPI.getCacheValue('customColorTheme');
    const zoomFactor = await window.cacheAPI.getCacheValue('zoomFactor');
    const windowSize = await window.cacheAPI.getCacheValue('windowSize');

    window.api.send('return-cache-dump', {
      requestId,
      clientDataFolder,
      colorTheme,
      customColorTheme,
      zoomFactor,
      windowSize
    });
  });

  window.api.receive('update-cache', ({ key, value }) => {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      console.error('❌ Failed to update localStorage:', err);
    }
  });

  window.api.receive('set-shift-symbols', async (presetKey) => {
    await window.cacheAPI.setCacheValue('shiftSymbols', presetKey);
    localStorage.setItem('shiftSymbols', presetKey); // optional
    window.api.send('refresh-calendar');
  });

  window.api.receive('set-zodiac-style', async (style) => {
    await window.cacheAPI.setCacheValue('zodiacStyle', style);
    localStorage.setItem('zodiacStyle', style); // optional
    window.api.send('refresh-calendar');
  });


  window.api.receive('mode-changed', (mode) => {
    document.body.setAttribute('data-mode', mode);

    const feedback = document.getElementById('feedback-console');
    if (feedback) {
      feedback.classList.toggle('sandbox', mode === 'sandbox');
    }
  });

  window.api.receive("refresh-calendar", () => {
    const calendarContainer = document.getElementById('calendar');
    loadCalendarIntoContainer(calendarContainer);
  });
  window.api.receive('open-help', (topicId) => {

    const helpContainer = document.getElementById('calendar');
    const container = document.getElementById('calendar');
    if (container) {
      initializeHelp(container, topicId);
    } else {
      alert(`Help requested: ${topicId}`);
    }
  });
}

window.addEventListener('DOMContentLoaded', async () => {
  await loadFormModules();

  setupResizers();
  setupNavButtons();
  setupFormLoader();
  restoreLayoutFromLocalStorage();
  setupIPCListeners();

  localStorage.removeItem('selectedForm');

  const dialogEl = document.getElementById('goodbyeDialog');

  const employees = await loadEmployeeData(window.api);
  if (Array.isArray(employees) && employees.length > 0) {
    const lastDayEmployees = checkEmployeesEndingToday(employees);
    if (lastDayEmployees.length > 0) {
      // dialogEl.textContent = `Goodbye to: ${lastDayEmployees.map(e => e.name).join(', ')}`;
      // dialogEl.showModal();
    }
  }

  const calendarContainer = document.getElementById('calendar');
  if (calendarContainer) {
    loadCalendarIntoContainer(calendarContainer);
  } else {
    console.error('❌ Calendar container not found.');
  }

  // document.addEventListener('mousemove', handleDrag);
  // document.addEventListener('mouseup', stopDrag);

  // ----------- F-Key Handling -----------

  document.addEventListener('click', (event) => {
    const closeBtn = event.target.closest('#fn-hint-close');
    if (!closeBtn) return;

    const hint = closeBtn.closest('#fn-key-hint');
    if (hint) {
      console.log("Fn key hint dismissed by user.");
      hint.classList.add("visually-hidden");
    }
  });


  document.addEventListener('keydown', (event) => {
    // If user presses Fn-locked keys, this may not trigger at all (hardware side)
    switch (event.key) {
      case 'F1':
        event.preventDefault();
        const container = document.getElementById('calendar');
        if (container) {
          initializeHelp(container, 'chapter-overview');
        } else {
          alert(`Help requested:  chapter-overview`);
        }
        break;

      case 'F5':
        event.preventDefault();
        window.api.send('refresh-calendar'); // triggers same logic as menu
        break;

      case 'F12':
        event.preventDefault();
        window.api.send('toggle-devtools'); // handled in main below
        break;

      default:
        break;
    }
  });

  window.addEventListener('dataModeChanged', async (event) => {
    const { mode } = event.detail || {};
    if (!mode) return;

    // Skip if mode hasn't changed
    if (mode === latestMode) return;

    latestMode = mode;
    applyModeClass(mode);
    await globalRefresh(mode);
  });


  async function loadHelpIntoContainer(container) {
    try {
      // Show the existing spinner
      container.innerHTML = `<div class="spinner" aria-hidden="true"></div>`;

      const response = await fetch('./Components/help/help.html');
      if (!response.ok) throw new Error(`Fehler beim Laden der Hilfe: ${response.status}`);

      const html = await response.text();
      container.innerHTML = html;

      const { initializeHelp } = await import('../Components/help/help.js');
      initializeHelp(window.api);

    } catch (err) {
      console.error('❌ Fehler beim Laden der Hilfe:', err);

      container.innerHTML = `
      <div class="help-error">
        <h2>Fehler beim Laden der Hilfe</h2>
        <p>Die Hilfeseite konnte nicht geladen werden. Bitte versuchen Sie es später erneut.</p>
        <button id="back-to-calendar">Zurück zum Kalender</button>
      </div>
    `;

      document.getElementById('back-to-calendar')?.addEventListener('click', () => {
        const calendarContainer = document.getElementById('calendar');
        if (calendarContainer) loadCalendarIntoContainer(calendarContainer);
      });
    }
  }

  async function switchMainView(viewName) {
    const container = document.getElementById('calendar'); // or 'main-content'

    if (!container) {
      console.error("❌ View container not found");
      return;
    }

    if (viewName === 'calendar') {
      await loadCalendarIntoContainer(container);
    } else if (viewName === 'help') {
      await loadHelpIntoContainer(container);
    } else {
      console.warn(`⚠ Unknown view: ${viewName}`);
    }

    localStorage.setItem('selectedView', viewName);
  }

  window.api.receive('excel-export-done', (filePath) => {
    alert("Export gespeichert: " + filePath);
  });
  window.api.receive('excel-import-done', () => {
    globalRefresh('client');
  });


  window.api.receive('open-help', (topic) => {

    switchMainView('help'); // <- loads the help page in the shared container

    window.dispatchEvent(new CustomEvent('help-topic', { detail: topic }));
  });

  (async () => {
    let savedMode = await window.cacheAPI.getCacheValue('presenceUIMode');
    if (!savedMode) savedMode = 'toggle'; // default
    switchPresenceUIMode(savedMode);
  })();

  initTheme();
  syncInitialSettingsToMain();
  loadFormLikeElectron('welcome');
  showFnKeyHintIfLaptop();

  // --- Restore zoom factor ---
  (async () => {
    const savedZoom = await window.cacheAPI.getCacheValue('zoomFactor') || 1;
    document.body.style.zoom = savedZoom;
  })();
  // injectWindowButtonsIntoWelcomeHeader();
});


async function loadFormLikeElectron(formName) {
  const formContainer = document.getElementById('form-container');
  if (!formContainer) return;

  if (Object.keys(formInitializers).length === 0) {
    await loadFormModules();
  }

  const initializer = formInitializers[formName];
  if (!initializer) return;

  formContainer.innerHTML = '';
  initializer(window.api);

  resizeByPreferredForm(formName);
  requestAnimationFrame(() => {
    injectWindowButtonsIntoWelcomeHeader();
  });
}


export async function globalRefresh(mode = localStorage.getItem('dataMode') || 'default') {
  /* TO:DO
   Add refresh circuit breaker:
   - attempt counter
   - cooldown window (5s)
   - max retries (5–10)
   - structured console logs
*/
  if (isRefreshing && mode === latestMode) {
    console.warn('⏳ Refresh already running for this mode...');
    return;
  }

  isRefreshing = true;
  latestMode = mode;

  try {
    localStorage.setItem('dataMode', mode);
    document.body.setAttribute('data-mode', mode);

    const calendarContainer = document.getElementById('calendar');
    if (calendarContainer) {
      await loadCalendarIntoContainer(calendarContainer);
    }

    const legendContainer = document.getElementById('legend');
    if (legendContainer) {
      const { initializeLegend } = await import('../Components/legend/legend.js');
      await initializeLegend(window.api);
    } else {
      console.warn('⚠️ Legend container not found during refresh');
    }

    const currentForm = localStorage.getItem('selectedForm');
    if (currentForm && formInitializers[currentForm]) {
      try {
        formInitializers[currentForm](window.api);
      } catch (err) {
        console.error(`❌ Failed to refresh form ${currentForm}:`, err);
      }
    }

    await new Promise(requestAnimationFrame);
  } catch (err) {
    console.warn('⚠ No cached form to restore on global refresh');
  } finally {
    isRefreshing = false;
  }
}

function loadWelcomePage() {
  const currentPage = 'welcome';

  const formContainer = document.getElementById('form-container');
  if (!formContainer) return;

  formContainer.innerHTML = '';

  const template = document.getElementById('tmp-welcome-page');
  if (!template) return;

  const clone = template.content.cloneNode(true);

  formContainer.appendChild(clone);

  if (typeof showFnKeyHintIfLaptop === "function") {
    showFnKeyHintIfLaptop();
  }
}


function domReady() {
  if (document.readyState === 'loading') {
    return new Promise(resolve =>
      document.addEventListener('DOMContentLoaded', resolve, { once: true })
    );
  }
  const savedMode = localStorage.getItem('dataMode') || 'sample';
  applyModeClass(savedMode);

  return Promise.resolve();
}

function injectWindowButtonsIntoWelcomeHeader() {
  const divider = document.getElementById('horizontal-divider-box');
  if (!divider || divider.classList.contains('bg-admin')) return;

  // Avoid double-injection
  if (divider.querySelector('.window-buttons')) return;

  divider.addEventListener('mouseup', resizeFormContainer);

  // Ensure right-side container exists
  let rightGap = divider.querySelector('.right-gap');
  if (!rightGap) {
    rightGap = document.createElement('div');
    rightGap.className = 'right-gap';
    divider.appendChild(rightGap);
  }

  const windowBtns = createWindowButtons();
  rightGap.appendChild(windowBtns);
}

function applySettings() {
  const colorTheme = localStorage.getItem('colorTheme') || 'default';
  setTheme(colorTheme);

  const zoomFactor = localStorage.getItem('zoomFactor') || 1.0;
  setZoom(zoomFactor);

  const shiftSymbols = localStorage.getItem('shiftSymbols') || 'letters';
  setShiftSymbols(shiftSymbols);

  const zodiacStyle = localStorage.getItem('zodiacStyle') || 'none';
  setZodiacStyle(zodiacStyle);
}


function syncInitialSettingsToMain() {
  const payload = {
    colorTheme: localStorage.getItem('colorTheme') || 'default',
    zoomFactor: Number(localStorage.getItem('zoomFactor') || 1),
    presenceUIMode: localStorage.getItem('presenceUIMode') || 'toggle',
    shiftSymbols: localStorage.getItem('shiftSymbols') || 'letters',
    zodiacStyle: localStorage.getItem('zodiacStyle') || 'none',
    autoSave: localStorage.getItem('autoSave') === 'true'
  };

  window.api.send('update-cache', payload);
}
