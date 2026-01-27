// js\resizer.js

const formHeightLookup = {
  'welcome-page': { bottomRem: 8 },
  'role-form': { bottomRem: 17 },
  'rule-form': { bottomRem: 50 },
  'calendar-form': { bottomRem: 30 },
  'employee-form': { bottomRem: 43 },
  'admin-form': { bottomRem: 1 },
  'request-form': { bottomRem: 50 },
};

const MIN_BOTTOM_PX = Math.max(150, window.innerHeight * 0.15);

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
    const dividerHeight = divider.offsetHeight;

    const offsetY = e.clientY - panelRect.top;
    const requestedBottom = panelRect.height - offsetY - dividerHeight;

    applyBottomHeight(requestedBottom);
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.classList.remove('resizing');
  });
})

function getMaxBottomPx() {
  const prefs = formHeightLookup[currentFormKey];

  console.log(" from look up table =", prefs);
  return prefs ? remToPx(prefs.bottomRem) : Infinity;
}

function applyBottomHeight(requestedBottomPx) {
  const rightPanel = document.getElementById('right-panel');
  const topPanel = rightPanel.querySelector('.top-row');
  const bottomPanel = rightPanel.querySelector('.bottom-row');
  const divider = document.getElementById('horizontal-divider');

  if (!rightPanel || !topPanel || !bottomPanel) return;

  const containerHeight = rightPanel.getBoundingClientRect().height;
  const dividerHeight = divider?.offsetHeight || 0;

  const minBottom = MIN_BOTTOM_PX;
  const maxBottom = getMaxBottomPx();

  const bottomHeight = Math.min(
    Math.max(requestedBottomPx, minBottom),
    maxBottom,
    containerHeight - dividerHeight - 100 // safety top min
  );

  const topHeight = containerHeight - bottomHeight - dividerHeight;

  bottomPanel.style.height = `${bottomHeight}px`;
  topPanel.style.height = `${topHeight}px`;

  if (divider) {
    divider.style.top = `${topHeight}px`;
  }
}

export function toggleResize(action) {

  console.log(" resize actuion", action);

  if (!['minimize', 'maximize'].includes(action)) {
    console.warn('toggleResize called with invalid action:', action);
    return;
  }

  const rightPanel = document.getElementById('right-panel');
  if (!rightPanel) {
    console.error(" no right panel found ==>", rightPanel)
    return;
  }
  const containerHeight = rightPanel.getBoundingClientRect().height;

  if (action === 'maximize') {
    applyBottomHeight(getMaxBottomPx());
  } else if (action === 'minimize') {
    applyBottomHeight(MIN_BOTTOM_PX);
  }
}

export function resizeFormContainer() {

}

function remToPx(rem) {
  return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
}

export function resizeByPreferredForm(formKey, fraction = 0.75) {
  currentFormKey = formKey;

  const rightPanel = document.getElementById('right-panel');
  if (!rightPanel) return;

  const containerHeight = rightPanel.getBoundingClientRect().height;
  applyBottomHeight(containerHeight * fraction);
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