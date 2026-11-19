import { isPlainObject } from "../utils/is-plain-object.js";
import { parseDataObject } from "./data-object.js";
import { readDataPath } from "./interpolate.js";

/**
 * Resolves the data declared by an element's data attribute over a parent scope.
 *
 * A dotted path must resolve to an object, while an object literal is parsed rather than evaluated and its keys overlay the parent data.
 *
 * @param {string|null} attributeValue
 * @param {object} data
 * @returns {object}
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
            `Data attribute "${value}" must resolve to an object, found ${describeResolution(resolved)}`,
        );
    }

    return { ...data, ...resolved };
}

/**
 * Describes a resolved data attribute path value for error messages.
 *
 * @param {unknown} value
 * @returns {string}
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
