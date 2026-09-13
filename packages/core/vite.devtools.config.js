import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    target: ['es2015', 'chrome64', 'firefox60', 'safari12', 'edge79'],
    lib: {
      entry: resolve(__dirname, 'src/EUIXDevTools.js'),
      name: 'EUIXDevTools',
      fileName: (format) => `EUIXDevTools.${format}.js`,
      formats: ['es', 'umd']
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_debugger: true,
        passes: 3,
        booleans: true,
        collapse_vars: true,
        reduce_vars: true,
        reduce_funcs: true,
        keep_fargs: false,
        evaluate: true,
        hoist_funs: true
      },
      format: {
        comments: false
      }
    },
    sourcemap: true,
    emptyOutDir: false
  }
});
