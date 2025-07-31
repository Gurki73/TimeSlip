// utils/onboarding.js
export async function checkOnboardingState(api) {
    let isOnboarding = false;
    let dataFolder = localStorage.getItem('clientDefinedDataFolder');

    if (!dataFolder) {
        dataFolder = await api.getRecoveredPath();
        if (dataFolder) {
            localStorage.setItem('clientDefinedDataFolder', dataFolder);
        } else {
            isOnboarding = true;
        }
    }

    return { isOnboarding, dataFolder };
}
