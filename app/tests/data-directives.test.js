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

    it("reads a quoted key and the shared escape rules", () => {
        expect(
            resolveDataAttribute("{ 'a b': 'x\\ty', q: '\\q' }", data),
        ).toEqual({ ...data, "a b": "x\ty", q: "q" });
    });

    it("keeps punctuation inside a quoted key", () => {
        expect(resolveDataAttribute("{ 'a:b} c': 'x' }", data)).toEqual({
            ...data,
            "a:b} c": "x",
        });
    });

    it("unescapes a quoted key", () => {
        expect(resolveDataAttribute("{ 'a\\tb': 1 }", data)).toEqual({
            ...data,
            "a\tb": 1,
        });
    });

    it("rejects a sign separated from its number", () => {
        expect(() => resolveDataAttribute("{ m: - 1 }", data)).toThrow(
            'Invalid data object: unexpected character "-"',
        );
    });

    it("escapes a quote in an unexpected character message", () => {
        expect(() => resolveDataAttribute('{ a: "x }', data)).toThrow(
            'Invalid data object: unexpected character "\\""',
        );
    });

    it("escapes a quoted token in an expected colon message", () => {
        expect(() => resolveDataAttribute('{ "a" "b" }', data)).toThrow(
            'Invalid data object: expected ":" but found "\\"b\\""',
        );
    });

    it("rejects a key named after the prototype accessor", () => {
        const message =
            'Invalid data object: data key "__proto__" is not supported, because assigning it would replace the prototype instead of creating the key';

        expect(() => resolveDataAttribute("{ '__proto__': 1 }", data)).toThrow(
            message,
        );
        expect(() => resolveDataAttribute("{ __proto__: 1 }", data)).toThrow(
            message,
        );
        expect(() =>
            resolveDataAttribute("{ title: 'x', __proto__: 1 }", data),
        ).toThrow(message);
    });

    it("keeps an ordinary key that shadows an inherited member", () => {
        const resolved = resolveDataAttribute(
            "{ constructor: 1, toString: 'x' }",
            data,
        );

        expect(Object.keys(resolved)).toEqual([
            "heading",
            "product",
            "constructor",
            "toString",
        ]);
        expect(resolved.constructor).toBe(1);
        expect(resolved.toString).toBe("x");
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

    it("resolves a root data key that starts with $", () => {
        expect(parseTemplate("{ $total } items", { $total: 3 })).toBe(
            "3 items",
        );
        expect(parseTemplate("{$price}", { $price: "9.50" })).toBe("9.50");
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
