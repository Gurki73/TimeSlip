// legend.js

import { loadRoleData, roles } from '../../js/loader/role-loader.js';
import { loadEmployeeData, employees, getTotalEmployeesByRole } from '../../js/loader/employee-loader.js';
import { getHolidayGreetingForToday } from '../../js/Utils/holidayUtils.js';

document.addEventListener('DOMContentLoaded', () => {

  Promise.all([loadRoleData(), loadEmployeeData()])
    .then(() => {

      initializeLegend();
      syncCollapsibleState();
    })
    .catch((error) => {
      console.error('Error loading data:', error);
    });
});

function initializeLegend() {
  const legendContainer = document.getElementById('legend');
  if (!legendContainer) return console.error('Legend container not found');

  // Inject dynamic holiday greeting
  updateWelcomeGreeting();

  legendContainer.innerHTML = '';
  renderCollapsibleSection(legendContainer, '🎨 ⇨ Aufgaben', renderRoles);
  renderCollapsibleSection(legendContainer, '😊 ⇨ Mitarbeiter', renderEmployees);
}

function updateWelcomeGreeting() {
  const header = document.getElementById('greetingID');
  if (!header) return;
  const greeting = getHolidayGreetingForToday();
  if (greeting) {
    header.textContent = greeting;
  }
}

function syncCollapsibleState() {
  const collapsibles = document.querySelectorAll('.collapsible');

  collapsibles.forEach(collapsible => {
    if (shouldBeOpen(collapsible)) {
      collapsible.classList.add('active');
      const collapsibleContent = collapsible.nextElementSibling;
      collapsibleContent.style.display = 'block';
    } else {
      collapsible.classList.remove('active');
      const collapsibleContent = collapsible.nextElementSibling;
      collapsibleContent.style.display = 'none';
    }
  });
}

function shouldBeOpen(collapsible) {
  return collapsible === document.querySelector('.collapsible');
}

function renderCollapsibleSection(container, title, renderContentFunction) {
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

  renderContentFunction(collapsibleContent);

  container.appendChild(collapsibleButton);
  container.appendChild(collapsibleContent);

  collapsibleButton.addEventListener('click', () => {
    const isVisible = collapsibleContent.style.display === 'block';
    collapsibleContent.style.display = isVisible ? 'none' : 'block';
    collapsibleButton.classList.toggle('active', !isVisible);

    if (!isVisible && renderContentFunction) {
      renderContentFunction();
    }
  });
}


function renderRoles(container) {
  const list = document.createElement('ul');
  list.classList.add('legend-list');

  roles.forEach((role, index) => {
    if (role.emoji === "❓") return;
    if (role.name === 'keine') return;
    if (role.name === '?') return;
    if (role.name === "name") return;

    const listItem = document.createElement('li');
    listItem.classList.add('legend-item');

    const roleColor = getComputedStyle(document.documentElement)
      .getPropertyValue(`--role-${role.colorIndex}-color`);
    listItem.style.backgroundColor = roleColor;

    const emoji = document.createElement('span');
    emoji.innerText = role.emoji;
    emoji.title = role.name;

    const roleName = document.createElement('span');
    roleName.classList.add('legend-name');
    roleName.innerText = `   ⇨ ${role.name}`;

    const roleCount = getTotalEmployeesByRole(index);

    const roleCountSpan = document.createElement('span');
    roleCountSpan.classList.add('role-count');
    roleCountSpan.innerHTML = ` [${roleCount}]`;

    roleName.appendChild(roleCountSpan);

    listItem.appendChild(emoji);
    listItem.appendChild(roleName);

    list.appendChild(listItem);
  });

  container.appendChild(list);
}

function renderEmployees(container) {
  const list = document.createElement('ul');
  list.classList.add('legend-list');

  employees.forEach(employee => {
    if (employee.name === '?') return;
    if (employee.name === "name") return;

    const listItem = document.createElement('li');
    listItem.classList.add('legend-item');

    const roleColor = getComputedStyle(document.documentElement)
      .getPropertyValue(`--role-${employee.mainRoleIndex}-color`);

    listItem.style.backgroundColor = roleColor;

    const emoji = document.createElement('span');
    emoji.innerText = employee.personalEmoji;
    emoji.title = employee.name;
    emoji.style.backgroundColor = roleColor;
    const employeeName = document.createElement('span');
    employeeName.classList.add('legend-name');
    employeeName.innerText = `   ⇨ ${employee.name}`;

    listItem.appendChild(emoji);
    listItem.appendChild(employeeName);

    list.appendChild(listItem);
  });

  container.appendChild(list);
}
