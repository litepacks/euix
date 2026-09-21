import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        bail: 1,
        include: ["tests/**/*.test.ts"],
    },
});
