import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    BASE_URL,
    createRoolith,
    mount,
    runRoolith,
    stubFetch,
} from "./helpers.js";

describe("shadow view integration", () => {
    beforeEach(() => {
        mount("");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("renders the view directives inside the shadow root", async () => {
        stubFetch({
            "views/shadow/directives.html": `
                <section r-data="{ open: false }">
                    <h2>{title}</h2>
                    <p r-if="open">Open</p>
                    <p r-else>Closed</p>
                    <ul><li r-for="item in items">{item}</li></ul>
                </section>
            `,
        });

        mount(
            '<r-view src="./views/shadow/directives.html" r-shadow></r-view>',
        );

        await runRoolith(
            createRoolith({
                data: { title: "Products", items: ["One", "Two"] },
            }),
        );

        const root = document.querySelector("r-view").shadowRoot;
        const paragraphs = [...root.querySelectorAll("p")];
        const items = [...root.querySelectorAll("li")].map(
            (node) => node.textContent,
        );

        expect(root.querySelector("h2")?.textContent).toBe("Products");
        expect(paragraphs).toHaveLength(1);
        expect(paragraphs[0].textContent).toBe("Closed");
        expect(items).toEqual(["One", "Two"]);
        expect(root.querySelector("[r-data]")).toBeNull();
        expect(root.querySelector("[r-for]")).toBeNull();
        expect(root.querySelector("[r-if]")).toBeNull();
        expect(root.querySelector("[r-else]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("loads a nested view inside a shadow view relative to the view URL", async () => {
        const { calls } = stubFetch({
            "views/shadow/parent.html":
                '<section><r-view src="./child.html"></r-view></section>',
            "views/shadow/child.html": "<p>Child</p>",
        });

        mount('<r-view src="./views/shadow/parent.html" r-shadow></r-view>');

        await runRoolith(createRoolith());

        const root = document.querySelector("r-view").shadowRoot;

        expect(root.querySelector("p")?.textContent).toBe("Child");
        expect(calls.map(({ url }) => url.pathname)).toContain(
            "/views/shadow/child.html",
        );
        expect(document.querySelector("section")).toBeNull();
    });

    it("places a nested shadow view that a condition selected", async () => {
        stubFetch({
            "views/shadow/outer.html": `
                <section>
                    <r-view src="./inner.html" r-if="show" r-shadow></r-view>
                    <p>Outer</p>
                </section>
            `,
            "views/shadow/inner.html": "<p>Inner</p>",
        });

        mount('<r-view src="./views/shadow/outer.html" r-shadow></r-view>');

        await runRoolith(createRoolith({ data: { show: true } }));

        const outerRoot = document.querySelector("r-view").shadowRoot;
        const innerHost = outerRoot.querySelector("r-view");

        expect(innerHost.hasAttribute("r-if")).toBe(false);
        expect(innerHost.hasAttribute("r-shadow")).toBe(false);
        expect(innerHost.shadowRoot.querySelector("p")?.textContent).toBe(
            "Inner",
        );
        expect(outerRoot.querySelector("p")?.textContent).toBe("Outer");
        expect(console.error).not.toHaveBeenCalled();
    });

    it("removes a nested shadow view that a condition rejected without a request", async () => {
        const { calls } = stubFetch({
            "views/shadow/rejected-outer.html": `
                <section>
                    <r-view src="./rejected-inner.html" r-if="show" r-shadow></r-view>
                    <p>Outer</p>
                </section>
            `,
            "views/shadow/rejected-inner.html": "<p>Inner</p>",
        });

        mount('<r-view src="./views/shadow/rejected-outer.html"></r-view>');

        await runRoolith(createRoolith({ data: { show: false } }));

        expect(document.querySelector("r-view")).toBeNull();
        expect(document.querySelector("[data-r-shadow-host]")).toBeNull();
        expect(document.querySelector("p")?.textContent).toBe("Outer");
        expect(calls.map(({ url }) => url.pathname)).toEqual([
            "/views/shadow/rejected-outer.html",
        ]);
    });

    it("announces the nodes it placed in the shadow root", async () => {
        stubFetch({ "views/shadow/event.html": "<p>Event</p>" });

        mount('<r-view src="./views/shadow/event.html" r-shadow></r-view>');

        const roolith = createRoolith();
        const events = [];
        const subscriber = vi.fn();
        const listener = (event) => events.push(event.detail);
        const unsubscribe = roolith.onViewRendered(
            "views/shadow/event.html",
            subscriber,
        );

        document.addEventListener("r-view:rendered", listener);

        await runRoolith(roolith);

        document.removeEventListener("r-view:rendered", listener);
        unsubscribe();

        const host = document.querySelector("r-view");
        const [detail] = events;

        expect(events).toHaveLength(1);
        expect(detail.src).toBe("./views/shadow/event.html");
        expect(detail.url.href).toBe(`${BASE_URL}views/shadow/event.html`);
        expect(detail.nodes).toHaveLength(1);
        expect(host.shadowRoot.contains(detail.nodes[0])).toBe(true);
        expect(detail.nodes[0].getRootNode()).toBe(host.shadowRoot);
        expect(subscriber).toHaveBeenCalledTimes(1);
        expect(subscriber.mock.calls[0][0].nodes).toBe(detail.nodes);
    });

    it("renders a remote-sourced view in the shadow root and clears its state", async () => {
        const remoteUrl = `${BASE_URL}views/shadow/remote.html`;
        const { fetch } = stubFetch({
            "views/shadow/remote.html": "<p>Remote</p>",
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
            '<r-view r-remote="./views/shadow/remote.html" r-data="{ note: \'Remote\' }" r-shadow></r-view>',
        );

        await runRoolith(createRoolith());

        const host = document.querySelector("r-view");

        expect(pending).toBe(host);
        expect(host.hasAttribute("data-r-remote")).toBe(false);
        expect(host.hasAttribute("r-remote")).toBe(false);
        expect(host.hasAttribute("r-data")).toBe(false);
        expect(host.hasAttribute("r-shadow")).toBe(false);
        expect(host.shadowRoot.querySelector("p")?.textContent).toBe("Remote");
        expect(console.error).not.toHaveBeenCalled();
    });

    it("renders a remote JSON view payload in the shadow root", async () => {
        stubFetch({
            "views/shadow/payload.json": {
                body: '{"html":"<p>{note}</p>","data":{"note":"Payload"}}',
                contentType: "application/json",
            },
        });

        mount(
            '<r-view r-remote="./views/shadow/payload.json" r-shadow></r-view>',
        );

        await runRoolith(createRoolith());

        const host = document.querySelector("r-view");

        expect(host.shadowRoot.querySelector("p")?.textContent).toBe(
            "Payload",
        );
        expect(host.hasAttribute("r-remote")).toBe(false);
        expect(console.error).not.toHaveBeenCalled();
    });
});
