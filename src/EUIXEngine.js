/**
 * EUIXEngine.js
 * Main Entry Point for EUIX Engine (Full Bundle).
 * Automatically bundles EUIXEngineCore with built-in API, Action Composer, and Drag-and-Drop plugins.
 */

import { EUIXEngineCore, EUIXExpressionParser, EUIXStructuredError, EUIXXMLParseError } from "./core/EUIXEngineCore.js";
import { EUIXAnimationPlugin, EUIXAnimationPresets, EUIXAnimationRegistry } from "./plugins/EUIXAnimationPlugin.js";
import { EUIXApiPlugin } from "./plugins/EUIXApiPlugin.js";
import { EUIXChartError, EUIXChartPlugin } from "./plugins/EUIXChartPlugin.js";
import { EUIXCollapsePlugin } from "./plugins/EUIXCollapsePlugin.js";
import {
    EUIXActionComposer,
    EUIXActionContext,
    EUIXActionRecursionError,
    EUIXActionRegistry,
    EUIXActionValidationError,
    EUIXActionValidator,
    EUIXComposerPlugin,
} from "./plugins/EUIXComposerPlugin.js";
import { DATE_PRESETS, EUIXDateFormatter, EUIXDatePlugin } from "./plugins/EUIXDatePlugin.js";
import { EUIXDialogPlugin } from "./plugins/EUIXDialogPlugin.js";
import { EUIXDragDropPlugin } from "./plugins/EUIXDragDropPlugin.js";
import { EUIXHeadPlugin, EUIXHelmetPlugin } from "./plugins/EUIXHeadPlugin.js";
import { EUIXLazyPlugin } from "./plugins/EUIXLazyPlugin.js";
import { EUIXLeafletPlugin } from "./plugins/EUIXLeafletPlugin.js";
import { EUIXNavigatorPlugin } from "./plugins/EUIXNavigatorPlugin.js";
import {
    EUIXComputedNode,
    EUIXDependencyGraph,
    EUIXReactivePlugin,
    EUIXWatchNode,
} from "./plugins/EUIXReactivePlugin.js";
import { EUIXCancellationController, EUIXResiliencePlugin } from "./plugins/EUIXResiliencePlugin.js";
import {
    createMemoryRouter,
    createPath,
    createStaticRouter,
    EUIXRouter,
    EUIXRouterPlugin,
    generatePath,
    matchPath,
    matchRoutes,
    parsePath,
    RouterError,
    RouterRedirect,
    resolvePath,
} from "./plugins/EUIXRouterPlugin.js";
import { EUIXStoragePlugin } from "./plugins/EUIXStoragePlugin.js";

// Register default plugins automatically for full bundle backward compatibility
EUIXEngineCore.use(EUIXApiPlugin);
EUIXEngineCore.use(EUIXComposerPlugin);
EUIXEngineCore.use(EUIXDragDropPlugin);
EUIXEngineCore.use(EUIXStoragePlugin);
EUIXEngineCore.use(EUIXCollapsePlugin);
EUIXEngineCore.use(EUIXDialogPlugin);
EUIXEngineCore.use(EUIXResiliencePlugin);
EUIXEngineCore.use(EUIXReactivePlugin);
EUIXEngineCore.use(EUIXAnimationPlugin);
EUIXEngineCore.use(EUIXHeadPlugin);
EUIXEngineCore.use(EUIXLeafletPlugin);
EUIXEngineCore.use(EUIXNavigatorPlugin);
EUIXEngineCore.use(EUIXChartPlugin);
EUIXEngineCore.use(EUIXRouterPlugin);
EUIXEngineCore.use(EUIXDatePlugin);
EUIXEngineCore.use(EUIXLazyPlugin);

const EUIXEngine = EUIXEngineCore;

if (typeof window !== "undefined" && typeof document !== "undefined") {
    window.EUIXExpressionParser = EUIXExpressionParser;
    window.EUIXStructuredError = EUIXStructuredError;
    window.EUIXCancellationController = EUIXCancellationController;
    window.EUIXEngineCore = EUIXEngineCore;
    window.EUIXEngine = EUIXEngine;
    window.EUIXActionRecursionError = EUIXActionRecursionError;
    window.EUIXActionValidationError = EUIXActionValidationError;
    window.EUIXActionContext = EUIXActionContext;
    window.EUIXActionValidator = EUIXActionValidator;
    window.EUIXActionRegistry = EUIXActionRegistry;
    window.EUIXActionComposer = EUIXActionComposer;
    window.EUIXResiliencePlugin = EUIXResiliencePlugin;
    window.EUIXReactivePlugin = EUIXReactivePlugin;
    window.EUIXAnimationPlugin = EUIXAnimationPlugin;
    window.EUIXAnimationPresets = EUIXAnimationPresets;
    window.EUIXAnimationRegistry = EUIXAnimationRegistry;
    window.EUIXHeadPlugin = EUIXHeadPlugin;
    window.EUIXHelmetPlugin = EUIXHelmetPlugin;
    window.EUIXLeafletPlugin = EUIXLeafletPlugin;
    window.EUIXNavigatorPlugin = EUIXNavigatorPlugin;
    window.EUIXChartPlugin = EUIXChartPlugin;
    window.EUIXChartError = EUIXChartError;
    window.EUIXRouterPlugin = EUIXRouterPlugin;
    window.EUIXRouter = EUIXRouter;
    window.createMemoryRouter = createMemoryRouter;
    window.createStaticRouter = createStaticRouter;
    window.EUIXDatePlugin = EUIXDatePlugin;
    window.EUIXDateFormatter = EUIXDateFormatter;
    window.DATE_PRESETS = DATE_PRESETS;
    window.EUIXLazyPlugin = EUIXLazyPlugin;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => EUIXEngine.autoInit());
    } else {
        EUIXEngine.autoInit();
    }
}

export {
    createMemoryRouter,
    createPath,
    createStaticRouter,
    DATE_PRESETS,
    EUIXActionComposer,
    EUIXActionContext,
    EUIXActionRecursionError,
    EUIXActionRegistry,
    EUIXActionValidationError,
    EUIXActionValidator,
    EUIXAnimationPlugin,
    EUIXAnimationPresets,
    EUIXAnimationRegistry,
    EUIXApiPlugin,
    EUIXCancellationController,
    EUIXChartError,
    EUIXChartPlugin,
    EUIXCollapsePlugin,
    EUIXComposerPlugin,
    EUIXComputedNode,
    EUIXDateFormatter,
    EUIXDatePlugin,
    EUIXDependencyGraph,
    EUIXDialogPlugin,
    EUIXDragDropPlugin,
    EUIXEngine,
    EUIXEngineCore,
    EUIXExpressionParser,
    EUIXReactivePlugin,
    EUIXResiliencePlugin,
    EUIXRouter,
    EUIXRouterPlugin,
    EUIXStoragePlugin,
    EUIXStructuredError,
    EUIXWatchNode,
    EUIXXMLParseError,
    generatePath,
    matchPath,
    matchRoutes,
    parsePath,
    RouterError,
    RouterRedirect,
    resolvePath,
};

export default EUIXEngine;
