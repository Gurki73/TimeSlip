import { getCurrentFormState } from './request-warnings.js';
import { updateDurationPreview } from './request-form.js';


function setEnabled(el, enabled) {
    if (!el) return;
    el.disabled = !enabled;
    el.style.opacity = enabled ? "1" : "0.5";
    el.style.pointerEvents = enabled ? "auto" : "none";
}


// After requester selection
function afterRequesterSelected() {
    setEnabled(document.getElementById('request-type-select'), true);
    setEnabled(document.getElementById('pick-request-start'), true);
    setEnabled(document.getElementById('pick-request-end'), false); // enable later
    setEnabled(document.getElementById('multiline-input'), false);
    setEnabled(document.getElementById('requestStoreButton'), false);
    setStepActive("step1", true);
}

// After start date picked
function afterStartDatePicked() {
    setEnabled(document.getElementById('pick-request-end'), true);
    setEnabled(document.getElementById('multiline-input'), true);
    setStepActive("step2", true);
    // Enable warnings after 2 sec
    setTimeout(() => {
        const warningContainer = document.querySelector(".request-form-warn");
        if (warningContainer) warningContainer.style.opacity = 1;
    }, 1500);
}

// After end date picked
function afterEndDatePicked() {
    setEnabled(document.getElementById('requestStoreButton'), true);
}


function setStepActive(stepClass, enabled) {
    document.querySelectorAll(`.${stepClass}`).forEach(el => {
        if (enabled) {
            el.classList.add("request-active");
            el.classList.remove("request-inactive");
            if (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA" || el.tagName === "BUTTON") {
                el.disabled = false;
            }
        } else {
            el.classList.add("request-inactive");
            el.classList.remove("request-active");
            if (el.tagName === "INPUT" || el.tagName === "SELECT" || el.tagName === "TEXTAREA" || el.tagName === "BUTTON") {
                el.disabled = true;
            }
        }
    });
}

function initializeFormState() {

    setEnabled(document.getElementById('requester-select'), true);
    setEnabled(document.getElementById('request-type-select'), false);
    setEnabled(document.getElementById('pick-request-start'), false);
    setEnabled(document.getElementById('pick-request-end'), false);
    setEnabled(document.getElementById('multiline-input'), false);
    setEnabled(document.getElementById('requestStoreButton'), false);

    const warningContainer = document.querySelector(".request-form-warn");
    if (warningContainer) warningContainer.style.opacity = 0.5;

    setStepActive("step1", false);
    setStepActive("step2", false);

    const requesterEmoji = document.getElementById('requester-emoji');
    if (requesterEmoji) requesterEmoji.textContent = '❓';

    const requestId = document.getElementById('request-id');
    if (requestId) requestId.textContent = 'xx.xx.xxxx. xx.xx';

    const requesterSelect = document.getElementById('requester-select');
    if (requesterSelect) requesterSelect.selectedIndex = 0;

    const requestTypeSelect = document.getElementById('request-type-select');
    if (requestTypeSelect) {
        requestTypeSelect.selectedIndex = 0;
        requestTypeSelect.onchange = () => {
            updateDurationPreview();
        };
    }
    const pickStart = document.getElementById('pick-request-start');
    if (pickStart) pickStart.value = '';

    const pickEnd = document.getElementById('pick-request-end');
    if (pickEnd) pickEnd.value = '';

    const multilineInput = document.getElementById('multiline-input');
    if (multilineInput) multilineInput.value = '';
}