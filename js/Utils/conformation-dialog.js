export async function confirmAction(message) {
    if (!window.api?.confirm) {
        return window.confirm(message); // browser fallback
    }
    return window.api.confirm(message); // electron dialog
}