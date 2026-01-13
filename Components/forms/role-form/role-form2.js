import { loadRoleData, getAllRoles, saveRoleData, loadTeamnames, saveTeamnames } from '../../../js/loader/role-loader.js';
import { createEmojiPicker } from '../../../Components/emojiPicker/emojiPicker.js';
import { resetAndBind } from '../../../js/Utils/bindEventListner.js';
import { createHelpButton } from '../../../js/Utils/helpPageButton.js';
import { createWindowButtons } from '../../../js/Utils/minMaxFormComponent.js';
import { createBranchSelect, branchPresetsRoles } from '../../../js/Utils/branch-select.js';
import { createSaveButton } from '../../../js/Utils/saveButton.js';
import { loadEmojiData } from '../../../js/loader/custom-loader.js';

let roleChanges = Array(12).fill(false);
const roleEmojis = ["🛠️", "📚", "💻",];
let api;
let roleFormRoles = [];
let teamnames = {};
let saveButtonHeader;

export async function initializeRoleForm(passedApi) {
  setApi(passedApi);
  await loadInitialData(api);
  const emojiData = await loadEmojiData(api);
  if (emojiData?.roleEmojis?.length) {
    console.log("[RoleForm] Using custom role emojis:", emojiData.roleEmojis);
    roleEmojis.length = 0;
    roleEmojis.push(...emojiData.roleEmojis);

    console.log(emojiData);
    console.log(roleEmojis);
  }
  roleFormRoles = await getAllRoles(api);
  const formContainer = getFormContainer();
  if (!formContainer) return;
  await loadRoleForm(formContainer);
  updateDivider("bg-tasks");
  renderRoleTable();
  initTeamnames(passedApi);
}

export async function initTeamnames(passedApi) {
  // 1️⃣ Load existing teamnames (or defaults/sample if missing)
  try {
    teamnames = await loadTeamnames(passedApi);
  } catch (err) {
    console.error('⚠️ Failed to load teamnames, using defaults.', err);
  }

  // 2️⃣ Fill current names into DOM
  for (const [key, value] of Object.entries(teamnames)) {
    const el = document.querySelector(`.teamname-editable[data-team="${key}"]`);
    if (el) el.textContent = value;
  }

  // 3️⃣ Attach listeners to save on blur or Enter/Tab
  const editableTeamNames = document.querySelectorAll('.teamname-editable');

  editableTeamNames.forEach(el => {

    const saveTeamName = async () => {
      const team = el.dataset.team;
      const newName = el.textContent.trim();
      if (!newName || team === 'azubi') return; // skip empty or Azubi

      teamnames[team] = newName;

      try {
        await saveTeamnames(passedApi, teamnames);
        console.log(`💾 Saved teamnames → ${team}: ${newName}`);
      } catch (err) {
        console.error(`✗ Failed to save teamname "${team}"`, err);
      }
    };

    el.addEventListener('blur', saveTeamName);

    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        el.blur(); // triggers blur → save
      }
    });
  });
}

function updateDivider(className) {
  const divider = document.getElementById('horizontal-divider-box');
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
      applyBranchPreset(val);
    }
  });

  saveButtonHeader = createSaveButton({ onSave: () => storeAllRoles(api) });

  const windowBtns = createWindowButtons(); // your new min/max buttons

  buttonContainer.append(saveButtonHeader.el, helpBtn, branchSelect, windowBtns);

  divider.append(leftGap, h2, buttonContainer);
}

function setApi(passedApi) {
  api = passedApi;
  if (!api) console.error("Api was not passed ==> " + api);
}

function storeAllRoles(api) {

  // 1. Find all changed roles
  const dirtyRoles = roleFormRoles.filter((role, idx) => roleChanges[idx]);

  // 2. Save roles (example)
  saveRoleData(api, dirtyRoles).then(() => {
    console.log("All roles saved successfully!");
  }).catch(err => console.error("Failed to save roles:", err));

  saveButtonHeader?.setState('clean');
}


