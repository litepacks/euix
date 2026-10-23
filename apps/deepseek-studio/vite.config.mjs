import { defineConfig } from "vite";
import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";

const repoRoot = resolve(import.meta.dirname, "../..");

export default defineConfig({
    root: resolve(import.meta.dirname),
    plugins: [
        tailwindcss(),
    ],
    server: {
        port: 3200,
        strictPort: false,
        open: true,
        fs: {
            allow: [repoRoot],
        },
    },
    resolve: {
        alias: {
            "@euix/core": resolve(repoRoot, "packages/core/src"),
            "euixjs/prepare": resolve(repoRoot, "packages/core/src/prepare/index.js"),
            "euixjs": resolve(repoRoot, "packages/core/src/EUIXEngine.js"),
        },
    },
});
