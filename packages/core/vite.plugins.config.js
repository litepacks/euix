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
        'plugins/EUIXAnimationPlugin': resolve(__dirname, 'src/plugins/EUIXAnimationPlugin.js'),
        'plugins/EUIXHeadPlugin': resolve(__dirname, 'src/plugins/EUIXHeadPlugin.js'),
        'plugins/EUIXLeafletPlugin': resolve(__dirname, 'src/plugins/EUIXLeafletPlugin.js'),
        'plugins/EUIXNavigatorPlugin': resolve(__dirname, 'src/plugins/EUIXNavigatorPlugin.js'),
        'plugins/EUIXRouterPlugin': resolve(__dirname, 'src/plugins/EUIXRouterPlugin.js'),
        'plugins/EUIXChartPlugin': resolve(__dirname, 'src/plugins/EUIXChartPlugin.js'),
        'plugins/EUIXDatePlugin': resolve(__dirname, 'src/plugins/EUIXDatePlugin.js'),
        'plugins/EUIXInspectorPlugin': resolve(__dirname, 'src/plugins/EUIXInspectorPlugin.js'),
        'plugins/EUIXPlaywright': resolve(__dirname, 'src/plugins/inspector/playwright.js'),
        'plugins/EUIXWebMCPPlugin': resolve(__dirname, 'src/plugins/EUIXWebMCPPlugin.js'),
        'plugins/EUIXValidationPlugin': resolve(__dirname, 'src/plugins/EUIXValidationPlugin.js'),
        'plugins/EUIXStreamPlugin': resolve(__dirname, 'src/plugins/EUIXStreamPlugin.js'),
        'plugins/EUIXA11yPlugin': resolve(__dirname, 'src/plugins/EUIXA11yPlugin.js'),
        'EUIXCompiler': resolve(__dirname, 'src/compiler/index.js'),
        'EUIXServer': resolve(__dirname, 'src/server/index.js')
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
