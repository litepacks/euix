/**
 * types/index.d.ts
 * Main TypeScript type declarations for euixjs (Full Bundle).
 */

import { EUIXEngineCore } from './core';

export * from './core';
export * from './plugins';
export * from './prepare';

export interface EUIXGlobalHelper {
    mount(element: HTMLElement, options?: { props?: Record<string, any>; state?: Record<string, any> }): Promise<any>;
    mountElement(element: HTMLElement, options?: { props?: Record<string, any>; state?: Record<string, any> }): Promise<any>;
    unmount(element: HTMLElement): boolean;
    scan(root?: Document | HTMLElement): Promise<any[]>;
    get(elementOrSelector: HTMLElement | string): any;
    instances: any[];
}

export declare const euix: EUIXGlobalHelper;

export class EUIXEngine<TState extends Record<string, any> = Record<string, any>> extends EUIXEngineCore<TState> {
    static mount<T extends Record<string, any> = Record<string, any>>(
        xmlString: string | HTMLElement,
        containerSelector?: string | HTMLElement
    ): EUIXEngine<T>;
    static mountElement<T extends Record<string, any> = Record<string, any>>(
        element: HTMLElement,
        options?: { props?: Record<string, any>; state?: Record<string, any> }
    ): Promise<EUIXEngine<T>>;
    static unmountElement(element: HTMLElement): boolean;
    static scan(root?: Document | HTMLElement): Promise<EUIXEngine[]>;
    static getEngine(elementOrSelector: HTMLElement | string): EUIXEngine | undefined;
    static instances: EUIXEngine[];
    static elements: WeakMap<HTMLElement, EUIXEngine>;
}

export default EUIXEngine;

