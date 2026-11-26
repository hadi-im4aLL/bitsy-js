import { readFileSync } from "node:fs";
import { defineConfig } from "vite-plus";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

/**
 * Banner prepended to the standalone library bundle.
 */
const banner = `/*!
 * ${pkg.name} v${pkg.version}
 * ${pkg.homepage}
 * Released under the ${pkg.license} License
 */`;

/**
 * Build configuration for the standalone browser bundle of lib/bitsy.js.
 */
const libraryBuild = {
    build: {
        outDir: "dist",
        emptyOutDir: true,
        minify: "oxc",
        lib: {
            entry: "lib/bitsy.js",
            formats: ["es"],
            fileName: () => "bitsy.min.js",
        },
        rolldownOptions: {
            output: {
                banner,
                minify: { compress: true, mangle: true, codegen: true },
                comments: { legal: true },
            },
        },
    },
};

/**
 * Build configuration for the demo app served by `vp build` without `--mode lib`.
 */
const appBuild = {
    build: {
        outDir: "dist-demo",
        emptyOutDir: true,
    },
};

export default defineConfig(({ mode }) => ({
    ...(mode === "lib" ? libraryBuild : appBuild),
    fmt: {
        printWidth: 120,
    },
}));
