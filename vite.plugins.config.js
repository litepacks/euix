import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    target: ['es2022', 'chrome100', 'firefox100', 'safari15', 'edge100'],
    lib: {
      entry: {
        'plugins/EUIXApiPlugin': resolve(__dirname, 'src/plugins/EUIXApiPlugin.js'),
        'plugins/EUIXComposerPlugin': resolve(__dirname, 'src/plugins/EUIXComposerPlugin.js'),
        'plugins/EUIXDragDropPlugin': resolve(__dirname, 'src/plugins/EUIXDragDropPlugin.js'),
        'plugins/EUIXStoragePlugin': resolve(__dirname, 'src/plugins/EUIXStoragePlugin.js'),
        'plugins/EUIXCollapsePlugin': resolve(__dirname, 'src/plugins/EUIXCollapsePlugin.js'),
        'plugins/EUIXDialogPlugin': resolve(__dirname, 'src/plugins/EUIXDialogPlugin.js'),
        'plugins/EUIXResiliencePlugin': resolve(__dirname, 'src/plugins/EUIXResiliencePlugin.js'),
        'plugins/EUIXReactivePlugin': resolve(__dirname, 'src/plugins/EUIXReactivePlugin.js'),
        'plugins/EUIXAnimationPlugin': resolve(__dirname, 'src/plugins/EUIXAnimationPlugin.js')
      },
      formats: ['es']
    },
    rollupOptions: {
      output: {
        entryFileNames: '[name].es.js'
      }
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
