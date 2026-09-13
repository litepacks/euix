import { defineConfig } from 'vite';
import { resolve } from 'path';

const repoRoot = resolve(import.meta.dirname);

export default defineConfig({
    root: resolve(repoRoot, 'apps/playground'),
    server: {
        port: 3100,
        strictPort: true,
        open: false,
        fs: {
            allow: [repoRoot],
        },
    },
    resolve: {
        alias: {
            '@euix/core': resolve(repoRoot, 'packages/core/src'),
        },
    },
});
