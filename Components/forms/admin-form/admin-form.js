// adminTools.js
import { loadEmojiData, normalizeEmojiData, saveEmojiData } from '../../../js/loader/custom-loader.js';
import { createHelpButton } from '../../../js/Utils/helpPageButton.js';
import { createWindowButtons } from '../../../js/Utils/minMaxFormComponent.js';
import { loadEmployeeData, storeEmployeeChange } from '../../../js/loader/employee-loader.js';
import { initRoleColorTab } from './colorTheme.js';

export const adminTools = [
  { id: 'color-customization', name: 'Color Customization', icon: 'cog-wheel-settings-svgrepo-com.svg', enabled: true },
  { id: 'emoji-customization', name: 'Emoji Customization', icon: 'smiley-happy-svgrepo-com.svg', enabled: true },
  { id: 'auto-save-toggle', name: 'Auto Save', icon: 'rocket-svgrepo-com.svg', enabled: true },
  { id: 'clear-cache', name: 'Clear Cache', icon: 'safe-svgrepo-com.svg', enabled: true },
  { id: 'rules-settings', name: 'Rules / Exceptions', icon: 'puzzle-piece-svgrepo-com.svg', enabled: false },
  { id: 'calendar-settings', name: 'Calendar Settings', icon: 'calendar-svgrepo-com.svg', enabled: true },
  { id: 'deleted-employees', name: 'Deleted Employees', icon: 'reshot-icon-trash-SX6L89TFAM.svg', enabled: true },
  { id: 'buy-coffee', name: 'Buy Coffee', icon: 'BuyMeACoffee.png', enabled: true }
];

let adminApi;

export async function initializeAdminForm(api) {
  const toolGrid = document.getElementById('tool-grid');
  if (!toolGrid) return console.error('❌ Tool grid not found');

  adminApi = api;
  toolGrid.innerHTML = '';

  // Build admin tiles
  adminTools.forEach(tool => {
    const btn = document.createElement('div');
    btn.className = `tool-btn${tool.enabled ? '' : ' disabled'}`;
    btn.id = tool.id;

    const img = document.createElement('img');
    img.src = `./assets/svg/${tool.icon}`;
    img.onerror = () => (img.src = `./assets/png/${tool.icon}`);
    btn.append(img);

    const span = document.createElement('span');
    span.textContent = tool.name;
    btn.append(span);

    if (tool.enabled) {
      btn.addEventListener('click', () => {
        if (tool.id === 'buy-coffee') {
          api.openExternalLink('https://www.buymeacoffee.com/gurky73?amount=5');
        } else {
          loadToolPage(`${tool.id}.html`);
        }
      });
    }

    toolGrid.appendChild(btn);
  });

  // Setup auto-save toggle if exists
  const autoSaveBtn = document.getElementById('auto-save-toggle');
  const stateLabel = autoSaveBtn?.querySelector('.state-label');

  if (autoSaveBtn && stateLabel) {
    let autoSave = JSON.parse(localStorage.getItem('autoSave') || 'false');

    const update = () => {
      stateLabel.textContent = autoSave ? 'ON' : 'OFF';
      autoSaveBtn.setAttribute('aria-pressed', autoSave);
    };

    update();

    autoSaveBtn.addEventListener('click', () => {
      autoSave = !autoSave;
      localStorage.setItem('autoSave', JSON.stringify(autoSave));
      update();
      window.dispatchEvent(new CustomEvent('autoSaveChanged', { detail: { enabled: autoSave } }));
    });
  }

  // Clear cache
  const clearBtn = document.getElementById('clear-cache');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm("Clear stored data folder path? This cannot be undone.")) {
        localStorage.removeItem('clientDefinedDataFolder');
        alert('Cache cleared. Restart app to reload defaults.');
      }
    });
  }

  // Inject help divider
  const divider = document.getElementById('horizontal-divider');
  if (divider) {
    divider.innerHTML = '';
    divider.className = 'bg-admin';

    const leftGap = document.createElement('div');
    leftGap.className = 'left-gap';

    const h2 = document.createElement('h2');
    h2.id = 'role-form-title';
    h2.className = 'sr-only';
    h2.innerHTML = `<span class="noto">💻️</span> Admin Tools <span class="noto">🔨</span>`;

    const btnContainer = document.createElement('div');
    btnContainer.id = 'form-buttons';

    const helpBtn = createHelpButton('chapter-admin');

    // --- New global window buttons ---
    const windowBtns = createWindowButtons();

    btnContainer.append(helpBtn, windowBtns);

    divider.append(leftGap, h2, btnContainer);
  }
}


