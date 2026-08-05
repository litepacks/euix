import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 3000,
    open: true
  },
  build: {
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
        unsafe_proto: true
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
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js', 'tests/**/*.bench.js']
  }
});
