import { defineConfig } from "vitest/config";

/**
 * Test runner configuration.
 *
 * Tests run in happy-dom so the library can use the same DOM APIs it uses in a
 * browser. The fixed document URL keeps relative view sources and absolute URL
 * assertions deterministic. Only `app/tests` is scanned, and nothing in that
 * directory is part of the `app/roolith.js` build graph.
 */
export default defineConfig({
    test: {
        environment: "happy-dom",
        environmentOptions: {
            happyDOM: {
                url: "https://roolith.test/",
            },
        },
        include: ["app/tests/**/*.test.js"],
    },
});
