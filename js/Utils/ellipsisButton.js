
const ELLIPSIS_ACTIONS = {
    edit: { icon: '✏️', label: 'Bearbeiten' },
    delete: { icon: '🗑️', label: 'Löschen', danger: true },
    repair: { icon: '🔨', label: 'Reparieren' },
    save: { icon: '💾', label: 'Speichern' },
    inspect: { icon: '💡', label: 'Prüfen' },
    copy: { icon: '📋', label: 'Kopieren' }
};

export function createEllipsis(actions = [], context = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'ellipsis';

    const button = document.createElement('button');
    button.className = 'ellipsis-button noto';
    button.textContent = '⋯';
    button.title = 'Weitere Optionen';
    button.setAttribute('aria-haspopup', 'menu');
    button.setAttribute('aria-expanded', 'false');

    const menu = document.createElement('div');
    menu.className = 'ellipsis-menu hidden';
    menu.setAttribute('role', 'menu');

    menu.addEventListener('focusout', (e) => {
        // If focus moves outside the menu AND outside the button → close
        if (
            !menu.contains(e.relatedTarget) &&
            !button.contains(e.relatedTarget)
        ) {
            closeMenu();
        }
    });


    let closeTimeout;

    function openMenu() {
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

    menu.addEventListener('mouseenter', () => {
        clearTimeout(closeTimeout);
    });

    menu.addEventListener('mouseleave', () => {
        closeTimeout = setTimeout(closeMenu, 80);
    });

    menu.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMenu();
            button.focus();
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

        item.addEventListener('click', () => {
            closeMenu();
            context[actionKey]?.();
        });

        if (def.danger) item.classList.add('danger');

        menu.appendChild(item);
    });

    wrapper.append(button, menu);
    return wrapper;
}
