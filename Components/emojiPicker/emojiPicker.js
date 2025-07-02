export function createEmojiPicker(emojiArray, targetButton, colorIndex, callback) {

  const existingPicker = document.querySelector('.emoji-picker');
  if (existingPicker) {
    existingPicker.remove();
  }

  if (!emojiArray || !Array.isArray(emojiArray) || emojiArray.length === 0) {
    console.warn('Emoji array is invalid or empty');
    return;
  }

  let n = 0;
  while (n * n < emojiArray.length) {
    n++;
  }

  const emojiPickerRow = n;
  const emojiPickerCol = n;

  const emojiPicker = document.createElement('div');
  emojiPicker.classList.add('emoji-picker', 'emoji-picker-container');


  const topBarWrapper = document.createElement('div');
  topBarWrapper.classList.add('top-bar-wrapper', 'emoji-picker-top-bar-wrapper');
  topBarWrapper.setAttribute('data-index', colorIndex);

  const topBar = document.createElement('div');
  topBar.classList.add('top-bar', 'emoji-picker-top-bar');
  topBar.textContent = 'bitte ein neues Emoji auswählen';

  const closeButton = document.createElement('button');
  closeButton.setAttribute('tabindex', '0');
  closeButton.setAttribute('aria-label', 'Exit emoji picker');
  closeButton.classList.add('close-btn', 'emoji-picker-close-btn');
  closeButton.textContent = '×';
  closeButton.onclick = () => {
    callback(null);
    emojiPicker.remove();
  };
  topBar.appendChild(closeButton);

  topBarWrapper.appendChild(topBar);
  emojiPicker.appendChild(topBarWrapper);

  const emojiGrid = document.createElement('div');
  emojiGrid.classList.add('emoji-grid', 'emoji-picker-grid');
  emojiPicker.setAttribute('tabindex', '-1'); // just in case
  emojiGrid.setAttribute('tabindex', '-1');


  let emojiIndex = 0;
  for (let row = 0; row < emojiPickerRow; row++) {
    for (let col = 0; col < emojiPickerCol; col++) {
      const emoji = emojiArray[emojiIndex++];
      if (!emoji) break;

      const emojiButton = document.createElement('div');
      emojiButton.classList.add('emoji', 'emoji-picker-emoji');
      emojiButton.textContent = emoji;

      emojiButton.classList.add(`row-${row}`);
      emojiButton.classList.add(`col-${col}`);
      emojiButton.style.setProperty('--hover-color', `var(--role-${colorIndex}-color)`);
      emojiButton.setAttribute('data-index', emojiIndex - 1);
      emojiButton.classList.add('noto');
      emojiButton.style.zIndex = 9999;
      emojiButton.addEventListener('click', () => handleEmojiSelection(emoji, emojiPicker, callback));
      emojiButton.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault(); // prevent scrolling on space
          handleEmojiSelection(emoji, emojiPicker, callback);
        }
      });
      emojiButton.setAttribute('tabindex', '0'); // Allows focus via keyboard
      emojiButton.setAttribute('role', 'button'); // Assistive tech compatibility
      emojiButton.setAttribute('aria-label', `Emoji ${emoji}`); // Improves screen reader UX

      emojiGrid.appendChild(emojiButton);
    }
  }

  emojiPicker.appendChild(emojiGrid);

  const emojiPickerHeight = emojiPickerRow * 24;
  const emojiPickerWidth = emojiPickerCol * 24;

  const rect = targetButton.getBoundingClientRect();
  emojiPicker.style.top = `${rect.bottom + (-n * 25)}px`;
  emojiPicker.style.left = `${rect.left + window.scrollX + (-n * 25)}px`;

  document.body.appendChild(emojiPicker);

  setTimeout(() => {
    const firstEmoji = emojiPicker.querySelector('.emoji-picker-emoji');
    if (firstEmoji) {
      firstEmoji.focus();
    } else {
      closeButton.focus(); // fallback
    }
  }, 0);

  const headerColor = getComputedStyle(topBar).backgroundColor;

  emojiPicker.style.setProperty('--role-hover-color', headerColor);

}


// Mouseleave to close the emoji picker when cursor leaves
// emojiPicker.addEventListener('mouseleave', () => {
//     callback(null);
//     emojiPicker.remove();
// });

//const closeAfterTimeLimit = 10000; 
// setTimeout(() => {
//     callback(null);
//     emojiPicker.remove();
// }, closeAfterTimeLimit);

function handleEmojiSelection(emoji, pickerElement, callback) {
  callback(emoji);  // Pass the selected emoji to the callback
  pickerElement.remove();  // Close the picker after selection
}

