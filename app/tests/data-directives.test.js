import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveDataAttribute } from "../template/data-attribute.js";
import { parseTemplate, readDataPath } from "../template/interpolate.js";
import {
    createRoolith,
    mount,
    runRoolith,
    stubFetch,
} from "./helpers.js";

const data = {
    heading: "Products",
    product: { name: "Coffee", description: "Roasted beans" },
};

describe("data attributes", () => {
    it("overlays the object resolved by a data path", () => {
        expect(resolveDataAttribute("product", data)).toEqual({
            ...data,
            name: "Coffee",
            description: "Roasted beans",
        });
    });

    it("overlays values resolved by an object literal", () => {
        expect(
            resolveDataAttribute(
                "{ title: heading, count: 2, featured: true, missing: null, label: 'New' }",
                data,
            ),
        ).toEqual({
            ...data,
            title: "Products",
            count: 2,
            featured: true,
            missing: null,
            label: "New",
        });
    });

    it("returns the parent data for an empty attribute", () => {
        expect(resolveDataAttribute(null, data)).toBe(data);
        expect(resolveDataAttribute("   ", data)).toBe(data);
    });

    it("rejects an invalid object literal", () => {
        expect(() => resolveDataAttribute("{ title: }", data)).toThrow(
            /Invalid data value/,
        );
    });

    it("rejects a data path that does not resolve to an object", () => {
        expect(() => resolveDataAttribute("heading", data)).toThrow(
            'Data attribute "heading" must resolve to an object, found string',
        );
    });

    it("reads only own properties and never inherited members", () => {
        const inherited = Object.create({ inherited: "yes" });

        expect(readDataPath({}, "constructor")).toBeUndefined();
        expect(readDataPath({}, "__proto__")).toBeUndefined();
        expect(readDataPath({ value: 1 }, "value.constructor")).toBeUndefined();
        expect(readDataPath(inherited, "inherited")).toBeUndefined();
        expect(() => resolveDataAttribute("inherited", inherited)).toThrow(
            'Data attribute "inherited" must resolve to an object, found nothing',
        );
    });
});

describe("interpolation", () => {
    it("replaces dotted paths with their values", () => {
        expect(
            parseTemplate("Hello {user.name}, you have { count } items", {
                user: { name: "Hadi" },
                count: 3,
            }),
        ).toBe("Hello Hadi, you have 3 items");
    });

    it("keeps the placeholder for missing and null values", () => {
        expect(parseTemplate("Hello {missing}", {})).toBe("Hello {missing}");
        expect(parseTemplate("Hello {name}", { name: null })).toBe(
            "Hello {name}",
        );
    });

    it("keeps the placeholder for function values without calling them", () => {
        const callback = vi.fn(() => {
            throw new Error("must not be called");
        });

        expect(parseTemplate("{callback}", { callback })).toBe("{callback}");
        expect(callback).not.toHaveBeenCalled();
    });

    it("keeps the placeholder for inherited members", () => {
        expect(parseTemplate("{constructor}", {})).toBe("{constructor}");
        expect(parseTemplate("{toString}", {})).toBe("{toString}");
    });
});

describe("data attributes in rendered views", () => {
    beforeEach(() => {
        mount("");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("applies path and object literal forms to rendered content", async () => {
        stubFetch({
            "views/data.html": `
                <section r-data="product">
                    <h2>{name}</h2>
                </section>
                <section r-data="{ title: heading }">
                    <h3>{title}</h3>
                </section>
            `,
        });

        mount('<r-view src="./views/data.html"></r-view>');

        await runRoolith(createRoolith({ data }));

        expect(document.querySelector("h2")?.textContent).toBe("Coffee");
        expect(document.querySelector("h3")?.textContent).toBe("Products");
        expect(document.querySelector("[r-data]")).toBeNull();
    });

    it("reports invalid data inside a view as a view error", async () => {
        stubFetch({
            "views/bad-data.html": '<section r-data="{ title: }">{title}</section>',
        });

        mount('<r-view src="./views/bad-data.html"></r-view>');

        await runRoolith(createRoolith());

        const error = document.querySelector(".r-view-error");

        expect(error).not.toBeNull();
        expect(error.textContent).toContain("Invalid data value");
        expect(error.getAttribute("data-view-error")).toContain(
            "Invalid data value",
        );
        expect(document.querySelector("section")).toBeNull();
    });
});
