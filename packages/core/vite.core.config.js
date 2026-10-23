import { defineConfig } from 'vite';
import { resolve } from 'path';
import { minify } from 'terser';

const terserOptions = {
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
    pure_funcs: ['isObj', 'isFn', 'isStr', 'isBool', 'isElem', 'isTxtNode', 'trimStr', 'splitPath', 'getRootKey', 'getTagName', 'getAttr', 'getChildNodes', 'getChildrenList', 'isScoped', 'toNum', 'toInt', 'genId', 'getNow', 'safeParse', 'isCycleError']
  },
  mangle: {
    toplevel: true
  },
  format: {
    comments: false
  }
};

function minifyEsPlugin() {
  return {
    name: 'minify-es-terser',
    renderChunk: {
      order: 'post',
      async handler(code, chunk, outputOptions) {
        if (outputOptions.format === 'es') {
          const res = await minify(code, {
            ...terserOptions,
            module: true,
            sourceMap: !!outputOptions.sourcemap,
            toplevel: true
          });
          return {
            code: res.code,
            map: res.map
          };
        }
        return null;
      }
    }
  };
}

export default defineConfig({
  plugins: [minifyEsPlugin()],
  build: {
    target: ['es2022', 'chrome100', 'firefox100', 'safari15', 'edge100'],
    lib: {
      entry: resolve(__dirname, 'src/core/EUIXEngineCore.js'),
      name: 'EUIXEngineCore',
      fileName: (format) => `EUIXEngineCore.${format}.js`,
      formats: ['es', 'umd']
    },
    minify: 'terser',
    terserOptions,
    sourcemap: true,
    emptyOutDir: false
  }
});
