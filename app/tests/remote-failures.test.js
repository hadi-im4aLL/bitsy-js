import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    createRoolith,
    mount,
    runRoolith,
    stubFetch,
} from "./helpers.js";

describe("remote failures", () => {
    beforeEach(() => {
        mount("");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("keeps a plain element placeholder when its remote content fails", async () => {
        stubFetch({
            "views/remote-failure.html":
                '<div r-remote="./missing-panel.html">Placeholder</div><p>After</p>',
        });

        mount('<r-view src="./views/remote-failure.html"></r-view>');

        await runRoolith(createRoolith());

        const element = document.querySelector("div");

        expect(element?.textContent).toBe("Placeholder");
        expect(element?.getAttribute("data-r-error")).toBe(
            'Failed to load remote "/views/missing-panel.html" (404)',
        );
        expect(element?.hasAttribute("data-r-remote")).toBe(false);
        expect(element?.hasAttribute("r-remote")).toBe(false);
        expect(document.querySelector("p")?.textContent).toBe("After");
        expect(document.querySelector(".r-view-error")).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("replaces a failed remote view with the error element", async () => {
        stubFetch({
            "views/remote-view-failure.html":
                '<r-view r-remote="./missing-view.html"></r-view><p>After</p>',
        });

        mount('<r-view src="./views/remote-view-failure.html"></r-view>');

        await runRoolith(createRoolith());

        const error = document.querySelector(".r-view-error");

        expect(error?.textContent).toBe(
            'Failed to load view "/views/missing-view.html" (404)',
        );
        expect(error?.getAttribute("data-view-error")).toBe(
            'Failed to load view "/views/missing-view.html" (404)',
        );
        expect(document.querySelector("p")?.textContent).toBe("After");
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("renders a remote view whose unused src cannot be parsed", async () => {
        const { calls } = stubFetch({
            "views/unusable-src.html": "<p>Remote</p>",
        });

        mount(
            '<r-view src="http://[" r-remote="./views/unusable-src.html"></r-view>',
        );

        await runRoolith(createRoolith());

        expect(document.querySelector("p")?.textContent).toBe("Remote");
        expect(document.querySelector(".r-view-error")).toBeNull();
        expect(calls.map(({ url }) => url.pathname)).toEqual([
            "/views/unusable-src.html",
        ]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("fails a view whose valid src sits beside a blank remote source", async () => {
        const { calls } = stubFetch({
            "views/declared-only.html": "<p>Declared</p>",
        });

        mount('<r-view src="./views/declared-only.html" r-remote=""></r-view>');

        await runRoolith(createRoolith());

        const error = document.querySelector(".r-view-error");

        expect(error?.getAttribute("data-view-error")).toBe(
            'Attribute "r-remote" is missing a source URL',
        );
        expect(document.querySelector("r-view")).toBeNull();
        expect(calls).toHaveLength(0);
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("renders an error message containing markup as text", async () => {
        stubFetch({
            "views/markup-failure.html": new Error(
                "<b>bold</b> is not a view",
            ),
        });

        mount('<r-view src="./views/markup-failure.html"></r-view>');

        await runRoolith(createRoolith());

        const error = document.querySelector(".r-view-error");

        expect(error?.querySelector("b")).toBeNull();
        expect(error?.textContent).toBe("<b>bold</b> is not a view");
        expect(error?.getAttribute("data-view-error")).toBe(
            "<b>bold</b> is not a view",
        );
    });

    it("does not request remote content recorded by a walk that failed", async () => {
        const { calls } = stubFetch({
            "views/remote-discarded.html": `
                <div r-remote="./discarded-panel.html"></div>
                <p r-data="missing">After</p>
            `,
            "views/discarded-panel.html": "<p>Discarded</p>",
        });

        mount('<r-view src="./views/remote-discarded.html"></r-view>');

        await runRoolith(createRoolith());

        const error = document.querySelector(".r-view-error");

        expect(calls.map(({ url }) => url.pathname)).toEqual([
            "/views/remote-discarded.html",
        ]);
        expect(error?.getAttribute("data-view-error")).toContain(
            'Data attribute "missing"',
        );
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("keeps a sibling view rendering after a remote fails", async () => {
        stubFetch({
            "views/remote-isolation.html":
                '<div r-remote="./missing-panel.html"></div><r-view src="./sibling-view.html"></r-view>',
            "views/sibling-view.html": "<p>Sibling</p>",
        });

        mount('<r-view src="./views/remote-isolation.html"></r-view>');

        await runRoolith(createRoolith());

        expect(document.querySelector("[data-r-error]")).not.toBeNull();
        expect(document.querySelector(".r-view-error")).toBeNull();
        expect(document.querySelector("p")?.textContent).toBe("Sibling");
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("loads a view placeholder inside the kept children of a failed remote", async () => {
        const { calls } = stubFetch({
            "views/failed-children.html": `
                <div r-remote="./missing-panel.html">
                    <r-view src="./nested-child.html" r-data="{ title: label }"></r-view>
                </div>
            `,
            "views/nested-child.html": "<p>{title}</p>",
        });

        mount('<r-view src="./views/failed-children.html"></r-view>');

        await runRoolith(createRoolith({ data: { label: "Enclosing" } }));

        const failed = document.querySelector("[data-r-error]");

        expect(failed?.tagName).toBe("DIV");
        expect(failed?.getAttribute("data-r-error")).toBe(
            'Failed to load remote "/views/missing-panel.html" (404)',
        );
        expect(failed?.querySelector("p")?.textContent).toBe("Enclosing");
        expect(calls.map(({ url }) => url.pathname)).toEqual([
            "/views/failed-children.html",
            "/views/missing-panel.html",
            "/views/nested-child.html",
        ]);
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("leaves the authored children of a JSON remote untouched when a directive fails", async () => {
        stubFetch({
            "views/remote-json-partial.html": `
                <section r-remote="./partial.json">
                    <p>{name}</p>
                    <span r-data="missing"></span>
                </section>
                <p>After</p>
            `,
            "views/partial.json": {
                body: '{"name":"Coffee"}',
                contentType: "application/json",
            },
        });

        mount('<r-view src="./views/remote-json-partial.html"></r-view>');

        await runRoolith(createRoolith());

        const section = document.querySelector("section");

        expect(section?.querySelector("p")?.textContent).toBe("{name}");
        expect(section?.querySelector("span")?.hasAttribute("r-data")).toBe(
            true,
        );
        expect(section?.getAttribute("data-r-error")).toContain(
            'Data attribute "missing"',
        );
        expect(document.querySelector(".r-view-error")).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("leaves the authored children of a markup remote untouched when a directive fails", async () => {
        stubFetch({
            "views/remote-html-partial.html":
                '<div r-remote="./partial-panel.html">Placeholder</div>',
            "views/partial-panel.html":
                '<p>Remote</p><span r-data="missing"></span>',
        });

        mount('<r-view src="./views/remote-html-partial.html"></r-view>');

        await runRoolith(createRoolith());

        const element = document.querySelector("div");

        expect(element?.textContent).toBe("Placeholder");
        expect(element?.querySelector("p")).toBeNull();
        expect(element?.getAttribute("data-r-error")).toContain(
            'Data attribute "missing"',
        );
        expect(console.error).toHaveBeenCalledTimes(1);
    });
});
