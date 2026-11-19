import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoolith, mount, runRoolith, stubFetch } from "./helpers.js";

describe("shadow view failures", () => {
    beforeEach(() => {
        mount("");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("fails a shadow view through the view error element", async () => {
        stubFetch({ "views/shadow/missing.html": { status: 404 } });

        mount(
            '<r-view src="./views/shadow/missing.html" r-shadow>Loading</r-view>',
        );

        await runRoolith(createRoolith());

        const error = document.querySelector(".r-view-error");

        expect(error?.getAttribute("data-view-error")).toBe(
            'Failed to load view "/views/shadow/missing.html" (404)',
        );
        expect(document.querySelector("r-view")).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("fails a shadow view whose content cannot render without leaving an empty host", async () => {
        stubFetch({
            "views/shadow/broken.html": '<div r-data="{ oops: }"></div>',
        });

        mount('<r-view src="./views/shadow/broken.html" r-shadow></r-view>');

        await runRoolith(createRoolith());

        const error = document.querySelector(".r-view-error");

        expect(error?.getAttribute("data-view-error")).toContain(
            'View "/views/shadow/broken.html"',
        );
        expect(document.querySelector("r-view")).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("fails a remote-sourced shadow view through the view error element", async () => {
        stubFetch({ "views/shadow/remote-missing.html": { status: 404 } });

        mount(
            '<r-view r-remote="./views/shadow/remote-missing.html" r-shadow></r-view>',
        );

        await runRoolith(createRoolith());

        const error = document.querySelector(".r-view-error");

        expect(error?.getAttribute("data-view-error")).toBe(
            'Failed to load view "/views/shadow/remote-missing.html" (404)',
        );
        expect(document.querySelector("r-view")).toBeNull();
        expect(document.querySelector("[data-r-shadow-host]")).toBeNull();
        expect(document.querySelector("[data-r-remote]")).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("reports a missing source on a placeholder that already carries a shadow tree", async () => {
        const { fetch } = stubFetch({});

        mount('<r-view r-shadow></r-view>');

        document.querySelector("r-view").attachShadow({ mode: "open" });

        await runRoolith(createRoolith());

        const error = document.querySelector(".r-view-error");

        expect(error?.getAttribute("data-view-error")).toBe(
            'View node is missing a "src" attribute',
        );
        expect(document.querySelector("r-view")).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(fetch).not.toHaveBeenCalled();
    });

    it("fails a placeholder that already carries a shadow tree at placement", async () => {
        const { calls } = stubFetch({
            "views/shadow/preexisting.html": "<p>Discarded</p>",
        });

        mount(
            '<r-view src="./views/shadow/preexisting.html" r-shadow></r-view>',
        );

        document.querySelector("r-view").attachShadow({ mode: "open" });

        await runRoolith(createRoolith());

        const error = document.querySelector(".r-view-error");

        expect(error).not.toBeNull();
        expect(error?.getAttribute("data-view-error")).toContain(
            'View "/views/shadow/preexisting.html": ',
        );
        expect(document.querySelector("r-view")).toBeNull();
        expect(document.querySelector("[data-r-shadow-host]")).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(calls.map(({ url }) => url.pathname)).toEqual([
            "/views/shadow/preexisting.html",
        ]);
    });
});
