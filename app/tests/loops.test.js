import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    createRoolith,
    mount,
    runRoolith,
    stubFetch,
} from "./helpers.js";

describe("r-for", () => {
    beforeEach(() => {
        mount("");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("repeats an element once per item", async () => {
        stubFetch({
            "views/loop-element.html":
                '<ul><li r-for="item in items">{item}</li></ul>',
        });

        mount('<r-view src="./views/loop-element.html"></r-view>');

        await runRoolith(
            createRoolith({ data: { items: ["Coffee", "Tea"] } }),
        );

        const items = [...document.querySelectorAll("li")];

        expect(items.map((node) => node.textContent)).toEqual(["Coffee", "Tea"]);
        expect(document.querySelector("[r-for]")).toBeNull();
    });

    it("repeats template content once per item", async () => {
        stubFetch({
            "views/loop-template.html": `
                <ul>
                    <template r-for="item in items">
                        <li>{item}</li>
                    </template>
                </ul>
            `,
        });

        mount('<r-view src="./views/loop-template.html"></r-view>');

        await runRoolith(
            createRoolith({ data: { items: ["Coffee", "Tea"] } }),
        );

        expect(
            [...document.querySelectorAll("li")].map((node) => node.textContent),
        ).toEqual(["Coffee", "Tea"]);
        expect(document.querySelector("template")).toBeNull();
    });

    it("renders nested loops with the inner item scope", async () => {
        stubFetch({
            "views/nested-loops.html": `
                <div r-for="group in groups">
                    <h2>{group.name}</h2>
                    <span r-for="value in group.values">{value}</span>
                </div>
            `,
        });

        mount('<r-view src="./views/nested-loops.html"></r-view>');

        await runRoolith(
            createRoolith({
                data: {
                    groups: [
                        { name: "A", values: [1, 2] },
                        { name: "B", values: [3] },
                    ],
                },
            }),
        );

        expect(
            [...document.querySelectorAll("h2")].map((node) => node.textContent),
        ).toEqual(["A", "B"]);
        expect(
            [...document.querySelectorAll("span")].map((node) => node.textContent),
        ).toEqual(["1", "2", "3"]);
    });

    it("passes the loop item into a repeated nested view", async () => {
        stubFetch({
            "views/list.html": `
                <r-view
                    src="./row.html"
                    r-for="product in products"
                    r-data="{ name: product.name }"
                ></r-view>
            `,
            "views/row.html": "<p>{name}</p>",
        });

        mount('<r-view src="./views/list.html"></r-view>');

        await runRoolith(
            createRoolith({
                data: {
                    products: [{ name: "Coffee" }, { name: "Tea" }],
                },
            }),
        );

        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["Coffee", "Tea"]);
    });

    it("reports an invalid loop expression as a view error", async () => {
        stubFetch({
            "views/bad-loop.html":
                '<ul><li r-for="items">{item}</li></ul>',
        });

        mount('<r-view src="./views/bad-loop.html"></r-view>');

        await runRoolith(createRoolith({ data: { items: [] } }));

        const error = document.querySelector(".r-view-error");

        expect(error).not.toBeNull();
        expect(error.textContent).toContain("Invalid loop expression");
        expect(error.getAttribute("data-view-error")).toContain(
            "Invalid loop expression",
        );
        expect(document.querySelector("li")).toBeNull();
    });

    it("reports a non-array loop value as a view error", async () => {
        stubFetch({
            "views/bad-loop-value.html":
                '<ul><li r-for="item in heading">{item}</li></ul>',
        });

        mount('<r-view src="./views/bad-loop-value.html"></r-view>');

        await runRoolith(
            createRoolith({ data: { heading: "Products" } }),
        );

        const error = document.querySelector(".r-view-error");

        expect(error).not.toBeNull();
        expect(error.textContent).toContain(
            'Loop "item in heading" did not resolve to an array, found string',
        );
        expect(error.getAttribute("data-view-error")).toContain(
            'Loop "item in heading" did not resolve to an array, found string',
        );
    });

    it("reports a missing loop path as a view error", async () => {
        stubFetch({
            "views/missing-loop.html":
                '<ul><li r-for="item in items">{item}</li></ul>',
        });

        mount('<r-view src="./views/missing-loop.html"></r-view>');

        await runRoolith(createRoolith());

        const error = document.querySelector(".r-view-error");

        expect(error?.textContent).toContain(
            'Loop "item in items" did not resolve to an array, found nothing',
        );
        expect(error?.getAttribute("data-view-error")).toContain(
            'Loop "item in items" did not resolve to an array, found nothing',
        );
    });
});
