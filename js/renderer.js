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
import { resizeFormContainer, resizeByPreferredForm } from './resizer.js';
// resizerLookup.js

const SHIFT_SYMBOL_PRESETS = {
  empty: ["", "", ""],
  letters: ["ϝ", "τ", "s"],
  emoji: ["🐓", "🍴", "🌙"]
};

let isRefreshing = false;

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
let isDragging = false;
let currentResizer = null;

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

// ----------- Drag & Resize Handlers -----------

function startDrag(e) {
  isDragging = true;
  currentResizer = e.target;
  const cursorClass = currentResizer.classList.contains('vertical-resizer') ? 'resize-ew' : 'resize-ns';
  document.body.classList.add(cursorClass);
}

function handleDrag(e) {
  if (!isDragging || !currentResizer) return;

  if (currentResizer.classList.contains('vertical-resizer')) {
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');

    const newWidthPercent = (e.clientX / window.innerWidth) * 100;
    leftPanel.style.setProperty('--left-panel-width', `${newWidthPercent}%`);
    rightPanel.style.width = `${100 - newWidthPercent}%`;
  } else if (currentResizer.classList.contains('horizontal-resizer')) {
    const parent = currentResizer.parentElement;
    const topSection = parent.children[0];
    const bottomSection = parent.children[2];

    const totalHeight = parent.offsetHeight;
    const newHeight = e.clientY - parent.offsetTop;
    const percentage = (newHeight / totalHeight) * 100;

    topSection.style.height = `${percentage}%`;
    bottomSection.style.height = `${100 - percentage}%`;
  }
}

function stopDrag() {
  if (!isDragging || !currentResizer) return;

  isDragging = false;
  document.body.style.cursor = 'default';

  if (currentResizer.classList.contains('vertical-resizer')) {
    const leftPanel = document.getElementById('left-panel');
    const leftWidth = leftPanel.style.getPropertyValue('--left-panel-width');
    if (leftWidth) localStorage.setItem('ui-left-panel-width', leftWidth);
  } else if (currentResizer.classList.contains('horizontal-resizer')) {
    const parent = currentResizer.parentElement;
    const topSection = parent.children[0];
    const topHeight = topSection.style.height;
    if (topHeight) localStorage.setItem('ui-top-section-height', topHeight);
  }

  currentResizer.classList.contains('vertical-resizer')
    ? document.body.classList.remove('resize-ew')
    : document.body.classList.remove('resize-ns');

  currentResizer = null;

  requestAnimationFrame(() => {
    const container = document.getElementById('form-container') || document.getElementById('calendar');
    if (container) {
      void container.offsetHeight;

      container.style.transform = 'translateZ(0)';
      setTimeout(() => (container.style.transform = ''), 100);
    }

    if (window.api?.send) {
      window.api.send('invalidate-renderer');
    }
  });
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

    console.log("[renderer] on form loaded", formName);

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
    resizeFormContainer();
  });
}

// ----------- Theme Handling -----------

function setTheme(themeName) {
  console.log("theme name :", themeName);
  document.body.classList.remove("theme-dark", "theme-default", "theme-pastel", "theme-greyscale");
  document.body.classList.add(`theme-${themeName}`);
  window.api.send('update-cache', { colorTheme: themeName });
}


