import { readDataPath } from "./interpolate.js";

/**
 * Resolves a loop expression into a loop variable name and a list of items.
 *
 * @param {string|null} expression
 * @param {object} data
 * @returns {{name: string, items: unknown[]}}
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
 * Only the shape and character set are checked, so a path built from word, dot, and `$` characters such as `items.` reports the unresolved-array error instead of a syntax error.
 *
 * @param {string|null} expression
 * @returns {{name: string, path: string}}
 * @throws {Error} When the expression is not `name in dataPath`.
 */
function parseLoopExpression(expression) {
    const match = /^\s*([A-Za-z_$][\w$]*)\s+in\s+([\w.$]+)\s*$/.exec(
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
 * @param {unknown} value
 * @returns {string}
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
