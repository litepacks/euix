/**
 * EUIXEngineCore.js
 * High-performance, modular core runtime for EUIX Engine.
 */

import {
    _executeActionInternalBody,
    _handleActionError,
    _handleActionInternal,
    _handleTryCatchFinally,
    _setScopedState,
    _setupContainerEventDelegation,
    applyResets,
    bindEvents,
    confirmAction,
    executeEventHandlers,
    handleAction,
} from "./actions/ActionDispatcher.js";
import {
    _handleFocusAction,
    _handleMutateStateAction,
    _handleRedoStateAction,
    _handleRethrowAction,
    _handleRevalidateAction,
    _handleRunScriptAction,
    _handleSetStateAction,
    _handleSetTitleAction,
    _handleTakeSnapshotAction,
    _handleThrowAction,
    _handleToggleStateAction,
    _handleUndoStateAction,
} from "./actions/BuiltInActions.js";
import {
    escapeHtml,
    escapeRegExp,
    getBindingValue,
    getJsonPath,
    getKeyMask,
    isTruthy,
    mapResponseItems,
    parseBindPath,
    resolveBinding,
    setBindingValue,
} from "./binding/BindingResolver.js";
import {
    initComponentSchema,
    loadComponent,
    loadComponentFile,
    registerComponentSpec,
    registerEngineComponentSpec,
    renderComponentSpec,
} from "./components/ComponentLoader.js";
import { EUIXHookEmitter } from "./events/HookEmitter.js";
import {
    autoInit,
    destroy,
    initConstants,
    initDataModel,
    loadConstants,
    loadDataModel,
    loadScript,
    loadStyle,
    mount,
    onUnmount,
    preloadAsyncResources,
    processLifecycleHooks,
    runMountActions,
} from "./lifecycle/Lifecycle.js";
import {
    _astCache,
    _astCacheMaxSize,
    _astCacheStats,
    _cloneDocument,
    clearAstCache,
    deserializeAst,
    generateCodeFrame,
    getAstCacheStats,
    parseXmlToAst,
    serializeAst,
    setAstCacheSize,
} from "./parser/AstParser.js";
import { EUIXExpressionParser } from "./parser/ExpressionParser.js";
import { EUIXStructuredError, EUIXXMLParseError } from "./parser/errors.js";
import { _getTestStats, enableDevTools, getBindingsStats, getPerformanceMetrics } from "./profiler/Profiler.js";
import {
    _createHTMLElementInternal,
    appendChildren,
    applyItemChildStyles,
    applyLayoutStyles,
    applyNodeAttributes,
    applyRef,
    createHTMLElement,
    evalCondition,
    extractStateKeys,
    interpolate,
    processStyleTag,
    render,
    renderConditional,
    resolveBindPath,
    scopeCSS,
    updateAttributeBinding,
} from "./renderer/DOMRenderer.js";
import { getConstant, registerConstant, registerGlobalConstant } from "./state/Constants.js";
import {
    _invalidateComputed,
    batch,
    batchUpdates,
    flushStateUpdates,
    getState,
    mutateState,
    registerBinding,
    resolveValueFromPath,
    setState,
    syncBindings,
    toggleState,
} from "./state/ReactiveStore.js";
import { onStateChange, triggerStateWatchers, watch } from "./state/Watchers.js";
import { isFn, isStr } from "./utils/constants.js";
import { getChild, getChildren, reportError } from "./utils/domHelpers.js";

class EUIXEngineCore {
    static hooks = new EUIXHookEmitter();
    static _installedPlugins = new Set();
    static _globalActionHandlers = new Map();
    static _componentAstCache = new Map();
    static _componentUrlCache = new Map();

    static clearComponentCache() {
        if (EUIXEngineCore._componentAstCache) EUIXEngineCore._componentAstCache.clear();
        if (EUIXEngineCore._componentUrlCache) EUIXEngineCore._componentUrlCache.clear();
    }

    static use(plugin) {
        if (!plugin) return EUIXEngineCore;
        if (EUIXEngineCore._installedPlugins.has(plugin)) return EUIXEngineCore;
        EUIXEngineCore._installedPlugins.add(plugin);

        if (isFn(plugin)) {
            plugin(EUIXEngineCore);
        } else if (plugin && isFn(plugin.install)) {
            plugin.install(EUIXEngineCore);
        }
        return EUIXEngineCore;
    }

