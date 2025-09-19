let us work on following task:

1. Project Overview

Framework / Tech: Electron v33.3.1, vanilla JS, HTML, CSS

App Purpose: Staffing management tool; detects potential overstaffing/understaffing from vacation/day-off requests

Primary Features:

Calendar month sheet showing all employee absences/presences

Rule set composed of modular building blocks describing optimal staffing conditions

Vacation request list with current states

2. Project Architecture

Data Handling:

fetch() → sample/mock data

fs → client data (isolated from mock data)

State Persistence:

Renderer: localStorage for minor data between sessions

Main process: mirrored in in-memory cache

IPC / Communication:

Preload exposes whitelist of channels

API methods: send, invoke, receive

Security / Best Practices:

Context isolation enabled

No inline HTML/scripts

3. Lazy Loading / Script Notes

Renderer scripts loaded dynamically

Each script includes init() function (must be called when script is requested)

window.api is only available in renderer.js

All lazy-loaded scripts must receive API object explicitly as argument

4. Known Limitations / Constraints

Large-scale changes require Git commit before execution

Scripts dependent on lazy loading may fail if init() not called

5. Session Goals

Short description of current session objectives

Explicit constraints or areas requiring focus

Optional: include expected outputs/examples for testing

please ask questions to clearify current tasks?