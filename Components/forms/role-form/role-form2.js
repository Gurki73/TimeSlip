import { loadRoleData, roles, allRoles, saveRoleData } from '../../../js/loader/role-loader.js';
import { createEmojiPicker } from '../../../Components/emojiPicker/emojiPicker.js';
import { createBranchSelect, branchPresetsRoles } from '../../../js/Utils/branch-select.js';
import { createSaveAllButton, saveAll } from '../../../js/Utils/saveAllButton.js';
import { resetAndBind } from '../../../js/Utils/bindEventListner.js';
import { createHelpButton } from '../../../js/Utils/helpPageButton.js';

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
  updateDivider("bg-tasks");
  renderRoleTable();
}

function updateDivider(className) {
  const divider = document.getElementById('horizontal-divider');
  divider.innerHTML = '';

  const leftGap = document.createElement('div');
  leftGap.className = 'left-gap';

  const h2 = document.createElement('h2');
  h2.id = 'role-form-title';
  h2.className = 'sr-only';
  h2.innerHTML = `<span class="noto">🧩</span> Rollen und Aufgaben Formular <span class="noto">🧩</span>`;

  const buttonContainer = document.createElement('div');
  buttonContainer.id = 'form-buttons';

  const helpBtn = createHelpButton('chapter-roles');
  helpBtn.setAttribute('aria-label', 'Hilfe öffnen für Rollen-Formular');

  const branchSelect = createBranchSelect({
    onChange: (val) => {
      console.log('Branch changed to:', val);
      applyBranchPreset(val);
    }
  });
  branchSelect.setAttribute('aria-label', 'Branche auswählen');

  const saveBtn = createSaveAllButton({
    onClick: () => {
      console.log('Save all clicked!');
    }
  });
  saveBtn.setAttribute('aria-label', 'Alle Änderungen speichern');

  buttonContainer.append(helpBtn, branchSelect, saveBtn);

  divider.append(leftGap, h2, buttonContainer);

  divider.className = '';
  divider.classList.add(className);
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

function applyBranchPreset(branch) {
  const preset = branchPresetsRoles[branch];
  if (!preset || !preset.teams) return;

  Object.entries(preset.teams).forEach(([teamKey, roles]) => {
    const teamName = roles[0];       // first entry = team name
    const roleNames = roles.slice(1); // remaining = roles

    // Example: team input and roles inputs must have consistent IDs / data attributes
    const teamInput = document.querySelector(`#team-${teamKey}-name`);
    const roleInputs = document.querySelectorAll(`.role-input[data-team="${teamKey}"]`);

    if (teamInput) teamInput.value = teamName;

    roleInputs.forEach((input, i) => {
      input.value = roleNames[i] || "";
    });
  });

  console.log(`[RoleForm] Applied preset for branch "${branch}"`);
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

async function renderRoleTable() {
  const cells = document.querySelectorAll('.role-cell');
  const templateHTML = await (await fetch('Components/forms/role-form/role-template.html')).text();

  cells.forEach(cell => {
    const roleIndex = parseInt(cell.dataset.roleIndex, 10);
    const role = allRoles[roleIndex];
    if (!role) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = templateHTML.trim();
    const roleDiv = wrapper.firstElementChild;

    roleDiv.dataset.role = role.colorIndex || '0';
    roleDiv.dataset.index = roleIndex;

    roleDiv.querySelector('.role-index').textContent = roleIndex;

    const emojiBtn = roleDiv.querySelector('.emoji-button');
    emojiBtn.textContent = role.emoji || emoji[roleIndex % emoji.length];
    emojiBtn.setAttribute('aria-label', `Rollen-Emoji für ${role.name || 'unnannte Rolle'}`);
    emojiBtn.dataset.index = roleIndex;

    const nameInput = roleDiv.querySelector('.name-role');
    nameInput.value = role.name || '';
    nameInput.setAttribute('aria-label', `Rollenname Eingabefeld für Rolle ${roleIndex}`);
    nameInput.dataset.index = roleIndex;

    const { shouldShowDelete, shouldShowStore } = updateRoleButtonsVisibility(roleIndex);

    const storeBtn = roleDiv.querySelector('.store-button');
    storeBtn.classList.toggle('hidden', !shouldShowStore);
    storeBtn.dataset.index = roleIndex;

    const deleteBtn = roleDiv.querySelector('.delete-button');
    deleteBtn.classList.toggle('hidden', !shouldShowDelete);
    deleteBtn.dataset.index = roleIndex;

    addEventListeners(roleDiv, roleIndex);

    cell.innerHTML = '';
    cell.appendChild(roleDiv);
  });
}


function addEventListeners(roleDiv, roleIndex) {
  // Emoji button
  const emojiBtn = roleDiv.querySelector('.emoji-button');
  resetAndBind(emojiBtn, 'click', () => changeEmoji(roleIndex));

  // Name input
  const nameInput = roleDiv.querySelector('.name-role');
  const freshInput = resetAndBind(nameInput, 'keydown', (event) => handleRoleInputKeydown(event, roleIndex));
  if (freshInput) {
    freshInput.addEventListener('focus', (event) => {
      if (event.target.value === '?') event.target.value = '';
    });
  }

  // Delete button
  const deleteButton = roleDiv.querySelector('.delete-button');
  resetAndBind(deleteButton, 'click', (event) => {
    const index = event.target.getAttribute('data-index');
    deleteRoleAndShowStoreButton(index);
  });

  // Store button
  const storeButton = roleDiv.querySelector('.store-button');
  resetAndBind(storeButton, 'click', (event) => {
    const index = event.target.getAttribute('data-index');
    storeRole(index);
  });
}



function validateRoleName(index) {
  const input = document.querySelector(`.name-role[data-index="${index}"]`);
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
  const inputElement = document.querySelector(`.name-role[data-index="${index}"]`);
  const newValue = inputElement.value.trim();
  allRoles[index].name = newValue || '?';
}


function changeEmoji(index) {
  const role = allRoles[index];

  // ✅ select using data-index
  const emojiButton = document.querySelector(`.emoji-button[data-index="${index}"]`);

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

  const inputElement = document.querySelector(`.name-role[data-index="${index}"]`);

  const newName = inputElement.value.trim();

  role.name = newName || '?';

  console.log(`Role at index ${index} stored:`, role);

  saveRoleData(api);
  renderRoleTable();
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

  const nameInput = container.querySelector(`.name-role[data-index="${roleIndex}"]`);
  const emojiBtn = container.querySelector(`.emoji-button[data-index="${roleIndex}"]`);
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


