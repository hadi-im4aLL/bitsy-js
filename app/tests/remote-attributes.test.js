import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoolith, mount, runRoolith, stubFetch } from "./helpers.js";

describe("remote directive attributes", () => {
    beforeEach(() => {
        mount("");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("honors a custom remote attribute name", async () => {
        const { calls } = stubFetch({
            "views/custom-remote.html": `
                <div x-remote="./custom-panel.html"></div>
                <div r-remote="./never-loaded.html"></div>
            `,
            "views/custom-panel.html": "<p>Custom</p>",
            "views/never-loaded.html": "<p>Never</p>",
        });

        mount('<r-view src="./views/custom-remote.html"></r-view>');

        await runRoolith(createRoolith({ remoteAttribute: "x-remote" }));

        expect(document.querySelector("p")?.textContent).toBe("Custom");
        expect(document.querySelector("[x-remote]")).toBeNull();
        expect(
            calls.filter(
                ({ url }) => url.pathname === "/views/never-loaded.html",
            ),
        ).toHaveLength(0);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("loads both sources of a view and renders the remote content", async () => {
        const { calls } = stubFetch({
            "views/both-sources.html":
                '<r-view src="./declared-view.html" r-remote="./winning-view.html"></r-view>',
            "views/declared-view.html": "<p>Declared</p>",
            "views/winning-view.html": "<p>Winner</p>",
        });

        mount('<r-view src="./views/both-sources.html"></r-view>');

        await runRoolith(createRoolith());

        const paths = calls.map(({ url }) => url.pathname);

        expect(paths).toContain("/views/declared-view.html");
        expect(paths).toContain("/views/winning-view.html");
        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["Winner"]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("consumes a remote on a template without requesting it", async () => {
        const { calls } = stubFetch({
            "views/remote-template.html":
                '<template r-remote="./template-panel.html"><p>Body</p></template><p>After</p>',
            "views/template-panel.html": "<p>Panel</p>",
        });

        mount('<r-view src="./views/remote-template.html"></r-view>');

        await runRoolith(createRoolith());

        const template = document.querySelector("template");

        expect(template).not.toBeNull();
        expect(template?.hasAttribute("r-remote")).toBe(false);
        expect(template?.content.querySelector("p")?.textContent).toBe("Body");
        expect(calls.map(({ url }) => url.pathname)).toEqual([
            "/views/remote-template.html",
        ]);
        expect(document.querySelector("p")?.textContent).toBe("After");
        expect(console.error).not.toHaveBeenCalled();
    });

    it("ignores a src attribute on a plain element", async () => {
        const { calls } = stubFetch({
            "views/plain-src.html": '<div src="   ">Authored</div><p>After</p>',
        });

        mount('<r-view src="./views/plain-src.html"></r-view>');

        await runRoolith(createRoolith());

        expect(document.querySelector("div")?.textContent).toBe("Authored");
        expect(document.querySelector("[data-r-error]")).toBeNull();
        expect(calls.map(({ url }) => url.pathname)).toEqual([
            "/views/plain-src.html",
        ]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("reports a blank remote source on a plain element without a request", async () => {
        const { calls } = stubFetch({
            "views/blank-remote-element.html":
                '<div r-remote="">Placeholder</div><p>After</p>',
        });

        mount('<r-view src="./views/blank-remote-element.html"></r-view>');

        await runRoolith(createRoolith());

        const element = document.querySelector("div");

        expect(element?.textContent).toBe("Placeholder");
        expect(element?.getAttribute("data-r-error")).toBe(
            'Attribute "r-remote" is missing a source URL',
        );
        expect(calls.map(({ url }) => url.pathname)).toEqual([
            "/views/blank-remote-element.html",
        ]);
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("reports a whitespace-only remote source on a plain element without a request", async () => {
        const { calls } = stubFetch({
            "views/blank-remote-space.html":
                '<div r-remote="   ">Placeholder</div>',
        });

        mount('<r-view src="./views/blank-remote-space.html"></r-view>');

        await runRoolith(createRoolith());

        const element = document.querySelector("div");

        expect(element?.textContent).toBe("Placeholder");
        expect(element?.getAttribute("data-r-error")).toBe(
            'Attribute "r-remote" is missing a source URL',
        );
        expect(calls.map(({ url }) => url.pathname)).toEqual([
            "/views/blank-remote-space.html",
        ]);
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("reports a blank remote source on a view placeholder without a request", async () => {
        const { calls } = stubFetch();

        mount('<r-view r-remote="   ">Loading</r-view>');

        await runRoolith(createRoolith());

        const error = document.querySelector(".r-view-error");

        expect(error?.getAttribute("data-view-error")).toBe(
            'Attribute "r-remote" is missing a source URL',
        );
        expect(document.querySelector("r-view")).toBeNull();
        expect(calls).toHaveLength(0);
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("reports a blank view source without requesting the containing document", async () => {
        const { calls } = stubFetch();

        mount('<r-view src="   ">Loading</r-view>');

        await runRoolith(createRoolith());

        const error = document.querySelector(".r-view-error");

        expect(error?.getAttribute("data-view-error")).toBe(
            'View node is missing a "src" attribute',
        );
        expect(calls).toHaveLength(0);
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("ignores a blank src beside a remote view source without requesting it", async () => {
        const { calls } = stubFetch({
            "views/winning-child.html": "<p>Winner</p>",
        });

        mount('<r-view src="   " r-remote="./views/winning-child.html"></r-view>');

        await runRoolith(createRoolith());

        expect(document.querySelector("p")?.textContent).toBe("Winner");
        expect(calls.map(({ url }) => url.pathname)).toEqual([
            "/views/winning-child.html",
        ]);
        expect(console.error).not.toHaveBeenCalled();
    });
});
