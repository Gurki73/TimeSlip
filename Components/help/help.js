import { loadCalendarIntoContainer } from '../../js/renderer.js'
import { resetAndBind } from '../../js/Utils/bindEventListner.js';

const helpRoles = [
    // 0 - Special: no assignment
    { roleIndex: 0, roleName: "", colorVar: "--role-0-color" },                        // No role / unassigned (transparent)

    // 1–3 → Kitchen roles (Blue)
    { roleIndex: 1, roleName: "Koch", colorVar: "--role-1-color" },                    // Kitchen staff
    { roleIndex: 2, roleName: "Spüler", colorVar: "--role-2-color" },                  // Cleaning / Dish / Busboy

    // 4–6 → Front roles (Green)
    { roleIndex: 4, roleName: "Kellner", colorVar: "--role-4-color" },                 // Waitstaff / Service
    { roleIndex: 5, roleName: "Barkeeper", colorVar: "--role-5-color" },               // Drinks / Social Anchor
    { roleIndex: 6, roleName: "Lieferfahrer", colorVar: "--role-6-color" },            // Delivery / Driver

    // 7–8 → Admin roles (Red)
    { roleIndex: 7, roleName: "Einkauf", colorVar: "--role-7-color" },                 // Stock / Procurement
    { roleIndex: 8, roleName: "Manager", colorVar: "--role-8-color" },                 // Admin / Planning / Office
    { roleIndex: 9, roleName: "Empfang", colorVar: "--role-9-color" },
    // 9–12 → "Non-employees" (Grey/Black)
    { roleIndex: 10, roleName: "Großmutter", colorVar: "--role-10-color" },            // Family / Legacy role
    { roleIndex: 11, roleName: "Stammgast", colorVar: "--role-11-color" },             // Regular (used in tutorial only)
    { roleIndex: 12, roleName: "Studentin", colorVar: "--role-12-color" },             // Intern / Newcomer role

    { roleIndex: 13, roleName: "Azubi", colorVar: "--role-13-color" },                  // Apprentice (fixed index!)
];


const helpEmployees = [
    { emoji: "🐸", name: "Tiana", nickname: "Tia", roles: [8, 2, 4] },
    { emoji: "🛁", name: "Jubaba", nickname: "Jubaba", roles: [8, 1, 9, 10] },
    { emoji: "🏠", name: "Kevin", nickname: "Kevin", roles: [2, 6] },
    { emoji: "🧽", name: "BobAzubi", nickname: "Bob (Azubi)", roles: [13, 1, 9] },
    { emoji: "🐝", name: "BigBee", nickname: "BigBee", roles: [13, 8, 7] },
    { emoji: "🚀", name: "Fry", nickname: "Fry", roles: [6, 4, 5] },
    { emoji: "🧹", name: "Kiky", nickname: "Kiky", roles: [6, 4, 2] },
    { emoji: "🍜", name: "Grobi", nickname: "Grobi", roles: [4] },
    { emoji: "🐀", name: "Remi", nickname: "Remi", roles: [2, 1] },
    { emoji: "💀", name: "Weasel", nickname: "Weasel", roles: [5, 4, 7] },
    { emoji: "🤖", name: "Walle", nickname: "Walle", roles: [2, 7] },
    { emoji: "👒", name: "Sanji", nickname: "Sanji", roles: [4, 1, 5] },
    { emoji: "🐕", name: "Stromberg", nickname: "Stromberg", roles: [9, 8, 4] },
    { emoji: "🍄", name: "Joel", nickname: "Joel", roles: [4, 1, 2] },
    { emoji: "🍔", name: "BobStellvertrter", nickname: "Bob", roles: [9, 1, 4] },
    { emoji: "👟", name: "Al", nickname: "Al", roles: [4, 5, 6] },
    { emoji: "⛓️", name: "Filch", nickname: "Filch", roles: [2, 6, 4] },
    { emoji: "🌋", name: "Ramsey", nickname: "Ramsey", roles: [1] },
    { emoji: "🧁", name: "Step", nickname: "Step", roles: [4, 9, 5] },
    { emoji: "🚁", name: "Heli", nickname: "Heli", roles: [7, 2, 5] },
];


const HELP_CHAPTERS = {
    intro: { title: "Einführung", color: "welcome" },
    calendar: { title: "Öffnungszeiten", color: "calendar" },
    roles: { title: "Aufgaben", color: "tasks" },
    employees: { title: "Mitarbeiter", color: "employee" },
    rules: { title: "Regelwerk", color: "rules" },
    requests: { title: "Urlaubsanträge", color: "request" },
    admin: { title: "Werkzeuge", color: "admin" },
    glossar: { title: "Glossar", color: "calendar" }
};