function initTheme() {
  const savedTheme = localStorage.getItem("theme") || "default";
  setTheme(savedTheme);
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
    console.log("[renderer] toggle or radio? ", mode);
    await window.cacheAPI.setCacheValue('presenceUIMode', mode);

    // Dispatch event for other modules
    document.dispatchEvent(new CustomEvent('presence-ui-mode-changed', { detail: mode }));

    // Update the UI immediately
    switchPresenceUIMode(mode);
  });



  window.api.receive('get-cache-dump', async (requestId) => {
    const clientDataFolder = await window.cacheAPI.getCacheValue('clientDataFolder');
    const colorTheme = await window.cacheAPI.getCacheValue('colorTheme');
    const zoomFactor = await window.cacheAPI.getCacheValue('zoomFactor');
    const windowSize = await window.cacheAPI.getCacheValue('windowSize');

    window.api.send('return-cache-dump', {
      requestId,
      clientDataFolder,
      colorTheme,
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
    window.api.send('refresh-calendar');
  });

  window.api.receive('set-zodiac-style', async (style) => {
    await window.cacheAPI.setCacheValue('zodiacStyle', style);
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
    console.log(`‽ Help requested for topic: ${topicId}`);

    const helpContainer = document.getElementById('calendar');
    const container = document.getElementById('calendar');
    if (container) {
      initializeHelp(container, topicId);
    } else {
      alert(`Help requested: ${topicId}`);
    }
  });
}

// ----------- Initialization -----------
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

  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', stopDrag);

  // ----------- F-Key Handling -----------

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
    applyModeClass(event.detail.mode);
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
    console.log(`🕮 Opening help topic: ${topic}`);
    switchMainView('help'); // <- loads the help page in the shared container

    window.dispatchEvent(new CustomEvent('help-topic', { detail: topic }));
  });

  // --- Restore Presence UI Mode ---
  (async () => {
    let savedMode = await window.cacheAPI.getCacheValue('presenceUIMode');
    if (!savedMode) savedMode = 'toggle'; // default
    switchPresenceUIMode(savedMode);
  })();

  initTheme();
  showFnKeyHintIfLaptop();

  (async () => {
    const savedTheme = await window.cacheAPI.getCacheValue('colorTheme') || 'default';
    setTheme(savedTheme);
  })();

  // --- Restore zoom factor ---
  (async () => {
    const savedZoom = await window.cacheAPI.getCacheValue('zoomFactor') || 1;
    document.body.style.zoom = savedZoom;
  })();
  injectWindowButtonsIntoWelcomeHeader();
});

export async function globalRefresh(mode = localStorage.getItem('dataMode') || 'default') {
  if (isRefreshing) {
    console.warn('⏳ Refresh already running...');
    return;
  }
  isRefreshing = true;
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
    isRefreshing = false; // 🔓 Always unlock
  }
}