    static registerAction(actionType, handler) {
        if (!EUIXEngineCore._globalActionHandlers) EUIXEngineCore._globalActionHandlers = new Map();
        if (actionType && isFn(handler)) {
            EUIXEngineCore._globalActionHandlers.set(String(actionType).toUpperCase(), handler);
        }
    }

    constructor(containerSelector) {
        this.container =
            typeof containerSelector === "string" ? document.querySelector(containerSelector) : containerSelector;
        this.state = null;
        this._rawState = null;
        this.xmlDoc = null;
        this._batching = false;
        this._isBatching = false;
        this._pendingFocusKey = null;
        this._bindings = new Map();
        this._stateKeyBits = new Map();
        this._nextStateBitIndex = 0;
        this._dirtyBitmask = 0n;
        this._customComponents = new Map();
        this._customActions = new Map();
        this._componentSpecs = new Map();
        this.refs = {};
        this.onError = null;
        this.constants = new Map();
        this._stateWatchers = new Map();
        this._globalStateWatchers = [];
        this._persistenceConfig = new Map();
        this._pendingAsyncLoads = [];
        this._activeIntervals = [];
        this._apiConfig = {
            baseUrl: "",
            credentials: undefined,
            headers: new Map(),
            timeout: 0,
            onRequest: null,
            onResponse: null,
            revalidateFocus: false,
            revalidateOnline: false,
        };
        this._registeredXhrs = new Set();
        this._xhrCache = new Map();
        if (!EUIXEngineCore._globalConstants) {
            EUIXEngineCore._globalConstants = new Map();
        }
        if (!EUIXEngineCore._globalComponentSpecs) {
            EUIXEngineCore._globalComponentSpecs = new Map();
        }
        this._actionRegistry = null;
        this._maxActionDepth = 25;
        this._depGraph = null;
        this._computedRegistry = null;
        this._watchRegistry = null;
        this._isEvaluatingComputed = false;
        this._reactiveDepth = 0;
        this._destroyHooks = [];
        this.hooks = new EUIXHookEmitter();
        if (isFn(this._setupStorageListener)) this._setupStorageListener();
        if (isFn(this._initRevalidationListeners)) this._initRevalidationListeners();
    }

    async loadDataModel(urlOrObj) {
        return loadDataModel(this, urlOrObj);
    }

    async loadConstants(urlOrObj) {
        return loadConstants(this, urlOrObj);
    }

    async preloadAsyncResources() {
        return preloadAsyncResources(this);
    }

    onUnmount(callback) {
        return onUnmount(this, callback);
    }

    unmount() {
        return this.destroy();
    }

    destroy() {
        return destroy(this);
    }

    _getTestStats() {
        return _getTestStats(this);
    }

    getBindingsStats() {
        return getBindingsStats(this);
    }

    getPerformanceMetrics() {
        return getPerformanceMetrics(this, EUIXEngineCore);
    }

    getProfilerData() {
        return this.getPerformanceMetrics();
    }

    watch(key, callback) {
        return watch(this, key, callback);
    }

    onStateChange(callback) {
        return onStateChange(this, callback);
    }

    watchState(key, callback) {
        return this.watch(key, callback);
    }

    triggerStateWatchers(key, newValue, oldValue) {
        return triggerStateWatchers(this, key, newValue, oldValue);
    }

    enableDevTools(autoOpen = false) {
        return enableDevTools(this, autoOpen);
    }

    static enableDevTools(autoOpen = false) {
        if (EUIXEngineCore.instance) {
            return enableDevTools(EUIXEngineCore.instance, autoOpen);
        }
        return null;
    }

    reportError(error, contextInfo = "") {
        return reportError(this, error, contextInfo);
    }

    static _globalErrorHandler = null;

    static onError(handler) {
        EUIXEngineCore._globalErrorHandler = handler;
        return EUIXEngineCore;
    }

    static _astCache = _astCache;
    static get _astCacheMaxSize() {
        return _astCacheMaxSize;
    }
    static set _astCacheMaxSize(val) {
        setAstCacheSize(val);
    }
    static _astCacheStats = _astCacheStats;