export async function initializeHelp(container, topicId = 'intro') {
    if (!container) return;

    try {
        const response = await fetch('Components/help/help.html');
        if (!response.ok) throw new Error('Failed to load help page');

        const html = await response.text();
        container.innerHTML = html;

        // Initialize any JS logic for TOC, collapsibles, etc.
        initEventListener();
        initHelpCollapse();
        initTOCScroll();
        focusFirstTOCEntry();

        if (topicId) {
            const target = container.querySelector(`#${topicId}`);
            if (target) target.scrollIntoView({ behavior: 'smooth' });
        }

    } catch (err) {
        console.error('Error loading help page:', err);
        container.innerHTML = `<p>Unable to load help page.</p>`;
    }

    document.querySelectorAll('[data-help-toggle]').forEach(btn => {
        const contentId = btn.getAttribute('aria-controls');
        const content = document.getElementById(contentId);
        if (!content) return;

        btn.setAttribute('aria-expanded', 'false');
        content.style.display = 'block';
        content.classList.remove('helpChapterHidden');
    });

}

function focusFirstTOCEntry() {
    const firstLink = document.querySelector("#help-toc a");
    if (firstLink) {
        firstLink.focus();
    } else {
        console.warn("⚠️ No TOC link found.");
    }
}

function initHelpCollapse() {
    document.querySelectorAll('[data-help-toggle]').forEach(button => {
        if (button.dataset.bound) return;
        button.dataset.bound = 'true';

        const contentId = button.getAttribute('aria-controls');
        const content = document.getElementById(contentId);
        if (!content) return;

        // default: collapsed
        const expanded = false;
        button.setAttribute('aria-expanded', expanded);
        content.hidden = !expanded;
        content.classList.toggle('helpChapterHidden', !expanded);

        const chapterLoading = new Set();

        button.addEventListener('click', async () => {
            const chapterName = button.dataset.chapter;
            const isExpanded = button.getAttribute('aria-expanded') === 'true';
            const newExpanded = !isExpanded;

            button.setAttribute('aria-expanded', newExpanded);
            content.hidden = !newExpanded;
            content.classList.toggle('helpChapterHidden', !newExpanded);

            localStorage.setItem(`helpCollapse_${contentId}`, newExpanded);

            if (newExpanded && chapterName && !loadedChapters.has(chapterName)) {
                if (chapterLoading.has(chapterName)) return;

                chapterLoading.add(chapterName);
                document.body.style.cursor = 'wait';

                await ensureChapterLoaded(chapterName);

                chapterLoading.delete(chapterName);
                document.body.style.cursor = 'default';
            }
        });
    });
}


function expandChapterBySectionId(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    const toggleButton = section.querySelector('[data-help-toggle]');
    if (!toggleButton) return;

    const contentId = toggleButton.getAttribute('aria-controls');
    const content = document.getElementById(contentId);
    if (!content) return;

    toggleButton.setAttribute('aria-expanded', 'true');

    content.style.display = 'block';
}

function initTOCScroll() {
    const controlBar = document.getElementById('help-controlbar');
    const scrollContainer = document.getElementById('help-scroll-container') || window;

    document.querySelectorAll('#help-toc a').forEach(link => {
        link.addEventListener('click', async e => {
            e.preventDefault();

            const targetId = link.getAttribute('href').substring(1);
            const target = document.getElementById(targetId);
            if (!target) return;

            // Hide control bar
            controlBar?.classList.add('is-hidden');

            // Expand chapter immediately
            expandChapterBySectionId(targetId);

            // Scroll with offset
            const y =
                target.getBoundingClientRect().top +
                window.pageYOffset -
                controlBar.offsetHeight;

            window.scrollTo({
                top: y,
                behavior: 'smooth'
            });

            // Restore bar on next user scroll
            const restore = () => {
                controlBar?.classList.remove('is-hidden');
                window.removeEventListener('wheel', restore, { passive: true });
                window.removeEventListener('touchstart', restore);
                window.removeEventListener('keydown', restore);
            };

            window.addEventListener('wheel', restore, { passive: true });
            window.addEventListener('touchstart', restore);
            window.addEventListener('keydown', restore);
        });
    });
}

function highlightCurrentChapter() {
    const tocLinks = document.querySelectorAll('#help-toc a');
    const chapters = Array.from(tocLinks).map(link => document.getElementById(link.getAttribute('href').substring(1)));

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            const id = entry.target.id;
            const tocLink = document.querySelector(`#help-toc a[href="#${id}"]`);
            if (entry.isIntersecting) {
                tocLinks.forEach(link => link.classList.remove('active'));
                tocLink.classList.add('active');
            }
        });
    }, {
        root: null,
        rootMargin: '0px 0px -80% 0px',
        threshold: 0
    });

    chapters.forEach(chapter => {
        if (chapter) observer.observe(chapter);
    });
}

function initEventListener() {

    const exitBtn = document.getElementById('help-exit-button');
    resetAndBind(exitBtn, 'click', () => {
        const container = document.getElementById('calendar');
        loadCalendarIntoContainer(container);
    });

    initHelpToggles();
    initTOCScroll();
    focusFirstTOCEntry();
    highlightCurrentChapter();
    setTimeout(initHelpToggles, 0);
}


function scanAndReplaceHelpContent(container) {
    const placeholders = container.querySelectorAll("p, li, span, div");
    placeholders.forEach(el => {
        const original = el.innerHTML;

        el.innerHTML = original.replace(/\{\{([\w\-]+)\}\}/g, (_, token) => {
            return renderEmployeeTag(token);
        });
    });
}


