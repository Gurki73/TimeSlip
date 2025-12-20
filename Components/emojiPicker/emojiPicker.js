export function createEmojiPicker(emojiArray, targetButton, colorIndex, callback) {
  const existingPicker = document.querySelector('.emoji-picker');
  if (existingPicker) existingPicker.remove();

  if (!emojiArray?.length) {
    console.warn('Emoji array is invalid or empty');
    return;
  }

  // Grid size
  let n = 0;
  while (n * n < emojiArray.length) n++;
  const emojiPickerRow = n, emojiPickerCol = n;

  // Picker container
  const emojiPicker = document.createElement('div');
  emojiPicker.classList.add('emoji-picker', 'emoji-picker-container');

  // Top bar wrapper
  const topBarWrapper = document.createElement('div');
  topBarWrapper.classList.add('top-bar-wrapper', 'emoji-picker-top-bar-wrapper');
  topBarWrapper.setAttribute('data-index', colorIndex);

  // Top bar
  const topBar = document.createElement('div');
  topBar.classList.add('top-bar', 'emoji-picker-top-bar');
  topBar.textContent = 'bitte ein neues Emoji auswählen';

  // Compute top bar background color with fallback
  let topBarColor = getComputedStyle(document.documentElement)
    .getPropertyValue(`--role-${colorIndex}-color`).trim();
  if (!topBarColor || topBarColor === '#fff' || topBarColor === 'rgb(255, 255, 255)') {
    topBarColor = 'cornflowerblue';
  }
  topBarWrapper.style.backgroundColor = topBarColor;

  // Close button (always visible)
  const closeButton = document.createElement('button');
  closeButton.setAttribute('tabindex', '0');
  closeButton.setAttribute('aria-label', 'Exit emoji picker');
  closeButton.classList.add('close-btn', 'emoji-picker-close-btn', 'noto');
  closeButton.textContent = '×';
  closeButton.style.color = getContrastYIQ(topBarColor); // dynamic contrast
  closeButton.onclick = () => {
    callback(null);
    emojiPicker.remove();
  };
  topBar.appendChild(closeButton);

  topBarWrapper.appendChild(topBar);
  emojiPicker.appendChild(topBarWrapper);

  // Emoji grid
  const emojiGrid = document.createElement('div');
  emojiGrid.classList.add('emoji-grid', 'emoji-picker-grid');

  let emojiIndex = 0;
  for (let row = 0; row < emojiPickerRow; row++) {
    for (let col = 0; col < emojiPickerCol; col++) {
      const emoji = emojiArray[emojiIndex++];
      if (!emoji) break;

      const emojiButton = document.createElement('div');
      emojiButton.classList.add('emoji', 'emoji-picker-emoji', `row-${row}`, `col-${col}`, 'noto');
      emojiButton.textContent = emoji;
      emojiButton.style.setProperty('--hover-color', `var(--role-${colorIndex}-color)`);
      emojiButton.setAttribute('tabindex', '0');
      emojiButton.setAttribute('role', 'button');
      emojiButton.setAttribute('aria-label', `Emoji ${emoji}`);
      emojiButton.style.zIndex = 9999;

      emojiButton.addEventListener('click', () => handleEmojiSelection(emoji, emojiPicker, callback));
      emojiButton.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleEmojiSelection(emoji, emojiPicker, callback);
        }
      });

      emojiGrid.appendChild(emojiButton);
    }
  }

  emojiPicker.appendChild(emojiGrid);

  // Position picker
  const rect = targetButton.getBoundingClientRect();
  emojiPicker.style.top = `${rect.bottom + (-n * 25)}px`;
  emojiPicker.style.left = `${rect.left + window.scrollX + (-n * 25)}px`;

  document.body.appendChild(emojiPicker);

  // Auto-focus first emoji, fallback to close button
  setTimeout(() => {
    const firstEmoji = emojiPicker.querySelector('.emoji-picker-emoji');
    (firstEmoji || closeButton).focus();
  }, 0);

  // Store hover color for CSS
  emojiPicker.style.setProperty('--role-hover-color', topBarColor);
}

// Helper functions
function handleEmojiSelection(emoji, pickerElement, callback) {
  callback(emoji);
  pickerElement.remove();
}

function getContrastYIQ(hexcolor) {
  hexcolor = hexcolor.replace('#', '');
  const r = parseInt(hexcolor.substr(0, 2), 16);
  const g = parseInt(hexcolor.substr(2, 2), 16);
  const b = parseInt(hexcolor.substr(4, 2), 16);
  return ((r * 299 + g * 587 + b * 114) / 1000) > 128 ? 'black' : 'white';
}
