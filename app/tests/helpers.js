import { vi } from "vitest";
import { Roolith } from "../roolith.js";

/**
 * Document URL used by the test environment, matching `vitest.config.js`.
 *
 * Relative view sources resolve against this URL so tests can assert absolute
 * URLs without depending on the machine running them.
 *
 * @type {string}
 */
export const BASE_URL = "https://roolith.test/";

/**
 * Creates the effective settings object a {@link Roolith} instance would use.
 *
 * Deriving settings from the real constructor keeps test defaults in sync with
 * library defaults instead of duplicating them here.
 *
 * @param {object} [overrides] Settings merged over the library defaults.
 * @returns {object} Merged settings.
 */
export function createSettings(overrides = {}) {
    return new Roolith(overrides).settings;
}

/**
 * Creates a Roolith instance for a test, optionally with settings and root data.
 *
 * Root data is passed through settings, exactly as the host page does it, so tests
 * exercise the same path as production code.
 *
 * @example
 * const roolith = createRoolith({ data: { items: ["Coffee", "Tea"] } });
 *
 * @param {object} [settings] Settings merged over the library defaults, including `data`.
 * @returns {Roolith} Instance ready to be run by {@link runRoolith}.
 */
export function createRoolith(settings = {}) {
    return new Roolith(settings);
}

/**
 * Replaces the document body with the given markup.
 *
 * Tests call this before rendering so each case starts from a known document
 * without depending on previous tests.
 *
 * @param {string} html Markup placed inside `<body>`.
 * @returns {HTMLElement} The document body containing the mounted markup.
 */
export function mount(html) {
    document.body.innerHTML = html;

    return document.body;
}

/**
 * Settles any microtasks the renderer may still have queued.
 *
 * This is a defensive settling aid rather than a correctness requirement: the
 * awaited render pass already resolves after request loading and nested view
 * rendering finish. Keeping it means tests stay stable if that changes.
 *
 * @returns {Promise<void>} Resolves after the queued microtasks run.
 */
async function flush() {
    await Promise.resolve();
    await Promise.resolve();
}

/**
 * Runs a full render pass and then flushes pending microtasks.
 *
 * @param {Roolith} [roolith] Instance to run. A new instance is created when omitted.
 * @returns {Promise<Roolith>} The instance that was run.
 */
export async function runRoolith(roolith = createRoolith()) {
    await roolith.run();
    await flush();

    return roolith;
}

/**
 * Response-like object returned by the fetch stub.
 *
 * @typedef {object} StubResponse
 * @property {boolean} ok Whether the status is in the 2xx range.
 * @property {number} status HTTP status code.
 * @property {{get: (name: string) => string|null}} headers Case-insensitive header reader.
 * @property {() => Promise<string>} text Response body as text.
 * @property {() => Promise<unknown>} json Response body parsed as JSON.
 */

/**
 * Route configuration accepted by {@link stubFetch}.
 *
 * The internal {@link createFetchStub} helper wrapped by {@link stubFetch}
 * accepts the same shape.
 *
 * A route can be a string shorthand for a successful HTML response, an
 * {@link Error} to simulate a network failure, or an object describing a body,
 * status, content type, extra headers, or a failure.
 *
 * @typedef {string|Error|{body?: string, status?: number, contentType?: string, headers?: Record<string, string>, error?: Error}} StubRoute
 */

/**
 * Fetch stub plus its recorded calls.
 *
 * @typedef {object} FetchStub
 * @property {import("vitest").Mock} fetch Fetch mock that serves the routes; {@link stubFetch} installs it globally.
 * @property {Array<{url: URL, options: object|undefined}>} calls Requests recorded in call order.
 */

/**
 * Creates a fetch stub that serves the given routes and records every request.
 *
 * Internal helper for {@link stubFetch}, which is the consumer tests should use:
 * it creates the stub and installs it as the global `fetch` in one step.
 *
 * Route keys may be relative to {@link BASE_URL} or absolute URLs. Unmatched
 * requests receive a 404 response, mirroring a missing view file. Errors are
 * thrown during fetch so tests can cover network failure handling.
 *
 * @param {Record<string, StubRoute>} [routes] Responses keyed by relative or absolute URL.
 * @returns {FetchStub} Fetch stub and recorded calls.
 */
function createFetchStub(routes = {}) {
    const routesByUrl = new Map(
        Object.entries(routes).map(([key, route]) => [
            new URL(key, BASE_URL).href,
            normalizeRoute(route),
        ]),
    );

    const calls = [];
    const fetch = vi.fn(async (input, options) => {
        const url = input instanceof URL ? input : new URL(String(input), BASE_URL);

        calls.push({ url, options });

        const route = routesByUrl.get(url.href);

        if (route === undefined) {
            return createResponse({ status: 404 });
        }

        if (route.error) {
            throw route.error;
        }

        return createResponse(route);
    });

    return { fetch, calls };
}

/**
 * Creates a fetch stub and installs it as the global `fetch` for the current test.
 *
 * Tests still call `vi.unstubAllGlobals()` in `afterEach` to restore the real
 * implementation, which keeps cleanup visible at the test level.
 *
 * @example
 * const { fetch, calls } = stubFetch({ "views/home.html": "<p>home</p>" });
 *
 * @param {Record<string, StubRoute>} [routes] Responses keyed by relative or absolute URL.
 * @returns {FetchStub} Installed fetch stub and recorded calls.
 */
export function stubFetch(routes = {}) {
    const stub = createFetchStub(routes);

    vi.stubGlobal("fetch", stub.fetch);

    return stub;
}

/**
 * Normalizes a route shorthand into the full route shape.
 *
 * @param {StubRoute} route Route value from {@link createFetchStub}.
 * @returns {{body: string, status: number, contentType: string, headers: Record<string, string>, error?: Error}} Normalized route.
 */
function normalizeRoute(route) {
    if (route instanceof Error) {
        return { ...createResponseDefaults(), error: route };
    }

    if (typeof route === "string") {
        return { ...createResponseDefaults(), body: route };
    }

    return { ...createResponseDefaults(), ...route };
}

/**
 * Creates the default fields of a normalized route.
 *
 * @returns {{body: string, status: number, contentType: string, headers: Record<string, string>}} Successful HTML defaults.
 */
function createResponseDefaults() {
    return {
        body: "",
        status: 200,
        contentType: "text/html; charset=utf-8",
        headers: {},
    };
}

/**
 * Builds a response-like object from a normalized route.
 *
 * @param {{body?: string, status?: number, contentType?: string, headers?: Record<string, string>}} route Normalized route values.
 * @returns {StubResponse} Response compatible with the renderer's reading path.
 */
function createResponse(route) {
    const status = route.status ?? 200;
    const body = route.body ?? "";
    const headers = new Map(
        Object.entries({
            "content-type": route.contentType ?? "text/html; charset=utf-8",
            ...route.headers,
        }).map(([name, value]) => [name.toLowerCase(), value]),
    );

    return {
        ok: status >= 200 && status < 300,
        status,
        headers: {
            get: (name) => headers.get(String(name).toLowerCase()) ?? null,
        },
        text: async () => body,
        json: async () => JSON.parse(body),
    };
}
