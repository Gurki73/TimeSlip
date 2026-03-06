// legend.js

import { loadRoleData } from '../../js/loader/role-loader.js';
import { loadEmployeeData, getTotalEmployeesByRole } from '../../js/loader/employee-loader.js';
import { getHolidayGreetingForToday } from '../../js/Utils/holidayUtils.js';
import { updateFeedback } from '../../js/Utils/statusbar.js';

const employeeEmojiCache = new Map(); // employee.id => NodeList
const roleEmojiCache = new Map();     // role.colorIndex => NodeList
const ROLE_LOAD_RETRIES = 3;
const ROLE_LOAD_RETRY_DELAY_MS = 220;
const ROLE_INDEX_MAX = 13;

let legendEmployees = [];
let lengendRoles = [];
let calendarReadyListenerBound = false;

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function buildFallbackRoleByIndex(colorIndex) {
    if (colorIndex === 0) return { colorIndex: '0', name: 'Keine', emoji: '🚫' };
    if (colorIndex === 13) return { colorIndex: '13', name: 'Azubi', emoji: '✏️' };
    return { colorIndex: String(colorIndex), name: `Aufgabe ${colorIndex}`, emoji: '🧩' };
}

function buildLegendFallbackRoles() {
    const roles = [];
    for (let idx = 0; idx <= ROLE_INDEX_MAX; idx++) {
        roles.push(buildFallbackRoleByIndex(idx));
    }
    return roles;
}

function normalizeLegendRoles(rawRoles) {
    if (!Array.isArray(rawRoles)) return [];

    const byIndex = new Map();
    rawRoles
        .map((role, idx) => {
            const colorIndex = Number(role?.colorIndex ?? role?.index ?? idx);
            if (!Number.isInteger(colorIndex) || colorIndex < 0) return null;

            return {
                colorIndex: String(colorIndex),
                name: String(role?.name ?? '?').trim(),
                emoji: String(role?.emoji ?? '⊖').trim()
            };
        })
        .filter(Boolean)
        .forEach((role) => {
            byIndex.set(Number(role.colorIndex), role);
        });

    const normalized = [];
    for (let idx = 0; idx <= ROLE_INDEX_MAX; idx++) {
        const role = byIndex.get(idx);
        if (!role) {
            normalized.push(buildFallbackRoleByIndex(idx));
            continue;
        }

        const hasRealName = role.name && !['?', 'name'].includes(role.name.toLowerCase());
        const hasRealEmoji = role.emoji && role.emoji !== '⊖';
        if (!hasRealName || !hasRealEmoji) {
            normalized.push({
                ...buildFallbackRoleByIndex(idx),
                name: hasRealName ? role.name : buildFallbackRoleByIndex(idx).name,
                emoji: hasRealEmoji ? role.emoji : buildFallbackRoleByIndex(idx).emoji
            });
            continue;
        }

        normalized.push(role);
    }

    return normalized;
}

async function loadLegendRoles(api) {
    let lastResult = [];

    for (let attempt = 1; attempt <= ROLE_LOAD_RETRIES; attempt++) {
        const loaded = await loadRoleData(api);
        const normalized = normalizeLegendRoles(loaded);
        lastResult = normalized;

        if (normalized.length > 0) {
            if (attempt > 1) {
                console.info(`[legend] roles loaded after retry #${attempt}`);
            }
            return normalized;
        }

        if (attempt < ROLE_LOAD_RETRIES) {
            await wait(ROLE_LOAD_RETRY_DELAY_MS);
        }
    }

    console.warn('[legend] role list is empty after retries, using fallback role set');
    updateFeedback('⚠ Aufgaben nicht lesbar. Fallback-Rollen aktiv.');
    return lastResult.length ? lastResult : buildLegendFallbackRoles();
}

export async function initializeLegend(api) {
    const legendContainer = document.getElementById('legend');
    if (!legendContainer) {
        console.error('Legend container not found');
        return;
    }

    if (!api) console.warn('⚠️ No API reference provided to initializeLegend(), using fallback');

    updateWelcomeGreeting();
    legendContainer.innerHTML = '';

    // Safe UI setup (no try/catch needed)
    renderCollapsibleSection(legendContainer, '🎨 ⇨ Aufgaben', renderRoles, 'lade Aufgaben...');
    renderCollapsibleSection(legendContainer, '😊 ⇨ Mitarbeiter', renderEmployees, 'lade Mitarbeiter...');

    let roles = [];
    let employees = [];

    try {
        roles = await loadLegendRoles(api);
    } catch (err) {
        console.error('❌ Failed to load legend roles:', err);
        roles = buildLegendFallbackRoles();
    }

    try {
        employees = await loadEmployeeData(api);
    } catch (err) {
        console.error('❌ Failed to load legend employees:', err);
        employees = [];
    }

    lengendRoles = Array.isArray(roles) ? roles : [];
    legendEmployees = Array.isArray(employees) ? employees : [];

    const roleContent = document.getElementById('legend-roles');
    const employeeContent = document.getElementById('legend-employees');

    if (!calendarReadyListenerBound) {
        document.addEventListener('calendar-ready', () => {
            rebuildEmojiCaches();
        });
        calendarReadyListenerBound = true;
    }

    renderRoles(roleContent);
    renderEmployees(employeeContent);
}

