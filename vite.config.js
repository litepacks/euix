import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';

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
    plugins: [
        {
            name: 'serve-packages-dist',
            configureServer(server) {
                server.middlewares.use((req, res, next) => {
                    if (req.url && req.url.startsWith('/packages/core/dist/')) {
                        const relPath = req.url.slice('/packages/core/dist/'.length).split('?')[0];
                        const filePath = resolve(repoRoot, 'packages/core/dist', relPath);
                        if (fs.existsSync(filePath)) {
                            res.setHeader('Content-Type', 'application/javascript');
                            return fs.createReadStream(filePath).pipe(res);
                        }
                    }
                    next();
                });
            },
        },
    ],
    resolve: {
        alias: {
            '@euix/core': resolve(repoRoot, 'packages/core/src'),
        },
    },
});
