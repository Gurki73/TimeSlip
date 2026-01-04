import { resetAndBind } from './bindEventListner.js';
import { initializeHelp } from '../../Components/help/help.js';

const chapterNames = {
    "chapter-intro": "Einführung",
    "chapter-overview": "Allgemeiner Überblick",
    "chapter-calendar": "Kalender anpassen",
    "chapter-roles": "Rollen definieren",
    "chapter-employees": "Mitarbeiter & Spitznamen",
    "chapter-rules": "Regelwerk festlegen",
    "chapter-requests": "Urlaubsanfrage stellen",
    "chapter-admin": "Admin-Werkzeuge"
};

export function createHelpButton(topicId) {
    const topicName = chapterNames[topicId] || "Formular"; // fallback

    let btn = document.createElement('button');
    btn.type = 'button';
    btn.classList.add("noto");
    btn.textContent = '❓';
    btn.title = `Hilfe zum ${topicName}`;
    btn.setAttribute('aria-label', `Hilfe öffnen für ${topicName}`);

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


