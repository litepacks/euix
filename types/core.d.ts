/**
 * types/core.d.ts
 * TypeScript type definitions for EUIXEngineCore.
 */

export interface EUIXPlugin {
    name: string;
    install: (engineClass: typeof EUIXEngineCore) => void;
}

export interface EUIXStateOptions {
    silent?: boolean;
    batch?: boolean;
    sourceEl?: HTMLElement;
    context?: Record<string, any>;
}

export type EUIXMutationOperation =
    | 'PUSH'
    | 'APPEND'
    | 'POP'
    | 'SHIFT'
    | 'UNSHIFT'
    | 'PREPEND'
    | 'REMOVE'
    | 'DELETE'
    | 'SWAP'
    | 'UPDATE'
    | 'SET'
    | 'INSERT'
    | 'MOVE_UP'
    | 'MOVE_DOWN'
    | 'REVERSE'
    | 'SORT'
    | 'INCREMENT'
    | 'DECREMENT'
    | 'CLEAR'
    | 'EMPTY'
    | 'RESET';

export interface EUIXStructuredErrorOptions {
    message: string;
    code?: string;
    status?: number;
    originatingAction?: string;
    component?: string;
    details?: any;
}

export class EUIXStructuredError extends Error {
    code: string;
    status?: number;
    originatingAction?: string;
    component?: string;
    details?: any;
    timestamp: number;

    constructor(options: EUIXStructuredErrorOptions | string);
    static from(err: any, extra?: Partial<EUIXStructuredErrorOptions>): EUIXStructuredError;
}

export class EUIXXMLParseError extends Error {
    xmlSnippet?: string;
    constructor(message: string, xmlSnippet?: string);
}

export class EUIXExpressionParser {
    static tokenize(expr: string): Array<{ type: string; value: any }>;
    static parseToJs(tokens: Array<{ type: string; value: any }>): string;
    static evaluate(exprString: string, context?: Record<string, any>): any;
    static interpolate(templateString: string, context?: Record<string, any>): string;
}

export interface BindingModifiers {
    number?: boolean;
    trim?: boolean;
    boolean?: boolean;
    lazy?: boolean;
    debounce?: number;
}

export interface ResolvedBinding {
    type: 'state' | 'context';
    path?: string;
    scope?: string;
    prop?: string;
    modifiers: BindingModifiers;
}

export interface ErrorBoundaryController {
    id: string;
    name: string;
    hasError: boolean;
    error: any;
    el: HTMLElement;
    catchError(error: Error | any): void;
    retry(): void;
    reset(): void;
}

export class EUIXEngineCore<TState extends Record<string, any> = Record<string, any>> {
    container: HTMLElement | null;
    state: TState;
    refs: Record<string, HTMLElement>;
    xmlDoc: Document | null;
    onError: ((err: EUIXStructuredError | Error, context?: string) => void) | null;

    constructor(containerSelector?: string | HTMLElement);

    static use(plugin: EUIXPlugin): typeof EUIXEngineCore;
    static mount<T extends Record<string, any> = Record<string, any>>(
        xmlString: string | HTMLElement,
        containerSelector?: string | HTMLElement
    ): EUIXEngineCore<T>;
    static registerAction(actionType: string, handler: (actionNode: Element, context: Record<string, any>) => any): void;

    mount<T extends Record<string, any> = TState>(
        xmlString: string | HTMLElement,
        containerSelector?: string | HTMLElement
    ): EUIXEngineCore<T>;
    unmount(): this;
    destroy(): void;
    onUnmount(callback: () => void): this;

    getState<K extends keyof TState>(key: K): TState[K];
    getState(): TState;
    getState<TVal = any>(key: string): TVal;

    setState<K extends keyof TState>(
        key: K,
        value: TState[K] | ((prev: TState[K]) => TState[K]),
        options?: EUIXStateOptions
    ): void;
    setState(partialState: Partial<TState>, options?: EUIXStateOptions): void;
    setState<TVal = any>(key: string, value: TVal, options?: EUIXStateOptions): void;

    mutateState<K extends keyof TState>(path: K | string, operation: EUIXMutationOperation, payload?: any): this;
    toggleState<K extends keyof TState>(key: K | string): boolean;
    batch(fn: () => void): void;
    batchUpdates(fn: () => void): void;

    watch<K extends keyof TState>(key: K, callback: (newValue: TState[K], oldValue: TState[K]) => void): () => void;
    watch(key: string, callback: (newValue: any, oldValue: any) => void): () => void;
    watchState<K extends keyof TState>(key: K, callback: (newValue: TState[K], oldValue: TState[K]) => void): () => void;
    watchState(key: string, callback: (newValue: any, oldValue: any) => void): () => void;
    onStateChange(callback: (key: string, newValue: any, oldValue: any) => void): () => void;

    // Error Boundary controls
    getErrorBoundary(nameOrId: string): ErrorBoundaryController | undefined;
    resetErrorBoundary(nameOrId: string): boolean;
    catchErrorBoundary(nameOrId: string, error: Error | any): boolean;
    findClosestErrorBoundary(element: HTMLElement): ErrorBoundaryController | null;

    // Binding modifiers and coercion
    extractBindModifiers(xmlNode: Element | null): { bindAttr: string | null; modifiers: BindingModifiers };
    coerceBindingValue(
        rawValue: any,
        binding?: ResolvedBinding | { path?: string; modifiers?: BindingModifiers },
        xmlNode?: Element | null
    ): any;

    registerAction(name: string, handler: (actionNode: Element, context: Record<string, any>) => any): this;
    handleAction(actionNode: Element, context?: Record<string, any>): any;
    executeAction(actionName: string, args?: Record<string, any>): Promise<any>;

    clearApiCache(tagOrUrl?: string): void;
    flushOfflineQueue(): Promise<void>;
    getApiStatus(endpointId: string): {
        loading: boolean;
        error: string | null;
        status: number | null;
        data: any;
        timestamp: number | null;
        stale: boolean;
        isOffline: boolean;
    };

    interpolate(text: string, context?: Record<string, any>): string;
    evalCondition(conditionStr: string, context?: Record<string, any>): boolean;
    getPerformanceMetrics(): Record<string, any>;
}

export default EUIXEngineCore;
