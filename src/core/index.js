/**
 * src/core/index.js
 * Public entrypoint for EUIX Engine Core module.
 */

export { bindEvents, executeEventHandlers, handleAction } from "./actions/ActionDispatcher.js";
export {
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
export {
    loadComponent,
    loadComponentFile,
    registerComponentSpec,
    registerEngineComponentSpec,
    renderComponentSpec,
} from "./components/ComponentLoader.js";
export { EUIXEngineCore, EUIXExpressionParser, EUIXStructuredError, EUIXXMLParseError } from "./EUIXEngineCore.js";
export { EUIXHookEmitter } from "./events/HookEmitter.js";
export {
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
export {
    clearAstCache,
    generateCodeFrame,
    getAstCacheStats,
    parseXmlToAst,
    setAstCacheSize,
} from "./parser/AstParser.js";
export { EUIXExpressionParser as ExpressionParser } from "./parser/ExpressionParser.js";
export { EUIXStructuredError as StructuredError, EUIXXMLParseError as XMLParseError } from "./parser/errors.js";
export {
    _getTestStats,
    enableDevTools,
    getBindingsStats,
    getPerformanceMetrics,
    updateDevToolsStatus,
} from "./profiler/Profiler.js";
export {
    applyItemChildStyles,
    applyLayoutStyles,
    applyNodeAttributes,
    createHTMLElement,
    evalCondition,
    interpolate,
    render,
    renderConditional,
    updateAttributeBinding,
} from "./renderer/DOMRenderer.js";
export { _getLongestIncreasingSubsequence, _reconcileKeyedDOM, renderForEach } from "./renderer/ForEachRenderer.js";
export { getConstant, registerConstant, registerGlobalConstant } from "./state/Constants.js";
export { applyArrayMutation } from "./state/Mutations.js";
export {
    batch,
    batchUpdates,
    flushStateUpdates,
    getState,
    mutateState,
    registerBinding,
    setState,
    syncBindings,
    toggleState,
} from "./state/ReactiveStore.js";
export { onStateChange, triggerStateWatchers, watch } from "./state/Watchers.js";
export { MUTATION_OPS } from "./utils/constants.js";
export { getChild, getChildren, reportError } from "./utils/domHelpers.js";