// ---------------------------------------------------------
// Load sub-tool pages
// ---------------------------------------------------------
async function loadToolPage(htmlFile) {
  const container = document.getElementById('form-container');
  if (!container) return;

  try {
    const res = await fetch(`./Components/forms/admin-form/tools/${htmlFile}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status);

    const html = await res.text();
    container.innerHTML = html;

    // Only initialize when needed
    if (htmlFile === 'emoji-customization.html') {
      initEmojiCustomizer();
    }
    if (htmlFile === 'color-customization.html') {
      initRoleColorTabSafe(adminApi);
    }


  } catch (err) {
    container.innerHTML = `
      <div class="tool-page">
        <h2>⚠️ Failed to load tool</h2>
        <p>Error: ${err}</p>
      </div>`;
  }
}

async function initRoleColorTabSafe(api) {
  // Wait for the table to exist
  let attempts = 0;
  while (!document.querySelector('#tab-roles') && attempts < 10) {
    await new Promise(r => setTimeout(r, 50)); // 50ms
    attempts++;
  }

  if (!document.querySelector('#tab-roles')) {
    console.warn('#tab-roles not found, skipping role color init');
    return;
  }

  await initRoleColorTab(api);
}

// ---------------------------------------------------------
// Emoji Customizer (NOW COMPLETELY SELF-INERT)
// ---------------------------------------------------------
export async function initEmojiCustomizer() {
  const loaded = await loadEmojiData(adminApi);
  const { pool, employees, roles } = normalizeEmojiData(loaded);

  let poolEmojis = [...pool];
  let employeeEmojis = [...employees];
  let roleEmojis = [...roles];

  // DOM refs
  const employeeGrid = document.getElementById('employee-grid');
  const poolGrid = document.getElementById('pool-grid');
  const roleGrid = document.getElementById('role-grid');
  const addBtn = document.getElementById('add-emoji-btn');
  const helpBtn = document.querySelector('.header button[title="Hilfe"]');
  const saveBtn = document.querySelector('.header button[title="speichern"]');
  const helpOverlay = document.getElementById('emoji-help-overlay');
  const helpClose = document.getElementById('emoji-help-close');

  if (!employeeGrid || !poolGrid || !roleGrid) {
    console.error("Emoji grids missing in DOM");
    return;
  }

  let lastFocusedEmoji = null;

  /* ------------------ Deduplicate ------------------ */
  function dedupe() {
    const used = new Set([...employeeEmojis, ...roleEmojis]);
    poolEmojis = poolEmojis.filter(e => !used.has(e));
  }

  /* ------------------ Rendering ------------------ */
  function renderGrid(grid, data) {
    grid.innerHTML = "";

    data.forEach((e, i) => {
      const div = document.createElement("div");
      div.className = "emoji-customizer-emoji noto";
      div.textContent = e;
      div.tabIndex = 0;

      div.dataset.index = i;
      div.dataset.emoji = e;

      div.setAttribute("role", "button");
      div.setAttribute("aria-label", `Emoji ${e}`);

      grid.appendChild(div);
    });
  }

  function renderAll() {
    dedupe();
    renderGrid(poolGrid, poolEmojis);
    renderGrid(employeeGrid, employeeEmojis);
    renderGrid(roleGrid, roleEmojis);

    // Restore focus
    if (lastFocusedEmoji) {
      const match = document.querySelector(`[data-emoji="${lastFocusedEmoji}"]`);
      if (match) match.focus();
    }
  }

  renderAll();

  /* ------------------ Moving logic ------------------ */
  function moveEmojiTo(destination, emoji) {
    lastFocusedEmoji = emoji;

    // Remove from all
    poolEmojis = poolEmojis.filter(v => v !== emoji);
    employeeEmojis = employeeEmojis.filter(v => v !== emoji);
    roleEmojis = roleEmojis.filter(v => v !== emoji);

    if (destination === "employee") {
      if (employeeEmojis.length >= 54) return alert("Max 54 Mitarbeiter-Emojis!");
      employeeEmojis.push(emoji);
    }
    if (destination === "role") {
      if (roleEmojis.length >= 54) return alert("Max 54 Aufgaben-Emojis!");
      roleEmojis.push(emoji);
    }
    if (destination === "pool") {
      poolEmojis.push(emoji);
    }

    renderAll();
  }

  /* ------------------ MOUSE BEHAVIOR ------------------ */

  // Pool: left → employee
  poolGrid.addEventListener("click", (e) => {
    if (!e.target.classList.contains("emoji-customizer-emoji")) return;
    moveEmojiTo("employee", e.target.textContent);
  });

  // Pool: right → role
  poolGrid.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (!e.target.classList.contains("emoji-customizer-emoji")) return;
    moveEmojiTo("role", e.target.textContent);
  });

  // Employees / Roles: click → back to pool
  [employeeGrid, roleGrid].forEach((grid) => {
    grid.addEventListener("click", (e) => {
      if (!e.target.classList.contains("emoji-customizer-emoji")) return;
      moveEmojiTo("pool", e.target.textContent);
    });
  });

  /* ------------------ KEYBOARD NAVIGATION ------------------ */
  function handleArrowNav(e) {
    const el = e.target;
    if (!el.classList.contains("emoji-customizer-emoji")) return;

    const grid = el.parentElement;
    const emojis = [...grid.querySelectorAll(".emoji-customizer-emoji")];
    const index = emojis.indexOf(el);

    const cols = grid.id === "pool-grid" ? Math.floor(grid.clientWidth / 28) : 6;
    let newIndex = index;

    switch (e.key) {
      case "ArrowRight": newIndex = index + 1; break;
      case "ArrowLeft": newIndex = index - 1; break;
      case "ArrowDown": newIndex = index + cols; break;
      case "ArrowUp": newIndex = index - cols; break;
      case "Enter":
        lastFocusedEmoji = el.dataset.emoji;

        if (grid === poolGrid) moveEmojiTo("employee", el.textContent);
        else moveEmojiTo("pool", el.textContent);

        return;
      default:
        return;
    }

    if (newIndex >= 0 && newIndex < emojis.length) {
      emojis[newIndex].focus();
      lastFocusedEmoji = emojis[newIndex].dataset.emoji;
    }
  }

  document.addEventListener("keydown", handleArrowNav);

  /* ------------------ ADD CUSTOM EMOJI ------------------ */
  addBtn.addEventListener("click", () => {
    const userInput = prompt("Eigenes Emoji einfügen:");
    if (!userInput) return;

    const emoji = [...userInput.trim()][0]; // sanitize, take first emoji

    if (!emoji) return;

    if (!loaded.categories.custom)
      loaded.categories.custom = [];

    loaded.categories.custom.push(emoji);
    poolEmojis.push(emoji);

    lastFocusedEmoji = emoji;
    renderAll();
  });

  /* ------------------ SAVE BUTTON ------------------ */
  saveBtn.addEventListener("click", () => {
    saveEmojiData(adminApi, {
      categories: loaded.categories,
      employees: employeeEmojis,
      roles: roleEmojis
    });
    alert("Emojis gespeichert!");
  });

  /* ------------------ HELP OVERLAY ------------------ */
  helpBtn.addEventListener("click", () => {
    helpOverlay.classList.add("active");
  });

  // helpClose.addEventListener("click", () => {
  //   helpOverlay.classList.remove("active");
  // });
}


/*

  R E V I V I N G   -  E M P L O Y E E

*/

let apiRef = null;
let deletedEmployees = []; // local cache (only deleted ones)
let emojiPool = []; // source emojis to pick from

export async function initDeletedEmployees(api) {
  apiRef = api;
  // load emoji pool & employees concurrently
  try {
    const [loadedEmoji, loadedEmps] = await Promise.all([
      loadEmojiData(apiRef).catch(err => {
        console.warn('Failed to load emoji data, fallback to basic set', err);
        return { categories: {}, pool: [] };
      }),
      loadEmployeeData(apiRef)
    ]);

    const normalized = normalizeEmojiData ? normalizeEmojiData(loadedEmoji) : { pool: (loadedEmoji.pool || []), employees: [], roles: [] };
    emojiPool = normalized.pool || [];

    // filter deleted employees (emoji === '🗑️')
    deletedEmployees = (loadedEmps || []).filter(e => e.personalEmoji === '🗑️');

    // Sort by nearest endDate to oldest (null/invalid dates go to end)
    deletedEmployees.sort((a, b) => {
      const aDate = a.endDate ? new Date(a.endDate) : new Date(8640000000000000);
      const bDate = b.endDate ? new Date(b.endDate) : new Date(8640000000000000000);
      return aDate - bDate;
    });

    renderDeletedList();
    attachControls();
  } catch (err) {
    console.error('initDeletedEmployees error', err);
    alert('Fehler beim Laden der gelöschten Mitarbeiter');
  }
}

/* ---------- Rendering ---------- */
function renderDeletedList() {
  const list = document.getElementById('deleted-list');
  if (!list) return console.error('deleted-list not found');
  list.innerHTML = '';

  deletedEmployees.forEach(emp => {
    const li = document.createElement('li');
    li.className = 'deleted-item';
    li.dataset.id = emp.id;

    // checkbox
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'select-cb';
    cb.title = 'Select for bulk restore';

    // id small
    const idSpan = document.createElement('div');
    idSpan.className = 'id';
    idSpan.textContent = String(emp.id).slice(-6); // concise

    // emoji button (click opens picker)
    const emojiBtn = document.createElement('button');
    emojiBtn.className = 'emoji-btn';
    emojiBtn.type = 'button';
    emojiBtn.title = 'Click to pick emoji';
    emojiBtn.innerHTML = `<span class="preview-emoji noto">${emp.personalEmoji}</span>`;

    // name + optional info
    const nameSpan = document.createElement('div');
    nameSpan.className = 'name';
    nameSpan.textContent = emp.name || '(no name)';

    const roleSpan = document.createElement('div');
    roleSpan.className = 'role';
    roleSpan.textContent = emp.mainRoleIndex != null ? `#${emp.mainRoleIndex}` : '';

    const endSpan = document.createElement('div');
    endSpan.className = 'end';
    endSpan.textContent = emp.endDate || '';

    // actions
    const actions = document.createElement('div');
    actions.className = 'actions';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-btn';
    saveBtn.textContent = 'Save';
    saveBtn.style.display = 'none'; // only visible after emoji selected

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.display = 'none';

    actions.append(saveBtn, cancelBtn);

    // Append elements
    li.appendChild(cb);
    li.appendChild(idSpan);
    li.appendChild(emojiBtn);
    li.appendChild(nameSpan);
    li.appendChild(roleSpan);
    li.appendChild(endSpan);
    li.appendChild(actions);

    // Interaction: open emoji picker anchored to emojiBtn
    emojiBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      createEmojiPicker(emojiPool, emojiBtn, emp.mainRoleIndex || 1, (chosenEmoji) => {
        if (!chosenEmoji) {
          // canceled
          saveBtn.style.display = 'none';
          cancelBtn.style.display = 'none';
          // restore preview to trash
          li.querySelector('.preview-emoji').textContent = emp.personalEmoji;
          return;
        }
        // set preview and show Save
        li.querySelector('.preview-emoji').textContent = chosenEmoji;
        saveBtn.style.display = '';
        cancelBtn.style.display = '';
        // attach chosen to dataset for later save
        li.dataset.chosenEmoji = chosenEmoji;
      });
    });

    // Cancel selection: revert preview
    cancelBtn.addEventListener('click', () => {
      li.querySelector('.preview-emoji').textContent = emp.personalEmoji;
      saveBtn.style.display = 'none';
      cancelBtn.style.display = 'none';
      delete li.dataset.chosenEmoji;
    });

    // Save: update only personalEmoji and endDate (+10 years)
    saveBtn.addEventListener('click', async () => {
      const chosen = li.dataset.chosenEmoji;
      if (!chosen) return alert('No emoji selected.');

      // compute new endDate = today + 10 years
      const newEnd = computeDatePlusYearsISO(10);

      // create shallow copy to send to storeEmployeeChange
      const updated = { ...emp, personalEmoji: chosen, endDate: newEnd };

      try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        await storeEmployeeChange(apiRef, updated, 'update');
        // update local cache row
        emp.personalEmoji = chosen;
        emp.endDate = newEnd;
        // remove from deletedEmployees (restored)
        deletedEmployees = deletedEmployees.filter(e => String(e.id) !== String(emp.id));
        renderDeletedList();
        alert(`Employee ${emp.name} restored.`);
      } catch (err) {
        console.error('Save failed', err);
        alert('Fehler beim Speichern. Schau in die Konsole.');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save';
      }
    });

    list.appendChild(li);
  });

  // If none, show empty placeholder
  if (deletedEmployees.length === 0) {
    const placeholder = document.createElement('li');
    placeholder.className = 'deleted-item';
    placeholder.textContent = 'Keine gelöschten Mitarbeiter gefunden.';
    list.appendChild(placeholder);
  }
}

