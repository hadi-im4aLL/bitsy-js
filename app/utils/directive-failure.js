/**
 * Attribute that records a directive failure on the element that stays in place.
 *
 * Not configurable, because it reports library state rather than a template directive.
 */
const DIRECTIVE_ERROR_ATTRIBUTE = "data-r-error";

/**
 * Reports a directive failure on the element that stays in place.
 *
 * A view placeholder throws instead, so the view error element path handles the failure.
 *
 * @param {object} options
 * @param {Element} options.element
 * @param {Error} options.error
 * @param {string|null} [options.viewTag]
 * @throws {Error} When the element is the view placeholder.
 */
export function reportDirectiveFailure({ element, error, viewTag = null }) {
    if (viewTag !== null && element.tagName === viewTag) {
        throw error;
    }

    element.setAttribute(DIRECTIVE_ERROR_ATTRIBUTE, error.message);

    console.error(error);
}
