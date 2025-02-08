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