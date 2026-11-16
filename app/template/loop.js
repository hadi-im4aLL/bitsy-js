import { readDataPath } from "./interpolate.js";

/**
 * Resolves a loop expression against data.
 *
 * Combines expression parsing with data lookup so a caller gets either a usable
 * loop variable and item list or a contextual error. Keeping this out of the
 * renderer leaves DOM traversal and loop semantics as separate responsibilities.
 *
 * @param {string|null} expression Raw loop expression, such as `product in products`.
 * @param {object} data Data the loop path is resolved against.
 * @returns {{name: string, items: unknown[]}} Loop variable name and resolved items.
 * @throws {Error} When the expression is malformed or the path is not an array.
 */
export function resolveLoop(expression, data) {
    const { name, path } = parseLoopExpression(expression);
    const items = readDataPath(data, path);

    if (!Array.isArray(items)) {
        throw new Error(
            `Loop "${expression}" did not resolve to an array, found ${describeValue(items)}`,
        );
    }

    return { name, items };
}

/**
 * Parses a loop expression of the form `item in dataPath`.
 *
 * @param {string|null} expression Raw value of the loop attribute.
 * @returns {{name: string, path: string}} Loop variable name and data path.
 * @throws {Error} When the expression is not `name in dataPath`.
 */
function parseLoopExpression(expression) {
    const match = /^\s*([A-Za-z_$][\w$]*)\s+in\s+([\w.]+)\s*$/.exec(
        expression ?? "",
    );

    if (!match) {
        throw new Error(
            `Invalid loop expression "${expression}", expected "item in dataPath"`,
        );
    }

    return { name: match[1], path: match[2] };
}

/**
 * Describes a resolved loop value for error messages.
 *
 * @param {unknown} value Value the loop path resolved to.
 * @returns {string} Short description such as `nothing`, `null`, or a type name.
 */
function describeValue(value) {
    if (value === undefined) {
        return "nothing";
    }

    if (value === null) {
        return "null";
    }

    return typeof value;
}
