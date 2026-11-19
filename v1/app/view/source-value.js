/**
 * Source values declared by the `src` attribute and by the remote attribute.
 *
 * A blank value must never reach URL resolution, because a WHATWG URL parse would resolve it against the containing document.
 */

/**
 * Normalizes a raw source attribute value, returning null when it declares no source.
 */
export function normalizeSource(value) {
    if (typeof value !== "string") {
        return null;
    }

    const trimmed = value.trim();

    return trimmed === "" ? null : trimmed;
}

/**
 * Reads and normalizes the source declared by one attribute of an element.
 */
export function readSource(element, attributeName) {
    return normalizeSource(element.getAttribute(attributeName));
}

/**
 * Creates the directive error for a source attribute that declares nothing.
 */
export function createMissingSourceError(attributeName) {
    return new Error(`Attribute "${attributeName}" is missing a source URL`);
}
