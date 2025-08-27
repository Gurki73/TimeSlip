import { resetAndBind } from './bindEventListner.js';
import { initializeHelp } from '../../Components/help/help.js';

export function createHelpButton(topicId) {
    let btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Help';
    btn.setAttribute('aria-label', 'Hilfe öffnen');

    btn = resetAndBind(btn, 'click', () => {
        const container = document.getElementById('calendar');
        if (container) {
            initializeHelp(container, topicId);
        } else {
            alert(`Help requested: ${topicId}`);
        }
    });

    return btn;
}

