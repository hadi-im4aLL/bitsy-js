/**
 * Checks whether a value can be spread into a child scope.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
