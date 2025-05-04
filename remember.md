Electron App – Issue & Feature List
🎨 Color Theme System
 Theme switcher via menu (bright / pastel / dark)

 IPC bridge for sending themes main → preload → renderer

 Replace hardcoded shift/holiday/weekend colors in calendar.css

 Define CSS variables:

--color-shift-early, --color-shift-day, --color-shift-late

--color-weekend, --color-holiday, --color-regular

 Implement themes in global.css, override in dark.css, pastel.css

 Add theme preview in settings or menu

 Consider auto-detecting system theme (dark/light)

 Remember last theme selection in local storage (persist theme choice)

 Centralize text color management for dark mode (avoid dark text on dark background)

📅 Calendar Improvements
 Centralize all calendar day/shift color logic

 Add support for custom color per client config?

 Hover/tooltip with shift description?

💻 UI & Display Enhancements
 Zoom-to-fit support for low-resolution screens

Detect screen size and apply default zoom level

Possibly expose zoom as a user setting

 Zoom control via top menu bar with number input (e.g., 75%, 100%)

Serialize zoom settings similar to color theme (store in localStorage)

Implement for window ranges like:

< 1040px = 75%

>= 1040px && < 1600px = 100%

 Add Ctrl + Mousewheel and shortcuts to adjust zoom

🧰 Installation & Data Management
 Create/update installer that:

✅ Preserves user-entered data on update

✅ Validates install path (block temp, cloud folders, etc.)

✅ Warns/prevents install to "Downloads" or cloud sync locations

 Ensure consistent and user-safe storage location (e.g., %APPDATA%, ~/Library/Application Support)

 Add startup check for existing data and alert on overwrite risk

📖 Help & Documentation
 Add in-app Help or Glossary section

 Include sample data or walkthrough tutorial

 Possibly make this toggleable (for first-time use)