/* ---------- Controls ---------- */
function attachControls() {
  const refresh = document.getElementById('refresh-deleted');
  const selectAllBtn = document.getElementById('select-all-toggle');
  const restoreSelectedBtn = document.getElementById('restore-selected');

  refresh?.addEventListener('click', async () => {
    await refreshList();
  });

  selectAllBtn?.addEventListener('click', () => {
    const boxes = Array.from(document.querySelectorAll('#deleted-list .select-cb'));
    const anyUnchecked = boxes.some(b => !b.checked);
    boxes.forEach(b => b.checked = anyUnchecked);
    selectAllBtn.textContent = anyUnchecked ? 'Unselect all' : 'Select all';
  });

  restoreSelectedBtn?.addEventListener('click', async () => {
    const selectedBoxes = Array.from(document.querySelectorAll('#deleted-list .select-cb:checked'));
    if (selectedBoxes.length === 0) return alert('Keine Mitarbeiter ausgewählt.');

    // ask user to pick emoji once to apply to all selected
    // anchor to restoreSelectedBtn
    createEmojiPicker(emojiPool, restoreSelectedBtn, 1, async (chosenEmoji) => {
      if (!chosenEmoji) return; // cancelled
      if (!confirm(`Restore ${selectedBoxes.length} employees with emoji "${chosenEmoji}"?`)) return;

      // Batch save
      restoreSelectedBtn.disabled = true;
      restoreSelectedBtn.textContent = 'Saving...';

      const toRestore = selectedBoxes.map(cb => {
        const li = cb.closest('.deleted-item');
        const id = li?.dataset?.id;
        return deletedEmployees.find(e => String(e.id) === String(id));
      }).filter(Boolean);

      try {
        for (const emp of toRestore) {
          const updated = { ...emp, personalEmoji: chosenEmoji, endDate: computeDatePlusYearsISO(10) };
          // sequential saves are safer to avoid race with your save routine; you can parallelize if desired
          // eslint-disable-next-line no-await-in-loop
          await storeEmployeeChange(apiRef, updated, 'update');
        }
        // refresh local cache & UI
        await refreshList();
        alert(`${toRestore.length} Mitarbeiter erfolgreich wiederhergestellt.`);
      } catch (err) {
        console.error('Bulk restore failed', err);
        alert('Fehler beim Bulk-Restore. Siehe Konsole.');
      } finally {
        restoreSelectedBtn.disabled = false;
        restoreSelectedBtn.textContent = '🔄 Restore selected';
      }
    });
  });
}

