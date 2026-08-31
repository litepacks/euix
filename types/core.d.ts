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

export class EUIXEngineCore {
    container: HTMLElement | null;
    state: Record<string, any>;
    refs: Record<string, HTMLElement>;
    xmlDoc: Document | null;
    onError: ((err: EUIXStructuredError | Error, context?: string) => void) | null;

    constructor(containerSelector?: string | HTMLElement);

    static use(plugin: EUIXPlugin): typeof EUIXEngineCore;
    static mount(xmlString: string | HTMLElement, containerSelector?: string | HTMLElement): EUIXEngineCore;
    static registerAction(actionType: string, handler: (actionNode: Element, context: Record<string, any>) => any): void;

    mount(xmlString: string | HTMLElement, containerSelector?: string | HTMLElement): this;
    unmount(): this;
    destroy(): void;
    onUnmount(callback: () => void): this;

    getState<T = any>(key: string): T;
    setState<T = any>(key: string, value: T, options?: EUIXStateOptions): void;
    mutateState(path: string, operation: EUIXMutationOperation, payload?: any): this;
    batch(fn: () => void): void;
    batchUpdates(fn: () => void): void;

    watch(key: string, callback: (newValue: any, oldValue: any) => void): () => void;
    watchState(key: string, callback: (newValue: any, oldValue: any) => void): () => void;
    onStateChange(callback: (key: string, newValue: any, oldValue: any) => void): () => void;

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
