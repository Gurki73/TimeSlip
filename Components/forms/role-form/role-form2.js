import { loadRoleData, roles, allRoles, saveRoleData } from '../../../js/loader/role-loader.js';
import { createEmojiPicker } from '../../../Components/emojiPicker/emojiPicker.js';

let roleChanges = Array(12).fill(false);
const emoji = [
  "🛠️", "📚", "💻", "🧑‍⚖️", "🚓", "🔍", "🎤",
  "🔬", "🪥", "🩺", "🧹", "🪣", "⚙️", "🧯",
  "📦", "🛒", "✂️", "🔌", "🖨️", "🎨", "📞",
  "⛑️", "🖋️", "💵", "💳", "🍲", "💪", "🔒",
  "🩻", "🦷", "💬", "📊", "🧠", "🌙", "📸",
  "🛵", "⚕️"
];

let api;

export async function initializeRoleForm(passedApi) {
  setApi(passedApi);
  await loadInitialData(api);
  const formContainer = getFormContainer();
  if (!formContainer) return;
  await loadRoleForm(formContainer);
  renderRoleTable();
}

function setApi(passedApi) {
  api = passedApi;
  if (!api) console.error("Api was not passed ==> " + api);
}

async function loadInitialData(api) {
  try {
    await Promise.all([loadRoleData(api)]);
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

function getFormContainer() {
  const formContainer = document.getElementById('form-container');
  if (!formContainer) {
    console.error('Form container not found');
    return null;
  }
  formContainer.innerHTML = '';
  return formContainer;
}

async function loadRoleForm(formContainer) {
  try {
    const response = await fetch('Components/forms/role-form/role-form.html');
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    formContainer.innerHTML = await response.text();
  } catch (err) {
    console.error(`Loading role form failed: ${err}`);
  }
}

function renderRoleTable() {
  const container = document.getElementById('role-form-container');
  if (!container) {
    console.warn("Render role form not found");
    return;
  }
  container.innerHTML = '';

  const table = document.createElement('table');
  table.className = 'role-table';

  // Render main 12 roles (3x4 grid)
  for (let row = 0; row < 3; row++) {
    const tableRow = document.createElement('tr');

    for (let col = 0; col < 4; col++) {
      const roleIndex = (row + col * 3) + 1;
      const role = allRoles[roleIndex];

      const cell = document.createElement('td');
      cell.className = 'role-cell';

      if (role) {
        const roleDiv = createRoleDiv(role, roleIndex);
        cell.appendChild(roleDiv);

        addEventListeners(roleDiv, roleIndex);
      }

      tableRow.appendChild(cell);
    }

    table.appendChild(tableRow);
  }

  // Render special 13th role (task button row)
  const tableRow = document.createElement('tr');
  const roleIndex = 13;
  const role = allRoles[roleIndex];

  const cell = document.createElement('td');
  cell.className = 'role-cell';

  const roleDiv = document.createElement('div');
  roleDiv.className = 'task-button';
  roleDiv.setAttribute('data-role', role.colorIndex || '0');

  const emojiToUse = role.emoji || emoji[roleIndex % emoji.length];
  const roleName = role.name || '';

  roleDiv.innerHTML = `
    ${roleIndex}.
    <button class="transparentButton unaccessable emoji-button-${roleIndex} noto">${emojiToUse}</button>
    ⇨
    <input class="name-role unaccessable name-role-${roleIndex}" type="text" value="${roleName}" />
  `;

  cell.appendChild(roleDiv);
  tableRow.appendChild(cell);
  table.appendChild(tableRow);

  container.appendChild(table);

}

function createRoleDiv(role, roleIndex) {
  const roleDiv = document.createElement('div');
  roleDiv.className = 'task-button';
  roleDiv.setAttribute('data-role', role.colorIndex || '0');

  const emojiToUse = role.emoji || emoji[roleIndex % emoji.length];
  const roleName = role.name || '';

  const { shouldShowDelete, shouldShowStore } = updateRoleButtonsVisibility(roleIndex);

  roleDiv.innerHTML = `
  ${roleIndex}.
  <button
    class="transparentButton emoji-button-${roleIndex} noto"
    aria-label="Rollen-Emoji für ${roleName || 'unnannte Rolle'}"
    type="button"
  >${emojiToUse}</button>
  ⇨
  <input
    class="name-role name-role-${roleIndex}"
    type="text"
    value="${roleName}"
    aria-label="Rollenname Eingabefeld für Rolle ${roleIndex}"
  />
  <button
    class="mybutton-small store-button noto ${!shouldShowStore ? 'hidden' : ''}"
    data-index="${roleIndex}"
    type="button"
    title="Änderungen speichern"
    aria-label="Änderungen speichern für Rolle ${roleName || roleIndex}"
  >💾</button>
  <button
    class="mybutton-small delete-button noto ${!shouldShowDelete ? 'hidden' : ''}"
    data-index="${roleIndex}"
    type="button"
    title="${roleName} löschen"
    aria-label="Rolle ${roleName || roleIndex} löschen"
  >🚮</button>
`;

  addEventListeners(roleDiv, roleIndex);
  return roleDiv;
}

function addEventListeners(roleDiv, roleIndex) {
  if (roleDiv.dataset.listenersBound === 'true') {
    // Already bound, skip
    return;
  }
  roleDiv.dataset.listenersBound = 'true';

  try {
    roleDiv.querySelector(`.emoji-button-${roleIndex}`).addEventListener('click', () => changeEmoji(roleIndex));
  } catch (error) {
    console.error(`Failed to bind emoji button for role ${roleIndex}:`, error);
  }

  try {
    roleDiv.querySelector(`.name-role-${roleIndex}`).addEventListener('keydown', (event) => handleRoleInputKeydown(event, roleIndex));
  } catch (error) {
    console.error(`Failed to bind role input for role ${roleIndex}:`, error);
  }

  try {
    const deleteButton = roleDiv.querySelector('.delete-button');
    if (deleteButton) {
      deleteButton.addEventListener('click', (event) => {
        const index = event.target.getAttribute('data-index');
        deleteRoleAndShowStoreButton(index);
      });
    }
  } catch (error) {
    console.error(`Failed to bind delete button:`, error);
  }

  try {
    const storeButton = roleDiv.querySelector('.store-button');
    if (storeButton) {
      storeButton.addEventListener('click', (event) => {
        const index = event.target.getAttribute('data-index');
        storeRole(index);
      });
    }
  } catch (error) {
    console.error(`Failed to bind store button:`, error);
  }


  try {
    roleDiv.querySelector(`.name-role-${roleIndex}`).addEventListener('focus', (event) => {
      const input = event.target;
      if (input.value === '?') {
        input.value = '';
      }
    });
  } catch (error) {
    console.error(`Failed to bind focus event for role ${roleIndex}:`, error);
  }
}

function validateRoleName(index) {
  const input = document.querySelector(`.name-role-${index}`);
  const name = input.value.trim();
  const isUnique = !allRoles.some((r, i) => i !== index && r.name?.trim() === name);

  if (!isUnique) {
    input.setCustomValidity('Diesen Namen gibt es schon. Wähle einen anderen.');
    input.reportValidity();
    return false;
  } else {
    input.setCustomValidity('');
    return true;
  }
}

function handleRoleInputKeydown(event, index) {
  if (event.key === 'Enter') {
    event.target.blur();            // commit value
    processRoleInput(index);        // write into allRoles
    const ok = validateRoleName(index);
    if (!ok) {
      // focus back on the offending input
      event.target.focus();
      return;
    }
    markRoleAsChanged(index);
    // only advance focus once name is valid
    setTimeout(() => focusNext(index), 0);
  }
}

function markRoleAsChanged(index) {
  console.log("role js - mark change ", index);
  roleChanges[index] = true;
  focusNext(index);
}

function processRoleInput(index) {
  const inputElement = document.querySelector(`.name-role-${index}`);
  const newValue = inputElement.value.trim();
  allRoles[index].name = newValue || '?';
}


function changeEmoji(index) {
  const role = allRoles[index];

  const emojiButton = document.querySelector(`.emoji-button-${index}`);

  const handleEmojiSelectionChange = (selectedEmoji) => {
    if (selectedEmoji) {
      console.log(`Selected emoji for role ${role.name}:`, selectedEmoji);
      role.emoji = selectedEmoji;
      markRoleAsChanged(index);
      renderRoleTable();
    } else {
      console.log(`No emoji selected for role ${role.name}.`);
    }
  };

  createEmojiPicker(emoji, emojiButton, index, handleEmojiSelectionChange);
}

function deleteRoleAndShowStoreButton(index) {
  allRoles[index].emoji = '❓';
  allRoles[index].name = '?';
  roleChanges[index] = true;
  renderRoleTable();
}


function storeRole(index) {
  const role = allRoles[index];
  roleChanges[index] = false;

  const inputElement = document.querySelector(`.name-role-${index}`);
  const newName = inputElement.value.trim();

  role.name = newName || '?';

  console.log(`Role at index ${index} stored:`, role);

  saveRoleData(api);

}

function updateRoleButtonsVisibility(index) {
  const role = allRoles[index];
  const name = role.name?.trim();
  const emoji = role.emoji;
  const isValidName = name !== undefined && name.trim() !== '' && name.trim() !== '?';
  const isValidEmoji = emoji !== undefined && emoji.trim() !== '' && emoji.trim() !== '❓';

  const isChanged = roleChanges[index];
  const isNameUnique = !allRoles.some((r, i) => i !== index && r.name?.trim() === name);

  const shouldShowDelete = isValidName || isValidEmoji;
  const shouldShowStore = isValidName && isValidEmoji && isChanged && isNameUnique;

  return { shouldShowDelete, shouldShowStore }
}

function focusNext(roleIndex) {
  const container = document.getElementById('role-form-container');

  const nameInput = container.querySelector(`.name-role-${roleIndex}`);
  const emojiBtn = container.querySelector(`.emoji-button-${roleIndex}`);
  const saveButton = container.querySelector(`.store-button[data-index="${roleIndex}"]`);

  const { shouldShowDelete, shouldShowStore } = updateRoleButtonsVisibility(roleIndex);
  const role = allRoles[roleIndex];
  const isValidName = role.name?.trim() !== '' && role.name?.trim() !== '?';
  const isValidEmoji = role.emoji?.trim() !== '' && role.emoji?.trim() !== '❓';

  if (shouldShowDelete) {
    if (shouldShowStore) {
      console.log(" save button should receive focus ");
      renderRoleTable();
      requestAnimationFrame(() => {
        saveButton?.focus();
      });
      return;
    }
    if (!isValidName) {
      console.log(" Name text input should recive focus ");
      nameInput.focus();
    } else if (!isValidEmoji) {
      console.log(" emojiPicker should recive focus ");
      emojiBtn.focus();
    }
  }
}


