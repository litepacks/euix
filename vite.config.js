import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 3000,
    open: true
  },
  build: {
    target: ['es2022', 'chrome100', 'firefox100', 'safari15', 'edge100'],
    lib: {
      entry: resolve(__dirname, 'src/EUIXEngine.js'),
      name: 'EUIXEngine',
      fileName: (format) => `EUIXEngine.${format}.js`,
      formats: ['es', 'umd']
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_debugger: true,
        passes: 3,
        pure_getters: true,
        unsafe: true,
        unsafe_comps: true,
        unsafe_math: true,
        unsafe_proto: true,
        booleans: true,
        collapse_vars: true,
        reduce_vars: true,
        reduce_funcs: true,
        keep_fargs: false,
        evaluate: true,
        hoist_funs: true,
        pure_funcs: ['isObj', 'isFn', 'isStr', 'isBool', 'isElem', 'isTxtNode', 'trimStr', 'splitPath', 'getRootKey', 'getTagName', 'getAttr', 'getChildNodes', 'getChildrenList', 'isScoped', 'toNum', 'genId', 'getNow']
      },
      mangle: {
        toplevel: true
      },
      format: {
        comments: false
      }
    },
    treeshake: {
      moduleSideEffects: false,
      propertyReadSideEffects: false
    },
    sourcemap: true
  },
  test: {
    globals: true,
    environment: 'jsdom',
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/.stryker-tmp/**'],
    bail: 1,
    testTimeout: 10000,
    teardownTimeout: 2000,
    fileParallelism: true,
    onConsoleLog(log) {
      if (log.includes('[EUIXEngine Fallback]')) return false;
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/EUIXEngine.js', 'src/EUIXDevTools.js'],
      thresholds: {
        statements: 75,
        branches: 65,
        functions: 75,
        lines: 75
      }
    }
  }
});
