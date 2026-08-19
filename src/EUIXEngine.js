/**
 * EUIXEngine.js
 * Main Entry Point for EUIX Engine (Full Bundle).
 * Automatically bundles EUIXEngineCore with built-in API, Action Composer, and Drag-and-Drop plugins.
 */

import { EUIXEngineCore, EUIXExpressionParser, EUIXStructuredError, EUIXXMLParseError } from "./core/EUIXEngineCore.js";
import { EUIXApiPlugin } from "./plugins/EUIXApiPlugin.js";
import {
    EUIXComposerPlugin,
    EUIXActionRecursionError,
    EUIXActionValidationError,
    EUIXActionContext,
    EUIXActionValidator,
    EUIXActionRegistry,
    EUIXActionComposer
} from "./plugins/EUIXComposerPlugin.js";
import { EUIXDragDropPlugin } from "./plugins/EUIXDragDropPlugin.js";
import { EUIXStoragePlugin } from "./plugins/EUIXStoragePlugin.js";
import { EUIXCollapsePlugin } from "./plugins/EUIXCollapsePlugin.js";
import { EUIXDialogPlugin } from "./plugins/EUIXDialogPlugin.js";
import { EUIXResiliencePlugin, EUIXCancellationController } from "./plugins/EUIXResiliencePlugin.js";
import { EUIXReactivePlugin, EUIXDependencyGraph, EUIXComputedNode, EUIXWatchNode } from "./plugins/EUIXReactivePlugin.js";
import { EUIXAnimationPlugin, EUIXAnimationPresets, EUIXAnimationRegistry } from "./plugins/EUIXAnimationPlugin.js";
import { EUIXHeadPlugin, EUIXHelmetPlugin } from "./plugins/EUIXHeadPlugin.js";
import { EUIXLeafletPlugin, calculatePolygonArea, formatMetricArea } from "./plugins/EUIXLeafletPlugin.js";
import { EUIXNavigatorPlugin } from "./plugins/EUIXNavigatorPlugin.js";
import { EUIXChartPlugin, EUIXChartError } from "./plugins/EUIXChartPlugin.js";
import {
    EUIXRouterPlugin,
    EUIXRouter,
    createMemoryRouter,
    createStaticRouter,
    RouterRedirect,
    RouterError,
    matchPath,
    matchRoutes,
    generatePath,
    resolvePath,
    createPath,
    parsePath
} from "./plugins/EUIXRouterPlugin.js";

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

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => EUIXEngine.autoInit());
    } else {
        EUIXEngine.autoInit();
    }
}

export {
    EUIXEngine,
    EUIXEngineCore,
    EUIXExpressionParser,
    EUIXStructuredError,
    EUIXXMLParseError,
    EUIXCancellationController,
    EUIXApiPlugin,
    EUIXComposerPlugin,
    EUIXDragDropPlugin,
    EUIXStoragePlugin,
    EUIXCollapsePlugin,
    EUIXDialogPlugin,
    EUIXResiliencePlugin,
    EUIXReactivePlugin,
    EUIXAnimationPlugin,
    EUIXAnimationPresets,
    EUIXAnimationRegistry,
    EUIXDependencyGraph,
    EUIXComputedNode,
    EUIXWatchNode,
    EUIXActionRecursionError,
    EUIXActionValidationError,
    EUIXActionContext,
    EUIXActionValidator,
    EUIXActionRegistry,
    EUIXActionComposer,
    EUIXChartPlugin,
    EUIXChartError,
    EUIXRouterPlugin,
    EUIXRouter,
    createMemoryRouter,
    createStaticRouter,
    RouterRedirect,
    RouterError,
    matchPath,
    matchRoutes,
    generatePath,
    resolvePath,
    createPath,
    parsePath
};

export default EUIXEngine;

