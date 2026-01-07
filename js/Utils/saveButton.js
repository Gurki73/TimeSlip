export function createSaveButton({ onSave }) {
    const button = document.createElement('button');
    button.className = 'save-button noto';
    button.textContent = '💾';

    const isSampleMode = document.body.classList.contains('mode-sample');
    let state = isSampleMode ? 'readonly' : 'clean';

    function setState(newState) {
        state = newState;

        // remove all state classes
        button.classList.remove(
            'is-clean',
            'is-dirty',
            'is-blocked',
            'is-readonly',
            'is-saving'
        );

        // add the current state class
        button.classList.add(`is-${state}`);

        // update title
        switch (state) {
            case 'readonly':
                button.title = 'Beispielmodus – Speichern deaktiviert';
                break;
            case 'blocked':
                button.title = 'Speichern nicht möglich – unvollständige Daten';
                break;
            case 'dirty':
                button.title = 'Änderungen speichern';
                break;
            case 'saving':
                button.title = 'Speichert…';
                break;
            default:
                button.title = 'Speichern';
        }
    }

    function forbiddenFeedback() {
        button.classList.add('is-shake');
        document.body.classList.add('sample-feedback');
        setTimeout(() => {
            button.classList.remove('is-shake');
            document.body.classList.remove('sample-feedback');
        }, 500);
    }

    button.addEventListener('click', async e => {
        console.log(' save button was clicked');
        e.preventDefault();

        if (state === 'blocked') {
            forbiddenFeedback();
            return;
        }

        try {
            setState('saving');
            await onSave?.();
            setState('clean');
        } catch (err) {
            console.error('Save failed:', err);
            setState('dirty');
        }
    });

    setState(state);

    return {
        el: button,
        setState,
        getState: () => state
    };
}
