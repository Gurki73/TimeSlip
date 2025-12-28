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
    { emoji: "🐸", name: "Tiana", nickname: "Tia", roles: [8, 2, 4, 12] },  // Manager
    { emoji: "🛁", name: "Jutah", nickname: "Jubaba", roles: [8, 1, 9, 10] },// grandma / old-Manager
    { emoji: "🧸", name: "Kevin", nickname: "Kevin", roles: [2, 6] },       // holiday-job
    { emoji: "🧽", name: "Robert", nickname: "Bob", roles: [13, 1, 9] },    // apprentice Chef
    { emoji: "🐝", name: "Ned", nickname: "BigBee", roles: [13, 8, 7] },    // apprentice Manager
    { emoji: "🛵", name: "Philip", nickname: "Fry", roles: [6, 4, 5] },     // delivery
    { emoji: "🧹", name: "Christina", nickname: "Kiky", roles: [6, 4, 2] }, // delivery
    { emoji: "🍜", name: "Grover", nickname: "Grobi", roles: [4] },         // waiter
    { emoji: "🐀", name: "Rainer", nickname: "Remi", roles: [2, 1] },       // chef (chaotisch)
    { emoji: "💀", name: "Peter", nickname: "Weasel", roles: [5, 4, 7] },   // Barkeeper (Mentor)
    { emoji: "🤖", name: "Walter", nickname: "Walle", roles: [2, 7] },      // cleaning / dishwasher
    { emoji: "☎️", name: "Schrute", nickname: "Dwight", roles: [9, 5] },    // Reception 
    { emoji: "🐕", name: "Bernd", nickname: "Stromburg", roles: [9, 8, 4] },// Reception 
    { emoji: "🪁", name: "Karin", nickname: "Karen", roles: [11] },         // regular (conflict )
    { emoji: "☕", name: "Lorelei", nickname: "Gilly", roles: [11] },       // regular (friend mentor)
    { emoji: "🍄", name: "Miller", nickname: "Joel", roles: [7, 1, 2] },    // single Father
    { emoji: "🍔", name: "Belcher", nickname: "Bob", roles: [9, 1, 4] },    // chef (conflicct doubling names)
    { emoji: "👟", name: "Alfred", nickname: "Al", roles: [4, 5, 6] },      // (struggling family father)
    { emoji: "⛓️", name: "Argus", nickname: "Filch", roles: [2, 6, 4] },    // dishwasher/ cleaning
    { emoji: "🌋", name: "Gregor", nickname: "Ramsey", roles: [1] },        // chef
    { emoji: "🧁", name: "Stephanie", nickname: "Step", roles: [1, 9, 5] }, // step Mom 
    { emoji: "🚁", name: "Helga", nickname: "Heli", roles: [7, 2, 5] },     // Helicopter mom
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
}

function focusFirstTOCEntry() {
    const firstLink = document.querySelector("#help-toc a");
    if (firstLink) {
        firstLink.focus();
        console.log("🔵 Focused first TOC entry.");
    } else {
        console.warn("⚠️ No TOC link found.");
    }
}


function initHelpCollapse() {
    document.querySelectorAll('[data-help-toggle]').forEach(button => {
        const contentId = button.getAttribute('aria-controls');
        const content = document.getElementById(contentId);

        // Try to get persisted state from localStorage
        const savedState = localStorage.getItem(`helpCollapse_${contentId}`);
        // If savedState is null, fallback to the aria-expanded attribute, else use savedState
        const expanded = savedState !== null ? savedState === 'true' : button.getAttribute('aria-expanded') === 'true';

        // Set initial state based on persisted or default
        button.setAttribute('aria-expanded', expanded);

        if (!content) {
            console.warn(`⚠️ No content element for ${contentId}`);
            return;
        }

        content.style.display = expanded ? 'block' : 'none';
        content.classList.toggle('helpChapterHidden', !expanded);

        button.addEventListener('click', async () => {
            const chapterName = button.dataset.chapter;

            if (chapterName) {
                await ensureChapterLoaded(chapterName);
            }

            const isExpanded = button.getAttribute('aria-expanded') === 'true';
            const newExpanded = !isExpanded;

            button.setAttribute('aria-expanded', newExpanded);
            content.style.display = newExpanded ? 'block' : 'none';
            content.classList.toggle('helpChapterHidden', !newExpanded);

            localStorage.setItem(`helpCollapse_${contentId}`, newExpanded);
        });
    });
}




function runHelpSetup() {
    const helpContent = document.getElementById("help-scroll-container");

    if (!helpContent) {
        console.warn("⚠️ #help-scroll-container not found.");
        return;
    }

    console.log("✅ Found #help-scroll-container. Scanning content...");
    scanAndReplaceHelpContent(helpContent);
}

function applyCollapseState(toggleBtn, expand) {
    const contentId = toggleBtn.getAttribute('aria-controls');
    const content = document.getElementById(contentId);

    if (!content) return;

    toggleBtn.setAttribute('aria-expanded', expand);
    toggleBtn.classList.toggle('expanded', expand);
    content.style.display = expand ? 'block' : 'none';
}

function expandChapterBySectionId(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    // Finde das zugehörige Button-Element innerhalb der Section
    const toggleButton = section.querySelector('[data-help-toggle]');
    if (!toggleButton) return;

    const contentId = toggleButton.getAttribute('aria-controls');
    const content = document.getElementById(contentId);
    if (!content) return;

    // Setze aria-expanded auf true
    toggleButton.setAttribute('aria-expanded', 'true');

    // Inhalt anzeigen (entferne ggf. hide-Klasse oder setze style)
    content.style.display = 'block'; // oder: content.classList.remove('helpChapterHidden');
}


function initTOCScroll() {
    document.querySelectorAll('#help-toc a').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const targetId = link.getAttribute('href').substring(1);

            expandChapterBySectionId(targetId);

            // Scrollen zu section (Eltern-Element vom content)
            const content = document.getElementById(targetId);
            if (content) {
                // find parent section
                const section = content.closest('section');
                if (section) {
                    section.scrollIntoView({ behavior: 'smooth' });
                } else {
                    content.scrollIntoView({ behavior: 'smooth' });
                }
            }
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
    console.log(`Scanning ${placeholders.length} elements for placeholders.`);

    placeholders.forEach(el => {
        const original = el.innerHTML;

        el.innerHTML = original.replace(/\{\{([\w\-]+)\}\}/g, (_, token) => {
            console.log(`🔍 Found placeholder: {{${token}}}`);
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
            storyCheckbox.checked = true; // default: aktiviert
            helpRoot.classList.remove('no-storymode'); // Storymode aktiv
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



