import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    target: ['es2022', 'chrome100', 'firefox100', 'safari15', 'edge100'],
    lib: {
      entry: resolve(__dirname, 'src/core/EUIXEngineCore.js'),
      name: 'EUIXEngineCore',
      fileName: (format) => `EUIXEngineCore.${format}.js`,
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
        unsafe_proto: true
      },
      mangle: {
        toplevel: true,
        properties: {
          regex: /^_/
        }
      },
      format: {
        comments: false
      }
    },
    sourcemap: true,
    emptyOutDir: false
  }
});
