// js\resizer.js

const formHeightLookup = {
  'welcome-page': { bottomRem: 8 },
  'role-form': { bottomRem: 17 },
  'rule-form': { bottomRem: 75 },
  'calendar-form': { bottomRem: 30 },
  'employee-form': { bottomRem: 43 },
  'admin-form': { bottomRem: 1 },
  'request-form': { bottomRem: 50 },
};

let isDragging = false;
let currentResizer = null;
let currentFormKey = 'welcome-page';

document.addEventListener('DOMContentLoaded', () => {
  const divider = document.getElementById('horizontal-divider');
  const topPanel = document.querySelector('#right-panel .top-row');
  const bottomPanel = document.querySelector('#right-panel .bottom-row');
  const rightPanel = document.getElementById('right-panel');
  const leftPanel = document.getElementById('left-panel');
  const resizeButton = document.getElementById('resize-toggle');

  resizeButton.addEventListener('click', () => {
    const isExpanded = leftPanel.classList.toggle('expanded');
    resizeButton.classList.toggle('expanded', isExpanded);
  });

  divider.addEventListener('mousedown', (e) => {
    e.preventDefault();

    isDragging = true;
    document.body.classList.add('resizing');
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const panelRect = rightPanel.getBoundingClientRect();
    const offsetY = e.clientY - panelRect.top;

    const dividerHeight = divider.offsetHeight;

    const minTopHeight = 100;
    const maxTopHeight = panelRect.height - minTopHeight - dividerHeight;

    const newTopHeight = Math.min(Math.max(offsetY, minTopHeight), maxTopHeight);
    const newBottomHeight = panelRect.height - newTopHeight - dividerHeight;

    const prefs = formHeightLookup[currentFormKey];
    const maxBottomPx = prefs ? remToPx(prefs.bottomRem) : newBottomHeight;

    const clampedBottomHeight = Math.min(newBottomHeight, maxBottomPx);

    const finalTopHeight = panelRect.height - clampedBottomHeight - dividerHeight;

    topPanel.style.height = `${finalTopHeight}px`;
    bottomPanel.style.height = `${clampedBottomHeight}px`;
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.classList.remove('resizing');
  });
})

export function toggleResize(panelTop, panelBottom, action) {

  console.log('[resize button] clicked');

  if (!panelTop || !panelBottom) return;

  const container = panelTop.parentElement; // Assuming both panels share the same parent
  const containerHeight = container.getBoundingClientRect().height;
  const dividerHeight = container.querySelector('#horizontal-divider').offsetHeight;

  let newTopHeight;

  if (action === 'maximize') {
    newTopHeight = containerHeight * 0.7; // 70% of container
  } else if (action === 'minimize') {
    newTopHeight = containerHeight * 0.15; // 15% of container
  } else {
    return;
  }

  console.log(" new to height ==> ", newTopHeight);


  panelTop.style.height = `${newTopHeight}px`;
  panelBottom.style.height = `${containerHeight - newTopHeight - dividerHeight}px`;


  // resizeFormContainer();
  // Force a repaint if needed
  panelTop.offsetHeight;
  panelBottom.offsetHeight;

}

function getAvailableHeight() {
  const banner = document.getElementById('banner'); // optional
  const bannerHeight = banner ? banner.offsetHeight : 0;

  const rightPanel = document.getElementById('right-panel');
  const panelRect = rightPanel.getBoundingClientRect();

  const divider = document.getElementById('horizontal-divider');
  const dividerHeight = divider ? divider.offsetHeight : 0;

  const topHeight = document.querySelector('#right-panel .top-row').offsetHeight;

  return panelRect.height - topHeight - dividerHeight - bannerHeight;
}

export function resizeFormContainer() {
  /* intentionally empty – scroll handled by CSS
  const bottomPanel = document.querySelector('.bottom-row');
  if (!formContainer) return;

  const availableHeight = getAvailableHeight();
  formContainer.style.height = `${availableHeight}px`;
  formContainer.style.overflowY = 'auto';
  */
}

function remToPx(rem) {
  return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
}

