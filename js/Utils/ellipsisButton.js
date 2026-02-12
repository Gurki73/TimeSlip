
const ELLIPSIS_ACTIONS = {
    edit: { icon: '✏️', label: 'Bearbeiten' },
    delete: { icon: '🗑️', label: 'Löschen', danger: true, sampleDisabled: true },
    disable: { icon: '💤', label: 'Pausieren', sampleDisabled: true },
    enable: { icon: '⏰', label: 'Aktivieren', sampleDisabled: true },
    repair: { icon: '🔨', label: 'Reparieren' },
    save: { icon: '💾', label: 'Speichern' },
    inspect: { icon: '💡', label: 'Prüfen' },
    copy: { icon: '🗳️', label: 'Kopieren' },
};

export function createEllipsis(actions = [], context = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ellipsis';

    const isSampleMode =
        document.body.classList.contains('mode-sample') ||
        localStorage.getItem('dataMode') === 'sample';

    const button = document.createElement('button');
    button.className = 'ellipsis-button noto';
    button.textContent = '⋯';
    button.title = 'Weitere Optionen';
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');

    // Create menu but don't append to wrapper
    const menu = document.createElement('div');
    menu.className = 'ellipsis-menu hidden';
    menu.setAttribute('role', 'menu');
    document.body.appendChild(menu); // move to body

    let closeTimeout;

    function openMenu() {
        // Position menu relative to button
        const rect = button.getBoundingClientRect();
        menu.style.position = 'absolute';
        menu.style.top = `${rect.bottom + window.scrollY}px`;
        menu.style.left = `${rect.left + window.scrollX}px`;
        menu.style.zIndex = 1000; // make sure it's above other content

        menu.classList.remove('hidden');
        button.setAttribute('aria-expanded', 'true');
        menu.querySelector('.ellipsis-item')?.focus();
    }

    function closeMenu() {
        menu.classList.add('hidden');
        button.setAttribute('aria-expanded', 'false');
    }

    button.addEventListener('click', () => {
        menu.classList.contains('hidden') ? openMenu() : closeMenu();
    });

    menu.addEventListener('mouseenter', () => clearTimeout(closeTimeout));
    menu.addEventListener('mouseleave', () => closeTimeout = setTimeout(closeMenu, 80));
    menu.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMenu();
            button.focus();
        }
    });

    menu.addEventListener('focusout', (e) => {
        if (!menu.contains(e.relatedTarget) && !button.contains(e.relatedTarget)) {
            closeMenu();
        }
    });

    actions.forEach(actionKey => {
        const def = ELLIPSIS_ACTIONS[actionKey];
        if (!def) return;

        const item = document.createElement('button');
        item.className = 'ellipsis-item';
        item.innerHTML = `
        <span class="noto ellipsis-icon">${def.icon}</span>
        <span class="ellipsis-label">${def.label}</span>
    `;


        if (isSampleMode && def.sampleDisabled) {
            item.disabled = true;
            item.classList.add('is-readOnly');
            item.title = 'Beispielmodus – Aktion deaktiviert';
        }

        item.addEventListener('click', () => {
            if (item.disabled) return;
            closeMenu();
            context[actionKey]?.();
        });

        if (def.danger) item.classList.add('danger');

        menu.appendChild(item);
    });
    wrapper.appendChild(button);
    return wrapper;
}