    static _cloneDocument(doc) {
        return _cloneDocument(doc);
    }

    static parseXmlToAst(xmlString, options = {}) {
        return parseXmlToAst(xmlString, options);
    }

    static generateCodeFrame(source, line = 1, col = 1, windowSize = 2) {
        return generateCodeFrame(source, line, col, windowSize);
    }

    static clearAstCache() {
        return clearAstCache();
    }

    static getAstCacheStats() {
        return getAstCacheStats();
    }

    static setAstCacheSize(maxSize) {
        return setAstCacheSize(maxSize);
    }

    static serializeAst(docOrXml) {
        return serializeAst(docOrXml);
    }

    static deserializeAst(astJson) {
        return deserializeAst(astJson);
    }

    get isPending() {
        return !!this._isPending;
    }

    startTransition(fn) {
        if (!isFn(fn)) return Promise.resolve();
        this._isPending = true;
        try {
            const res = fn();
            if (res && typeof res.then === "function") {
                return res.finally(() => {
                    this._isPending = false;
                });
            }
        } finally {
            this._isPending = false;
        }
        return Promise.resolve();
    }

    scheduleIdle(fn, options = { timeout: 1000 }) {
        if (!isFn(fn)) return () => {};
        if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
            const handle = window.requestIdleCallback(() => fn(this), options);
            return () => {
                if (typeof window.cancelIdleCallback === "function") {
                    window.cancelIdleCallback(handle);
                }
            };
        }
        const timer = setTimeout(() => fn(this), 1);
        return () => clearTimeout(timer);
    }

    static mount(xmlString, containerSelector = "#app", options = {}) {
        const engine = new EUIXEngineCore(containerSelector);
        EUIXEngineCore.instance = engine;
        engine.mount(xmlString, options);
        return engine;
    }

    static async mountAsync(xmlString, containerSelector = "#app", options = {}) {
        const engine = EUIXEngineCore.mount(xmlString, containerSelector, options);
        await engine.preloadAsyncResources();
        return engine;
    }

    static async loadComponent(name, url, options = {}) {
        return loadComponent(EUIXEngineCore, name, url, options);
    }

    static registerComponentSpec(name, xmlStringOrNode, options = {}) {
        return registerComponentSpec(EUIXEngineCore, name, xmlStringOrNode, options);
    }

    async loadComponentFile(name, url) {
        return loadComponentFile(this, name, url);
    }

    registerComponentSpec(name, xmlStringOrNode) {
        return registerEngineComponentSpec(this, name, xmlStringOrNode);
    }

    static autoInit() {
        return autoInit(EUIXEngineCore);
    }

    getChild(node, tagName) {
        return getChild(node, tagName);
    }

    getChildren(node, tagName) {
        return getChildren(node, tagName);
    }

    static _globalCustomComponents = new Map();

    static registerComponent(type, handler) {
        if (isStr(type) && isFn(handler)) {
            EUIXEngineCore._globalCustomComponents.set(type, handler);
        }
    }

    registerComponent(type, handler) {
        if (isStr(type) && isFn(handler)) {
            this._customComponents.set(type, handler);
            EUIXEngineCore._globalCustomComponents.set(type, handler);
        }
    }

    registerAction(actionType, handler) {
        if (isStr(actionType) && isFn(handler)) {
            this._customActions.set(actionType, handler);
        }
    }

    batch(fn) {
        return batch(this, fn);
    }

    static escapeRegExp(str) {
        return escapeRegExp(str);
    }

    escapeRegExp(str) {
        return escapeRegExp(str);
    }

    parseBindPath(expr) {
        return parseBindPath(expr);
    }

    extractStateKeys(expr) {
        return extractStateKeys(expr);
    }

    isTruthy(value) {
        return isTruthy(value);
    }

    resolveBinding(xmlNode, context = {}) {
        return resolveBinding(this, xmlNode, context);
    }

    getBindingValue(binding, context = {}) {
        return getBindingValue(this, binding, context);
    }

    setBindingValue(binding, value, context = {}, options = {}) {
        return setBindingValue(this, binding, value, context, options);
    }

    escapeHtml(text) {
        return escapeHtml(text);
    }

    getState(key) {
        return getState(this, key);
    }

    resolveValueFromPath(path, context = {}) {
        return resolveValueFromPath(this, path, context);
    }

    batchUpdates(fn) {
        return batchUpdates(this, fn);
    }

    getKeyMask(key) {
        return getKeyMask(this, key);
    }

    _invalidateComputed(changedKey, allAffected) {
        return _invalidateComputed(this, changedKey, allAffected);
    }

    flushStateUpdates() {
        return flushStateUpdates(this);
    }

    setStates(obj, options = {}) {
        return this.setState(obj, null, options);
    }

    setState(key, value, options = {}) {
        return setState(this, key, value, options);
    }

    toggleState(key) {
        return toggleState(this, key);
    }

    mutateState(key, operation, payload = {}) {
        return mutateState(this, key, operation, payload);
    }

    registerBinding(path, el, kind, updateFn = null) {
        return registerBinding(this, path, el, kind, updateFn);
    }

    syncBindings(path, value, sourceEl = null, executedFns = null) {
        return syncBindings(this, path, value, sourceEl, executedFns);
    }

    applyLayoutStyles(el, xmlNode, context) {
        return applyLayoutStyles(this, el, xmlNode, context);
    }

    applyItemChildStyles(childEl, childXmlNode, context) {
        return applyItemChildStyles(this, childEl, childXmlNode, context);
    }

    mount(appXmlString, options = {}) {
        return mount(this, appXmlString, options);
    }

    runMountActions() {
        return runMountActions(this);
    }

    processLifecycleHooks(xmlNode, domEl, context = {}) {
        return processLifecycleHooks(this, xmlNode, domEl, context);
    }

    getJsonPath(obj, path) {
        return getJsonPath(obj, path);
    }

    mapResponseItems(items, itemMapNode) {
        return mapResponseItems(this, items, itemMapNode);
    }

    handleXHR(_actionNode, _context = {}) {
        this.reportError(
            new Error("[EUIXEngine Core] XHR actions require EUIXApiPlugin to be registered."),
            "XHR Handler",
        );
        return null;
    }

    static registerConstant(name, value) {
        return registerGlobalConstant(EUIXEngineCore, name, value);
    }

    registerConstant(name, value) {
        return registerConstant(this, name, value);
    }

    getConstant(name) {
        return getConstant(this, name);
    }

    initConstants() {
        return initConstants(this);
    }

    initDataModel() {
        return initDataModel(this);
    }

    loadScript(src, options = {}) {
        return loadScript(this, src, options);
    }

    loadStyle(href, options = {}) {
        return loadStyle(this, href, options);
    }

    interpolate(text, context = {}) {
        return interpolate(this, text, context);
    }

    evalCondition(expr, context = {}) {
        return evalCondition(this, expr, context);
    }

    appendChildren(fragment, nodes, context, options = {}) {
        return appendChildren(this, fragment, nodes, context, options);
    }

    renderConditional(xmlNode, context = {}) {
        return renderConditional(this, xmlNode, context);
    }

    resolveBindPath(xmlNode) {
        return resolveBindPath(this, xmlNode);
    }

    applyNodeAttributes(el, xmlNode, context = {}) {
        return applyNodeAttributes(this, el, xmlNode, context);
    }

    updateAttributeBinding(el, attrName, template, context = {}) {
        return updateAttributeBinding(this, el, attrName, template, context);
    }

    applyRef(el, xmlNode, context = {}) {
        return applyRef(this, el, xmlNode, context);
    }

    createHTMLElement(xmlNode, context = {}) {
        return createHTMLElement(this, xmlNode, context);
    }

    _createHTMLElementInternal(xmlNode, context = {}) {
        return _createHTMLElementInternal(this, xmlNode, context);
    }

    executeEventHandlers(handlerNodes, eventType, e, el, context = {}) {
        return executeEventHandlers(this, handlerNodes, eventType, e, el, context);
    }

    _setupContainerEventDelegation(containerTarget) {
        return _setupContainerEventDelegation(this, containerTarget);
    }

    bindEvents(xmlNode, el, context = {}) {
        return bindEvents(this, xmlNode, el, context);
    }

    renderComponentSpec(specNode, usageNode, context = {}) {
        return renderComponentSpec(this, specNode, usageNode, context);
    }

    initComponentSchema(specNode, context = {}) {
        return initComponentSchema(this, specNode, context);
    }

    applyResets(actionNode) {
        return applyResets(this, actionNode);
    }

    confirmAction(actionNode, context = {}) {
        return confirmAction(this, actionNode, context);
    }

    _handleActionError(err, actionNode, context = {}) {
        return _handleActionError(this, err, actionNode, context);
    }

    handleAction(actionNode, context = {}) {
        return handleAction(this, actionNode, context);
    }

    _handleTryCatchFinally(tryNode, context = {}) {
        return _handleTryCatchFinally(this, tryNode, context);
    }

    _handleActionInternal(actionNode, context = {}) {
        return _handleActionInternal(this, actionNode, context);
    }

    _setScopedState(rawPath, path, nextValue, context = {}) {
        return _setScopedState(this, rawPath, path, nextValue, context);
    }

    _handleSetStateAction(actionNode, context = {}) {
        return _handleSetStateAction.call(this, actionNode, context);
    }

    _handleToggleStateAction(actionNode, context = {}) {
        return _handleToggleStateAction.call(this, actionNode, context);
    }

    _handleFocusAction(actionNode, context = {}) {
        return _handleFocusAction.call(this, actionNode, context);
    }

    _handleRevalidateAction(actionNode, context = {}) {
        return _handleRevalidateAction.call(this, actionNode, context);
    }

    _handleSetTitleAction(actionNode, context = {}) {
        return _handleSetTitleAction.call(this, actionNode, context);
    }

    _handleThrowAction(actionNode, context = {}) {
        return _handleThrowAction.call(this, actionNode, context);
    }

    _handleRethrowAction(actionNode, context = {}) {
        return _handleRethrowAction.call(this, actionNode, context);
    }

    _handleRunScriptAction(actionNode, context = {}) {
        return _handleRunScriptAction.call(this, actionNode, context);
    }

    _handleMutateStateAction(actionNode, context = {}) {
        return _handleMutateStateAction.call(this, actionNode, context);
    }

    _handleUndoStateAction(actionNode, context = {}) {
        return _handleUndoStateAction.call(this, actionNode, context);
    }

    _handleRedoStateAction(actionNode, context = {}) {
        return _handleRedoStateAction.call(this, actionNode, context);
    }

    _handleTakeSnapshotAction(actionNode, context = {}) {
        return _handleTakeSnapshotAction.call(this, actionNode, context);
    }

    _executeActionInternalBody(actionNode, context = {}) {
        return _executeActionInternalBody(this, actionNode, context);
    }

    processStyleTag(xmlNode, context = {}, targetEl = null) {
        return processStyleTag(this, xmlNode, context, targetEl);
    }

    render() {
        return render(this);
    }
}