export function resizeByPreferredForm(formKey, fraction = 0.75) {
  const bottomPanel = document.querySelector('.bottom-row');
  const topPanel = document.querySelector('.top-row'); // calendar
  const rightPanel = document.getElementById('right-panel');
  const dividerHeight = document.getElementById('horizontal-divider')?.offsetHeight || 0;

  console.log("Form key ====>", formKey);
  currentFormKey = formKey;
  if (!bottomPanel || !topPanel || !rightPanel) return;
  const prefs = formHeightLookup[formKey];
  console.log(" Formkey and Prefs =====>", formKey, prefs.bottomRem);
  if (!prefs) return;

  const containerHeight = rightPanel.getBoundingClientRect().height;
  const maxBottomPx = remToPx(prefs.bottomRem); // clamp by form type
  console.log("mAX BOTTOM PX =====> ", maxBottomPx);
  console.log("mmax mall fracction ====>", (fraction * containerHeight));
  const initialBottomHeight = Math.min(containerHeight * fraction, maxBottomPx);

  console.log("initialBottomHeight ====>", initialBottomHeight);

  bottomPanel.style.height = `${initialBottomHeight}px`;
  bottomPanel.style.maxHeight = `${maxBottomPx}px`;

  topPanel.style.height = `${containerHeight - initialBottomHeight - dividerHeight}px`;

  const formContainer = document.getElementById('form-container');
  if (formContainer) {
    formContainer.style.height = `${initialBottomHeight}px`;
    formContainer.style.overflowY = 'auto';
  }

  const divider = document.getElementById('horizontal-divider');

  const dividerTop = containerHeight - initialBottomHeight - dividerHeight;
  console.log("divider top ", dividerTop);
  console.log("conmtainer height", containerHeight);
  divider.style.top = `${dividerTop}px`;
}

// ----------- Drag & Resize Handlers -----------

export function startDrag(e) {
  isDragging = true;
  currentResizer = e.target;
  const cursorClass = currentResizer.classList.contains('vertical-resizer') ? 'resize-ew' : 'resize-ns';
  document.body.classList.add(cursorClass);
}

export function handleDrag(e) {
  if (!isDragging || !currentResizer) return;

  if (currentResizer.classList.contains('vertical-resizer')) {
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');

    const newWidthPercent = (e.clientX / window.innerWidth) * 100;
    leftPanel.style.setProperty('--left-panel-width', `${newWidthPercent}%`);
    rightPanel.style.width = `${100 - newWidthPercent}%`;
  } else if (currentResizer.classList.contains('horizontal-resizer')) {
    // REPLACE TEMP DISABLED
    const parent = currentResizer.closest('#right-panel');
    const topPanel = parent.querySelector('.top-row');       // calendar
    const bottomPanel = parent.querySelector('.bottom-row'); // bottom panel
    const divider = parent.querySelector('#horizontal-divider');
    const dividerHeight = divider ? divider.offsetHeight : 0;

    const offsetY = e.clientY - parent.getBoundingClientRect().top;

    // Safety limits
    const minTopHeight = 100; // px
    const maxTopHeight = parent.offsetHeight * 0.85; // 85% of container

    const newTopHeight = Math.min(Math.max(offsetY, minTopHeight), maxTopHeight);
    const newBottomHeight = parent.offsetHeight - newTopHeight - dividerHeight;

    topPanel.style.height = `${newTopHeight}px`;
    bottomPanel.style.height = `${newBottomHeight}px`;
  }
}

export function stopDrag() {
  if (!isDragging || !currentResizer) return;

  isDragging = false;
  document.body.style.cursor = 'default';

  if (currentResizer.classList.contains('vertical-resizer')) {
    const leftPanel = document.getElementById('left-panel');
    const leftWidth = leftPanel.style.getPropertyValue('--left-panel-width');
    if (leftWidth) localStorage.setItem('ui-left-panel-width', leftWidth);
  } else if (currentResizer.classList.contains('horizontal-resizer')) {
    /* localStorage restore disabled for now
    const parent = currentResizer.parentElement;
    const topSection = parent.children[0];
    const topHeight = topSection.style.height;
    if (topHeight) localStorage.setItem('ui-top-section-height', topHeight);
    */
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