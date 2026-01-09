
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
    button.innerHTML = '⋯';
    button.title = 'Weitere Optionen';
    button.setAttribute('aria-haspopup', 'menu');

    const menu = document.createElement('div');
    menu.className = 'ellipsis-menu hidden';
    menu.setAttribute('role', 'menu');

    actions.forEach(actionKey => {
        const def = ELLIPSIS_ACTIONS[actionKey];
        if (!def) return;

        const item = document.createElement('button');
        item.className = 'ellipsis-item';
        item.innerHTML = `<span>${def.icon}</span>${def.label}`;
        item.onclick = () => def.onSelect?.(context);

        if (def.danger) item.classList.add('danger');

        menu.appendChild(item);
    });

    button.onclick = () => {
        menu.classList.toggle('hidden');
        button.setAttribute(
            'aria-expanded',
            !menu.classList.contains('hidden')
        );
    };

    wrapper.append(button, menu);
    return wrapper;
}
