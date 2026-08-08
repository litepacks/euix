/**
 * EUIXEngine.js
 * Main Entry Point for EUIX Engine (Full Bundle).
 * Automatically bundles EUIXEngineCore with built-in API, Action Composer, and Drag-and-Drop plugins.
 */

import { EUIXEngineCore, EUIXExpressionParser } from "./core/EUIXEngineCore.js";
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

// Register default plugins automatically for full bundle backward compatibility
EUIXEngineCore.use(EUIXApiPlugin);
EUIXEngineCore.use(EUIXComposerPlugin);
EUIXEngineCore.use(EUIXDragDropPlugin);
EUIXEngineCore.use(EUIXStoragePlugin);
EUIXEngineCore.use(EUIXCollapsePlugin);
EUIXEngineCore.use(EUIXDialogPlugin);

const EUIXEngine = EUIXEngineCore;

if (typeof window !== "undefined" && typeof document !== "undefined") {
    window.EUIXExpressionParser = EUIXExpressionParser;
    window.EUIXEngineCore = EUIXEngineCore;
    window.EUIXEngine = EUIXEngine;
    window.EUIXActionRecursionError = EUIXActionRecursionError;
    window.EUIXActionValidationError = EUIXActionValidationError;
    window.EUIXActionContext = EUIXActionContext;
    window.EUIXActionValidator = EUIXActionValidator;
    window.EUIXActionRegistry = EUIXActionRegistry;
    window.EUIXActionComposer = EUIXActionComposer;

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
    EUIXApiPlugin,
    EUIXComposerPlugin,
    EUIXDragDropPlugin,
    EUIXStoragePlugin,
    EUIXCollapsePlugin,
    EUIXDialogPlugin,
    EUIXActionRecursionError,
    EUIXActionValidationError,
    EUIXActionContext,
    EUIXActionValidator,
    EUIXActionRegistry,
    EUIXActionComposer
};

export default EUIXEngine;
