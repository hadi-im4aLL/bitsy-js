#!/usr/bin/env node

import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".cjs": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".eot": "application/vnd.ms-fontobject",
    ".txt": "text/plain; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".wasm": "application/wasm",
};

function printUsage() {
    console.log(
        `
Usage:
  node bin/prerender.js --src=<inputDir> --dist=<outputDir> [options]

Options:
  --src=<dir>        Source directory containing HTML files (required)
  --dist=<dir>       Destination directory for pre-rendered output (required)
  --entry=<files>    Comma-separated list of HTML files relative to src (optional)
  --timeout=<ms>     Max wait time for bitsy:rendered per page (default: 10000)
  --clean            Remove existing dist directory before writing
  --help             Show this help message
`.trim(),
    );
}

function parseArgs(argv) {
    const args = {
        src: null,
        dist: null,
        entry: null,
        timeout: 10000,
        clean: false,
        help: false,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];

        if (arg === "--help" || arg === "-h") {
            args.help = true;
        } else if (arg === "--clean") {
            args.clean = true;
        } else if (arg.startsWith("--src=")) {
            args.src = arg.slice("--src=".length);
        } else if (arg === "--src" && argv[i + 1]) {
            args.src = argv[++i];
        } else if (arg.startsWith("--dist=")) {
            args.dist = arg.slice("--dist=".length);
        } else if (arg === "--dist" && argv[i + 1]) {
            args.dist = argv[++i];
        } else if (arg.startsWith("--entry=")) {
            args.entry = arg
                .slice("--entry=".length)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
        } else if (arg === "--entry" && argv[i + 1]) {
            args.entry = argv[++i]
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
        } else if (arg.startsWith("--timeout=")) {
            args.timeout = Number(arg.slice("--timeout=".length)) || 10000;
        } else if (arg === "--timeout" && argv[i + 1]) {
            args.timeout = Number(argv[++i]) || 10000;
        }
    }

    return args;
}

async function walkDir(dir, baseDir = dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...(await walkDir(fullPath, baseDir)));
        } else if (entry.isFile()) {
            files.push(path.relative(baseDir, fullPath));
        }
    }

    return files;
}

function isHtmlFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ext === ".html" || ext === ".htm";
}

function isFullHtmlDocument(html) {
    return /<html[\s>]/i.test(html);
}

function createStaticServer(rootDir) {
    const server = http.createServer(async (req, res) => {
        try {
            const reqUrl = new URL(req.url, "http://127.0.0.1");
            const decodedPath = decodeURIComponent(reqUrl.pathname);
            let filePath = path.resolve(rootDir, "." + decodedPath);

            if (filePath !== rootDir && !filePath.startsWith(rootDir + path.sep)) {
                res.writeHead(403);
                res.end("Forbidden");
                return;
            }

            let stat = await fs.stat(filePath).catch(() => null);
            if (stat?.isDirectory()) {
                filePath = path.join(filePath, "index.html");
                stat = await fs.stat(filePath).catch(() => null);
            }

            if (!stat?.isFile()) {
                res.writeHead(404);
                res.end("Not Found");
                return;
            }

            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || "application/octet-stream";
            const content = await fs.readFile(filePath);

            res.writeHead(200, { "Content-Type": contentType });
            res.end(content);
        } catch (error) {
            res.writeHead(500);
            res.end(error.message);
        }
    });

    return new Promise((resolve, reject) => {
        server.on("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            resolve({ server, port: address.port });
        });
    });
}

async function loadPlaywright() {
    try {
        return await import("playwright");
    } catch {
        console.error(
            'Error: "playwright" is required to run prerender.\n' +
                "Install it with:\n" +
                "  npm install -D playwright\n" +
                "  npx playwright install chromium",
        );
        process.exit(1);
    }
}

