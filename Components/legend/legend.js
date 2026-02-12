// legend.js

import { loadRoleData } from '../../js/loader/role-loader.js';
import { loadEmployeeData, getTotalEmployeesByRole } from '../../js/loader/employee-loader.js';
import { getHolidayGreetingForToday } from '../../js/Utils/holidayUtils.js';
import { updateFeedback } from '../../js/Utils/statusbar.js';

const employeeEmojiCache = new Map(); // employee.id => NodeList
const roleEmojiCache = new Map();     // role.colorIndex => NodeList

let legendEmployees = [];
let lengendRoles = [];

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

    let roles, employees;

    try {
        [roles, employees] = await Promise.all([
            loadRoleData(api),
            loadEmployeeData(api)
        ]);
    } catch (err) {
        console.error('❌ Failed to load legend data:', err);
        return; // stop here if data failed
    }

    lengendRoles = roles;
    legendEmployees = employees;

    const roleContent = document.getElementById('legend-roles');
    const employeeContent = document.getElementById('legend-employees');

    document.addEventListener('calendar-ready', (event) => {
        rebuildEmojiCaches();
    });

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
    if (!calendarContainer) return;

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
        if (!emojisInCalendar) {
            emojisInCalendar = calendarContainer.querySelectorAll(`.emp-${employee.id}`);
            employeeEmojiCache.set(employee.id, emojisInCalendar);
        }

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
    if (!calendarContainer) return;

    lengendRoles.forEach(role => {
        if (role.emoji === "⊖" || ['keine', '?', 'name'].includes(role.name)) return;

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

        const roleName = document.createElement('span');
        roleName.classList.add('legend-name');
        roleName.innerText = role.name;

        listItem.appendChild(emoji);
        listItem.appendChild(arrow);
        listItem.appendChild(roleName);

        // --- Cache emojis for this role ---
        let emojisInCalendar = roleEmojiCache.get(role.colorIndex);
        if (!emojisInCalendar) {
            emojisInCalendar = calendarContainer.querySelectorAll(`.role-${role.colorIndex}`);
            roleEmojiCache.set(role.colorIndex, emojisInCalendar);
        }

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

