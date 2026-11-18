import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    createRoolith,
    mount,
    runRoolith,
    stubFetch,
} from "./helpers.js";

describe("remote payloads", () => {
    beforeEach(() => {
        mount("");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("merges a JSON payload over the declared data of a plain element", async () => {
        stubFetch({
            "views/remote-json.html": `
                <section r-data="{ name: 'Local', stock: 1 }" r-remote="./product.json">
                    <p>{name}:{price}:{stock}</p>
                </section>
            `,
            "views/product.json": {
                body: '{"name":"Coffee","price":9}',
                contentType: "application/json",
            },
        });

        mount('<r-view src="./views/remote-json.html"></r-view>');

        await runRoolith(createRoolith());

        expect(document.querySelector("p")?.textContent).toBe("Coffee:9:1");
        expect(document.querySelector("section")?.hasAttribute("r-data")).toBe(
            false,
        );
        expect(document.querySelector("[r-remote]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("renders a JSON payload with an html key as view content and data", async () => {
        stubFetch({
            "views/remote-json-view.html":
                '<r-view r-remote="./card.json"></r-view>',
            "views/card.json": {
                body: '{"html":"<p>{title}:{subtitle}</p>","data":{"title":"Tea","subtitle":"Leaf"}}',
                contentType: "application/json",
            },
        });

        mount('<r-view src="./views/remote-json-view.html"></r-view>');

        await runRoolith(createRoolith({ data: { title: "Outer" } }));

        expect(document.querySelector("p")?.textContent).toBe("Tea:Leaf");
        expect(document.querySelector("r-view")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("renders a JSON payload without html as escaped text", async () => {
        stubFetch({
            "views/remote-json-text.html":
                '<r-view r-remote="./report.json"></r-view><p>After</p>',
            "views/report.json": {
                body: '{"note":"<b>bold</b>"}',
                contentType: "application/json",
            },
        });

        mount('<r-view src="./views/remote-json-text.html"></r-view>');

        await runRoolith(createRoolith());

        expect(document.querySelector("b")).toBeNull();
        expect(document.body.textContent).toContain('{"note":"<b>bold</b>"}');
        expect(document.querySelector("p")?.textContent).toBe("After");
        expect(document.querySelector("r-view")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("renders nested remotes and views inside a JSON element's children", async () => {
        const { calls } = stubFetch({
            "views/remote-json-nested.html": `
                <section r-remote="./nested.json">
                    <div r-remote="./nested-panel.html"></div>
                    <r-view src="./nested-child.html"></r-view>
                </section>
            `,
            "views/nested.json": {
                body: '{"title":"Coffee"}',
                contentType: "application/json",
            },
            "views/nested-panel.html": "<p>{title}-panel</p>",
            "views/nested-child.html": "<span>{title}-child</span>",
        });

        mount('<r-view src="./views/remote-json-nested.html"></r-view>');

        await runRoolith(createRoolith());

        expect(document.querySelector("div p")?.textContent).toBe(
            "Coffee-panel",
        );
        expect(document.querySelector("span")?.textContent).toBe(
            "Coffee-child",
        );
        expect(document.querySelector("[r-remote]")).toBeNull();
        expect(document.querySelector("[data-r-error]")).toBeNull();
        expect(calls.map(({ url }) => url.pathname)).toEqual([
            "/views/remote-json-nested.html",
            "/views/nested.json",
            "/views/nested-panel.html",
            "/views/nested-child.html",
        ]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("treats a JSON media type with parameters as data", async () => {
        stubFetch({
            "views/json-charset.html":
                '<section r-remote="./charset.json"><p>{name}</p></section>',
            "views/charset.json": {
                body: '{"name":"Coffee"}',
                contentType: "application/json; charset=utf-8",
            },
        });

        mount('<r-view src="./views/json-charset.html"></r-view>');

        await runRoolith(createRoolith());

        expect(document.querySelector("p")?.textContent).toBe("Coffee");
        expect(document.querySelector("[data-r-error]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("treats an upper case JSON media type as data", async () => {
        stubFetch({
            "views/json-upper.html":
                '<section r-remote="./upper.json"><p>{name}</p></section>',
            "views/upper.json": {
                body: '{"name":"Coffee"}',
                contentType: "Application/JSON",
            },
        });

        mount('<r-view src="./views/json-upper.html"></r-view>');

        await runRoolith(createRoolith());

        expect(document.querySelector("p")?.textContent).toBe("Coffee");
        expect(document.querySelector("[data-r-error]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("keeps a structured JSON suffix as markup", async () => {
        stubFetch({
            "views/ld-json.html":
                '<section r-remote="./customer.jsonld"><p>{name}</p></section>',
            "views/customer.jsonld": {
                body: "<p>Markup</p>",
                contentType: "application/ld+json",
            },
        });

        mount('<r-view src="./views/ld-json.html"></r-view>');

        await runRoolith(createRoolith());

        expect(
            [...document.querySelectorAll("p")].map(
                (node) => node.textContent,
            ),
        ).toEqual(["Markup"]);
        expect(document.querySelector("[data-r-error]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("reports invalid JSON as a remote failure without rendering it", async () => {
        stubFetch({
            "views/remote-json-broken.html":
                '<div r-remote="./broken.json">Placeholder</div><p>After</p>',
            "views/broken.json": {
                body: '{"note":"<b>bold</b>"',
                contentType: "application/json",
            },
        });

        mount('<r-view src="./views/remote-json-broken.html"></r-view>');

        await runRoolith(createRoolith());

        const element = document.querySelector("div");

        expect(element?.textContent).toBe("Placeholder");
        expect(element?.getAttribute("data-r-error")).toContain(
            'Invalid JSON in remote "/views/broken.json"',
        );
        expect(document.querySelector("b")).toBeNull();
        expect(document.querySelector(".r-view-error")).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
    });
});
