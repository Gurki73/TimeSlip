let formInitializers = {};
let isDragging = false;
let currentResizer = null;

const loadFormModules = async () => {
  try {
    const { initializeRoleForm } = await import('../Components/forms/role-form/role-form2.js');
    const { initializeRuleForm } = await import('../Components/forms/rule-form/rule-form.js');
    const { initializeEmployeeForm } = await import('../Components/forms/employee-form/employee-form.js');
    const { initializeRequestForm } = await import('../Components/forms/request-form/request-form.js');
    const { initializeCalendarForm } = await import('../Components/forms/calendar-form/calendar-form.js');
    const { initializeAdminForm } = await import('../Components/forms/admin-form/admin-form.js');

    formInitializers = {
      'role-form': initializeRoleForm,
      'rule-form': initializeRuleForm,
      'employee-form': initializeEmployeeForm,
      'request-form': initializeRequestForm,
      'calendar-form': initializeCalendarForm,
      'admin-form': initializeAdminForm,

    };

    console.log('✅ Form modules loaded successfully');
  } catch (err) {
    console.error('❌ Error loading form modules:', err);
  }
};

loadFormModules().then(() => console.log("📂 All form modules initialized"));

window.addEventListener('DOMContentLoaded', () => {

  document.querySelectorAll('.horizontal-resizer').forEach(resizer => {
    resizer.addEventListener('mousedown', startDrag);
  });

  document.querySelectorAll('.nav-button').forEach(button => {
    button.addEventListener('click', (e) => {
      const formName = e.currentTarget.getAttribute('data-form');
      window.api.loadForm(formName);
      localStorage.setItem('selectedForm', formName);
    });
  });

  const CalendarContainer = document.getElementById('calendar');
  if (!CalendarContainer) {
    console.error('❌ Calendar container in renderer.js not found');
  } else {
    console.log(' *** Found calendar container in renderer.js');

    loadCalendarIntoContainer(CalendarContainer).then(async () => {
      try {
        const { initializeCalendar } = await import('../Components/calendar/calendar.js');

        initializeCalendar(window.api);
      } catch (error) {
        console.error('❌ Error importing or initializing calendar:', error);
      }
    }).catch(error => {
      console.error('❌ Error loading calendar content:', error);
    });

  }


  async function loadCalendarIntoContainer(container) {
    try {
      const filePath = './Components/calendar/calendar.html';
      const response = await fetch(filePath);

      if (!response.ok) {
        throw new Error(`Failed to load file: ${filePath}, Status: ${response.status}`);
      }

      const data = await response.text();
      container.innerHTML = data;

    } catch (error) {
      console.error('❌ Error loading the calendar:', error);
      container.innerHTML = `<p>Error loading the calendar. Please try again later.</p>`;
      throw error;
    }
  }

  localStorage.removeItem('selectedForm');

  document.addEventListener('mousemove', handleDrag);
  document.addEventListener('mouseup', stopDrag);
});



function startDrag(e) {
  isDragging = true;
  currentResizer = e.target;
  document.body.style.cursor = currentResizer.classList.contains('vertical-resizer') ? 'ew-resize' : 'ns-resize';
}

function handleDrag(e) {
  if (!isDragging) return;

  if (currentResizer.classList.contains('vertical-resizer')) {
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');
    const newWidth = (e.clientX / window.innerWidth) * 100;
    leftPanel.style.width = `${newWidth}%`;
    rightPanel.style.width = `${100 - newWidth}%`;
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
  isDragging = false;
  document.body.style.cursor = 'default';
  currentResizer = null;
}

window.api.send('resize-event', {
  width: window.innerWidth,
  height: window.innerHeight
});


window.api.receive('resize-response', (data) => {
  console.log('Received response:', data);
});

document.addEventListener('DOMContentLoaded', () => {
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
        console.log(`✅ ${formName} initialized successfully.`);
      } catch (initError) {
        console.error(`❌ Error initializing ${formName}:`, initError);
      }
    } else {
      console.warn(`⚠️ No initializer found for form: ${formName}`);
    }
  });
});