async function refreshList() {
  try {
    const all = await loadEmployeeData(apiRef) || [];
    deletedEmployees = all.filter(e => e.personalEmoji === '🗑️');
    deletedEmployees.sort((a, b) => {
      const aDate = a.endDate ? new Date(a.endDate) : new Date(8640000000000000);
      const bDate = b.endDate ? new Date(b.endDate) : new Date(8640000000000000);
      return aDate - bDate;
    });
    renderDeletedList();
  } catch (err) {
    console.error('refreshList error', err);
  }
}

/* ---------- Utilities ---------- */
function computeDatePlusYearsISO(years) {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split('T')[0];
}

/* ---------- Emoji Picker (integrated) ---------- */
/* Use your createEmojiPicker function (slightly adapted to use callback) */
export function createEmojiPicker(emojiArray, targetButton, colorIndex = 1, callback) {
  const existingPicker = document.querySelector('.emoji-picker');
  if (existingPicker) existingPicker.remove();

  if (!emojiArray?.length) {
    console.warn('Emoji array is invalid or empty');
    return;
  }

  // Grid size (square-ish)
  let n = 0;
  while (n * n < emojiArray.length) n++;
  const emojiPickerRow = n, emojiPickerCol = n;

  const emojiPicker = document.createElement('div');
  emojiPicker.classList.add('emoji-picker', 'emoji-picker-container');
  emojiPicker.style.position = 'absolute';
  emojiPicker.style.zIndex = 99999;
  emojiPicker.style.minWidth = '220px';
  emojiPicker.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)';
  emojiPicker.style.background = '#fff';
  emojiPicker.style.borderRadius = '8px';
  emojiPicker.style.padding = '8px';

  const topBarWrapper = document.createElement('div');
  topBarWrapper.classList.add('top-bar-wrapper', 'emoji-picker-top-bar-wrapper');
  topBarWrapper.setAttribute('data-index', colorIndex);

  const topBar = document.createElement('div');
  topBar.classList.add('top-bar', 'emoji-picker-top-bar');
  topBar.textContent = 'bitte ein neues Emoji auswählen';

  // compute fallback color:
  let topBarColor = getComputedStyle(document.documentElement).getPropertyValue(`--role-${colorIndex}-color`)?.trim();
  if (!topBarColor || topBarColor === '#fff' || topBarColor === 'rgb(255, 255, 255)') topBarColor = 'cornflowerblue';
  topBarWrapper.style.backgroundColor = topBarColor;
  topBarWrapper.style.padding = '6px';
  topBarWrapper.style.borderRadius = '6px';
  topBarWrapper.style.marginBottom = '6px';
  topBarWrapper.style.display = 'flex';
  topBarWrapper.style.justifyContent = 'space-between';
  topBarWrapper.style.alignItems = 'center';
  topBarWrapper.style.color = getContrastYIQ(topBarColor);

  const closeButton = document.createElement('button');
  closeButton.setAttribute('tabindex', '0');
  closeButton.setAttribute('aria-label', 'Exit emoji picker');
  closeButton.classList.add('close-btn', 'emoji-picker-close-btn', 'noto');
  closeButton.textContent = '×';
  closeButton.style.background = 'transparent';
  closeButton.style.border = 'none';
  closeButton.style.cursor = 'pointer';
  closeButton.style.fontSize = '18px';
  closeButton.style.color = getContrastYIQ(topBarColor);
  closeButton.onclick = () => {
    callback(null);
    emojiPicker.remove();
  };

  topBar.appendChild(closeButton);
  topBarWrapper.appendChild(topBar);
  emojiPicker.appendChild(topBarWrapper);

  const emojiGrid = document.createElement('div');
  emojiGrid.classList.add('emoji-grid', 'emoji-picker-grid');
  emojiGrid.style.display = 'grid';
  emojiGrid.style.gridTemplateColumns = `repeat(${Math.min(8, emojiPickerCol)}, 1fr)`;
  emojiGrid.style.gap = '6px';
  emojiGrid.style.maxHeight = '36vh';
  emojiGrid.style.overflow = 'auto';
  emojiGrid.style.padding = '6px';

  let emojiIndex = 0;
  for (let row = 0; row < emojiPickerRow; row++) {
    for (let col = 0; col < emojiPickerCol; col++) {
      const emoji = emojiArray[emojiIndex++];
      if (!emoji) break;

      const emojiButton = document.createElement('div');
      emojiButton.classList.add('emoji', 'emoji-picker-emoji', `row-${row}`, `col-${col}`, 'noto');
      emojiButton.textContent = emoji;
      emojiButton.setAttribute('tabindex', '0');
      emojiButton.setAttribute('role', 'button');
      emojiButton.setAttribute('aria-label', `Emoji ${emoji}`);
      emojiButton.style.fontSize = '18px';
      emojiButton.style.padding = '6px';
      emojiButton.style.borderRadius = '6px';
      emojiButton.style.cursor = 'pointer';
      emojiButton.style.textAlign = 'center';
      emojiButton.style.userSelect = 'none';
      emojiButton.style.border = '1px solid transparent';

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

  // Position picker near targetButton (try below, fallback to center)
  const rect = targetButton.getBoundingClientRect();
  const top = rect.bottom + window.scrollY + 6;
  const left = Math.max(8, rect.left + window.scrollX - 80);
  emojiPicker.style.top = `${top}px`;
  emojiPicker.style.left = `${left}px`;

  document.body.appendChild(emojiPicker);

  setTimeout(() => {
    const firstEmoji = emojiPicker.querySelector('.emoji-picker-emoji');
    (firstEmoji || closeButton).focus();
  }, 0);

  // close on outside click
  setTimeout(() => {
    const onOutside = (ev) => {
      if (!emojiPicker.contains(ev.target)) {
        callback(null);
        emojiPicker.remove();
        document.removeEventListener('click', onOutside);
      }
    };
    document.addEventListener('click', onOutside);
  }, 0);
}

function handleEmojiSelection(emoji, pickerElement, callback) {
  callback(emoji);
  pickerElement.remove();
}

function getContrastYIQ(hexcolor) {
  hexcolor = hexcolor.replace('#', '');
  // if rgb(...) passed, return black by default
  if (hexcolor.indexOf('rgb') === 0) return 'black';
  const r = parseInt(hexcolor.substr(0, 2), 16) || 0;
  const g = parseInt(hexcolor.substr(2, 2), 16) || 0;
  const b = parseInt(hexcolor.substr(4, 2), 16) || 0;
  return ((r * 299 + g * 587 + b * 114) / 1000) > 128 ? 'black' : 'white';
}
