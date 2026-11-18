/**
 * Reads a dotted data path without following the prototype chain.
 *
 * Only own properties are readable, so template text cannot reach inherited members such as `toString` or `constructor`.
 *
 * @param {object} data
 * @param {string} path
 * @returns {unknown}
 */
export function readDataPath(data, path) {
    let value = data;

    for (const segment of path.split(".")) {
        if (!hasOwnProperty(value, segment)) {
            return undefined;
        }

        value = value[segment];
    }

    return typeof value === "function" ? undefined : value;
}

/**
 * Interpolates `{path}` placeholders with values from data.
 *
 * Missing, null, and function values keep the original placeholder, so unresolved data stays visible.
 *
 * @param {string} template
 * @param {object} data
 * @returns {string}
 */
export function parseTemplate(template, data) {
    return template.replace(/\{\s*([\w.$]+)\s*\}/g, (placeholder, path) => {
        const value = readDataPath(data, path);

        return value === undefined || value === null ? placeholder : String(value);
    });
}

/**
 * Checks for an own property while staying within the ES2020 language target.
 *
 * @param {unknown} value
 * @param {string} key
 * @returns {boolean}
 */
function hasOwnProperty(value, key) {
    return (
        value !== null &&
        typeof value === "object" &&
        Object.prototype.hasOwnProperty.call(value, key)
    );
}
