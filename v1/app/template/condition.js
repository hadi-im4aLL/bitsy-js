import { reportDirectiveFailure } from "../utils/directive-failure.js";
import { evaluateExpression } from "./expression.js";

/**
 * Outcome of resolving a condition directive on an element or a sibling run.
 *
 * @typedef {object} ConditionOutcome
 * @property {boolean} rendered Whether the element keeps its content; a directive error never removes content.
 * @property {boolean} failed Whether the directive failed and the failure was reported.
 */

/**
 * Pairing state of a condition chain that already rendered a branch.
 *
 * A following else element pairs with this state and is removed, which keeps the branches of one chain mutually exclusive.
 */
export const SATISFIED_CONDITION = Object.freeze({
    rendered: true,
    failed: false,
});

/**
 * Applies the condition directive of an element and removes the element when the condition is falsy.
 *
 * The attribute is consumed before evaluation, and a failure is reported on the element and counts as rendered, so content is never silently removed.
 *
 * @param {object} options
 * @param {Element} options.element
 * @param {string} options.ifAttribute
 * @param {object} options.data
 * @param {string} options.viewTag
 * @returns {ConditionOutcome|null}
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
        reportDirectiveFailure({ element, error, viewTag });

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
 * An orphan else is reported and stays in place, and an element selected by its else may still evaluate its own condition as an else-if branch.
 *
 * @param {object} options
 * @param {Element} options.element
 * @param {string} options.elseAttribute
 * @param {string} options.ifAttribute
 * @param {string} options.viewTag
 * @param {ConditionOutcome|null} options.previousCondition
 * @returns {ConditionOutcome}
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
        reportDirectiveFailure({
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

