export function initializeAdminForm(api) {
  const coffeeBtn = document.getElementById('buy-coffee');
  const clearCacheBtn = document.getElementById('clear-cache');
  const autoSaveBtn = document.getElementById('auto-save-toggle');
  const stateLabel = autoSaveBtn?.querySelector('.state-label');

  // ------------------------------
  // ☕ Coffee button
  // ------------------------------
  if (coffeeBtn) {
    coffeeBtn.addEventListener('click', () => {
      console.log("coffee button was clicked");
      api.openExternalLink('https://buymeacoffee.com/gurky73');
    });
  } else {
    console.error('❌ Buy Me a Coffee button not found.');
  }

  // ------------------------------
  // 🧼 Clear cache button
  // ------------------------------
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', () => {
      const currentCache = localStorage.getItem('clientDefinedDataFolder');
      console.log('🗄️ Current clientDefinedDataFolder cache:', currentCache);

      const confirmed = confirm(
        "⚠️ Are you sure you want to clear the stored data folder path?\n" +
        "This action can't be undone and will trigger fallback loading on next startup."
      );

      if (confirmed) {
        localStorage.removeItem('clientDefinedDataFolder');
        console.log('🧼 Cleared clientDefinedDataFolder from localStorage');
        alert('🧼 Data path cache cleared.\nRestart the app to test fallback or recovery logic.');
      }
    });
  }

  // ------------------------------
  // 💾 Auto-Save toggle
  // ------------------------------
  if (autoSaveBtn && stateLabel) {
    // Load from storage (default false)
    let autoSaveEnabled = JSON.parse(localStorage.getItem('autoSave')) || false;

    function updateToggleUI() {
      autoSaveBtn.setAttribute('aria-pressed', autoSaveEnabled);
      stateLabel.textContent = autoSaveEnabled ? 'ON' : 'OFF';
    }

    function setAutoSaveState(value) {
      autoSaveEnabled = value;
      localStorage.setItem('autoSave', JSON.stringify(autoSaveEnabled));
      updateToggleUI();

      // 🔔 Notify the rest of the app
      const event = new CustomEvent('autoSaveChanged', {
        detail: { enabled: autoSaveEnabled }
      });
      window.dispatchEvent(event);

      console.log(`💾 AutoSave is now ${autoSaveEnabled ? 'ON' : 'OFF'}`);
    }

    // Init UI
    updateToggleUI();

    // Click listener
    autoSaveBtn.addEventListener('click', () => {
      setAutoSaveState(!autoSaveEnabled);
    });
  }
}
