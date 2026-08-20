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
export const EUIXRouterPlugin: EUIXPlugin;
export const EUIXDatePlugin: EUIXPlugin;
export const DATE_PRESETS: Record<string, Intl.DateTimeFormatOptions>;
export class EUIXDateFormatter {
    parseDate(value: Date | string | number | null | undefined): Date | null;
    format(value: Date | string | number, optionsOrPreset?: string | Intl.DateTimeFormatOptions, locale?: string, timeZone?: string): string;
    formatRelative(value: Date | string | number, baseDate?: Date | string | number, options?: { numeric?: "auto" | "always"; style?: "long" | "short" | "narrow" }, locale?: string): string;
    formatRange(start: Date | string | number, end: Date | string | number, optionsOrPreset?: string | Intl.DateTimeFormatOptions, locale?: string, timeZone?: string): string;
    add(value: Date | string | number, amount?: number, unit?: "seconds" | "minutes" | "hours" | "days" | "weeks" | "months" | "years"): Date | null;
    subtract(value: Date | string | number, amount?: number, unit?: "seconds" | "minutes" | "hours" | "days" | "weeks" | "months" | "years"): Date | null;
    diff(start: Date | string | number, end: Date | string | number, unit?: "seconds" | "minutes" | "hours" | "days" | "weeks" | "months" | "years"): number;
    startOf(value: Date | string | number, unit?: "year" | "month" | "week" | "day" | "hour" | "minute"): Date | null;
    endOf(value: Date | string | number, unit?: "year" | "month" | "week" | "day" | "hour" | "minute"): Date | null;
    daysInMonth(value: Date | string | number): number;
    isLeapYear(value: Date | string | number): boolean;
    isSame(start: Date | string | number, end: Date | string | number, unit?: string): boolean;
    isBefore(start: Date | string | number, end: Date | string | number, unit?: string | null): boolean;
    isAfter(start: Date | string | number, end: Date | string | number, unit?: string | null): boolean;
    isBetween(target: Date | string | number, start: Date | string | number, end: Date | string | number, inclusivity?: "()" | "[)" | "(]" | "[]"): boolean;
    isToday(value: Date | string | number): boolean;
    isTomorrow(value: Date | string | number): boolean;
    isYesterday(value: Date | string | number): boolean;
    quarter(value: Date | string | number): number;
    weekOfYear(value: Date | string | number): number;
    formatToParts(value: Date | string | number, optionsOrPreset?: string | Intl.DateTimeFormatOptions, locale?: string, timeZone?: string): Array<{ type: string; value: string }>;
}
export const EUIXChartPlugin: EUIXPlugin & {
    configure(options?: { Chart?: any }): void;
};

export class EUIXChartError extends Error {
    code: string;
    context: any;
}

export interface EUIXChartEngineApi {
    get(id: string): any;
    has(id: string): boolean;
    update(id: string, mode?: string): boolean;
    resize(id: string): boolean;
    destroy(id: string): boolean;
    show(id: string, datasetIndex?: number): boolean;
    hide(id: string, datasetIndex?: number): boolean;
    toggleDataset(id: string, datasetIndex?: number): boolean;
    toggleData(id: string, index?: number): boolean;
    toBase64Image(id: string, type?: string, quality?: number): string | null;
}

export class EUIXRouter {
    navigate(to: string | object, options?: any): Promise<boolean>;
    back(): void;
    forward(): void;
    go(delta: number): void;
    revalidate(routeId?: string): Promise<void>;
    prefetch(targetPath: string): Promise<void>;
    fetcher(id: string): any;
    path(routeName: string, params?: Record<string, any>): string;
    inspect(): object;
}

export function createMemoryRouter(options?: any): EUIXRouter;
export function createStaticRouter(options?: any): Promise<any>;

export interface EUIXInspectorOptions {
    enabled?: boolean;
    shortcut?: string;
    maxEvents?: number;
    testAttributes?: boolean;
    maskSensitive?: boolean;
}

export class EUIXInspector {
    constructor(engine?: EUIXEngineCore, options?: EUIXInspectorOptions);
    enabled: boolean;
    enable(): void;
    disable(): void;
    toggle(force?: boolean): void;
    select(element: Element): void;
    showBoundaries(): void;
    hideBoundaries(): void;
    toggleBoundaries(): void;
    destroy(): void;
}

export function inspector(options?: EUIXInspectorOptions): EUIXPlugin;
export const EUIXInspectorPlugin: EUIXPlugin;

export class EUIXDevTools extends EUIXInspector {
    static init(engine?: EUIXEngineCore, options?: EUIXInspectorOptions): EUIXDevTools;
    static open(): void;
    static close(): void;
    static toggle(): void;
}

// Playwright E2E Helpers
export class EuixPlaywrightWrapper {
    constructor(pageOrLocator: any, scopeSelector?: string);
    component(componentName: string): EuixPlaywrightWrapper;
    action(actionName: string): any;
    getByTestId(testId: string): any;
    testId(testId: string): any;
    element(refOrSelector: string): any;
    waitForIdle(options?: { timeout?: number }): Promise<this>;
    waitForReady(options?: { timeout?: number }): Promise<this>;
    debug(): Promise<any>;
    locator(selector: string): any;
    click(options?: any): Promise<void>;
    fill(value: string, options?: any): Promise<void>;
    textContent(): Promise<string | null>;
}

export function euix(pageOrLocator: any): EuixPlaywrightWrapper;
export function getByComponent(pageOrLocator: any, componentName: string): any;
export function getByAction(pageOrLocator: any, actionName: string): any;
export function getByTestId(pageOrLocator: any, testId: string): any;

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
