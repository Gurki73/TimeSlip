import { loadRoleData, getAllRoles, saveRoleData, loadTeamnames, saveTeamnames } from '../../../js/loader/role-loader.js';
import { createEmojiPicker } from '../../../Components/emojiPicker/emojiPicker.js';
import { resetAndBind } from '../../../js/Utils/bindEventListner.js';
import { createHelpButton } from '../../../js/Utils/helpPageButton.js';
import { createWindowButtons } from '../../../js/Utils/minMaxFormComponent.js';
import { createDataModeToggle } from '../../../js/Utils/DataMode-select.js';
import { createSaveButton } from '../../../js/Utils/saveButton.js';
import { loadEmojiData, normalizeEmojiData } from '../../../js/loader/custom-loader.js';

let roleChanges = Array(12).fill(false);
const roleEmojis = ["🛠️", "📚", "💻",];
let api;
let roleFormRoles = [];
let teamnames = {};
let saveButtonHeader;

export async function initializeRoleForm(passedApi) {
  setApi(passedApi);
  await loadInitialData(api);
  const loadedRoles = await getAllRoles(api);
  roleFormRoles = Array.isArray(loadedRoles) ? loadedRoles : [];
  await refreshRoleEmojiPool();
  const formContainer = getFormContainer();
  if (!formContainer) return;
  await loadRoleForm(formContainer);
  updateDivider();
  renderRoleTable();
  initTeamnames();
}

async function refreshRoleEmojiPool() {
  try {
    const emojiData = await loadEmojiData(api);
    const normalized = normalizeEmojiData(emojiData);

    const configuredRoleEmojis = Array.isArray(normalized?.roles) && normalized.roles.length
      ? normalized.roles
      : Array.isArray(emojiData?.roleEmojis) && emojiData.roleEmojis.length
        ? emojiData.roleEmojis
        : Array.isArray(emojiData?.assignments?.tasks) && emojiData.assignments.tasks.length
          ? emojiData.assignments.tasks
          : [];

    if (configuredRoleEmojis.length) {
      roleEmojis.length = 0;
      roleEmojis.push(...configuredRoleEmojis);
    }
  } catch (err) {
    console.warn('⚠️ Failed to load role emoji config. Using fallback defaults.', err);
  }
}

export async function initTeamnames() {
  try {
    teamnames = await loadTeamnames(api);
  } catch (err) {
    console.error('⚠️ Failed to load teamnames, using defaults.', err);
  }

  for (const [key, value] of Object.entries(teamnames)) {
    const el = document.querySelector(`.teamname-editable[data-team="${key}"]`);
    if (el) el.textContent = value;
  }

  const editableTeamNames = document.querySelectorAll('.teamname-editable');

  editableTeamNames.forEach(el => {
    let originalValue = '';

    el.addEventListener('focus', () => {
      originalValue = el.textContent.trim();
    });

    const saveTeamName = async () => {
      const team = el.dataset.team;
      const newName = el.textContent.trim();

      if (!newName || team === 'azubi') return;
      if (newName === originalValue) return;

      teamnames[team] = newName;

      try {
        await saveTeamnames(api, teamnames);
      } catch (err) {
        console.error(`✗ Failed to save teamname "${team}"`, err);
      }
    };

    el.addEventListener('blur', saveTeamName);

    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        el.blur();
      }
    });
  });
}

function updateDivider() {
  const divider = document.getElementById('horizontal-divider-box');
  if (!divider) return;

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

  const dataModeToggle = createDataModeToggle({
    onChange: (val) => {
      applyDataModeMode(val);
    }
  });

  saveButtonHeader = createSaveButton({ onSave: () => storeAllRoles() });

  const windowBtns = createWindowButtons();

  buttonContainer.append(saveButtonHeader.el, helpBtn, dataModeToggle, windowBtns);
  divider.append(leftGap, h2, buttonContainer);
}

function setApi(passedApi) {
  api = passedApi;
  if (!api) console.error("⚠️ Api was not passed to role-form2.js");
}

