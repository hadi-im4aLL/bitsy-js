import { parseDataObject } from "./data-object.js";
import { readDataPath } from "./interpolate.js";

/**
 * Resolves the data declared by an element's `r-data` attribute over a parent scope.
 *
 * Two forms are supported:
 * - a dotted path from the parent scope that resolves to an object, such as `product`
 * - an object literal, such as `{ title: heading, product: item }`, whose values are
 *   quoted strings, numbers, booleans, null, or dotted data paths
 *
 * Declared keys overlay the parent data, so the element subtree and any view loaded
 * into it inherit both. The literal is parsed by {@link parseDataObject} rather than
 * evaluated, so it cannot execute code or break content security policies.
 *
 * @example
 * resolveDataAttribute("product", { product: { name: "Coffee" } });
 * // { product: { name: "Coffee" }, name: "Coffee" }
 *
 * @example
 * resolveDataAttribute("{ title: heading }", { heading: "Products" });
 * // { heading: "Products", title: "Products" }
 *
 * @param {string|null} attributeValue Raw value of the `r-data` attribute.
 * @param {object} data Data resolved by placeholders in the parent scope.
 * @returns {object} Parent data, or parent data with the declared keys overlaid.
 * @throws {Error} When the path does not resolve to an object or the literal is invalid.
 */
export function resolveDataAttribute(attributeValue, data) {
    if (attributeValue === null || attributeValue.trim() === "") {
        return data;
    }

    const value = attributeValue.trim();

    if (value.startsWith("{")) {
        return { ...data, ...parseDataObject(value, data) };
    }

    const resolved = readDataPath(data, value);

    if (!isPlainObject(resolved)) {
        throw new Error(
            `r-data "${value}" must resolve to an object, found ${describeResolution(resolved)}`,
        );
    }

    return { ...data, ...resolved };
}

/**
 * Checks whether a value can be spread into a child scope.
 *
 * @param {unknown} value Candidate value.
 * @returns {boolean} True for non-null, non-array objects.
 */
function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Describes a resolved `r-data` path value for error messages.
 *
 * @param {unknown} value Value the path resolved to.
 * @returns {string} Short description such as `nothing`, `an array`, or a type name.
 */
function describeResolution(value) {
    if (value === undefined) {
        return "nothing";
    }

    if (value === null) {
        return "null";
    }

    if (Array.isArray(value)) {
        return "an array";
    }

    return typeof value;
}