function rebuildEmojiCaches() {
    const calendarContainer = document.getElementById('calendar-month-sheet');
    if (!calendarContainer) return;

    employeeEmojiCache.clear();
    roleEmojiCache.clear();

    legendEmployees.forEach(emp => {
        const nodes = calendarContainer.querySelectorAll(`.emp-${emp.id}`);
        employeeEmojiCache.set(emp.id, nodes);
    });

    lengendRoles.forEach(role => {
        const nodes = calendarContainer.querySelectorAll(`.role-${role.colorIndex}`);
        roleEmojiCache.set(role.colorIndex, nodes);
    });

    refreshLegendItemStates();
}

function refreshLegendItemStates() {
    // Update opacity/pointer-events based on current cache
    document.querySelectorAll('#legend .legend-item').forEach(li => {
        const empId = li.dataset.empId;
        const roleIndex = li.dataset.roleIndex;
        let hasNodes = false;

        if (empId) hasNodes = employeeEmojiCache.get(empId)?.length > 0;
        if (roleIndex) hasNodes = roleEmojiCache.get(roleIndex)?.length > 0;

        if (hasNodes) {
            li.style.opacity = '1';
            li.style.pointerEvents = 'auto';
            li.style.cursor = 'pointer';
            li.title = li.dataset.title;
        } else {
            li.style.opacity = '0.35';
            li.style.pointerEvents = 'none';
            li.style.cursor = 'not-allowed';
            li.title = 'Keine Zuweisungen';
        }
    });
}

function renderCollapsibleSection(container, title, renderContentFunction, loadingText = '') {
    const collapsibleButton = document.createElement('button');
    collapsibleButton.classList.add('collapsible');

    const icon = document.createElement('span');
    icon.classList.add('collapsible-icon');
    collapsibleButton.appendChild(icon);
    collapsibleButton.title = title;

    const titleLabel = document.createElement('span');
    titleLabel.classList.add('collapsible-emoji');
    titleLabel.innerHTML = ` ${title}`;
    collapsibleButton.appendChild(titleLabel);

    const collapsibleContent = document.createElement('div');
    collapsibleContent.classList.add('collapsible-content');

    if (title.includes('Mitarbeiter')) {
        collapsibleContent.id = 'legend-employees';
    } else {
        collapsibleContent.id = 'legend-roles';
    }

    const key = `legend_${title.includes('Mitarbeiter') ? 'employees' : 'roles'}_expanded`;
    const lastState = localStorage.getItem(key);
    const isExpanded = lastState === 'true'; // stored as string
    collapsibleContent.style.display = isExpanded ? 'block' : 'none';
    collapsibleButton.classList.toggle('active', isExpanded);

    if (loadingText) {
        collapsibleContent.innerHTML = `<div class="spinner">${loadingText}</div>`;
    } else {
        renderContentFunction(collapsibleContent);
    }

    container.appendChild(collapsibleButton);
    container.appendChild(collapsibleContent);

    collapsibleButton.addEventListener('click', () => {
        const nowVisible = collapsibleContent.style.display !== 'block';
        collapsibleContent.style.display = nowVisible ? 'block' : 'none';
        collapsibleButton.classList.toggle('active', nowVisible);
        localStorage.setItem(key, String(nowVisible)); // persist

        if (nowVisible && renderContentFunction) {
            renderContentFunction(collapsibleContent);
        }
    });
}

function highlightItems(nodeList, highlightClass = 'big', duration = 4000) {
    if (!nodeList || !nodeList.length) return;

    nodeList.forEach(el => el.classList.add(highlightClass, 'highlight-pulse'));

    setTimeout(() => {
        nodeList.forEach(el => el.classList.remove(highlightClass, 'highlight-pulse'));
    }, duration);
}

