/**
 * src/core/renderer/formControls.js
 * Form controls (<input>, <textarea>, <select>, <option>, <form>) instantiation, two-way state binding, and input event handlers.
 */

/**
 * Renders an <input> element with support for types, two-way binding, modifiers (lazy, debounce, boolean, number), checkbox and radio.
 *
 * @param {import('../EUIXEngineCore.js').EUIXEngineCore} engine
 * @param {Element} xmlNode
 * @param {Record<string, any>} context
 * @returns {HTMLInputElement}
 */
export function renderInputElement(engine, xmlNode, context = {}) {
    const inputType = (xmlNode.getAttribute("type") || "text").toLowerCase();
    const el = document.createElement("input");
    el.type = inputType;
    if (xmlNode.getAttribute("class")) el.className = engine.interpolate(xmlNode.getAttribute("class"), context);
    if (xmlNode.getAttribute("placeholder"))
        el.placeholder = engine.interpolate(xmlNode.getAttribute("placeholder"), context);
    if (xmlNode.getAttribute("autofocus") === "true") el.dataset.xuiAutofocus = "true";
    if (xmlNode.getAttribute("min")) el.min = xmlNode.getAttribute("min");
    if (xmlNode.getAttribute("max")) el.max = xmlNode.getAttribute("max");
    if (xmlNode.getAttribute("step")) el.step = xmlNode.getAttribute("step");
    if (xmlNode.getAttribute("name")) el.name = engine.interpolate(xmlNode.getAttribute("name"), context);
    if (xmlNode.getAttribute("value")) el.value = engine.interpolate(xmlNode.getAttribute("value"), context);

    const bindPath = engine.resolveBindPath(xmlNode);
    const binding = engine.resolveBinding(xmlNode, context);
    const activeBinding = binding || (bindPath ? { type: "state", path: bindPath } : null);

    if (inputType === "checkbox") {
        if (activeBinding) {
            const rawInit = binding ? engine.getBindingValue(binding, context) : engine.getState(bindPath);
            el.checked = engine.isTruthy(rawInit);
            if (activeBinding.type === "state") engine.registerBinding(activeBinding.path, el, "checkbox");
            el.onchange = (e) => {
                const boolVal = e.target.checked;
                const next = activeBinding.modifiers?.boolean ? boolVal : boolVal ? "true" : "false";
                if (binding) engine.setBindingValue(binding, next, context);
                else engine.setState(bindPath, next);
            };
        }
    } else if (inputType === "radio") {
        if (activeBinding) {
            const rawInit = binding ? engine.getBindingValue(binding, context) : engine.getState(bindPath);
            const current = String(rawInit ?? "");
            el.checked = current === el.value;
            if (activeBinding.type === "state") engine.registerBinding(activeBinding.path, el, "radio");
            el.onchange = (e) => {
                if (e.target.checked) {
                    const coerced = engine.coerceBindingValue(el.value, activeBinding, xmlNode);
                    if (binding) engine.setBindingValue(binding, coerced, context);
                    else engine.setState(bindPath, coerced);
                }
            };
        }
    } else if (activeBinding) {
        const mods = activeBinding.modifiers || {};
        const isLazy = mods.lazy || xmlNode.getAttribute("lazy") === "true";
        const debounceMs = mods.debounce;

        const val = binding ? engine.getBindingValue(binding, context) : engine.getState(bindPath);
        el.value = val !== undefined && val !== null ? val : "";
        if (activeBinding.type === "state") engine.registerBinding(activeBinding.path, el, "input");

        const handleInputEvent = (e) => {
            const coerced = engine.coerceBindingValue(e.target.value, activeBinding, xmlNode);
            if (binding) {
                engine.setBindingValue(binding, coerced, context, { sourceEl: e.target });
            } else {
                engine.setState(bindPath, coerced, { sourceEl: e.target });
            }
        };

        let eventHandler = handleInputEvent;
        if (debounceMs > 0) {
            let timer = null;
            eventHandler = (e) => {
                const target = e.target;
                clearTimeout(timer);
                timer = setTimeout(() => handleInputEvent({ target }), debounceMs);
            };
        }

        if (isLazy) {
            el.onchange = eventHandler;
            el.onblur = eventHandler;
        } else {
            el.oninput = eventHandler;
        }
    }

    engine.bindEvents(xmlNode, el, context);
    return engine.applyRef(el, xmlNode, context);
}

/**
 * Renders a <textarea> element with two-way binding, debouncing, and lazy synchronization.
 *
 * @param {import('../EUIXEngineCore.js').EUIXEngineCore} engine
 * @param {Element} xmlNode
 * @param {Record<string, any>} context
 * @returns {HTMLTextAreaElement}
 */
