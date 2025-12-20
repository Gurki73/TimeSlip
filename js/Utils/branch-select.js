import { resetAndBind } from './bindEventListner.js';

/*
export function createBranchToggle({
    id = 'branch-toggle',
    defaultValue = 'client'
} = {}) {

    let button = document.getElementById(id);
    if (button) {
        const clone = button.cloneNode(true); // remove old handlers
        button.replaceWith(clone);
        button = clone;
    } else {
        button = document.createElement('button');
        button.id = id;
        button.classList.add('branch-toggle');
    }

    const STORAGE_KEY = 'dataMode';
    let current = localStorage.getItem(STORAGE_KEY) || defaultValue;
    let isCoolingDown = false;

    const updateLabel = () => {
        const toggleIcon = '<span class="noto">🔁</span>';
        const isExample = current === 'sample';
        const label = isExample ? 'Daten anzeigen' : 'Beispiel anzeigen';
        button.innerHTML = `${toggleIcon} ${label}`;
        button.classList.toggle('active', !isExample);
        localStorage.setItem(STORAGE_KEY, current);
    };

    // --- click-only toggle, no global events, no onChange callbacks
    button.addEventListener('click', (event) => {
        if (isCoolingDown) {
            event.preventDefault();
            return;
        }
        isCoolingDown = true;
        setTimeout(() => (isCoolingDown = false), 3000); // simple cooldown

        current = current === 'sample' ? 'client' : 'sample';
        updateLabel();
    });

    updateLabel();
    return button;
}
*/

export function createBranchToggle({
    id = 'branch-toggle',
    defaultValue = 'sample',
    onChange
} = {}) {

    const STORAGE_KEY = 'dataMode';
    let current = localStorage.getItem(STORAGE_KEY) || defaultValue;

    const wrapper = document.createElement('div');
    wrapper.id = id;
    wrapper.classList.add('branch-radio-group');

    // --- Create radio inputs
    const sampleRadio = document.createElement('input');
    sampleRadio.type = 'radio';
    sampleRadio.name = 'dataMode';
    sampleRadio.value = 'sample';
    sampleRadio.id = `${id}-sample`;

    const sampleLabel = document.createElement('label');
    sampleLabel.htmlFor = sampleRadio.id;
    sampleLabel.textContent = 'Beispiel';

    const clientRadio = document.createElement('input');
    clientRadio.type = 'radio';
    clientRadio.name = 'dataMode';
    clientRadio.value = 'client';
    clientRadio.id = `${id}-client`;

    const clientLabel = document.createElement('label');
    clientLabel.htmlFor = clientRadio.id;
    clientLabel.textContent = 'Daten';

    // --- Add everything into wrapper
    wrapper.appendChild(sampleRadio);
    wrapper.appendChild(sampleLabel);
    wrapper.appendChild(clientRadio);
    wrapper.appendChild(clientLabel);

    // --- Sync UI with state
    const updateUI = () => {
        sampleRadio.checked = current === 'sample';
        clientRadio.checked = current === 'client';
        localStorage.setItem(STORAGE_KEY, current);
    };

    // --- Notify the app
    const emitChange = () => {
        if (typeof onChange === 'function') onChange(current);
        window.dispatchEvent(new CustomEvent('dataModeChanged', {
            detail: { mode: current }
        }));
    };

    // --- Event handlers
    sampleRadio.addEventListener('change', () => {
        current = 'sample';
        updateUI();
        emitChange();
    });

    clientRadio.addEventListener('change', () => {
        current = 'client';
        updateUI();
        emitChange();
    });

    // --- Public method for external control
    wrapper.setMode = (mode) => {
        if (mode !== 'sample' && mode !== 'client') return;
        current = mode;
        updateUI();
        emitChange();
    };

    // Initialize
    if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, current);
    }
    updateUI();

    return wrapper;
}

export function createBranchSelect({ id = 'branch-select', defaultValue = 'onboarding', onChange } = {}) {

    return createBranchToggle();

    //    const select = document.createElement('select');
    //    select.id = id;
    //    select.setAttribute('aria-label', 'Branche auswählen');
    //
    //    const options = [
    //        { value: 'onboarding', label: 'Beispiel' },
    //        { value: 'gastro', label: 'Gastronomie' },
    //        { value: 'health', label: 'Gesundheit' },
    //        { value: 'shop', label: 'Einzelhandel' },
    //        { value: 'office', label: 'Büro' },
    //        { value: 'logistics', label: 'Logistik' },
    //        { value: 'industrial', label: 'Fertigung' },
    //        { value: 'hospitality', label: 'Übernachtung' },
    //        { value: 'custom', label: 'angepasst' },
    //    ];
    //
    //    options.forEach(opt => {
    //        const option = document.createElement('option');
    //        option.value = opt.value;
    //        option.textContent = opt.label;
    //        select.appendChild(option);
    //    });
    //
    //    select.value = defaultValue;
    //
    //    // attach shared logic
    //    initBranchSelectLogic(select, onChange);
    //
    //    return select;
}

