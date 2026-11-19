import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { View } from "../view/view.js";
import {
    BASE_URL,
    createRoolith,
    createSettings,
    mount,
    runRoolith,
    stubFetch,
} from "./helpers.js";

describe("view loading", () => {
    beforeEach(() => {
        mount("");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe("resolveUrl", () => {
        function createView() {
            return new View(createSettings());
        }

        it("resolves a relative source against the document base URL", () => {
            const view = createView();

            expect(view.resolveUrl("./views/home.html").href).toBe(
                `${BASE_URL}views/home.html`,
            );
        });

        it("keeps an absolute source URL", () => {
            const view = createView();

            expect(view.resolveUrl("https://cdn.example.test/view.html").href).toBe(
                "https://cdn.example.test/view.html",
            );
        });

        it("rejects a missing source", () => {
            const view = createView();

            expect(() => view.resolveUrl(null)).toThrow(
                'View node is missing a "src" attribute',
            );
            expect(() => view.resolveUrl("")).toThrow(
                'View node is missing a "src" attribute',
            );
        });
    });

    it("requests a duplicated view source once per render pass", async () => {
        const { fetch } = stubFetch({
            "views/duplicate.html": "<p>duplicate</p>",
        });

        mount(`
            <r-view src="./views/duplicate.html"></r-view>
            <r-view src="./views/duplicate.html"></r-view>
        `);

        await runRoolith(createRoolith());

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["duplicate", "duplicate"]);
    });

    it("requests one source once when it appears at the root and in a nested view", async () => {
        const { calls } = stubFetch({
            "views/shared.html": "<p>shared</p>",
            "views/nested-owner.html":
                '<section><r-view src="./shared.html"></r-view></section>',
        });

        mount(`
            <r-view src="./views/shared.html"></r-view>
            <r-view src="./views/nested-owner.html"></r-view>
        `);

        await runRoolith(createRoolith());

        const sharedRequests = calls.filter(
            ({ url }) => url.href === `${BASE_URL}views/shared.html`,
        );

        expect(sharedRequests).toHaveLength(1);
        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["shared", "shared"]);
    });

    it("requests one source once when two parent views embed it", async () => {
        const { calls } = stubFetch({
            "views/shared.html": "<p>shared</p>",
            "views/owner-a.html":
                '<section><r-view src="./shared.html"></r-view></section>',
            "views/owner-b.html":
                '<aside><r-view src="./shared.html"></r-view></aside>',
        });

        mount(`
            <r-view src="./views/owner-a.html"></r-view>
            <r-view src="./views/owner-b.html"></r-view>
        `);

        await runRoolith(createRoolith());

        const sharedRequests = calls.filter(
            ({ url }) => url.href === `${BASE_URL}views/shared.html`,
        );

        expect(sharedRequests).toHaveLength(1);
        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["shared", "shared"]);
    });

    it("resolves a nested view against its parent view URL", async () => {
        const { calls } = stubFetch({
            "views/parent.html": `
                <section>
                    <r-view src="./child.html"></r-view>
                </section>
            `,
            "views/child.html": "<p>child</p>",
        });

        mount('<r-view src="./views/parent.html"></r-view>');

        await runRoolith(createRoolith());

        expect(document.querySelector("section p")?.textContent).toBe("child");
        expect(calls.map(({ url }) => url.href)).toContain(
            `${BASE_URL}views/child.html`,
        );
    });

    it("passes data declared in a parent view scope to a nested view", async () => {
        stubFetch({
            "views/page.html": `
                <section r-data="{ title: heading }">
                    <r-view src="./child.html"></r-view>
                </section>
            `,
            "views/child.html": "<p>{title}</p>",
        });

        mount('<r-view src="./views/page.html"></r-view>');

        await runRoolith(
            createRoolith({ data: { heading: "Products" } }),
        );

        expect(document.querySelector("p")?.textContent).toBe("Products");
    });

    it("replaces a circular view reference with an error element", async () => {
        stubFetch({
            "views/loop.html": '<r-view src="./loop.html"></r-view>',
        });

        mount('<r-view src="./views/loop.html"></r-view>');

        await runRoolith(createRoolith());

        const error = document.querySelector(".r-view-error");

        expect(error).not.toBeNull();
        expect(error.textContent).toContain("Circular view reference");
        expect(error.getAttribute("data-view-error")).toBe(
            'Circular view reference "./loop.html"',
        );
        expect(console.error).toHaveBeenCalled();
    });

    it("replaces a failed view with an element using the configured class", async () => {
        stubFetch({
            "views/missing.html": { status: 404 },
        });

        mount('<r-view src="./views/missing.html">Loading</r-view>');

        await runRoolith(
            createRoolith({ viewErrorClassName: "view-failure" }),
        );

        const error = document.querySelector("div.view-failure");

        expect(document.querySelector("r-view")).toBeNull();
        expect(error).not.toBeNull();
        expect(error.textContent).toBe(
            'Failed to load view "/views/missing.html" (404)',
        );
        expect(error.getAttribute("data-view-error")).toBe(
            'Failed to load view "/views/missing.html" (404)',
        );
    });

    it("reports a network failure through the error element", async () => {
        stubFetch({
            "views/offline.html": new Error("network down"),
        });

        mount('<r-view src="./views/offline.html"></r-view>');

        await runRoolith(createRoolith());

        const error = document.querySelector(".r-view-error");

        expect(error?.textContent).toBe("network down");
        expect(error?.getAttribute("data-view-error")).toBe("network down");
    });

    it("reports one failure once with the same message for every reference", async () => {
        const { fetch } = stubFetch({
            "views/missing.html": { status: 404 },
        });

        mount(`
            <r-view src="./views/missing.html"></r-view>
            <r-view src="./views/missing.html"></r-view>
        `);

        const errorHandler = vi.fn();

        document.addEventListener("r-view:error", errorHandler);

        await runRoolith(createRoolith());

        document.removeEventListener("r-view:error", errorHandler);

        const errors = [...document.querySelectorAll("[data-view-error]")];

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(errors).toHaveLength(2);
        expect(errors[0].getAttribute("data-view-error")).toBe(
            'Failed to load view "/views/missing.html" (404)',
        );
        expect(errors[1].getAttribute("data-view-error")).toBe(
            errors[0].getAttribute("data-view-error"),
        );
        expect(errorHandler).toHaveBeenCalledTimes(2);
    });

    it("requests views with caching disabled by default", async () => {
        const { calls } = stubFetch({
            "views/part.html": "<p>part</p>",
        });

        mount('<r-view src="./views/part.html"></r-view>');

        await runRoolith(createRoolith());

        expect(calls).toHaveLength(1);
        expect(calls[0].options).toEqual({ cache: "no-cache" });
    });

    it("requests views without cache options when viewCache is enabled", async () => {
        const { calls } = stubFetch({
            "views/part.html": "<p>part</p>",
        });

        mount('<r-view src="./views/part.html"></r-view>');

        await runRoolith(createRoolith({ viewCache: true }));

        expect(calls).toHaveLength(1);
        expect(calls[0].options).toEqual({});
    });
});
