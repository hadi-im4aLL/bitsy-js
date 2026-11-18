import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoolith, mount, runRoolith, stubFetch } from "./helpers.js";

describe("loop metadata", () => {
    beforeEach(() => {
        mount("");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("exposes every loop metadata key to interpolation", async () => {
        stubFetch({
            "views/loop-metadata.html":
                '<ul><li r-for="item in items">{item}:{$index}:{$first}:{$last}:{$length}</li></ul>',
        });

        mount('<r-view src="./views/loop-metadata.html"></r-view>');

        await runRoolith(createRoolith({ data: { items: ["Coffee", "Tea"] } }));

        expect(
            [...document.querySelectorAll("li")].map((node) => node.textContent),
        ).toEqual(["Coffee:0:true:false:2", "Tea:1:false:true:2"]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("marks the only item of a repeated template as first and last", async () => {
        stubFetch({
            "views/loop-metadata-single.html":
                '<ul><template r-for="item in items"><li>{item}:{$index}:{$first}:{$last}:{$length}</li></template></ul>',
        });

        mount('<r-view src="./views/loop-metadata-single.html"></r-view>');

        await runRoolith(createRoolith({ data: { items: ["Coffee"] } }));

        expect(
            [...document.querySelectorAll("li")].map((node) => node.textContent),
        ).toEqual(["Coffee:0:true:true:1"]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("renders no output for an empty array and leaks no metadata", async () => {
        stubFetch({
            "views/loop-metadata-empty.html":
                '<ul><li r-for="item in items">{$index}:{$length}</li></ul><p>{$index}:{$length}</p>',
        });

        mount('<r-view src="./views/loop-metadata-empty.html"></r-view>');

        await runRoolith(createRoolith({ data: { items: [] } }));

        const list = document.querySelector("ul");

        expect(list).not.toBeNull();
        expect(list?.children).toHaveLength(0);
        expect(document.querySelector("li")).toBeNull();
        expect(document.querySelector("p")?.textContent).toBe(
            "{$index}:{$length}",
        );
        expect(document.querySelector("[data-r-error]")).toBeNull();
        expect(document.querySelector("[data-view-error]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("shadows every metadata key of the outer loop inside a nested loop", async () => {
        stubFetch({
            "views/loop-metadata-nested.html": `
                <div r-for="group in groups" r-data="{ outerIndex: $index }">
                    <p>{group.name}:{$index}:{$first}:{$last}:{$length}</p>
                    <span r-for="value in group.values">{value}:{$index}:{$first}:{$last}:{$length}:{outerIndex}</span>
                    <i>{$index}:{$first}:{$last}:{$length}</i>
                </div>
            `,
        });

        mount('<r-view src="./views/loop-metadata-nested.html"></r-view>');

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
        ).toEqual(["A:0:true:false:2", "B:1:false:true:2"]);
        expect(
            [...document.querySelectorAll("span")].map(
                (node) => node.textContent,
            ),
        ).toEqual([
            "10:0:true:false:2:0",
            "20:1:false:true:2:0",
            "30:0:true:true:1:1",
        ]);
        expect(
            [...document.querySelectorAll("i")].map((node) => node.textContent),
        ).toEqual(["0:true:false:2", "1:false:true:2"]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("overwrites a loop variable named after a metadata key", async () => {
        stubFetch({
            "views/loop-metadata-name.html":
                '<ul><li r-for="$index in items">{$index}</li></ul>',
        });

        mount('<r-view src="./views/loop-metadata-name.html"></r-view>');

        await runRoolith(createRoolith({ data: { items: ["Coffee", "Tea"] } }));

        expect(
            [...document.querySelectorAll("li")].map((node) => node.textContent),
        ).toEqual(["0", "1"]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("keeps loop metadata out of the outer scope and the caller data", async () => {
        const data = { items: ["Coffee", "Tea"] };

        stubFetch({
            "views/loop-metadata-scope.html":
                '<ul><li r-for="item in items">{item}:{$index}</li></ul><p>{$index}:{$length}</p>',
        });

        mount('<r-view src="./views/loop-metadata-scope.html"></r-view>');

        await runRoolith(createRoolith({ data }));

        expect(document.querySelector("p")?.textContent).toBe(
            "{$index}:{$length}",
        );
        expect(data).toEqual({ items: ["Coffee", "Tea"] });
        expect(console.error).not.toHaveBeenCalled();
    });

    it("reads loop metadata in a per-clone condition", async () => {
        stubFetch({
            "views/loop-metadata-filter.html":
                '<ul><li r-for="item in items" r-if="$index > 0">{item}:{$index}</li></ul>',
        });

        mount('<r-view src="./views/loop-metadata-filter.html"></r-view>');

        await runRoolith(
            createRoolith({ data: { items: ["Coffee", "Tea", "Cocoa"] } }),
        );

        expect(
            [...document.querySelectorAll("li")].map((node) => node.textContent),
        ).toEqual(["Tea:1", "Cocoa:2"]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("computes metadata from the resolved list before per-clone filtering", async () => {
        stubFetch({
            "views/loop-metadata-filter-length.html":
                '<ul><li r-for="item in items" r-if="!$last">{item}:{$index}:{$last}:{$length}</li></ul>',
        });

        mount('<r-view src="./views/loop-metadata-filter-length.html"></r-view>');

        await runRoolith(
            createRoolith({ data: { items: ["Coffee", "Tea", "Cocoa"] } }),
        );

        expect(
            [...document.querySelectorAll("li")].map((node) => node.textContent),
        ).toEqual(["Coffee:0:false:3", "Tea:1:false:3"]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("reports metadata declared on a loop template as a view error", async () => {
        stubFetch({
            "views/loop-template-metadata-data.html": `
                <ul>
                    <template r-for="item in items" r-data="{ position: $index }">
                        <li>{position}:{item}</li>
                    </template>
                </ul>
            `,
        });

        mount('<r-view src="./views/loop-template-metadata-data.html"></r-view>');

        await runRoolith(createRoolith({ data: { items: ["Coffee"] } }));

        const error = document.querySelector(".r-view-error");

        expect(error?.textContent).toContain(
            'Data value "$index" did not resolve to a value',
        );
        expect(error?.getAttribute("data-view-error")).toContain(
            'Data value "$index" did not resolve to a value',
        );
        expect(console.error).toHaveBeenCalledTimes(1);
    });
});
