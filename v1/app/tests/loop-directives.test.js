import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoolith, mount, runRoolith, stubFetch } from "./helpers.js";

describe("loop metadata across views", () => {
    beforeEach(() => {
        mount("");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("passes loop metadata into a nested view through r-data", async () => {
        stubFetch({
            "views/metadata-list.html": `
                <r-view
                    src="./metadata-row.html"
                    r-for="product in products"
                    r-data="{ position: $index, name: product.name }"
                ></r-view>
            `,
            "views/metadata-row.html": "<p>{position}:{name}</p>",
        });

        mount('<r-view src="./views/metadata-list.html"></r-view>');

        await runRoolith(
            createRoolith({
                data: {
                    products: [
                        { name: "Coffee" },
                        { name: "Tea" },
                        { name: "Cocoa" },
                    ],
                },
            }),
        );

        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["0:Coffee", "1:Tea", "2:Cocoa"]);
        expect(document.querySelector("[r-for]")).toBeNull();
        expect(document.querySelector("[r-data]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("renders loop metadata inside a repeated view", async () => {
        stubFetch({
            "views/metadata-view-list.html":
                '<r-view src="./metadata-view-row.html" r-for="item in items"></r-view>',
            "views/metadata-view-row.html":
                "<p>{$index}:{item}:{$first}:{$last}:{$length}</p>",
        });

        mount('<r-view src="./views/metadata-view-list.html"></r-view>');

        await runRoolith(createRoolith({ data: { items: ["Coffee", "Tea"] } }));

        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["0:Coffee:true:false:2", "1:Tea:false:true:2"]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("reads the inner loop metadata from a view inside a nested loop", async () => {
        stubFetch({
            "views/metadata-nested-view.html": `
                <div r-for="group in groups">
                    <r-view
                        src="./metadata-nested-row.html"
                        r-for="value in group.values"
                        r-data="{ group: group.name, position: $index }"
                    ></r-view>
                </div>
            `,
            "views/metadata-nested-row.html": "<p>{group}:{position}:{value}</p>",
        });

        mount('<r-view src="./views/metadata-nested-view.html"></r-view>');

        await runRoolith(
            createRoolith({
                data: {
                    groups: [
                        { name: "A", values: [10, 20] },
                        { name: "B", values: [30] },
                    ],
                },
            }),
        );

        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["A:0:10", "A:1:20", "B:0:30"]);
        expect(console.error).not.toHaveBeenCalled();
    });
});