export function renderEmployees(container, employeesToRender = legendEmployees) {
    if (!container) return;
    container.innerHTML = '';

    if (!employeesToRender || employeesToRender.length === 0) {
        container.innerHTML = '<div class="spinner">lade Mitarbeiter...</div>';
        return;
    }

    const list = document.createElement('ul');
    list.classList.add('legend-list');

    const calendarContainer = document.getElementById('calendar-month-sheet');

    employeesToRender.forEach(employee => {
        if (!employee.name || employee.name === '?' || employee.name === 'name' || employee.personalEmoji === '🗑️') return;

        const listItem = document.createElement('li');
        listItem.classList.add('legend-item');
        listItem.dataset.empId = employee.id;
        listItem.dataset.title = employee.name;

        const roleColor = getComputedStyle(document.body).getPropertyValue(`--role-${employee.mainRoleIndex}-color`);
        listItem.style.backgroundColor = roleColor;

        const emoji = document.createElement('span');
        emoji.innerText = employee.personalEmoji;
        emoji.title = employee.name;
        emoji.style.backgroundColor = roleColor;

        const arrow = document.createElement('span');
        arrow.classList.add('legend-arrow');
        arrow.innerText = '⇨';

        const employeeName = document.createElement('span');
        employeeName.classList.add('legend-name');
        employeeName.innerText = employee.name;

        listItem.appendChild(emoji);
        listItem.appendChild(arrow);
        listItem.appendChild(employeeName);

        // --- Cache emojis for this employee ---
        let emojisInCalendar = employeeEmojiCache.get(employee.id);
        if (!emojisInCalendar && calendarContainer) {
            emojisInCalendar = calendarContainer.querySelectorAll(`.emp-${employee.id}`);
            employeeEmojiCache.set(employee.id, emojisInCalendar);
        }
        if (!emojisInCalendar) emojisInCalendar = [];

        // --- Disable unassigned items ---
        if (!emojisInCalendar.length) {
            listItem.style.opacity = '0.2';
            listItem.style.pointerEvents = 'none';
            listItem.style.cursor = 'not-allowed';
            listItem.title = 'Keine Zuweisungen';
        }

        // --- Click handler with reusable highlight ---
        let lastClick = 0;
        listItem.addEventListener('click', () => {
            const now = Date.now();
            if (now - lastClick < 300) return; // debounce 300ms
            lastClick = now;

            highlightItems(emojisInCalendar, 'big', 4000);
        });

        list.appendChild(listItem);
    });

    container.appendChild(list);
}

export function renderRoles(container) {
    if (!container) return;
    container.innerHTML = '';

    const list = document.createElement('ul');
    list.classList.add('legend-list');

    const calendarContainer = document.getElementById('calendar-month-sheet');

    lengendRoles.forEach(role => {
        const roleName = String(role?.name || '').toLowerCase();
        if (role.emoji === "⊖" || ['keine', '?', 'name'].includes(roleName)) return;

        const listItem = document.createElement('li');
        listItem.classList.add('legend-item');
        listItem.dataset.roleIndex = role.colorIndex;
        listItem.dataset.title = role.name;

        const roleColor = getComputedStyle(document.body).getPropertyValue(`--role-${role.colorIndex}-color`);
        listItem.style.backgroundColor = roleColor;

        const emoji = document.createElement('span');
        emoji.innerText = role.emoji;
        emoji.title = role.name;

        const arrow = document.createElement('span');
        arrow.classList.add('legend-arrow');
        arrow.innerText = '⇨';

        const roleNameEl = document.createElement('span');
        roleNameEl.classList.add('legend-name');
        roleNameEl.innerText = role.name;

        listItem.appendChild(emoji);
        listItem.appendChild(arrow);
        listItem.appendChild(roleNameEl);

        // --- Cache emojis for this role ---
        let emojisInCalendar = roleEmojiCache.get(role.colorIndex);
        if (!emojisInCalendar && calendarContainer) {
            emojisInCalendar = calendarContainer.querySelectorAll(`.role-${role.colorIndex}`);
            roleEmojiCache.set(role.colorIndex, emojisInCalendar);
        }
        if (!emojisInCalendar) emojisInCalendar = [];

        // --- Disable unassigned items ---
        if (!emojisInCalendar.length) {
            listItem.style.opacity = '0.35';
            listItem.style.pointerEvents = 'none';
            listItem.style.cursor = 'not-allowed';
            listItem.title = 'Keine Zuweisungen';
        }

        // --- Click handler with reusable highlight ---
        let lastClick = 0;
        listItem.addEventListener('click', () => {
            const now = Date.now();
            if (now - lastClick < 300) return; // debounce 300ms
            lastClick = now;

            highlightItems(emojisInCalendar, 'role-big', 4000);
        });

        list.appendChild(listItem);
    });

    container.appendChild(list);
}

function updateWelcomeGreeting() {
    const header = document.getElementById('greetingID');
    if (!header) return;
    const greeting = getHolidayGreetingForToday();
    if (greeting) header.innerHTML = greeting;
}
