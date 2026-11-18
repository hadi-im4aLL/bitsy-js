import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoolith, mount, runRoolith, stubFetch } from "./helpers.js";

describe("shadow view placement", () => {
    beforeEach(() => {
        mount("");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("keeps the placeholder as a host with an open shadow root", async () => {
        stubFetch({ "views/shadow/plain.html": "<p>Plain</p>" });

        mount('<r-view src="./views/shadow/plain.html" r-shadow></r-view>');

        await runRoolith(createRoolith());

        const host = document.querySelector("r-view");

        expect(host).not.toBeNull();
        expect(host.shadowRoot).not.toBeNull();
        expect(host.shadowRoot.mode).toBe("open");
        expect(host.shadowRoot.querySelector("p")?.textContent).toBe("Plain");
        expect(console.error).not.toHaveBeenCalled();
    });

    it("hides the rendered content from document queries", async () => {
        stubFetch({
            "views/shadow/hidden.html": '<section><p class="note">Hidden</p></section>',
        });

        mount('<r-view src="./views/shadow/hidden.html" r-shadow></r-view>');

        await runRoolith(createRoolith());

        const host = document.querySelector("r-view");

        expect([...document.querySelectorAll("section")]).toEqual([]);
        expect([...document.querySelectorAll("p")]).toEqual([]);
        expect(host.shadowRoot.querySelectorAll("p.note")).toHaveLength(1);
    });

    it("discards the placeholder children instead of forwarding them", async () => {
        stubFetch({ "views/shadow/discard.html": "<p>Loaded</p>" });

        mount(
            '<r-view src="./views/shadow/discard.html" r-shadow><span>Fallback</span> Loading</r-view>',
        );

        await runRoolith(createRoolith());

        const host = document.querySelector("r-view");

        expect(host.childNodes).toHaveLength(0);
        expect(host.textContent).toBe("");
        expect(host.shadowRoot.querySelector("span")).toBeNull();
        expect(host.shadowRoot.textContent).toContain("Loaded");
    });

    it("loads a placeholder fallback view and then discards it with the host children", async () => {
        const { calls } = stubFetch({
            "views/shadow/fallback-host.html": "<p>Outer</p>",
            "views/shadow/fallback.html": "<p>Fallback</p>",
        });

        mount(`
            <r-view src="./views/shadow/fallback-host.html" r-shadow>
                <r-view src="./views/shadow/fallback.html"></r-view>
            </r-view>
        `);

        await runRoolith(createRoolith());

        const root = document.querySelector("r-view").shadowRoot;
        const paths = calls.map(({ url }) => url.pathname);

        expect(paths).toContain("/views/shadow/fallback.html");
        expect(root.textContent).toContain("Outer");
        expect(root.textContent).not.toContain("Fallback");
        expect(root.querySelector("r-view")).toBeNull();
    });

    it("marks the retained host, consumes what it read, and keeps the inert directives", async () => {
        stubFetch({ "views/shadow/host-data.html": "<p>{note}</p>" });

        mount(
            '<r-view src="./views/shadow/host-data.html" r-data="{ note: \'Host\' }" r-if="false" r-else r-for="item in items" r-shadow></r-view>',
        );

        await runRoolith(createRoolith());

        const host = document.querySelector("r-view");

        expect(host.getAttribute("data-r-shadow-host")).toBe("");
        expect(host.hasAttribute("src")).toBe(false);
        expect(host.hasAttribute("r-data")).toBe(false);
        expect(host.hasAttribute("r-shadow")).toBe(false);
        expect(host.hasAttribute("r-if")).toBe(true);
        expect(host.hasAttribute("r-else")).toBe(true);
        expect(host.hasAttribute("r-for")).toBe(true);
        expect(host.shadowRoot.querySelector("p")?.textContent).toBe("Host");
    });

    it("treats any value of the shadow attribute as opted in", async () => {
        stubFetch({
            "views/shadow/value-a.html": "<p>ValueA</p>",
            "views/shadow/value-b.html": "<p>ValueB</p>",
        });

        mount(`
            <r-view src="./views/shadow/value-a.html" r-shadow="false"></r-view>
            <r-view src="./views/shadow/value-b.html" r-shadow=""></r-view>
        `);

        await runRoolith(createRoolith());

        const hosts = [...document.querySelectorAll("r-view")];
        const contents = hosts.map(
            (host) => host.shadowRoot.querySelector("p")?.textContent,
        );

        expect(contents).toEqual(["ValueA", "ValueB"]);
        expect(
            hosts.every((host) => host.hasAttribute("r-shadow") === false),
        ).toBe(true);
    });

    it("honors a custom shadow attribute name", async () => {
        stubFetch({ "views/shadow/custom.html": "<p>Custom</p>" });

        mount('<r-view src="./views/shadow/custom.html" data-shadow></r-view>');

        await runRoolith(createRoolith({ shadowAttribute: "data-shadow" }));

        const host = document.querySelector("r-view");

        expect(host.shadowRoot).not.toBeNull();
        expect(host.hasAttribute("data-shadow")).toBe(false);
        expect(host.shadowRoot.querySelector("p")?.textContent).toBe("Custom");
    });

    it("replaces a placeholder carrying the default name when the attribute is customized", async () => {
        stubFetch({ "views/shadow/default-name.html": "<p>Default</p>" });

        mount(
            '<r-view src="./views/shadow/default-name.html" r-shadow></r-view>',
        );

        await runRoolith(createRoolith({ shadowAttribute: "data-shadow" }));

        expect(document.querySelector("r-view")).toBeNull();
        expect(document.querySelector("p")?.textContent).toBe("Default");
        expect(document.querySelector("[data-r-shadow-host]")).toBeNull();
    });

    it("does not load a rendered shadow host again on a later pass", async () => {
        const { fetch } = stubFetch({
            "views/shadow/persist.html": "<p>Persist</p>",
        });

        mount('<r-view src="./views/shadow/persist.html" r-shadow></r-view>');

        const roolith = createRoolith();

        await runRoolith(roolith);

        const host = document.querySelector("r-view");

        await roolith.run();

        expect(fetch).toHaveBeenCalledTimes(1);
        expect(host.shadowRoot.querySelector("p")?.textContent).toBe("Persist");
        expect(document.querySelector(".r-view-error")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("loads a placeholder that only carries the host marker attribute", async () => {
        const { calls } = stubFetch({
            "views/shadow/authored-marker.html": "<p>Authored</p>",
        });

        mount(
            '<r-view src="./views/shadow/authored-marker.html" data-r-shadow-host></r-view>',
        );

        await runRoolith(createRoolith());

        expect(document.querySelector("r-view")).toBeNull();
        expect(document.querySelector("p")?.textContent).toBe("Authored");
        expect(document.querySelector("[data-r-shadow-host]")).toBeNull();
        expect(calls.map(({ url }) => url.pathname)).toEqual([
            "/views/shadow/authored-marker.html",
        ]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("keeps the marker on a nested host and neither requests nor logs on a second run", async () => {
        const { calls } = stubFetch({
            "views/shadow/nested-parent.html":
                '<r-view src="./nested-inner.html" r-shadow></r-view>',
            "views/shadow/nested-inner.html": "<p>Inner</p>",
        });

        mount(
            '<r-view src="./views/shadow/nested-parent.html" r-shadow></r-view>',
        );

        const roolith = createRoolith();

        await runRoolith(roolith);

        const outerRoot = document.querySelector("r-view").shadowRoot;
        const innerHost = outerRoot.querySelector("r-view");

        await roolith.run();

        expect(innerHost.hasAttribute("data-r-shadow-host")).toBe(true);
        expect(innerHost.shadowRoot.querySelector("p")?.textContent).toBe(
            "Inner",
        );
        expect(calls.map(({ url }) => url.pathname)).toEqual([
            "/views/shadow/nested-parent.html",
            "/views/shadow/nested-inner.html",
        ]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("does not collect a shadow host that a replaced parent left in the document", async () => {
        const { calls } = stubFetch({
            "views/shadow/replaced-parent.html":
                '<r-view src="./replaced-child.html" r-shadow></r-view>',
            "views/shadow/replaced-child.html": "<p>Child</p>",
        });

        mount('<r-view src="./views/shadow/replaced-parent.html"></r-view>');

        const roolith = createRoolith();

        await runRoolith(roolith);

        const host = document.querySelector("r-view");

        await roolith.run();

        expect(document.querySelector("r-view")).toBe(host);
        expect(host.hasAttribute("data-r-shadow-host")).toBe(true);
        expect(host.shadowRoot.querySelector("p")?.textContent).toBe("Child");
        expect(calls.map(({ url }) => url.pathname)).toEqual([
            "/views/shadow/replaced-parent.html",
            "/views/shadow/replaced-child.html",
        ]);
        expect(document.querySelector(".r-view-error")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });
});
