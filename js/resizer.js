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
    document.body.style.cursor = 'row-resize';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const panelRect = rightPanel.getBoundingClientRect();
    const offsetY = e.clientY - panelRect.top;

    const minHeight = 100;
    const maxHeight = panelRect.height * 0.8; // Allow up to 80%

    if (offsetY > minHeight && offsetY < maxHeight) {
      topPanel.style.height = `${offsetY}px`;
      bottomPanel.style.height = `${panelRect.height - offsetY - divider.offsetHeight}px`;
    }
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.cursor = 'default';
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

  // Force a repaint if needed
  panelTop.offsetHeight;
  panelBottom.offsetHeight;
}