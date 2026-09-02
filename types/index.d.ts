/**
 * types/index.d.ts
 * Main TypeScript type declarations for euixjs (Full Bundle).
 */

import { EUIXEngineCore } from './core';

export * from './core';
export * from './plugins';

export class EUIXEngine<TState extends Record<string, any> = Record<string, any>> extends EUIXEngineCore<TState> {
    static mount<T extends Record<string, any> = Record<string, any>>(
        xmlString: string | HTMLElement,
        containerSelector?: string | HTMLElement
    ): EUIXEngine<T>;
}

export default EUIXEngine;
