export function shouldSkipMinorConfirmations() {
    return localStorage.getItem('skipMinorConfirmations') === 'true';
}

export function confirmMinor(message) {
    if (shouldSkipMinorConfirmations()) {
        return true;
    }
    return window.confirm(message);
}

export function confirmCritical(message) {
    return window.confirm(message);
}
