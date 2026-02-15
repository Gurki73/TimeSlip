export function createDataModeToggle({
    id = 'DataMode-toggle',
    defaultValue = 'sample',
    onChange
} = {}) {

    const STORAGE_KEY = 'dataMode';
    let current = localStorage.getItem(STORAGE_KEY) || defaultValue;

    const wrapper = document.createElement('div');
    wrapper.id = id;
    wrapper.classList.add('DataMode-radio-group');

    const sampleRadio = document.createElement('input');
    sampleRadio.type = 'radio';
    sampleRadio.name = 'dataMode';
    sampleRadio.value = 'sample';
    sampleRadio.id = `${id}-sample`;
    sampleRadio.title = 'Einführungs-Besipiel anzeigen';
    const sampleLabel = document.createElement('label');
    sampleLabel.htmlFor = sampleRadio.id;
    sampleLabel.textContent = 'Beispiel';
    sampleLabel.title = 'Einführungs-Besipiel anzeigen';

    const clientRadio = document.createElement('input');
    clientRadio.type = 'radio';
    clientRadio.name = 'dataMode';
    clientRadio.value = 'client';
    clientRadio.id = `${id}-client`;
    clientRadio.title = 'Eigene Daten anzeigen';

    const clientLabel = document.createElement('label');
    clientLabel.htmlFor = clientRadio.id;
    clientLabel.textContent = 'Daten';
    clientLabel.title = 'Eigene Daten anzeigen';

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

