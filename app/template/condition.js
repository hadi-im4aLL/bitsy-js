import { evaluateExpression } from "./expression.js";

/**
 * Attribute that records a directive failure on the element that stays in place.
 *
 * The name is not configurable, because it reports library failures rather than a
 * template directive, so host styles and scripts can rely on one name.
 */
const ERROR_ATTRIBUTE = "data-r-error";

/**
 * Outcome of resolving a condition directive on an element or a sibling run.
 *
 * @typedef {object} ConditionOutcome
 * @property {boolean} rendered Whether the element keeps its content. True when the expression evaluated truthy, when evaluation failed because a directive error never removes content, and when an else directive selected the element. In a sibling run it means the chain already rendered a branch.
 * @property {boolean} failed Whether the directive failed and the failure was reported instead of resolving silently.
 */

/**
 * Pairing state of a condition chain that already rendered a branch.
 *
 * A following else element pairs with this state and is removed, which is what
 * keeps an else-if chain and a duplicate else mutually exclusive instead of
 * rendering two branches of one chain.
 */
export const SATISFIED_CONDITION = Object.freeze({
    rendered: true,
    failed: false,
});

/**
 * Applies the condition directive of an element and removes the element when the condition is falsy.
 *
 * The attribute is consumed before evaluation, so a rendered element never carries
 * the directive, including when the expression fails. Evaluation reuses the shared
 * expression evaluator, so a missing path is falsy and never throws, and no new
 * grammar or evaluation path is introduced. Any value decides by truthiness, so a
 * condition reads like a JavaScript condition on the same data.
 *
 * An empty or whitespace-only value is a directive error rather than a false
 * condition, because an empty condition is a mistake, so the element keeps its place
 * and the failure is reported.
 *
 * A failing expression is reported and resolves as rendered, because directive
 * errors must not remove content. Both syntax errors and a `RangeError` from
 * pathological nesting are caught here, so a directive failure is reported by
 * {@link reportDirectiveError} instead of escaping evaluation.
 *
 * @param {object} options Condition options.
 * @param {Element} options.element Element that may carry the condition attribute.
 * @param {string} options.ifAttribute Name of the condition attribute, such as `r-if`.
 * @param {object} options.data Scope resolved for the element, including its own declared data.
 * @param {string} options.viewTag Configured view placeholder tag, in the upper case a DOM `tagName` uses, whose failures use the view error element path.
 * @returns {ConditionOutcome|null} Outcome of the condition, or null when the element carries no condition.
 * @throws {Error} When the element is a view placeholder, so the view error element path handles the failure.
 */
export function applyIfDirective({
    element,
    ifAttribute,
    data,
    viewTag,
}) {
    const expression = element.getAttribute(ifAttribute);

    if (expression === null) {
        return null;
    }

    element.removeAttribute(ifAttribute);

    let outcome;

    try {
        outcome = {
            rendered: Boolean(evaluateExpression(expression, data).value),
            failed: false,
        };
    } catch (error) {
        reportDirectiveError({ element, error, viewTag });

        outcome = { rendered: true, failed: true };
    }

    if (outcome.rendered === false) {
        element.remove();
    }

    return outcome;
}

/**
 * Applies the else directive of an element, which pairs with the condition element before it.
 *
 * The element is selected when the preceding condition element resolved falsy,
 * and is removed when that element rendered. The attribute is always consumed. An
 * else element with no condition element before it in the same sibling run is a
 * directive error that stays in place with the failure reported, because a
 * directive error never removes content.
 *
 * The else attribute carries no expression of its own, so a value on it is
 * ignored rather than validated: the attribute only marks the alternative branch.
 * Resolving the element's own condition after selection is the caller's job, which
 * is what makes `r-else` with `r-if` an else-if branch of the same chain.
 *
 * @param {object} options Pairing options.
 * @param {Element} options.element Element carrying the else attribute.
 * @param {string} options.elseAttribute Name of the else attribute, such as `r-else`.
 * @param {string} options.ifAttribute Name of the condition attribute, such as `r-if`.
 * @param {string} options.viewTag Configured view placeholder tag, in the upper case a DOM `tagName` uses, whose failures use the view error element path.
 * @param {ConditionOutcome|null} options.previousCondition Outcome the preceding sibling pairs with, or null when no condition element precedes this one in the run.
 * @returns {ConditionOutcome} Outcome of the pairing: rendered and failed for an orphan, not rendered when the chain already rendered a branch, and rendered when the element is selected as the alternative branch.
 * @throws {Error} When the element is a view placeholder, so the view error element path handles the failure.
 */
export function applyElseDirective({
    element,
    elseAttribute,
    ifAttribute,
    viewTag,
    previousCondition,
}) {
    element.removeAttribute(elseAttribute);

    if (previousCondition === null) {
        reportDirectiveError({
            element,
            error: new Error(
                `Attribute "${elseAttribute}" must follow an element with "${ifAttribute}"`,
            ),
            viewTag,
        });

        return { rendered: true, failed: true };
    }

    if (previousCondition.rendered) {
        element.remove();

        return { rendered: false, failed: false };
    }

    return { rendered: true, failed: false };
}

/**
 * Reports a directive failure on the failure surface of the element.
 *
 * A plain element keeps its place, records the message as `data-r-error`, and logs
 * it, so the failure stays observable in the DOM and in the console while the
 * element and its content are left untouched. A view placeholder uses the existing
 * view error element path instead: the failure is thrown so the `try`/`catch`
 * around the render pass in `app/view/view.js` replaces that view with its error
 * element. The placeholder itself is never marked, because `view.js` replaces it
 * afterwards and the attribute would not survive.
 *
 * @param {object} options Failure options.
 * @param {Element} options.element Element whose directive failed.
 * @param {Error} options.error Failure raised while resolving the directive.
 * @param {string} options.viewTag Configured view placeholder tag, in the upper case a DOM `tagName` uses.
 * @returns {void}
 * @throws {Error} When the element is a view placeholder, so the view error element path handles the failure.
 */
function reportDirectiveError({ element, error, viewTag }) {
    if (element.tagName === viewTag) {
        throw error;
    }

    element.setAttribute(ERROR_ATTRIBUTE, error.message);

    console.error(error);
}
