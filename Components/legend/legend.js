// legend.js

import { loadRoleData } from '../../js/loader/role-loader.js';
import { loadEmployeeData, getTotalEmployeesByRole } from '../../js/loader/employee-loader.js';
import { getHolidayGreetingForToday } from '../../js/Utils/holidayUtils.js';
import { updateFeedback } from '../../js/Utils/statusbar.js';

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

    // Safe DOM + rendering logic
    lengendRoles = roles;
    legendEmployees = employees;

    const roleContent = document.getElementById('legend-roles');
    const employeeContent = document.getElementById('legend-employees');

    renderRoles(roleContent);
    renderEmployees(employeeContent);
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

    // ✅ Add unique ID for easy selection later
    if (title.includes('Mitarbeiter')) {
        collapsibleContent.id = 'legend-employees';
    } else {
        collapsibleContent.id = 'legend-roles';
    }

    // 🔹 Generate a safe localStorage key based on title
    const key = `legend_${title.includes('Mitarbeiter') ? 'employees' : 'roles'}_expanded`;

    // 🔹 Restore last state
    const lastState = localStorage.getItem(key);
    const isExpanded = lastState === 'true'; // stored as string
    collapsibleContent.style.display = isExpanded ? 'block' : 'none';
    collapsibleButton.classList.toggle('active', isExpanded);

    // 🌀 Show spinner / loading placeholder
    if (loadingText) {
        collapsibleContent.innerHTML = `<div class="spinner">${loadingText}</div>`;
    } else {
        renderContentFunction(collapsibleContent);
    }

    // Attach to container
    container.appendChild(collapsibleButton);
    container.appendChild(collapsibleContent);

    // 🔹 Handle click toggle
    collapsibleButton.addEventListener('click', () => {
        const nowVisible = collapsibleContent.style.display !== 'block';
        collapsibleContent.style.display = nowVisible ? 'block' : 'none';
        collapsibleButton.classList.toggle('active', nowVisible);
        localStorage.setItem(key, String(nowVisible)); // persist

        // Re-render content when expanded (optional)
        if (nowVisible && renderContentFunction) {
            renderContentFunction(collapsibleContent);
        }
    });
}

export function renderEmployees(container, employeesToRender = legendEmployees) {
    if (!container) return;

    if (!employeesToRender || employeesToRender.length === 0) {
        container.innerHTML = '<div class="spinner">lade Mitarbeiter...</div>';
        return;
    }

    const list = document.createElement('ul');
    list.classList.add('legend-list');

    const calendarContainer = document.getElementById('calendar-month-sheet');
    let highlightTimeout;
    let lastClick = 0;

    employeesToRender.forEach(employee => {
        if (!employee.name ||
            employee.name === '?' ||
            employee.name === 'name' ||
            employee.personalEmoji === '🚮'
        ) return;

        const listItem = document.createElement('li');
        listItem.classList.add('legend-item');

        const roleColor = getComputedStyle(document.body)
            .getPropertyValue(`--role-${employee.mainRoleIndex}-color`);

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

        listItem.addEventListener('click', () => {
            const now = Date.now();
            if (now - lastClick < 4000) return; // debounce 4s
            lastClick = now;

            if (!calendarContainer) return; // help page open etc.

            clearTimeout(highlightTimeout);
            document.querySelectorAll('.calendar-emoji.big').forEach(el => {
                el.classList.remove('big');
                el.classList.add('small');
            });

            const emojis = calendarContainer.querySelectorAll(`.emp-${employee.id}`);
            emojis.forEach(el => {
                el.classList.remove('small');
                el.classList.add('big');
                el.classList.add('highlight-pulse'); // optional blink effect
            });

            highlightTimeout = setTimeout(() => {
                emojis.forEach(el => {
                    el.classList.remove('big', 'highlight-pulse');
                    el.classList.add('small');
                });
            }, 4000);
        });

        list.appendChild(listItem);
    });

    container.innerHTML = '';
    container.appendChild(list);
}

function renderRoles(container) {
    if (!container) return;

    const list = document.createElement('ul');
    list.classList.add('legend-list');

    const calendarContainer = document.getElementById('calendar-month-sheet');
    let highlightTimeout;
    let lastClick = 0;

    lengendRoles.forEach((role, index) => {
        if (role.emoji === "❓" || ['keine', '?', 'name'].includes(role.name)) return;

        const listItem = document.createElement('li');
        listItem.classList.add('legend-item');

        const roleColor = getComputedStyle(document.body)
            .getPropertyValue(`--role-${role.colorIndex}-color`);

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

        // 🧠 Click handler — highlight all calendar spans for this role
        listItem.addEventListener('click', () => {
            const now = Date.now();
            if (now - lastClick < 4000) return; // debounce 4s
            lastClick = now;

            if (!calendarContainer) return;

            clearTimeout(highlightTimeout);
            // Reset any previous highlights
            calendarContainer.querySelectorAll('.calendar-emoji.role-big').forEach(el => {
                el.classList.remove('role-big', 'highlight-pulse');
            });

            // Highlight all emojis that share this role
            const roleIndex = role.colorIndex;
            const emojis = calendarContainer.querySelectorAll(`.role-${roleIndex}`);
            emojis.forEach(el => {
                el.classList.add('role-big', 'highlight-pulse',);
            });

            // Auto-reset after 4s
            highlightTimeout = setTimeout(() => {
                emojis.forEach(el => el.classList.remove('role-big', 'highlight-pulse'));
            }, 4000);
        });

        list.appendChild(listItem);
    });

    container.innerHTML = '';
    container.appendChild(list);
}


function updateWelcomeGreeting() {
    const header = document.getElementById('greetingID');
    if (!header) return;
    const greeting = getHolidayGreetingForToday();
    if (greeting) header.innerHTML = greeting;
}