export function renderTextareaElement(engine, xmlNode, context = {}) {
    const ta = document.createElement("textarea");
    const taClass = engine.interpolate(xmlNode.getAttribute("class") || "", context);
    if (taClass) ta.className = taClass;
    const placeholder = xmlNode.getAttribute("placeholder");
    if (placeholder) ta.placeholder = engine.interpolate(placeholder, context);
    const rows = xmlNode.getAttribute("rows");
    if (rows) ta.rows = parseInt(rows, 10);

    const bindPath = engine.resolveBindPath(xmlNode);
    const binding = engine.resolveBinding(xmlNode, context);
    const activeBinding = binding || (bindPath ? { type: "state", path: bindPath } : null);

    if (activeBinding) {
        const mods = activeBinding.modifiers || {};
        const isLazy = mods.lazy || xmlNode.getAttribute("lazy") === "true";
        const debounceMs = mods.debounce;

        const initialVal = binding ? engine.getBindingValue(binding, context) : engine.getState(bindPath);
        ta.value = initialVal !== undefined && initialVal !== null ? initialVal : "";
        if (activeBinding.type === "state") engine.registerBinding(activeBinding.path, ta, "input");

        const handleTextareaEvent = (e) => {
            const coerced = engine.coerceBindingValue(e.target.value, activeBinding, xmlNode);
            if (binding) {
                engine.setBindingValue(binding, coerced, context, { sourceEl: e.target });
            } else {
                engine.setState(bindPath, coerced, { sourceEl: e.target });
            }
        };

        let eventHandler = handleTextareaEvent;
        if (debounceMs > 0) {
            let timer = null;
            eventHandler = (e) => {
                const target = e.target;
                clearTimeout(timer);
                timer = setTimeout(() => handleTextareaEvent({ target }), debounceMs);
            };
        }

        if (isLazy) {
            ta.onchange = eventHandler;
            ta.onblur = eventHandler;
        } else {
            ta.oninput = eventHandler;
        }
    }
    engine.bindEvents(xmlNode, ta, context);
    return engine.applyRef(ta, xmlNode, context);
}

/**
 * Renders a <select> element with options and two-way binding.
 *
 * @param {import('../EUIXEngineCore.js').EUIXEngineCore} engine
 * @param {Element} xmlNode
 * @param {Record<string, any>} context
 * @returns {HTMLSelectElement}
 */
export function renderSelectElement(engine, xmlNode, context = {}) {
    const sel = document.createElement("select");
    const selClass = engine.interpolate(xmlNode.getAttribute("class") || "", context);
    if (selClass) sel.className = selClass;
    const bindPath = engine.resolveBindPath(xmlNode);
    const binding = engine.resolveBinding(xmlNode, context);

    if (binding || bindPath) {
        const activeBinding = binding || { type: "state", path: bindPath };
        const initialVal = binding ? engine.getBindingValue(binding, context) : engine.getState(bindPath);
        sel.value = initialVal ?? "";
        if (activeBinding.type === "state") engine.registerBinding(activeBinding.path, sel, "input");

        sel.addEventListener("change", (e) => {
            const raw = e.target.value;
            const coerced = engine.coerceBindingValue(raw, activeBinding, xmlNode);
            if (binding) {
                engine.setBindingValue(binding, coerced, context, { sourceEl: e.target });
            } else {
                engine.setState(bindPath, coerced, { sourceEl: e.target });
            }
        });
    }

    engine.bindEvents(xmlNode, sel, context);

    const chNodes = xmlNode.childNodes;
    const chLen = chNodes ? chNodes.length : 0;
    for (let i = 0; i < chLen; i++) {
        const childEl = engine.createHTMLElement(chNodes[i], context);
        if (childEl) sel.appendChild(childEl);
    }

    if (binding) sel.value = engine.getBindingValue(binding, context) ?? "";
    else if (bindPath) sel.value = engine.getState(bindPath) ?? "";

    return engine.applyRef(sel, xmlNode, context);
}

/**
 * Renders an <option> element.
 *
 * @param {import('../EUIXEngineCore.js').EUIXEngineCore} engine
 * @param {Element} xmlNode
 * @param {Record<string, any>} context
 * @returns {HTMLOptionElement}
 */
export function renderOptionElement(engine, xmlNode, context = {}) {
    const opt = document.createElement("option");
    const valAttr = xmlNode.getAttribute("value");
    opt.value = valAttr ? engine.interpolate(valAttr, context) : xmlNode.textContent.trim();
    opt.textContent = engine.interpolate(xmlNode.textContent.trim(), context);
    if (xmlNode.getAttribute("selected") === "true") opt.selected = true;
    return opt;
}

/**
 * Renders a <form> element with preventDefault onsubmit.
 *
 * @param {import('../EUIXEngineCore.js').EUIXEngineCore} engine
 * @param {Element} xmlNode
 * @param {Record<string, any>} context
 * @returns {HTMLFormElement}
 */
export function renderFormElement(engine, xmlNode, context = {}) {
    const form = document.createElement("form");
    const formClass = engine.interpolate(xmlNode.getAttribute("class") || "", context);
    if (formClass) form.className = formClass;
    engine.bindEvents(xmlNode, form, context);

    form.onsubmit = (e) => {
        e.preventDefault();
    };

    const chNodes = xmlNode.childNodes;
    const chLen = chNodes ? chNodes.length : 0;
    for (let i = 0; i < chLen; i++) {
        const childEl = engine.createHTMLElement(chNodes[i], context);
        if (childEl) form.appendChild(childEl);
    }

    return engine.applyRef(form, xmlNode, context);
}

/**
 * Checks if a given tag is a form control tag and renders it.
 *
 * @param {import('../EUIXEngineCore.js').EUIXEngineCore} engine
 * @param {string} tagName
 * @param {Element} xmlNode
 * @param {Record<string, any>} context
 * @returns {HTMLElement | null}
 */
export function renderFormControl(engine, tagName, xmlNode, context = {}) {
    if (tagName === "input") return renderInputElement(engine, xmlNode, context);
    if (tagName === "textarea") return renderTextareaElement(engine, xmlNode, context);
    if (tagName === "select") return renderSelectElement(engine, xmlNode, context);
    if (tagName === "option") return renderOptionElement(engine, xmlNode, context);
    if (tagName === "form") return renderFormElement(engine, xmlNode, context);
    return null;
}
