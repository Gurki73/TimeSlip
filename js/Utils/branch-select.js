import { resetAndBind } from './bindEventListner.js';

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

    wrapper.appendChild(sampleRadio);
    wrapper.appendChild(sampleLabel);
    wrapper.appendChild(clientRadio);
    wrapper.appendChild(clientLabel);

    const updateUI = () => {
        sampleRadio.checked = current === 'sample';
        clientRadio.checked = current === 'client';
        localStorage.setItem(STORAGE_KEY, current);
    };

    const emitChange = () => {
        if (typeof onChange === 'function') onChange(current);
        window.dispatchEvent(new CustomEvent('dataModeChanged', {
            detail: { mode: current }
        }));
    };

    sampleRadio.addEventListener('change', () => {
        wrapper.setMode('sample');
        current = 'sample';
        updateUI();
        emitChange();
    });

    clientRadio.addEventListener('change', () => {
        wrapper.setMode('client');
        current = 'client';
        updateUI();
        emitChange();
    });

    wrapper.setMode = (mode) => {
        if (mode !== 'sample' && mode !== 'client') return;
        current = mode;
        document.body.classList.toggle('mode-sample', mode === 'sample');
        document.body.classList.toggle('mode-client', mode === 'client');
        updateUI();
        emitChange();
    };

    if (!localStorage.getItem(STORAGE_KEY)) {
        localStorage.setItem(STORAGE_KEY, current);
    }
    wrapper.setMode(current);
    updateUI();

    return wrapper;
}

export function createBranchSelect({ id = 'branch-select', defaultValue = 'onboarding', onChange } = {}) {

    return createBranchToggle();

}

export const branchPresetsRoles = [];

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
