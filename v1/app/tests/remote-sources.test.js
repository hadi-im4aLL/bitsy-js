import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RenderPass } from "../view/render-pass.js";
import { View } from "../view/view.js";
import {
    BASE_URL,
    createRoolith,
    createSettings,
    mount,
    runRoolith,
    stubFetch,
} from "./helpers.js";

describe("remote sources", () => {
    beforeEach(() => {
        mount("");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("requests a remote URL once per render pass", async () => {
        const { calls } = stubFetch({
            "views/remote-dedupe.html": `
                <div r-remote="./shared-panel.html"></div>
                <div r-remote="./shared-panel.html"></div>
            `,
            "views/shared-panel.html": "<p>Shared</p>",
        });

        mount('<r-view src="./views/remote-dedupe.html"></r-view>');

        await runRoolith(createRoolith());

        expect(
            calls.filter(
                ({ url }) => url.pathname === "/views/shared-panel.html",
            ),
        ).toHaveLength(1);
        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["Shared", "Shared"]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("requests one URL once for a remote element and a view placeholder", async () => {
        const { calls } = stubFetch({
            "views/remote-and-view.html": `
                <div r-remote="./shared-source.html"></div>
                <r-view src="./shared-source.html"></r-view>
            `,
            "views/shared-source.html": "<p>Shared</p>",
        });

        mount('<r-view src="./views/remote-and-view.html"></r-view>');

        await runRoolith(createRoolith());

        expect(
            calls.filter(
                ({ url }) => url.pathname === "/views/shared-source.html",
            ),
        ).toHaveLength(1);
        expect(
            [...document.querySelectorAll("p")].map(
                (node) => node.textContent,
            ),
        ).toEqual(["Shared", "Shared"]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("requests one remote URL once when two views declare it", async () => {
        const { calls } = stubFetch({
            "views/two-owners.html": `
                <r-view src="./owner-first.html"></r-view>
                <r-view src="./owner-second.html"></r-view>
            `,
            "views/owner-first.html":
                '<div r-remote="./shared-panel.html"></div>',
            "views/owner-second.html":
                '<div r-remote="./shared-panel.html"></div>',
            "views/shared-panel.html": "<p>Shared</p>",
        });

        mount('<r-view src="./views/two-owners.html"></r-view>');

        await runRoolith(createRoolith());

        expect(
            calls.filter(
                ({ url }) => url.pathname === "/views/shared-panel.html",
            ),
        ).toHaveLength(1);
        expect(
            [...document.querySelectorAll("p")].map(
                (node) => node.textContent,
            ),
        ).toEqual(["Shared", "Shared"]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("reports one failing remote URL on every element that declared it", async () => {
        const { calls } = stubFetch({
            "views/shared-failure.html": `
                <div r-remote="./missing-shared.html"></div>
                <div r-remote="./missing-shared.html"></div>
            `,
        });

        mount('<r-view src="./views/shared-failure.html"></r-view>');

        await runRoolith(createRoolith());

        const failed = [...document.querySelectorAll("[data-r-error]")];

        expect(
            calls.filter(
                ({ url }) => url.pathname === "/views/missing-shared.html",
            ),
        ).toHaveLength(1);
        expect(failed).toHaveLength(2);
        expect(failed[0].getAttribute("data-r-error")).toBe(
            'Failed to load remote "/views/missing-shared.html" (404)',
        );
        expect(failed[1].getAttribute("data-r-error")).toBe(
            failed[0].getAttribute("data-r-error"),
        );
        expect(console.error).toHaveBeenCalledTimes(2);
    });

    it("requests remote content with caching disabled by default", async () => {
        const { calls } = stubFetch({
            "views/remote-cache.html": '<div r-remote="./cache-panel.html"></div>',
            "views/cache-panel.html": "<p>Cached</p>",
        });

        mount('<r-view src="./views/remote-cache.html"></r-view>');

        await runRoolith(createRoolith());

        const panel = calls.find(
            ({ url }) => url.pathname === "/views/cache-panel.html",
        );

        expect(panel?.options).toEqual({ cache: "no-cache" });
    });

    it("requests remote content without cache options when viewCache is enabled", async () => {
        const { calls } = stubFetch({
            "views/remote-cache-on.html":
                '<div r-remote="./cache-on-panel.html"></div>',
            "views/cache-on-panel.html": "<p>Cached</p>",
        });

        mount('<r-view src="./views/remote-cache-on.html"></r-view>');

        await runRoolith(createRoolith({ viewCache: true }));

        const panel = calls.find(
            ({ url }) => url.pathname === "/views/cache-on-panel.html",
        );

        expect(panel?.options).toEqual({});
    });

    it("fails a remote document that includes itself", async () => {
        const { fetch } = stubFetch({
            "views/circular-outer.html": '<div r-remote="./circular.html"></div>',
            "views/circular.html": '<div r-remote="./circular.html"></div>',
        });

        mount('<r-view src="./views/circular-outer.html"></r-view>');

        await runRoolith(createRoolith());

        const failed = document.querySelector("[data-r-error]");

        expect(failed?.getAttribute("data-r-error")).toBe(
            'Circular remote reference "./circular.html"',
        );
        expect(
            fetch.mock.calls.filter(([input]) =>
                String(input).endsWith("/views/circular.html"),
            ),
        ).toHaveLength(1);
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("fails a remote document that recurses through another document", async () => {
        const { fetch } = stubFetch({
            "views/mutual-a.html": '<div r-remote="./mutual-b.html"></div>',
            "views/mutual-b.html": '<div r-remote="./mutual-a.html"></div>',
        });

        mount('<r-view src="./views/mutual-a.html"></r-view>');

        await runRoolith(createRoolith());

        const failed = document.querySelector("[data-r-error]");

        expect(failed?.getAttribute("data-r-error")).toBe(
            'Circular remote reference "./mutual-a.html"',
        );
        expect(
            fetch.mock.calls.filter(([input]) =>
                String(input).endsWith("/views/mutual-a.html"),
            ),
        ).toHaveLength(1);
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("fails a remote view document that includes itself", async () => {
        const { fetch } = stubFetch({
            "views/self-view.html":
                '<r-view r-remote="./self-view.html"></r-view>',
        });

        mount('<r-view r-remote="./views/self-view.html"></r-view>');

        await runRoolith(createRoolith());

        const failed = document.querySelector("[data-view-error]");

        expect(failed?.getAttribute("data-view-error")).toBe(
            'Circular view reference "./self-view.html"',
        );
        expect(
            fetch.mock.calls.filter(([input]) =>
                String(input).endsWith("/views/self-view.html"),
            ),
        ).toHaveLength(1);
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("starts a fresh request map for a direct render call", async () => {
        const { fetch } = stubFetch({
            "views/direct-render.html": "<p>{label}</p>",
        });

        mount(
            '<r-view src="./views/direct-render.html"></r-view><r-view src="./views/direct-render.html"></r-view>',
        );

        const view = new View(createSettings({ data: { label: "Direct" } }));
        const [first, second] = [...document.querySelectorAll("r-view")];
        const firstFragments = await view.getFragments([first], BASE_URL);

        await view.renderFragment(firstFragments[0]);

        const secondFragments = await view.getFragments([second], BASE_URL);

        await view.renderFragment(secondFragments[0]);

        expect(fetch).toHaveBeenCalledTimes(2);
        expect(
            [...document.querySelectorAll("p")].map(
                (node) => node.textContent,
            ),
        ).toEqual(["Direct", "Direct"]);
    });

    it("derives a pass with a copied ancestor chain and a shared request map", () => {
        const parent = RenderPass.create({
            hostData: { label: "Parent" },
        }).derive({
            ancestorUrl: "https://roolith.test/views/parent.html",
        });

        const derived = parent.derive({
            ancestorUrl: "https://roolith.test/views/child.html",
        });

        expect(derived.requests).toBe(parent.requests);
        expect(derived.ancestors).not.toBe(parent.ancestors);
        expect([...derived.ancestors]).toEqual([
            ...parent.ancestors,
            "https://roolith.test/views/child.html",
        ]);
        expect(derived.data).toBe(parent.data);
    });
});
