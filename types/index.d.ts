/**
 * types/index.d.ts
 * Main TypeScript type declarations for euixjs (Full Bundle).
 */

import { EUIXEngineCore } from './core';

export * from './core';
export * from './plugins';

export const EUIXEngine: typeof EUIXEngineCore;
export default EUIXEngine;