function renderEmployeeTag(raw) {
    const match = raw.match(/^([\w]+)(?:-(\d+))?$/i);
    if (!match) return raw;

    const nameKey = match[1];
    const roleIndex = match[2] !== undefined ? parseInt(match[2], 10) : 0;

    const person = helpEmployees.find(e => e.name.toLowerCase() === nameKey.toLowerCase());
    if (!person) {
        console.warn(`⚠️ No employee found with name "${nameKey}"`);
        // Return a visible warning tag instead of raw placeholder
        return `<span class="employee-tag mismatch" title="Unknown employee: ${nameKey}">{{${raw}}}</span>`;
    }

    const roleId = person.roles[roleIndex];
    if (roleId === undefined) {
        console.warn(`⚠️ No role #${roleIndex} for employee "${person.name}"`);
        return `<span class="employee-tag mismatch" title="Unknown role #${roleIndex} for ${person.name}">{{${raw}}}</span>`;
    }

    const role = helpRoles.find(r => r.roleIndex === roleId);
    if (!role) {
        console.warn(`⚠️ No role definition for index ${roleId}`);
        return `<span class="employee-tag mismatch" title="Unknown role definition for index ${roleId}">{{${raw}}}</span>`;
    }

    const roleLabel = role.roleName;
    const emoji = person.emoji;
    const nickname = person.nickname;

    return `
    <span class="employee-tag" title="${person.name}">
      <span class="employee-role help-role-text-${role.roleIndex}">${roleLabel}</span>
      <span class="noto help-icon help-role-color-${role.roleIndex}">${emoji}</span>
      ${nickname}
    </span>
  `;
}

function initHelpToggles() {
    const storyCheckbox = document.getElementById('help-storymode');
    const lengthSelect = document.getElementById('help-textlength');
    const helpRoot = document.getElementById('help-scroll-container');
    const sizeSelect = document.getElementById('help-screenshot-size');

    if (sizeSelect) {
        const savedSize = localStorage.getItem('helpScreenshotSize') || 'large';
        sizeSelect.value = savedSize;

        const updateScreenshotSize = () => {
            // Include help-screenshot in toggle
            const helpImages = document.querySelectorAll(
                '#help-scroll-container img.help-img, ' +
                '#help-scroll-container figure.help-img, ' +
                '#help-scroll-container img.help-screenshot'
            );
            helpImages.forEach(el => {
                el.classList.toggle('large', sizeSelect.value === 'large');
            });
            localStorage.setItem('helpScreenshotSize', sizeSelect.value);
        };

        sizeSelect.addEventListener('change', updateScreenshotSize);

        // Initial apply on load
        updateScreenshotSize();
    }

    // --- Storymode toggle ---
    if (storyCheckbox) {
        const savedStoryMode = localStorage.getItem('helpStoryMode');
        if (savedStoryMode !== null) {
            const enabled = savedStoryMode === 'true';
            storyCheckbox.checked = enabled;
            helpRoot.classList.toggle('no-storymode', !enabled);
        } else {
            storyCheckbox.checked = false; // default: off
            helpRoot.classList.add('no-storymode'); // Storymode off
        }

        storyCheckbox.addEventListener('change', () => {
            helpRoot.classList.toggle('no-storymode', !storyCheckbox.checked);
            localStorage.setItem('helpStoryMode', storyCheckbox.checked);
        });
    }


    // --- Text length select ---
    if (lengthSelect) {
        // Zustand aus localStorage laden, falls vorhanden
        const savedLength = localStorage.getItem('helpTextLength');
        if (savedLength !== null) {
            lengthSelect.value = savedLength;
        }

        const updateTextLength = () => {
            helpRoot.classList.remove('textlength-long', 'textlength-tiny');
            helpRoot.classList.add(`textlength-${lengthSelect.value}`);
            localStorage.setItem('helpTextLength', lengthSelect.value);
        };

        lengthSelect.addEventListener('change', updateTextLength);

        // Initialer Zustand
        updateTextLength();
    }
}

const loadedChapters = new Set();

async function ensureChapterLoaded(chapterName) {
    if (!HELP_CHAPTERS[chapterName]) {
        console.warn(`⚠️ Unknown help chapter "${chapterName}"`);
        return;
    }
    if (loadedChapters.has(chapterName)) return;

    const container = document.querySelector(
        `[data-chapter="${chapterName}"] + [data-chapter-content]`
    ) || document.getElementById(`chapter-${chapterName}-content`);

    if (!container) {
        console.warn(`⚠️ No container for chapter "${chapterName}"`);
        return;
    }

    const response = await fetch(`Components/help/chapters/${chapterName}.html`);
    if (!response.ok) {
        container.innerHTML = `<p>Kapitel konnte nicht geladen werden.</p>`;
        return;
    }

    const html = await response.text();
    container.replaceChildren(
        document.createRange().createContextualFragment(html)
    );

    // init only inside this chapter
    scanAndReplaceHelpContent(container);
    initHelpCollapse();
    initHelpToggles();

    loadedChapters.add(chapterName);
}