function storeAllRoles() {
  const dirtyRoles = roleFormRoles.filter((role, idx) => roleChanges[idx]);

  saveRoleData(api, dirtyRoles)
    .then(() => {
      console.log(`✓ Saved ${dirtyRoles.length} modified roles`);
    })
    .catch(err => console.error("✗ Failed to save roles:", err));

  saveButtonHeader?.setState('clean');
}

async function loadInitialData(api) {
  try {
    await loadRoleData(api);
  } catch (error) {
    console.error('✗ Error loading data:', error);
  }
}

function applyDataModeMode(dataMode) {
  // Use roleFormRoles which is already loaded and accessible
  if (dataMode === 'sample') {
    // Reset to original loaded data
    roleFormRoles.forEach((role, index) => {
      const nameInput = document.querySelector(`.name-role[data-index="${index}"]`);
      if (nameInput) {
        nameInput.value = role.name || '?';
      }

      const emojiBtn = document.querySelector(`.emoji-button[data-index="${index}"]`);
      if (emojiBtn) {
        emojiBtn.textContent = role.emoji || roleEmojis[index % roleEmojis.length];
      }
    });
  } else if (dataMode === 'client') {
    // Clear all fields
    roleFormRoles.forEach((_, index) => {
      const nameInput = document.querySelector(`.name-role[data-index="${index}"]`);
      if (nameInput) {
        nameInput.value = '';
      }

      const emojiBtn = document.querySelector(`.emoji-button[data-index="${index}"]`);
      if (emojiBtn) {
        emojiBtn.textContent = '⊖';
      }
    });
  }
}

function getFormContainer() {
  const formContainer = document.getElementById('form-container');
  if (!formContainer) {
    console.error('✗ Form container not found');
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
    console.error(`✗ Loading role form failed: ${err}`);
  }
}