function initBranchSelectLogic(select, onChange) {
    const LOCAL_STORAGE_KEY = 'customBranchWord';
    let previousValue = select.value;

    select.addEventListener('change', (event) => {
        const newValue = event.target.value;

        if (previousValue === 'custom' && newValue !== 'custom') {
            showBranchWarning(
                () => { previousValue = newValue; },
                () => { select.value = previousValue; }
            );
        } else {
            previousValue = newValue;
        }

        if (typeof onChange === 'function') onChange(newValue);
    });
}

function showBranchWarning(onConfirm, onCancel) {
    const dialog = document.getElementById('branch-warning-dialog');
    dialog.classList.remove('hidden');

    const confirmBtn = document.getElementById('dialog-confirm');
    const cancelBtn = document.getElementById('dialog-cancel');

    const closeDialog = () => dialog.classList.add('hidden');

    confirmBtn.onclick = () => {
        closeDialog();
        onConfirm();
    };

    cancelBtn.onclick = () => {
        closeDialog();
        onCancel();
    };
}

export const branchPresetsRoles = {
    gastro: {
        1: { name: "Koch", emoji: "🍳" },
        2: { name: "Spüler", emoji: "🧽" },
        4: { name: "Kellner", emoji: "🥄" },
        5: { name: "Barkeeper", emoji: "🍸" },
        6: { name: "Lieferfahrer", emoji: "🛵" },
        7: { name: "Einkauf", emoji: "🛒" },
        8: { name: "Manager", emoji: "🧮" },
        9: { name: "Empfang", emoji: "☎️" },
        10: { name: "Reinigung", emoji: "🧹" },
        13: { name: "Auszubildende", emoji: "✏️" }
    },

    health: {
        1: { name: "Arzt", emoji: "🩺" },
        2: { name: "Assistenz", emoji: "💉" },
        3: { name: "Pflege", emoji: "🦽" },
        4: { name: "Empfang", emoji: "☎️" },
        5: { name: "Abrechnung", emoji: "🧮" },
        7: { name: "Laborant", emoji: "⚗️" },
        8: { name: "Röntgen", emoji: "🩻" },
        10: { name: "Reinigung", emoji: "🧹" },
        13: { name: "Auszubildende", emoji: "✏️" }
    },

    shop: {
        1: { name: "Kassierer", emoji: "💰" },
        2: { name: "Information", emoji: "🛟" },
        4: { name: "Verkäufer", emoji: "👗" },
        5: { name: "Bestücker", emoji: "🥫" },
        6: { name: "Reinigung", emoji: "🧹" },
        7: { name: "Manager", emoji: "☎️" },
        10: { name: "Lagerist", emoji: "📦" },
        13: { name: "Auszubildende", emoji: "✏️" }
    },

    logistics: {
        1: { name: "Fernfahrer", emoji: "🚚" },
        2: { name: "Auslieferung", emoji: "🛺" },
        4: { name: "Lader", emoji: "🏗️" },
        5: { name: "Packer", emoji: "📦" },
        6: { name: "Kommissionierer", emoji: "🗒️" },
        7: { name: "Manager", emoji: "☎️" },
        8: { name: "Logistiker", emoji: "🧭" },
        10: { name: "Mechaniker", emoji: "🛠️" },
        11: { name: "Reinigung", emoji: "🧹" },
        13: { name: "Auszubildende", emoji: "✏️" }
    },

    industrial: {
        1: { name: "Maurer", emoji: "🧱" },           // Bricklayer
        2: { name: "Zimmerer", emoji: "🪚" },         // Carpenter
        3: { name: "Elektriker", emoji: "🔌" },       // Electrician
        4: { name: "Installateur", emoji: "🚰" },     // Plumber
        5: { name: "Bauhelfer", emoji: "🧑‍🔧" },      // General helper
        7: { name: "Polier", emoji: "📋" },           // Foreman
        8: { name: "Kranführer", emoji: "🏗️" },      // Crane operator
        10: { name: "Pforte", emoji: "🚪" },          // Gate/security
        11: { name: "Ersthelfer", emoji: "🩹" },      // First aid
        12: { name: "Brandschutz", emoji: "🧯" },     // Fire safety
        13: { name: "Auszubildende", emoji: "✏️" }   // Apprentice
    },

    hospitality: {
        1: { name: "Reinigung", emoji: "🛏️" },
        4: { name: "Koch", emoji: "🍳" },
        5: { name: "Kellner", emoji: "🥄" },
        7: { name: "Rezeption", emoji: "🛎️" },
        8: { name: "Manager", emoji: "☎️" },
        10: { name: "Animateur", emoji: "🤸" },
        13: { name: "Auszubildende", emoji: "✏️" }
    },
    office: {
        1: { name: "Entwickler", emoji: "💻" },       // Developer
        2: { name: "Operations", emoji: "⚙️" },      // Ops
        3: { name: "Support", emoji: "🎧" },         // IT support / helpdesk
        4: { name: "Hardware", emoji: "🖥️" },       // Hardware/infra
        5: { name: "Design", emoji: "🎨" },          // Designer/UX
        7: { name: "Projektleitung", emoji: "📋" },  // Project manager
        8: { name: "HR", emoji: "🧮" },              // HR/admin
        10: { name: "Reinigung", emoji: "🧹" },      // Cleaner
        11: { name: "Datenschutz", emoji: "🔒" },    // Data protection officer
        13: { name: "Auszubildende", emoji: "✏️" }  // Apprentice
    }

};