EUIXEngineCore.EUIXExpressionParser = EUIXExpressionParser;
EUIXEngineCore.EUIXStructuredError = EUIXStructuredError;
EUIXEngineCore.EUIXXMLParseError = EUIXXMLParseError;
EUIXEngineCore.scopeCSS = scopeCSS;
EUIXEngineCore.processStyleTag = processStyleTag;

if (typeof window !== "undefined" && typeof document !== "undefined") {
    window.EUIXExpressionParser = EUIXExpressionParser;
    window.EUIXStructuredError = EUIXStructuredError;
    window.EUIXXMLParseError = EUIXXMLParseError;
    window.EUIXEngineCore = EUIXEngineCore;
    const scheduleCoreInit = () => {
        queueMicrotask(() => {
            if (window.EUIXEngine && typeof window.EUIXEngine.autoInit === "function") {
                window.EUIXEngine.autoInit();
            } else {
                EUIXEngineCore.autoInit();
            }
        });
    };
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", scheduleCoreInit);
    } else {
        scheduleCoreInit();
    }
}

export {
    EUIXEngineCore,
    EUIXEngineCore as EUIXEngine,
    EUIXExpressionParser,
    EUIXHookEmitter,
    EUIXStructuredError,
    EUIXXMLParseError,
    processStyleTag,
    scopeCSS,
};
export default EUIXEngineCore;
