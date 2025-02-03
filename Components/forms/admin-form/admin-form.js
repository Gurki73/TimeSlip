document.getElementById('excel-import').addEventListener('click', () => {
    alert("Excel Import wird bald verfügbar sein!");
  });
  
  document.getElementById('excel-export').addEventListener('click', () => {
    alert("Excel Export wird bald verfügbar sein!");
  });
  
  document.getElementById('customization').addEventListener('click', () => {
    const options = `
      - Farbpalette anpassen
      - Emoji-Auswahl bearbeiten
    `;
    alert(`Customization Optionen:\n${options}`);
  });
  
  document.getElementById('buy-coffee').addEventListener('click', () => {
    window.open("https://www.buymeacoffee.com/", "_blank");
  });
  