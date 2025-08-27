// js/Utils/bindEventListner.js
export function resetAndBind(el, event, handler) {
    console.log("resetAndBind called with:", el);

    if (!el) {
        console.warn("⚠️ resetAndBind: element is null/undefined");
        return null;
    }

    // Handle NodeLists
    if (el instanceof NodeList || Array.isArray(el)) {
        // console.log("resetAndBind got a NodeList/Array with", el.length, "elements");
        return Array.from(el).map(node => resetAndBind(node, event, handler));
    }

    if (!(el instanceof Element)) {
        console.error("❌ resetAndBind called with a non-element:", el);
        return null;
    }

    console.log("✅ Cloning and rebinding:", el.tagName, el.id || el.className);

    const newEl = el.cloneNode(true);
    el.replaceWith(newEl);
    newEl.addEventListener(event, handler);

    return newEl;
}



