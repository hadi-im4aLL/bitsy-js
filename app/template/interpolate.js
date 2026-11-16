/**
 * Reads a dotted data path, such as `product.name` or `items.0.name`, without
 * following the prototype chain.
 *
 * Only own properties are readable, so template text cannot reach inherited
 * members such as `toString` or `constructor`.
 *
 * @param {object} data Object the path is resolved against.
 * @param {string} path Dotted path to read.
 * @returns {unknown} Value at the path, or undefined when a segment is missing.
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
 * This is the JavaScript port of `nano.ts` used by the view renderer. Only dotted
 * property paths are supported; template text is never executed. Missing, null,
 * and function values keep the original placeholder, so unresolved data stays
 * visible instead of rendering `undefined` or leaking function source.
 *
 * @example
 * parseTemplate("Hello {user.name}", { user: { name: "Hadi" } });
 * // "Hello Hadi"
 *
 * @param {string} template Text that may contain `{path}` placeholders.
 * @param {object} data Object the placeholders are resolved against.
 * @returns {string} Template with every resolved placeholder substituted.
 */
export function parseTemplate(template, data) {
    return template.replace(/\{\s*([\w.]+)\s*\}/g, (placeholder, path) => {
        const value = readDataPath(data, path);

        return value === undefined || value === null ? placeholder : String(value);
    });
}

/**
 * Checks for an own property while staying within the ES2020 language target.
 *
 * @param {unknown} value Candidate object.
 * @param {string} key Property name to look for.
 * @returns {boolean} True when value is an object owning a property named key.
 */
function hasOwnProperty(value, key) {
    return (
        value !== null &&
        typeof value === "object" &&
        Object.prototype.hasOwnProperty.call(value, key)
    );
}
