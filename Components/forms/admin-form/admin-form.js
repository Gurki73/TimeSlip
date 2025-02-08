export function initializeAdminForm(api) {
  const coffeeBtn = document.getElementById('buy-coffee');

  if (!coffeeBtn) {
    console.error('❌ Buy Me a Coffee button not found.');
    return;
  }

  coffeeBtn.addEventListener('click', () => {
    console.log("coffe button was clicked");
    api.openExternalLink('https://buymeacoffee.com/gurky73');
  });
}
