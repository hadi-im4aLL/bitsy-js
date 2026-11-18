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

    it("accepts a loop data path that starts with $", async () => {
        stubFetch({
            "views/dollar-path.html":
                '<ul><li r-for="row in $rows">{row}</li></ul>',
        });

        mount('<r-view src="./views/dollar-path.html"></r-view>');

        await runRoolith(
            createRoolith({ data: { $rows: ["Coffee", "Tea"] } }),
        );

        expect(
            [...document.querySelectorAll("li")].map((node) => node.textContent),
        ).toEqual(["Coffee", "Tea"]);
        expect(document.querySelector("[data-view-error]")).toBeNull();
        expect(document.querySelector("[data-r-error]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
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
    });

    it("reports a loop path with a trailing dot as a view error", async () => {
        stubFetch({
            "views/trailing-dot-loop.html":
                '<ul><li r-for="item in items.">{item}</li></ul>',
        });

        mount('<r-view src="./views/trailing-dot-loop.html"></r-view>');

        await runRoolith(
            createRoolith({ data: { items: ["Coffee", "Tea"] } }),
        );

        const error = document.querySelector(".r-view-error");

        expect(error).not.toBeNull();
        expect(error.textContent).toContain(
            'Loop "item in items." did not resolve to an array, found nothing',
        );
        expect(error.getAttribute("data-view-error")).toContain(
            'Loop "item in items." did not resolve to an array, found nothing',
        );
    });

    it("reports a bracketed loop path as an invalid expression", async () => {
        stubFetch({
            "views/bracketed-loop.html":
                '<ul><li r-for="item in items[0]">{item}</li></ul>',
        });

        mount('<r-view src="./views/bracketed-loop.html"></r-view>');

        await runRoolith(
            createRoolith({ data: { items: ["Coffee", "Tea"] } }),
        );

        const error = document.querySelector(".r-view-error");

        expect(error).not.toBeNull();
        expect(error.textContent).toContain(
            'Invalid loop expression "item in items[0]", expected "item in dataPath"',
        );
        expect(error.getAttribute("data-view-error")).toContain(
            'Invalid loop expression "item in items[0]", expected "item in dataPath"',
        );
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