function loadWelcomePage() {

  currentPage = 'welcome';

  const formContainer = document.getElementById('form-container');
  if (!formContainer) return;

  // Clear dynamic content inside container
  formContainer.innerHTML = '';

  // Rebuild the welcome page
  const welcome = document.createElement('section');
  welcome.classList.add('welcome-page');
  welcome.setAttribute('aria-label', 'Willkommensseite');

  welcome.innerHTML = `
    <!-- MAIN CONTENT AREA -->
        <section
          id="form-container"
          class="bottom-row"
          aria-labelledby="greetingID"
        >
          <section
            class="welcome-page text-arial"
            role="region"
            aria-label="Willkommensseite"
          >
            <p class="text-header-4">
              Ihr Werkzeug zur einfachen Belegschaftsplanung. Rufe die Anleitung
              <span class="noto">❓</span> mit [F1] oder unter Menü
              <span class="noto">⇨ </span> Hilfe auf.
            </p>

            <!-- Fn key hint (hidden by default) -->
            <div
              id="fn-key-hint"
              class="fn-hint visually-hidden"
              role="note"
              aria-label="Fn-Tastentipp"
            >
              <img
                src="./assets/png/Fn-key.png"
                alt="Fn-Taste auf einer Laptop-Tastatur"
                class="fn-hint-img"
              />
              <p>
                💡 Tipp: Auf vielen Laptops müssen Sie <kbd>Fn</kbd> +
                <kbd>F1</kbd> oder <kbd>F12</kbd> drücken, um
                Tastenkombinationen zu nutzen.
              </p>
            </div>

            <div class="layout-full-size flex-row">
              <!-- CARD TEMPLATE -->
              <article
                class="layout-card layout-card.request"
                aria-labelledby="heading-request"
              >
                <h4 class="card-title text-request" id="heading-request">
                  <img
                    src="./assets/svg/file-document-svgrepo-com.svg"
                    alt=""
                    class="nav-icon"
                    aria-hidden="true"
                  />
                  <span class="card-title-text">Urlaubsanträge</span>
                  <img
                    src="./assets/svg/file-document-svgrepo-com.svg"
                    alt=""
                    class="nav-icon"
                    aria-hidden="true"
                  />
                </h4>
                  <p class="text-header-5">
                    <strong>Wieso</strong> ist jemand nicht da?
                  </p>
                  <p class="text-small">
                    Urlaube, Abwesenheiten und deren Status übersichtlich verwalten.
                  </p>
              </article>

              <article
                class="layout-card layout-card.employee"
                aria-labelledby="heading-employee"
              >
                <h4 class="card-title text-employee" id="heading-employee">
                  <img
                    src="./assets/svg/person-team-svgrepo-com.svg"
                    alt=""
                    class="nav-icon"
                    aria-hidden="true"
                  />
                  <span class="card-title-text">Mitarbeiter</span>
                  <img
                    src="./assets/svg/person-team-svgrepo-com.svg"
                    alt=""
                    class="nav-icon"
                    aria-hidden="true"
                  />
                </h4>
                  <p class="text-header-5">
                    <strong>Wer</strong> kann <strong>was</strong> – und <strong>wann</strong>?
                  </p>
                  <p class="text-small">
                    Mitarbeiter definieren und Aufgaben und individuelle Arbeitszeiten zuweisen.
                  </p>
              </article>

              <article
                class="layout-card layout-card.tasks"
                aria-labelledby="heading-tasks"
              >
                <h4 class="card-title text-tasks" id="heading-tasks">
                  <img
                    src="./assets/svg/puzzle-piece-svgrepo-com.svg"
                    alt=""
                    class="nav-icon"
                    aria-hidden="true"
                  />
                  <span class="card-title-text">Aufgaben</span>
                  <img
                    src="./assets/svg/puzzle-piece-svgrepo-com.svg"
                    alt=""
                    class="nav-icon"
                    aria-hidden="true"
                  />
                </h4>
                  <p class="text-header-5">
                    <strong>Was</strong> wird überhaupt gemacht?
                  </p>
                  <p class="text-small">
                    Aufgaben anlegen, benennen und visuell gruppieren.
                  </p>
              </article>

              <article
                class="layout-card layout-card.rules"
                aria-labelledby="heading-rules"
              >
                <h4 class="card-title text-rules" id="heading-rules">
                  <img
                    src="./assets/svg/knowledge-graph-svgrepo-com.svg"
                    alt=""
                    class="nav-icon"
                    aria-hidden="true"
                  />
                  <span class="card-title-text">Regeln</span>
                  <img
                    src="./assets/svg/knowledge-graph-svgrepo-com.svg"
                    alt=""
                    class="nav-icon"
                    aria-hidden="true"
                  />
                </h4>
                  <p class="text-header-5">
                    <strong>Wie</strong> sieht ein ideales Team aus?
                  </p>
                  <p class="text-small">
                    Regeln festlegen, die eib optimales Zusamenspiel vorgibt.
                  </p>
              </article>

              <article
                class="layout-card layout-card.calendar"
                aria-labelledby="heading-calendar"
              >
                <h4 class="card-title text-calendar" id="heading-calendar">
                  <img
                    src="./assets/svg/calendar-svgrepo-com.svg"
                    alt=""
                    class="nav-icon"
                    aria-hidden="true"
                  />
                  <span class="card-title-text">Kalender</span>
                  <img
                    src="./assets/svg/calendar-svgrepo-com.svg"
                    alt=""
                    class="nav-icon"
                    aria-hidden="true"
                  />
                </h4>
                  <p class="text-header-5">
                    <strong>Wann</strong> wird gearbeitet?
                  </p>
                  <p class="text-small">
                    Öffnungszeiten, Feiertage, Schichten und besondere Tage festlegen.
                  </p>
              </article>
            </div>
          </section>
        </section>
  `;

  formContainer.appendChild(welcome);

  // Re-run FN laptop logic
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
  const divider = document.getElementById('horizontal-divider');
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

