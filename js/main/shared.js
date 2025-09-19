export let inMemoryCache = {
    currentMode: 'sandbox',
    unsavedChanges: false,
};


export function updateInMemoryCache(cacheDump) {
    if (typeof cacheDump !== 'object' || cacheDump === null) {
        console.warn('[main] Invalid cacheDump received');
        return;
    }

    Object.keys(inMemoryCache).forEach(key => delete inMemoryCache[key]);
    Object.assign(inMemoryCache, cacheDump);
}

export const DATA_ROOT_CANDIDATES = [
    {
        key: 'home',
        description: 'User home folder — visible, portable, preferred',
        priority: 1
    },
    {
        key: 'userData',
        description: 'Electron-managed app data folder — fallback, hidden from most users',
        priority: 2
    }
];
