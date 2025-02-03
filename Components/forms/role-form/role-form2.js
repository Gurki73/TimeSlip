import { loadRoleData, roles, allRoles, generateRoleCSV } from '../../../js/loader/role-loader.js';
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
  await loadInitialData();
  const formContainer = getFormContainer();
  if (!formContainer) return;
  await loadRoleForm(formContainer);
  renderRoleTable();
}

function setApi(passedApi) {
  api = passedApi;
  if (!api) console.error("Api was not passed ==> " + api);
}

async function loadInitialData() {
  try {
    await Promise.all([loadRoleData()]);
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
      }
      tableRow.appendChild(cell);
    }

    table.appendChild(tableRow);
  }

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
    <input class="name-role unaccessable name-role-${roleIndex}" type="text" value="${roleName}" oninput="markRoleAsChanged(${roleIndex})" />
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
  const deleteButtonStyle = (roleName === '?' && emojiToUse === '❓') ? 'display: none;' : '';
  const storeButtonStyle = roleChanges[roleIndex] ? '' : 'display: none;';

  roleDiv.innerHTML = `
    ${roleIndex}.
    <button class="transparentButton emoji-button-${roleIndex} noto">${emojiToUse}</button>
    ⇨
    <input class="name-role name-role-${roleIndex}" type="text" value="${roleName}" oninput="markRoleAsChanged(${roleIndex})" />
    <button class="mybutton-small store-button-${roleIndex} noto" type="button" style="${storeButtonStyle}" title="Änderungen speichern">💾</button>
    <button class="mybutton-small delete-button-${roleIndex} noto" type="button" style="${deleteButtonStyle}" title="${roleName} löschen">🚮</button>
  `;

  addEventListeners(roleDiv, roleIndex);
  return roleDiv;
}

function addEventListeners(roleDiv, roleIndex) {
  roleDiv.querySelector(`.emoji-button-${roleIndex}`).addEventListener('click', () => changeEmoji(roleIndex));
  roleDiv.querySelector(`.name-role-${roleIndex}`).addEventListener('keydown', (event) => handleRoleInputKeydown(event, roleIndex));
  roleDiv.querySelector(`.delete-button-${roleIndex}`).addEventListener('click', () => deleteRoleAndShowStoreButton(roleIndex));
  roleDiv.querySelector(`.store-button-${roleIndex}`).addEventListener('click', () => storeRole(roleIndex));
}

function handleRoleInputKeydown(event, index) {
  if (event.key === 'Enter') {
    // Exit the input field (blur the field)
    event.target.blur();

    // Call a custom function when Enter is pressed
    processRoleInput(index);
  }
}
function markRoleAsChanged(index) {
  roleChanges[index] = true;
}

/**
 * Process the input for a specific role
 * @param {number} index - The index of the role
 */
function processRoleInput(index) {
  console.log(`Processing input for role at index ${index}`);
  const inputElement = document.querySelector(`.name-role-${index}`);
  const newValue = inputElement.value.trim();

  // Perform any specific action with the new value
  console.log(`New value for role ${index}: ${newValue}`);

  // Update the role and re-render if necessary
  allRoles[index].name = newValue;
  roleChanges[index] = true;
  renderRoleTable()
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
  console.log(`Deleting role at index ${index}`);

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

  generateRoleCSV(api);

}
