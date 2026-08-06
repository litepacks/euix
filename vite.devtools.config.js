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
        passes: 3
      },
      format: {
        comments: false
      }
    },
    sourcemap: true,
    emptyOutDir: false
  }
});
