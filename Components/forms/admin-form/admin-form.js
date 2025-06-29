export function initializeAdminForm(api) {
  const coffeeBtn = document.getElementById('buy-coffee');

  if (!coffeeBtn) {
    console.error('❌ Buy Me a Coffee button not found.');
    return;
  }

  coffeeBtn.addEventListener('click', () => {
    console.log("coffee button was clicked");
    api.openExternalLink('https://buymeacoffee.com/gurky73');
  });

  document.getElementById('clear-cache').addEventListener('click', () => {
    const currentCache = localStorage.getItem('clientDefinedDataFolder');
    console.log('🗄️ Current clientDefinedDataFolder cache:', currentCache);

    const confirmed = confirm("⚠️ Are you sure you want to clear the stored data folder path?\nThis action can't be undone and will trigger fallback loading on next startup.");

    if (confirmed) {
      localStorage.removeItem('clientDefinedDataFolder');

      const afterClearCache = localStorage.getItem('clientDefinedDataFolder');
      console.log('🗄️ Cache after clearing:', afterClearCache);

      alert('🧼 Data path cache cleared.\nRestart the app to test fallback or recovery logic.');
      console.log('🧼 Cleared clientDefinedDataFolder from localStorage');
    }
  });
}

