const formHeightLookup = {
  'welcome-page': { bottomRem: 16 },
  'role-form': { bottomRem: 50 },
  'rule-form': { bottomRem: 28 },
  'calendar-form': { bottomRem: 30 },
  'employee-form': { bottomRem: 43 },
  'admin-form': { bottomRem: 20 },
  'request-form': { bottomRem: 20 },
};

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

  let isDragging = false;

  divider.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDragging = true;
    document.body.classList.add('resizing');
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const panelRect = rightPanel.getBoundingClientRect();
    const offsetY = e.clientY - panelRect.top;

    const minHeight = 100;
    const maxHeight = panelRect.height * 0.8; // Allow up to 80%

    if (offsetY > minHeight && offsetY < maxHeight) {
      topPanel.style.height = `${offsetY}px`;
      const maxBottomPx = remToPx(prefs.bottomRem);
      bottomPanel.style.height = `${Math.min(calculatedHeight, maxBottomPx)}px`;
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.classList.remove('resizing');
  });
})

export function toggleResize(panelTop, panelBottom, action) {
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


  resizeFormContainer();
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
  const formContainer = document.getElementById('form-container');
  if (!formContainer) return;

  const availableHeight = getAvailableHeight();
  formContainer.style.height = `${availableHeight}px`;
  formContainer.style.overflowY = 'auto';
}

function remToPx(rem) {
  return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
}

export function resizeByPreferredForm(formKey) {

  console.log("[resizer] formkey ==>", formKey)

  const topPanel = document.querySelector('#right-panel .top-row');
  const bottomPanel = document.querySelector('#right-panel .bottom-row');
  const rightPanel = document.getElementById('right-panel');
  const divider = document.getElementById('horizontal-divider');

  if (!topPanel || !bottomPanel || !rightPanel) return;

  const prefs = formHeightLookup[formKey];
  if (!prefs) return;

  const containerHeight = rightPanel.getBoundingClientRect().height;
  const dividerHeight = remToPx(3.2);

  const preferredBottomPx = remToPx(prefs.bottomRem);

  const maxBottomPx = containerHeight * 0.8; // safety cap
  const bottomHeight = Math.min(preferredBottomPx, maxBottomPx);

  const topHeight = containerHeight - bottomHeight - dividerHeight;

  if (topHeight < 100) return; // safety floor
  topPanel.style.height = `${topHeight}px`;
  bottomPanel.style.height = `${bottomHeight}px`;
  bottomPanel.style.maxHeight = `${bottomHeight}px`;
  bottomPanel.style.minHeight = `${bottomHeight}px`;

  resizeFormContainer();
}