async function loadInitialData(api) {
  try {
    await Promise.all([loadRoleData(api)]);
  } catch (error) {
    console.error('Error loading data:', error);
  }
}

function applyBranchPreset(branch, api) {
  const preset = branchPresetsRoles[branch];
  if (!preset || !preset.teams) return;

  const allRoles = loadRoleData(api)
  Object.entries(preset.teams).forEach(([teamKey, teamRoles]) => {
    const teamName = teamRoles[0];        // first entry = team name
    const roleNames = teamRoles.slice(1); // remaining = roles

    const teamInput = document.querySelector(`#team-${teamKey}-name`);
    const roleInputs = document.querySelectorAll(`.role-input[data-team="${teamKey}"]`);

    if (teamInput) teamInput.value = teamName;

    roleInputs.forEach((input, i) => {
      input.value = roleNames[i] || "";
    });
  });
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
    emojiBtn.setAttribute('aria-label', `Rollen-Emoji für ${role.name || 'unnannte Rolle'}`);
    emojiBtn.dataset.index = roleIndex;

    const nameInput = roleDiv.querySelector('.name-role');
    nameInput.disabled = roleIndex === 13;
    nameInput.value = role.name || '';
    nameInput.setAttribute('aria-label', `Rollenname Eingabefeld für Rolle ${roleIndex}`);
    nameInput.dataset.index = roleIndex;

    const { shouldShowDelete, shouldShowStore } = updateRoleButtonsVisibility(roleIndex);



    const storeBtn = roleDiv.querySelector('.store-button');
    storeBtn.classList.toggle('hidden', true);
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
  roleChanges[index] = true;
  saveButtonHeader?.setState('dirty');
  focusNext(index);
}


function processRoleInput(index) {

  const inputElement = document.querySelector(`.name-role[data-index="${index}"]`);
  const newValue = inputElement.value.trim();
  roleFormRoles[index].name = newValue || '?';
}


function changeEmoji(index) {
  index = Number(index);
  const role = roleFormRoles[index];

  // ✅ select using data-index
  const emojiButton = document.querySelector(`.emoji-button[data-index="${index}"]`);

  const handleEmojiSelectionChange = (selectedEmoji) => {
    if (selectedEmoji) {
      role.emoji = selectedEmoji;
      markRoleAsChanged(index);
      renderRoleTable();
    } else {
      console.log(`No emoji selected for role ${role.name}.`);
    }
  };
  if (index !== 13) {
    createEmojiPicker(roleEmojis, emojiButton, index, handleEmojiSelectionChange);
  }
}

async function deleteRoleAndShowStoreButton(index) {
  roleFormRoles[index].emoji = '❓';
  roleFormRoles[index].name = "?";
  roleChanges[index] = true;
  renderRoleTable();
  await new Promise(requestAnimationFrame);
  storeRole(index);
}


async function storeRole(index) {
  const role = roleFormRoles[index];
  roleChanges[index] = false;

  const inputElement = document.querySelector(`.name-role[data-index="${index}"]`);

  const newName = inputElement.value.trim();

  role.name = newName || '?';

  await saveRoleData(api);
}

function updateRoleButtonsVisibility(index) {
  index = Number(index); // ensure numeric comparison

  if (index === 13) return { shouldShowDelete: false, shouldShowStore: false };
  const role = roleFormRoles[index];
  const name = role.name?.trim();
  const emoji = role.emoji;
  const isValidName = name !== undefined && name.trim() !== '' && name.trim() !== '?';
  const isValidEmoji = emoji !== undefined && emoji.trim() !== '' && emoji.trim() !== '⊖';

  const isChanged = roleChanges[index];
  const isNameUnique = !roleFormRoles.some((r, i) => i !== index && r.name?.trim() === name);

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
      nameInput.focus();
    } else if (!isValidEmoji) {
      emojiBtn.focus();
    }
  }
}


