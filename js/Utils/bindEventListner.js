// js/Utils/bindEventListner.js
export function resetAndBind(el, event, handler) {
    const skipIds = ['state-select', 'calendar-form-year'];

    if (!el) {
        console.warn("⚠️ resetAndBind: element is null/undefined");
        return null;
    }

    if (el instanceof NodeList || Array.isArray(el)) {
        return Array.from(el).map(node => resetAndBind(node, event, handler));
    }

    if (!(el instanceof Element)) {
        console.error("❌ resetAndBind called with a non-element:", el);
        return null;
    }

    if (skipIds.includes(el.id)) {
        console.log(`⚠️ Skipping resetAndBind for ${el.tagName}#${el.id}`);
        el.addEventListener(event, handler); // attach listener only
        return el;
    }

    // console.log("✅ Cloning and rebinding:", el.tagName, el.id || el.className);

    const newEl = el.cloneNode(true);
    el.replaceWith(newEl);
    newEl.addEventListener(event, handler);

    return newEl;
}



