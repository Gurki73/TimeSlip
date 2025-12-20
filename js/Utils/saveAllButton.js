import { resetAndBind } from './bindEventListner.js';

const changeStack = {};

export function createSaveAllButton({ text = "Save All", onClick } = {}) {
    let btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = text;
    btn.classList.add('opaque');
    btn = resetAndBind(btn, 'click', onClick);
    return btn;
}

export function trackChange(formId, fieldName, value) {
    if (!changeStack[formId]) changeStack[formId] = {};
    changeStack[formId][fieldName] = value;
}

export function saveAll() {
    Object.entries(changeStack).forEach(([formId, fields]) => {
        Object.entries(fields).forEach(([fieldName, value]) => {
            saveField(formId, fieldName, value); // call your existing save fn
        });
    });
    // clear stack after saving
    Object.keys(changeStack).forEach(key => delete changeStack[key]);
}


