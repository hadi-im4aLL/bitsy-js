import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    BASE_URL,
    createRoolith,
    mount,
    runRoolith,
    stubFetch,
} from "./helpers.js";

describe("remote rendering", () => {
    beforeEach(() => {
        mount("");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("renders a remote HTML response as the children of a plain element", async () => {
        const { fetch } = stubFetch({
            "views/remote-html.html": `
                <div r-remote="./panel.html">Placeholder</div>
                <p>{label}</p>
            `,
            "views/panel.html": `
                <section>
                    <h2>{label}</h2>
                    <span r-data="{ note: 'kept' }">{note}</span>
                </section>
            `,
        });

        mount('<r-view src="./views/remote-html.html"></r-view>');

        await runRoolith(createRoolith({ data: { label: "Remote" } }));

        expect(document.querySelector("h2")?.textContent).toBe("Remote");
        expect(document.querySelector("span")?.textContent).toBe("kept");
        expect(document.querySelector("p")?.textContent).toBe("Remote");
        expect(document.querySelector("section")?.parentElement?.tagName).toBe(
            "DIV",
        );
        expect(document.querySelector("[r-remote]")).toBeNull();
        expect(document.querySelector("[data-r-remote]")).toBeNull();
        expect(fetch).toHaveBeenCalledTimes(2);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("renders a remote HTML response as view content", async () => {
        const { calls } = stubFetch({
            "views/remote-view.html":
                '<r-view r-remote="./remote-view-child.html"></r-view>',
            "views/remote-view-child.html": "<p>{title}</p>",
        });

        mount('<r-view src="./views/remote-view.html"></r-view>');

        await runRoolith(createRoolith({ data: { title: "Child" } }));

        expect(document.querySelector("p")?.textContent).toBe("Child");
        expect(document.querySelector("r-view")).toBeNull();
        expect(document.querySelector("[r-remote]")).toBeNull();
        expect(calls.map(({ url }) => url.pathname)).toContain(
            "/views/remote-view-child.html",
        );
        expect(console.error).not.toHaveBeenCalled();
    });

    it("loads a view placeholder from its remote source without a src", async () => {
        const { calls } = stubFetch({
            "views/host-remote.html": "<p>Host</p>",
        });

        mount('<r-view r-remote="./views/host-remote.html">Loading</r-view>');

        await runRoolith(createRoolith());

        expect(document.querySelector("p")?.textContent).toBe("Host");
        expect(document.querySelector("r-view")).toBeNull();
        expect(calls.map(({ url }) => url.pathname)).toEqual([
            "/views/host-remote.html",
        ]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("resolves sources inside remote content against the remote URL", async () => {
        const { calls } = stubFetch({
            "views/remote-base.html": '<div r-remote="./panels/panel.html"></div>',
            "views/panels/panel.html": `
                <section>
                    <r-view src="./row.html"></r-view>
                    <div r-remote="./nested.html"></div>
                </section>
            `,
            "views/panels/row.html": "<p>Row</p>",
            "views/panels/nested.html": "<span>Nested</span>",
        });

        mount('<r-view src="./views/remote-base.html"></r-view>');

        await runRoolith(createRoolith());

        const paths = calls.map(({ url }) => url.pathname);

        expect(document.querySelector("p")?.textContent).toBe("Row");
        expect(document.querySelector("span")?.textContent).toBe("Nested");
        expect(paths).toHaveLength(4);
        expect(paths).toContain("/views/panels/row.html");
        expect(paths).toContain("/views/panels/nested.html");
        expect(paths).not.toContain("/views/row.html");
        expect(console.error).not.toHaveBeenCalled();
    });

    it("marks a remote view while the request is pending and clears it after", async () => {
        const remoteUrl = `${BASE_URL}views/pending-view.html`;
        const { fetch } = stubFetch({
            "views/pending-view.html": "<p>Done</p>",
        });
        const route = fetch.getMockImplementation();
        let pending = null;

        fetch.mockImplementation(async (input, options) => {
            if (String(input) === remoteUrl) {
                pending = document.querySelector('[data-r-remote="loading"]');
            }

            return await route(input, options);
        });

        mount(
            '<r-view r-remote="./views/pending-view.html">Placeholder</r-view>',
        );

        await runRoolith(createRoolith());

        expect(pending).not.toBeNull();
        expect(pending?.textContent).toBe("Placeholder");
        expect(pending?.hasAttribute("r-remote")).toBe(false);
        expect(document.querySelector("[data-r-remote]")).toBeNull();
        expect(document.querySelector("p")?.textContent).toBe("Done");
    });

    it("loads a remote inside a view placeholder and discards it with the placeholder", async () => {
        const { calls } = stubFetch({
            "views/pending-placeholder.html": `
                <r-view src="./replacement.html">
                    <div r-remote="./panel.html">Loading</div>
                </r-view>
            `,
            "views/replacement.html": "<section>Replacement</section>",
            "views/panel.html": "<p>Panel</p>",
        });

        mount('<r-view src="./views/pending-placeholder.html"></r-view>');

        await runRoolith(createRoolith());

        expect(calls.map(({ url }) => url.pathname)).toEqual([
            "/views/pending-placeholder.html",
            "/views/panel.html",
            "/views/replacement.html",
        ]);
        expect(document.querySelector("section")?.textContent).toBe(
            "Replacement",
        );
        expect(document.body.textContent).not.toContain("Panel");
        expect(document.querySelector("[data-r-error]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("resolves data declared on a host remote view placeholder", async () => {
        stubFetch({
            "views/host-data-child.html": "<p>{title}</p>",
        });

        mount(
            '<r-view r-remote="./views/host-data-child.html" r-data="{ title: \'Host\' }"></r-view>',
        );

        await runRoolith(createRoolith());

        expect(document.querySelector("p")?.textContent).toBe("Host");
        expect(document.querySelector("[r-data]")).toBeNull();
        expect(document.querySelector("[r-remote]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("announces a remote view with the remote source as its rendered src", async () => {
        stubFetch({
            "views/remote-event-html.html": "<p>Event</p>",
            "views/remote-event.json": {
                body: '{"note":"Event"}',
                contentType: "application/json",
            },
        });

        const details = [];
        const handler = (event) => details.push(event.detail);

        document.addEventListener("r-view:rendered", handler);

        mount(
            '<r-view r-remote="./views/remote-event-html.html"></r-view><r-view r-remote="./views/remote-event.json"></r-view>',
        );

        await runRoolith(createRoolith());

        document.removeEventListener("r-view:rendered", handler);

        const markup = details.find(
            (detail) => detail.src === "./views/remote-event-html.html",
        );
        const text = details.find(
            (detail) => detail.src === "./views/remote-event.json",
        );

        expect(markup?.url.pathname).toBe("/views/remote-event-html.html");
        expect(markup?.nodes).toHaveLength(1);
        expect(markup?.nodes[0].textContent).toBe("Event");
        expect(text?.nodes).toHaveLength(1);
        expect(text?.nodes[0].nodeType).toBe(3);
        expect(text?.nodes[0].textContent).toBe('{"note":"Event"}');
        expect(console.error).not.toHaveBeenCalled();
    });
});