async function renderRoleTable() {
  const cells = document.querySelectorAll('.role-cell');
  if (!cells.length) return;

  const templateResponse = await fetch('Components/forms/role-form/role-template.html');
  const templateHTML = await templateResponse.text();

  cells.forEach(cell => {
    const roleIndex = parseInt(cell.dataset.roleIndex, 10);
    const role = roleFormRoles[roleIndex];
    if (!role) return;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = templateHTML.trim();
    const roleDiv = wrapper.firstElementChild;

    roleDiv.dataset.role = role.colorIndex || '0';
    roleDiv.dataset.index = roleIndex;

    roleDiv.querySelector('.role-index').textContent = roleIndex;

    const emojiBtn = roleDiv.querySelector('.emoji-button');
    emojiBtn.textContent = role.emoji || roleEmojis[roleIndex % roleEmojis.length];
    emojiBtn.setAttribute('aria-label', `Rollen-Emoji für ${role.name || 'unbenannte Rolle'}`);
    emojiBtn.dataset.index = roleIndex;

    const nameInput = roleDiv.querySelector('.name-role');
    nameInput.disabled = roleIndex === 13;
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
  const emojiBtn = roleDiv.querySelector('.emoji-button');
  resetAndBind(emojiBtn, 'click', () => changeEmoji(roleIndex));

  const nameInput = roleDiv.querySelector('.name-role');
  const freshInput = resetAndBind(nameInput, 'keydown', (event) => handleRoleInputKeydown(event, roleIndex));
  if (freshInput) {
    freshInput.addEventListener('focus', (event) => {
      if (event.target.value === '?') event.target.value = '';
    });
  }

  const deleteButton = roleDiv.querySelector('.delete-button');
  resetAndBind(deleteButton, 'click', (event) => {
    const index = event.target.getAttribute('data-index');
    deleteRoleAndShowStoreButton(index);
  });

  const storeButton = roleDiv.querySelector('.store-button');
  resetAndBind(storeButton, 'click', (event) => {
    const index = event.target.getAttribute('data-index');
    storeRole(index);
  });
}

function validateRoleName(index) {
  const input = document.querySelector(`.name-role[data-index="${index}"]`);
  const name = input.value.trim();
  const isUnique = !roleFormRoles.some((r, i) => i !== index && r.name?.trim() === name);

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
    event.target.blur();
    processRoleInput(index);
    const ok = validateRoleName(index);
    if (!ok) {
      event.target.focus();
      return;
    }
    markRoleAsChanged(index);
    setTimeout(() => focusNext(index), 0);
  }
}

function markRoleAsChanged(index) {
  roleChanges[index] = true;
  saveButtonHeader?.setState('dirty');
}

function processRoleInput(index) {
  const inputElement = document.querySelector(`.name-role[data-index="${index}"]`);
  const newValue = inputElement.value.trim();
  roleFormRoles[index].name = newValue || '?';
}

function changeEmoji(index) {
  index = Number(index);
  const role = roleFormRoles[index];
  const emojiButton = document.querySelector(`.emoji-button[data-index="${index}"]`);

  const handleEmojiSelectionChange = (selectedEmoji) => {
    if (selectedEmoji) {
      role.emoji = selectedEmoji;
      markRoleAsChanged(index);
      renderRoleTable();
    }
  };

  if (index !== 13) {
    try {
      createEmojiPicker(roleEmojis, emojiButton, index, handleEmojiSelectionChange);
    } catch (err) {
      console.error(`⚠ Failed to create emoji picker for role index ${index}:`, err);
      emojiButton.textContent = role.emoji || '⊖';
    }
  }
}

function deleteRoleAndShowStoreButton(index) {
  index = Number(index);
  const role = roleFormRoles[index];
  if (!role) return;

  role.emoji = '❓';
  role.name = '?';
  markRoleAsChanged(index);
  renderRoleTable();
}

async function storeRole(index) {
  const role = roleFormRoles[index];
  roleChanges[index] = false;

  const inputElement = document.querySelector(`.name-role[data-index="${index}"]`);
  const newName = inputElement.value.trim();
  role.name = newName || '?';

  await saveRoleData(api, roleFormRoles);
}

function updateRoleButtonsVisibility(index) {
  index = Number(index);

  if (index === 13) return { shouldShowDelete: false, shouldShowStore: false };

  const role = roleFormRoles[index];
  const name = role.name?.trim();
  const emoji = role.emoji?.trim();
  const isValidName = name && name !== '' && name !== '?';
  const isValidEmoji = emoji && emoji !== '' && emoji !== '❓' && emoji !== '⊖';

  const isChanged = roleChanges[index];
  const isNameUnique = !roleFormRoles.some((r, i) => i !== index && r.name?.trim() === name);

  const shouldShowDelete = isValidName || isValidEmoji;
  const shouldShowStore = isValidName && isValidEmoji && isChanged && isNameUnique;

  return { shouldShowDelete, shouldShowStore };
}

function focusNext(roleIndex) {
  const container = document.getElementById('role-form-container');
  if (!container) return;

  const nameInput = container.querySelector(`.name-role[data-index="${roleIndex}"]`);
  const emojiBtn = container.querySelector(`.emoji-button[data-index="${roleIndex}"]`);
  const saveButton = container.querySelector(`.store-button[data-index="${roleIndex}"]`);

  const { shouldShowDelete, shouldShowStore } = updateRoleButtonsVisibility(roleIndex);
  const role = roleFormRoles[roleIndex];
  const isValidName = role.name?.trim() !== '' && role.name?.trim() !== '?';
  const isValidEmoji = role.emoji?.trim() !== '' && role.emoji?.trim() !== '❓';

  if (shouldShowDelete) {
    if (shouldShowStore) {
      renderRoleTable();
      requestAnimationFrame(() => {
        saveButton?.focus();
      });
      return;
    }
    if (!isValidName) {
      nameInput?.focus();
    } else if (!isValidEmoji) {
      emojiBtn?.focus();
    }
  }
}
