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

  // Save layout sizes
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
}

// ----------- UI Initialization -----------

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
        console.log(`☑ ${formName} initialized successfully.`);
      } catch (err) {
        console.error(`✗ Error initializing ${formName}:`, err);
      }
    } else {
      console.warn(`⚠ No initializer found for form: ${formName}`);
    }
  });
}

// ----------- Theme Handling -----------

function setTheme(themeName) {
  document.body.classList.remove("theme-dark", "theme-default", "theme-pastel");
  document.body.classList.add(`theme-${themeName}`);
  window.api.send('update-cache', { colorTheme: themeName });
}

function initTheme() {
  const savedTheme = localStorage.getItem("theme") || "default";
  setTheme(savedTheme);
}

// ----------- IPC Event Handlers -----------

function setupIPCListeners() {
  window.api.receive('download-checklist-update', (step, status) => {
    const event = new CustomEvent('checklist-update', { detail: { step, status } });
    window.dispatchEvent(event);
  });

  window.api.receive('resize-response', data => {
    // console.log('Received resize-response:', data);
  });

  window.api.receive('set-theme', themeName => {
    setTheme(themeName);
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
    console.log(`📥 update-cache received → ${key}: ${value}`);
    try {
      localStorage.setItem(key, value);
      console.log(`💾 localStorage updated → ${key}`);
    } catch (err) {
      console.error('❌ Failed to update localStorage:', err);
    }
  });

  window.api.receive("refresh-calendar", () => {
    const calendarContainer = document.getElementById('calendar');
    loadCalendarIntoContainer(calendarContainer);
  });
  // ✅ New: Handle "open-help" event
  window.api.receive('open-help', (topic) => {
    console.log(`‽ Help requested for topic: ${topic}`);

    // Display help (can be customized or connected to modal/help system)
    const helpContainer = document.getElementById('calendar');
    if (helpContainer) {
      helpContainer.innerHTML = `<h2>Help: ${topic}</h2><p>This is placeholder help content.</p>`;
      helpContainer.style.display = 'block';
    } else {
      alert(`Help requested: ${topic}`);
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

  // Clear cached form selection because clients want the welcome page
  localStorage.removeItem('selectedForm');

  // Setup calendar if container exists
  const calendarContainer = document.getElementById('calendar');
  if (calendarContainer) {
    loadCalendarIntoContainer(calendarContainer);
  } else {
    console.error('❌ Calendar container not found.');
  }

  // Setup drag listeners
  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', stopDrag);

  // Init theme last (could be before or after loadFormModules, but separate is cleaner)
  initTheme();

  // Notify main process of initial window size
  window.api.send('resize-event', {
    width: window.innerWidth,
    height: window.innerHeight,
  });
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

window.api.receive('open-help', (topic) => {
  console.log(`🕮 Opening help topic: ${topic}`);
  switchMainView('help'); // <- loads the help page in the shared container

  // optionally pass topic to help.js if you want context-specific topics
  window.dispatchEvent(new CustomEvent('help-topic', { detail: topic }));
});