async function main() {
    const args = parseArgs(process.argv.slice(2));

    if (args.help) {
        printUsage();
        process.exit(0);
    }

    if (!args.src || !args.dist) {
        console.error("Error: Both --src and --dist are required.\n");
        printUsage();
        process.exit(1);
    }

    const cwd = process.cwd();
    const srcDir = path.resolve(cwd, args.src);
    const distDir = path.resolve(cwd, args.dist);

    if (srcDir === distDir) {
        console.error("Error: --src and --dist cannot be the same directory.");
        process.exit(1);
    }

    const srcStat = await fs.stat(srcDir).catch(() => null);
    if (!srcStat?.isDirectory()) {
        console.error(`Error: Source directory not found: ${srcDir}`);
        process.exit(1);
    }

    const allFiles = await walkDir(srcDir);
    const entryPages = [];
    const staticAssets = [];

    if (args.entry?.length > 0) {
        const entrySet = new Set(args.entry.map((f) => path.normalize(f)));
        for (const relPath of allFiles) {
            if (entrySet.has(path.normalize(relPath))) {
                entryPages.push(relPath);
            } else if (!isHtmlFile(relPath)) {
                staticAssets.push(relPath);
            }
        }
    } else {
        for (const relPath of allFiles) {
            if (isHtmlFile(relPath)) {
                const raw = await fs.readFile(path.join(srcDir, relPath), "utf8");
                if (isFullHtmlDocument(raw)) {
                    entryPages.push(relPath);
                }
            } else {
                staticAssets.push(relPath);
            }
        }
    }

    if (entryPages.length === 0) {
        console.warn(`No entry HTML pages found in ${srcDir}`);
        process.exit(0);
    }

    if (args.clean) {
        if (distDir === cwd || distDir === path.parse(distDir).root) {
            console.error(`Error: Refusing to clean unsafe directory: ${distDir}`);
            process.exit(1);
        }
        await fs.rm(distDir, { recursive: true, force: true });
    }

    await fs.mkdir(distDir, { recursive: true });

    // Serve from cwd if srcDir is inside cwd so relative imports like ../lib/bitsy.js resolve
    const isSrcInsideCwd = srcDir.startsWith(cwd + path.sep);
    const serverRoot = isSrcInsideCwd ? cwd : srcDir;
    const urlPrefix = isSrcInsideCwd ? "/" + path.relative(cwd, srcDir).split(path.sep).join("/") : "";

    const { chromium } = await loadPlaywright();
    const { server, port } = await createStaticServer(serverRoot);
    const browser = await chromium.launch();

    try {
        const page = await browser.newPage();

        await page.addInitScript(() => {
            window.__bitsyReady = new Promise((resolve) => {
                if (window.__bitsyRendered) {
                    resolve();
                    return;
                }
                document.addEventListener("bitsy:rendered", () => resolve(), { once: true });
            });
        });

        for (const relPath of entryPages) {
            const sourceHtml = await fs.readFile(path.join(srcDir, relPath), "utf8");
            const usesBitsy = /bitsy/i.test(sourceHtml);
            const urlPath = `${urlPrefix}/${relPath.split(path.sep).join("/")}`;
            const pageUrl = `http://127.0.0.1:${port}${urlPath}`;

            const errors = [];
            const onPageError = (err) => errors.push(err.message);
            const onConsole = (msg) => {
                if (msg.type() === "error") {
                    errors.push(msg.text());
                }
            };

            page.on("pageerror", onPageError);
            page.on("console", onConsole);

            await page.goto(pageUrl, { waitUntil: "networkidle", timeout: args.timeout });

            if (usesBitsy) {
                await page.evaluate((timeoutMs) => {
                    if (window.__bitsyRendered) {
                        return;
                    }
                    return Promise.race([
                        window.__bitsyReady,
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error("Timed out waiting for bitsy:rendered")), timeoutMs),
                        ),
                    ]);
                }, args.timeout);
            }

            const renderedHtml = await page.evaluate(() => {
                const doctype = document.doctype
                    ? `<!DOCTYPE ${document.doctype.name}${document.doctype.publicId ? ` PUBLIC "${document.doctype.publicId}"` : ""}${document.doctype.systemId ? ` "${document.doctype.systemId}"` : ""}>\n`
                    : "";
                return doctype + document.documentElement.outerHTML;
            });

            page.off("pageerror", onPageError);
            page.off("console", onConsole);

            const outPath = path.join(distDir, relPath);
            await fs.mkdir(path.dirname(outPath), { recursive: true });
            await fs.writeFile(outPath, renderedHtml, "utf8");

            console.log(`Pre-rendered: ${relPath} -> ${path.relative(cwd, outPath)}`);

            if (errors.length > 0) {
                console.warn(`  Warnings/errors on ${relPath}:`);
                for (const err of errors) {
                    console.warn(`    - ${err}`);
                }
            }
        }

        for (const relPath of staticAssets) {
            const srcAsset = path.join(srcDir, relPath);
            const distAsset = path.join(distDir, relPath);
            await fs.mkdir(path.dirname(distAsset), { recursive: true });
            await fs.copyFile(srcAsset, distAsset);
        }

        console.log(`\nDone. ${entryPages.length} page(s) pre-rendered, ${staticAssets.length} asset(s) copied.`);
    } finally {
        await browser.close();
        server.close();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
