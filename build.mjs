/**
 * Compiles `app/roolith.js` and its dependencies into a single minified,
 * dependency free ES module at `dist/roolith-<version>.min.js`.
 *
 * The version is read from `package.json`, which is the single source of truth, and
 * appears both in the file name and in a banner comment that survives minification.
 * Only the library is compiled. Entry files such as `app/index.js` are left
 * untouched and keep importing `./roolith.js`, which resolves to the bundle
 * once it is deployed beside them.
 */
import { readdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

const pkg = JSON.parse(await readFile("package.json", "utf8"));

if (!pkg.version) {
    throw new Error("package.json is missing a version");
}

const outDir = "dist";
const bundleName = `roolith-${pkg.version}.min.js`;
const outfile = path.join(outDir, bundleName);
const banner = `/*! ${pkg.name} v${pkg.version} */`;

// Drop bundles from earlier versions so dist always holds one build.
for (const file of await readdir(outDir).catch(() => [])) {
    if (/\.min\.js$/.test(file) && file !== bundleName) {
        await rm(path.join(outDir, file));
        console.log(`removed stale ${path.join(outDir, file)}`);
    }
}

await build({
    entryPoints: [path.join("app", "roolith.js")],
    outfile,
    bundle: true,
    minify: true,
    format: "esm",
    target: ["es2020"],
    legalComments: "none",
    banner: { js: banner },
    logLevel: "info",
});

const source = await readFile(outfile, "utf8");

if (/^\s*import\s/m.test(source)) {
    throw new Error("Bundled output still contains import statements");
}

if (!source.startsWith(banner)) {
    throw new Error("Bundled output is missing its version banner");
}

console.log(`compiled ${outfile} (${(await stat(outfile)).size} bytes)`);
