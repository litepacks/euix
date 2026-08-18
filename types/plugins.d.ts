/**
 * types/plugins.d.ts
 * TypeScript type definitions for all modular EUIX plugins.
 */

import { EUIXPlugin, EUIXEngineCore } from './core';

export const EUIXApiPlugin: EUIXPlugin;
export const EUIXComposerPlugin: EUIXPlugin;
export const EUIXDragDropPlugin: EUIXPlugin;
export const EUIXStoragePlugin: EUIXPlugin;
export const EUIXCollapsePlugin: EUIXPlugin;
export const EUIXDialogPlugin: EUIXPlugin;
export const EUIXResiliencePlugin: EUIXPlugin;
export const EUIXReactivePlugin: EUIXPlugin;
export const EUIXAnimationPlugin: EUIXPlugin;
export const EUIXHeadPlugin: EUIXPlugin;
export const EUIXHelmetPlugin: EUIXPlugin;
export const EUIXLeafletPlugin: EUIXPlugin;
export const EUIXNavigatorPlugin: EUIXPlugin;

export class EUIXDevTools {
    static init(engine?: EUIXEngineCore): EUIXDevTools;
    static open(): void;
    static close(): void;
    static toggle(): void;
}

// Action Composer Types
export class EUIXActionRecursionError extends Error {}
export class EUIXActionValidationError extends Error {}
export class EUIXActionContext {}
export class EUIXActionValidator {}
export class EUIXActionRegistry {}
export class EUIXActionComposer {}

// Reactive Types
export class EUIXDependencyGraph {}
export class EUIXComputedNode {}
export class EUIXWatchNode {}

// Resilience Types
export class EUIXCancellationController {
    isCancelled: boolean;
    cancel(): void;
}

// Animation Types
export const EUIXAnimationPresets: Record<string, any>;
export class EUIXAnimationRegistry {}

// Leaflet Spatial Types
export function calculatePolygonArea(latlngs: Array<[number, number]>): number;
export function formatMetricArea(areaSqMeters: number): string;
