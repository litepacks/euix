/**
 * src/core/components/ComponentLoader.js
 * Component specification registry, async loader, slot projection, and scoped state engine for EUIX Engine.
 */

import {
    getAttr,
    getChildNodes,
    getTagName,
    isElem,
    isFn,
    isScoped,
    isTxtNode,
    toNum,
    trimStr,
} from "../utils/constants.js";
import { processStyleTag } from "../renderer/DOMRenderer.js";

export async function loadComponent(EngineClass, name, url, options = {}) {
    try {
        if (!EngineClass._componentUrlCache) EngineClass._componentUrlCache = new Map();
        if (EngineClass._componentUrlCache.has(url)) {
            const cachedDoc = EngineClass._componentUrlCache.get(url);
            return EngineClass.registerComponentSpec(name, cachedDoc, options);
        }
        if (typeof fetch === "undefined") {
            console.error("[EUIXEngine] fetch is not available in this environment.");
            return null;
        }
        const isDev =
            typeof window !== "undefined" &&
            (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
        const res = await fetch(url, isDev ? { cache: "no-cache" } : undefined);
        const xmlText = isFn(res.text) ? await res.text() : typeof res === "string" ? res : String(res);

        const doc = EngineClass.parseXmlToAst(xmlText, options);
        if (EngineClass._componentUrlCache.size < 200) {
            EngineClass._componentUrlCache.set(url, doc);
        }

        const nestedImports = Array.from(doc.querySelectorAll("import"));
        const loadPromises = [];
        for (const imp of nestedImports) {
            const impSrc = imp.getAttribute("src");
            const impName = imp.getAttribute("name") || imp.getAttribute("as");
            const lazyAttr = imp.getAttribute("lazy");
            const preloadAttr = imp.getAttribute("preload");
            const isLazy =
                lazyAttr === "true" ||
                imp.getAttribute("mode") === "lazy" ||
                lazyAttr === "viewport" ||
                lazyAttr === "hover" ||
                lazyAttr === "idle" ||
                Boolean(preloadAttr) ||
                imp.getAttribute("viewport") === "true";
            const isViewport =
                imp.getAttribute("viewport") === "true" ||
                imp.getAttribute("observer") === "true" ||
                lazyAttr === "viewport" ||
                (isLazy && lazyAttr !== "hover" && lazyAttr !== "idle" && !preloadAttr);
            const rootMargin = imp.getAttribute("root_margin") || imp.getAttribute("rootMargin") || "300px";

            if (impSrc && impName) {
                const currentStack = options.parentStack || [(name || "").toLowerCase()];
                if (isLazy) {
                    if (typeof EngineClass.registerLazyComponent === "function") {
                        EngineClass.registerLazyComponent(impName, impSrc, {
                            fallback: imp.getAttribute("fallback"),
                            preload:
                                preloadAttr || (lazyAttr === "hover" ? "hover" : lazyAttr === "idle" ? "idle" : null),
                            viewport: isViewport,
                            observer: isViewport,
                            rootMargin: rootMargin,
                            minHeight: imp.getAttribute("min_height") || imp.getAttribute("minHeight"),
                            aspectRatio: imp.getAttribute("aspect_ratio") || imp.getAttribute("aspectRatio"),
                            placeholderClass:
                                imp.getAttribute("placeholder_class") || imp.getAttribute("placeholderClass"),
                            retries: imp.getAttribute("retries"),
                            retryDelay: imp.getAttribute("retry_delay") || imp.getAttribute("retryDelay"),
                            parentStack: currentStack,
                        });
                    }
                } else {
                    loadPromises.push(
                        EngineClass.loadComponent(impName, impSrc, {
                            ...options,
                            parentStack: currentStack,
                        })
                    );
                }
            }
        }

        if (loadPromises.length > 0) {
            await Promise.all(loadPromises);
        }

        return EngineClass.registerComponentSpec(name, doc, options);
    } catch (err) {
        if (err.code === "CIRCULAR_LAZY_DEPENDENCY" || err.message?.includes("CIRCULAR_LAZY_DEPENDENCY")) {
            throw err;
        }
        console.error(`[EUIXEngine] Failed to load component from file ('${name}' -> '${url}'):`, err);
        return null;
    }
}

export function registerComponentSpec(EngineClass, name, xmlStringOrNode, options = {}) {
    let node;
    if (typeof xmlStringOrNode === "string") {
        if (!EngineClass._componentAstCache) EngineClass._componentAstCache = new Map();
        let doc;
        if (EngineClass._componentAstCache.has(xmlStringOrNode)) {
            doc = EngineClass._componentAstCache.get(xmlStringOrNode);
        } else {
            doc = EngineClass.parseXmlToAst(xmlStringOrNode, options);
            if (EngineClass._componentAstCache.size < 200) {
                EngineClass._componentAstCache.set(xmlStringOrNode, doc);
            }
        }

        const nestedDefs = Array.from(doc.querySelectorAll("component_def"));
        nestedDefs.forEach((def) => {
            const defName = def.getAttribute("name") || def.getAttribute("id");
            if (defName && defName.toLowerCase() !== (name || "").toLowerCase()) {
                EngineClass.registerComponentSpec(defName, def, options);
            }
        });

        node = doc.querySelector("component_def, uid_spec, flex, grid, layout") || doc.documentElement;
    } else if (xmlStringOrNode && (xmlStringOrNode.nodeType === 1 || xmlStringOrNode.nodeType === 9)) {
        if (xmlStringOrNode.nodeType === 1) {
            const tagName = xmlStringOrNode.tagName ? xmlStringOrNode.tagName.toLowerCase() : "";
            if (["component_def", "uid_spec", "flex", "grid", "layout"].includes(tagName)) {
                node = xmlStringOrNode;
            } else {
                node = xmlStringOrNode.querySelector("component_def, uid_spec, flex, grid, layout") || xmlStringOrNode;
            }
        } else {
            node =
                xmlStringOrNode.querySelector("component_def, uid_spec, flex, grid, layout") ||
                xmlStringOrNode.documentElement;
        }

        const nestedDefs = Array.from(xmlStringOrNode.querySelectorAll("component_def"));
        nestedDefs.forEach((def) => {
            const defName = def.getAttribute("name") || def.getAttribute("id");
            if (defName && defName.toLowerCase() !== (name || "").toLowerCase() && def !== node) {
                EngineClass.registerComponentSpec(defName, def);
            }
        });
    } else {
        node = xmlStringOrNode;
    }

    const compName = (name || node?.getAttribute?.("name") || node?.getAttribute?.("id") || "").toLowerCase();
    if (compName && node) {
        if (!EngineClass._globalComponentSpecs) EngineClass._globalComponentSpecs = new Map();
        EngineClass._globalComponentSpecs.set(compName, node);

        if (isFn(EngineClass.registerActionDef)) {
            const actionDefNodes = Array.from(
                node.querySelectorAll ? node.querySelectorAll("action_def, workflow_def") : [],
            );
            actionDefNodes.forEach((def) => {
                const actName = def.getAttribute("name") || def.getAttribute("id");
                if (actName) {
                    EngineClass.registerActionDef(actName, def);
                }
            });
        }
    }
    return compName;
}

export function initComponentSchema(engine, specNode, context = {}) {
    if (!engine || !specNode) return;

    // 1. Action / Workflow definitions
    if (isFn(engine.constructor.registerActionDef)) {
        const actionDefNodes = Array.from(
            specNode.querySelectorAll ? specNode.querySelectorAll("action_def, workflow_def") : []
        );
        actionDefNodes.forEach((def) => {
            const actName = def.getAttribute("name") || def.getAttribute("id");
            if (actName) {
                engine.constructor.registerActionDef(actName, def);
            }
        });
    }

    // 2. Computed signals
    const computedNodes = specNode.querySelectorAll
        ? Array.from(specNode.querySelectorAll("computed"))
        : Array.from(specNode.getElementsByTagName ? specNode.getElementsByTagName("computed") : []);
    computedNodes.forEach((node) => {
        const id = node.getAttribute("id") || node.getAttribute("name");
        const deps = node.getAttribute("deps") || node.getAttribute("watch");
        const getter = node.textContent.trim() || node.getAttribute("value") || node.getAttribute("expr");
        if (id && isFn(engine.computed) && (!engine._computedRegistry || !engine._computedRegistry.has(id))) {
            engine.computed(id, getter, deps);
        }
    });

    // 3. Watch observers
    const watchNodes = specNode.querySelectorAll
        ? Array.from(specNode.querySelectorAll("watch"))
        : Array.from(specNode.getElementsByTagName ? specNode.getElementsByTagName("watch") : []);
    watchNodes.forEach((node) => {
        const path = node.getAttribute("path") || node.getAttribute("watch") || node.getAttribute("on");
        if (path && isFn(engine.watch)) {
            engine.watch(path, node);
        }
    });

    // 4. Keyframe / Animation definitions
    const animDefNodes = [
        ...Array.from(specNode.getElementsByTagName ? specNode.getElementsByTagName("animation_def") : []),
        ...Array.from(specNode.getElementsByTagName ? specNode.getElementsByTagName("keyframe_def") : []),
    ];
    animDefNodes.forEach((node) => {
        const name = node.getAttribute("name") || node.getAttribute("id");
        if (name && isFn(engine.registerAnimationDef)) {
            engine.registerAnimationDef(name, node);
        }
    });

    // 5. API Config & Endpoints
    const apiConfigNode = specNode.querySelector ? specNode.querySelector("api_config, api_client, api") : null;
    if (apiConfigNode && engine._apiConfig) {
        const baseUrl =
            apiConfigNode.getAttribute("base_url") ||
            apiConfigNode.getAttribute("baseUrl") ||
            apiConfigNode.getAttribute("url");
        if (baseUrl && !engine._apiConfig.baseUrl) engine._apiConfig.baseUrl = baseUrl.trim();

        const credentials = apiConfigNode.getAttribute("credentials");
        if (credentials && !engine._apiConfig.credentials) engine._apiConfig.credentials = credentials.trim();

        const timeout = apiConfigNode.getAttribute("timeout");
        if (timeout && !engine._apiConfig.timeout) engine._apiConfig.timeout = parseInt(timeout, 10) || 0;

        const headerNodes = Array.from(apiConfigNode.querySelectorAll("headers > header, header"));
        headerNodes.forEach((h) => {
            const name = h.getAttribute("name") || h.getAttribute("key");
            const val = h.textContent.trim() || h.getAttribute("value") || "";
            if (name && isFn(engine.setApiHeader)) engine.setApiHeader(name, val);
        });
    }

    const apiEndpoints = specNode.querySelectorAll
        ? Array.from(specNode.querySelectorAll("api_endpoint, endpoint"))
        : Array.from(specNode.getElementsByTagName ? specNode.getElementsByTagName("api_endpoint") : []).concat(
              Array.from(specNode.getElementsByTagName ? specNode.getElementsByTagName("endpoint") : [])
          );
    if (isFn(engine.handleXHR) && apiEndpoints.length > 0) {
        apiEndpoints.forEach((node) => {
            const autoFetchAttr = node.getAttribute("auto_fetch");
            const autoFetch = autoFetchAttr !== "false";
            if (autoFetch) {
                engine.handleXHR(node);
            } else {
                engine.handleXHR(node, { _registerOnly: true });
            }
        });
    }
}

export function renderComponentSpec(engine, specNode, usageNode, context = {}) {
    if (!specNode) return null;

    initComponentSchema(engine, specNode, context);

    const rawChildren = getChildNodes(usageNode).filter((n) => isElem(n) || (isTxtNode(n) && trimStr(n) !== ""));
    const namedSlots = new Map();
    const defaultSlots = [];

    rawChildren.forEach((child) => {
        if (isElem(child)) {
            const slotName =
                child.getAttribute("slot") || (getTagName(child) === "slot" ? child.getAttribute("name") : null);
            if (slotName) {
                if (!namedSlots.has(slotName)) namedSlots.set(slotName, []);
                namedSlots.get(slotName).push(child);
                return;
            }
        }
        defaultSlots.push(child);
    });

    const props = {};

    const uAttrs = usageNode.attributes;
    if (uAttrs) {
        const uLen = uAttrs.length;
        for (let uIdx = 0; uIdx < uLen; uIdx++) {
            const attr = uAttrs[uIdx];
            if (attr.name !== "type" && attr.name !== "class") {
                props[attr.name] = engine.interpolate(attr.value, context);
            }
        }
    }

    const compConstants = {};
    const constsNodes = specNode.querySelectorAll
        ? specNode.querySelectorAll("constants > const, constants > constant, vars > var, variables > variable")
        : null;
    if (constsNodes) {
        const cnLen = constsNodes.length;
        for (let i = 0; i < cnLen; i++) {
            const node = constsNodes[i];
            const id = node.getAttribute("id") || node.getAttribute("name") || node.getAttribute("key");
            if (id) compConstants[id] = node.textContent.trim();
        }
    }

    const compDepth = (context._compDepth || 0) + 1;
    const compName = getAttr(specNode, "name", "id") || getTagName(usageNode) || "component";
    if (compDepth > 20) {
        const err = new Error(
            `[EUIXEngine Infinite Loop Guard] Maximum component recursion depth (20) exceeded for component <${compName}>`,
        );
        engine.reportError(err, "Infinite Component Loop Guard");
        const errEl = document.createElement("div");
        errEl.className =
            "euix-recursion-error text-xs text-rose-600 font-bold p-2 bg-rose-50 border border-rose-200 rounded";
        errEl.textContent = `[Recursion Error] <${compName}> exceeds max depth (20)`;
        return errEl;
    }

    let componentApiConfig = context._componentApiConfig ? { ...context._componentApiConfig } : null;
    const apiNode = engine.getChild(specNode, "api_config") || specNode.querySelector("api_config, api_client, api");
    if (apiNode) {
        const baseUrl = getAttr(apiNode, "base_url", "baseUrl", "url");
        const credentials = apiNode.getAttribute("credentials") || undefined;
        const timeout = toNum(apiNode.getAttribute("timeout"));
        const headers = new Map(componentApiConfig?.headers || []);

        const headersNode = engine.getChild(apiNode, "headers");
        if (headersNode) {
            engine.getChildren(headersNode, "header").forEach((h) => {
                const name = h.getAttribute("name");
                if (name) headers.set(name, trimStr(h));
            });
        }

        componentApiConfig = { baseUrl, credentials, timeout, headers };
    }

    const dataModelNode = engine.getChild(specNode, "data_model") || specNode.querySelector("data_model");
    const isIsolated = isScoped(usageNode) || isScoped(specNode) || isScoped(dataModelNode);

    const localRawState = {};
    let hasLocalState = false;
    const stateNodes = dataModelNode
        ? engine.getChildren(dataModelNode, "state")
        : specNode.querySelectorAll
          ? Array.from(specNode.querySelectorAll("data_model > state"))
          : [];
    stateNodes.forEach((node) => {
        const id = node.getAttribute("id");
        if (!id) return;
        const scope = node.getAttribute("scope");
        const isStateLocal = isIsolated || scope === "local" || scope === "isolated" || scope === "scoped";
        const type = node.getAttribute("type");

        let parsedValue;
        if (type === "array") {
            const items = engine.getChildren(node, "item");
            const itLen = items.length;
            parsedValue = new Array(itLen);
            for (let itIdx = 0; itIdx < itLen; itIdx++) {
                const item = items[itIdx];
                const obj = {};
                const itAttrs = item.attributes;
                if (itAttrs) {
                    const iaLen = itAttrs.length;
                    for (let iaIdx = 0; iaIdx < iaLen; iaIdx++) {
                        const attr = itAttrs[iaIdx];
                        obj[attr.name] = attr.value;
                    }
                }
                parsedValue[itIdx] = obj;
            }
        } else if (type === "number" || type === "int" || type === "float") {
            const txt = node.textContent.trim();
            parsedValue = txt !== "" ? Number(txt) : 0;
        } else if (type === "boolean" || type === "bool") {
            const txt = node.textContent.trim().toLowerCase();
            parsedValue = txt === "true";
        } else if (type === "object" || type === "json") {
            const txt = node.textContent.trim();
            try {
                parsedValue = txt ? JSON.parse(txt) : {};
            } catch (_) {
                parsedValue = {};
            }
        } else {
            parsedValue = node.textContent.trim() || "";
        }

        if (isStateLocal && scope !== "global") {
            hasLocalState = true;
            localRawState[id] = parsedValue;
        } else {
            // Register into global data model if not already present
            if (engine.getState(id) === undefined) {
                engine.setState(id, parsedValue);
            }
        }
    });

    const EngineClass = engine.constructor;
    if (!EngineClass._instanceSeq) EngineClass._instanceSeq = 0;
    const instanceId = `comp_inst_${++EngineClass._instanceSeq}`;
    const self = engine;

    const reactiveLocalState = hasLocalState
        ? new Proxy(localRawState, {
              get(target, prop, receiver) {
                  return Reflect.get(target, prop, receiver);
              },
              set(target, key, value) {
                  target[key] = value;
                  self.syncBindings(`${instanceId}:${key}`, value);
                  return true;
              },
          })
        : null;

    const childContext = {
        ...context,
        data: engine.data,
        $data: engine.data,
        parent: context,
        $parent: context,
        props,
        ...props,
        $device: engine.$device || context?.$device,
        device: engine.$device || context?.device,
        $date: engine.$date || context?.$date,
        date: engine.$date || context?.date,
        _instanceId: instanceId,
        _localState: reactiveLocalState,
        local: reactiveLocalState,
        $local: reactiveLocalState,
        _compDepth: compDepth,
        _componentApiConfig: componentApiConfig,
        _projectedSlots: {
            named: namedSlots,
            default: defaultSlots,
            parentContext: context,
        },
        constants: {
            ...(context.constants || {}),
            ...compConstants,
        },
    };

    const metadataTags = [
        "props",
        "data_model",
        "imports",
        "import",
        "constants",
        "vars",
        "variables",
        "actions",
        "action_def",
        "workflow_def",
        "api_config",
        "api_endpoint",
        "endpoint",
        "api",
        "persistence",
        "navigator_config",
        "device_config",
        "on_mount",
        "on_unmount",
        "on_interval",
        "on_state_change",
        "use_script",
        "use_style",
        "style",
        "script_loader",
        "style_loader",
        "load_script",
        "load_style",
        "animations",
        "animation_def",
        "watch",
        "computed",
        "head",
        "helmet",
        "title",
        "webmcp",
        "webmcp_tool",
        "webmcp-tool",
    ];

    // Trigger external script loaders declared inside component
    const compScripts = Array.from(
        specNode.querySelectorAll ? specNode.querySelectorAll("use_script, script_loader, load_script") : [],
    );
    compScripts.forEach((node) => {
        const src = node.getAttribute("src") || node.getAttribute("url");
        if (src) engine.loadScript(src, { async: node.getAttribute("async") !== "false" });
    });

    const specChildElems =
        specNode.children && specNode.children.length > 0
            ? Array.from(specNode.children)
            : getChildNodes(specNode).filter(isElem);

    const templateNode =
        engine.getChild(specNode, "template") ||
        engine.getChild(specNode, "flex") ||
        engine.getChild(specNode, "grid") ||
        engine.getChild(specNode, "layout") ||
        engine.getChild(specNode, "collapse") ||
        engine.getChild(specNode, "dialog") ||
        specChildElems.find((c) => isElem(c) && !metadataTags.includes(getTagName(c))) ||
        specNode;

    const rendered = engine.createHTMLElement(templateNode, childContext);

    // Process style and use_style loaders declared inside component
    const compStyles = Array.from(
        specNode.querySelectorAll ? specNode.querySelectorAll("use_style, style_loader, load_style, style") : [],
    );
    compStyles.forEach((node) => {
        const tag = (node.tagName || "").toLowerCase();
        if (tag === "style") {
            processStyleTag(engine, node, childContext, rendered);
        } else {
            const href = node.getAttribute("src") || node.getAttribute("href") || node.getAttribute("url");
            if (href) engine.loadStyle(href);
        }
    });

    if (isElem(rendered)) {
        rendered.dataset.xuiComponent = compName;
        rendered.dataset.euixComponent = compName;
        rendered.dataset.euixInstance = instanceId;
        engine.processLifecycleHooks(specNode, rendered, childContext);
        if (engine.hooks) {
            engine.hooks.emit("component:mount", {
                component: compName,
                instanceId,
                element: rendered,
                props,
                localState: childContext._localState,
                context: childContext,
            });
        }
    }

    if (rendered && usageNode.getAttribute("class")) {
        const extraClass = usageNode.getAttribute("class");
        rendered.className = [rendered.className, extraClass].filter(Boolean).join(" ");
    }

    return rendered;
}

export async function loadComponentFile(engine, name, url) {
    const compName = await engine.constructor.loadComponent(name, url);
    if (compName && engine.constructor._globalComponentSpecs.has(compName)) {
        const specNode = engine.constructor._globalComponentSpecs.get(compName);
        engine._componentSpecs.set(compName, specNode);

        if (isFn(engine.registerActionDef)) {
            const actionDefNodes = Array.from(
                specNode.querySelectorAll ? specNode.querySelectorAll("action_def, workflow_def") : [],
            );
            actionDefNodes.forEach((def) => {
                const actName = def.getAttribute("name") || def.getAttribute("id");
                if (actName) {
                    engine.registerActionDef(actName, def);
                }
            });
        }

        if (isFn(engine.registerAnimationDef)) {
            const animNodes = Array.from(
                specNode.querySelectorAll ? specNode.querySelectorAll("animation_def, keyframe_def") : [],
            );
            animNodes.forEach((def) => {
                const animName = def.getAttribute("name") || def.getAttribute("id");
                if (animName) {
                    engine.registerAnimationDef(animName, def);
                }
            });
        }
    }
    return compName;
}

export function registerEngineComponentSpec(engine, name, xmlStringOrNode) {
    const compName = engine.constructor.registerComponentSpec(name, xmlStringOrNode);
    if (compName && engine.constructor._globalComponentSpecs.has(compName)) {
        const specNode = engine.constructor._globalComponentSpecs.get(compName);
        engine._componentSpecs.set(compName, specNode);

        if (isFn(engine.registerActionDef)) {
            const actionDefNodes = Array.from(
                specNode.querySelectorAll ? specNode.querySelectorAll("action_def, workflow_def") : [],
            );
            actionDefNodes.forEach((def) => {
                const actName = def.getAttribute("name") || def.getAttribute("id");
                if (actName) {
                    engine.registerActionDef(actName, def);
                }
            });
        }

        if (isFn(engine.registerAnimationDef)) {
            const animNodes = Array.from(
                specNode.querySelectorAll ? specNode.querySelectorAll("animation_def, keyframe_def") : [],
            );
            animNodes.forEach((def) => {
                const animName = def.getAttribute("name") || def.getAttribute("id");
                if (animName) {
                    engine.registerAnimationDef(animName, def);
                }
            });
        }
    }
    return compName;
}
