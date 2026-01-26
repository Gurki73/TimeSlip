// globalWindowButtons.js
import { resetAndBind } from './bindEventListner.js';
import { toggleResize } from '../resizer.js';

export function createWindowButtons() {
    const fromContainerID = "form-container";
    // const formConatinerBottom = document.getElementById(fromContainerID);
    const formConatinerBottom = document.querySelector(".bottom-row");
    const formConatinerTop = document.getElementById("calendar");
    if (!formConatinerBottom || !formConatinerTop) console.error("no calendar and/or form container found");

    // Create container span
    const container = document.createElement('span');
    container.classList.add('window-buttons');

    // --- Minimize button ---
    let btnMin = document.createElement('button');
    btnMin.type = 'button';
    btnMin.classList.add('noto');
    btnMin.textContent = '🔽';
    btnMin.title = 'Minimieren';
    btnMin.setAttribute('aria-label', 'Formular minimieren');

    btnMin = resetAndBind(btnMin, 'click', () => {
        toggleResize("minimize");
    });

    // --- Maximize / Restore button ---
    let btnMax = document.createElement('button');
    btnMax.type = 'button';
    btnMax.classList.add('noto', 'btn-gabs');
    btnMax.textContent = '🔼'; // Could be ⬜ or other symbolic icon
    btnMax.title = 'Maximieren / Wiederherstellen';
    btnMax.setAttribute('aria-label', 'Formular maximieren');

    btnMax = resetAndBind(btnMax, 'click', () => {
        toggleResize("maximize");
    });

    // Append buttons to container
    container.appendChild(btnMin);
    container.appendChild(btnMax);

    return container;
}
