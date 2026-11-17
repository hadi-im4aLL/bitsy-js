import {
    SATISFIED_CONDITION,
    applyElseDirective,
    applyIfDirective,
} from "./condition.js";
import { resolveDataAttribute } from "./data-attribute.js";
import {
    COMMENT_NODE,
    ELEMENT_NODE,
    TEMPLATE_TAG,
    TEXT_NODE,
    isRawTextElement,
} from "./dom-nodes.js";
import { parseTemplate } from "./interpolate.js";
import { LoopExpander } from "./loop-expander.js";

/**
 * Configuration accepted by {@link TemplateRenderer}.
 *
 * @typedef {object} TemplateRendererConfig
 * @property {Document} document Document used to create new nodes.
 * @property {string} viewTag Tag name of view placeholders, whose data is recorded.
 * @property {string} loopAttribute Attribute that marks an element for repetition.
 * @property {string} ifAttribute Attribute that marks an element with its condition.
 * @property {string} elseAttribute Attribute that marks the alternative of the preceding condition element.
 * @property {string} dataAttribute Attribute that declares data for an element subtree.
 */

/**
 * Resolves conditions, expands loops, and interpolates `{path}` placeholders in
 * parsed view content.
 *
 * Rendering mutates the given fragment in place. Every element matching the
 * configured view tag is recorded with the data of the scope it was rendered in, so
 * nested views can resolve item values when they are loaded later.
 *
 * Repetition is delegated to {@link LoopExpander}, which renders the copies back
 * through this renderer, so traversal and the sibling-run pairing state stay in one
 * place while repeated content supports every directive.
 */
export class TemplateRenderer {
    /**
     * Creates a renderer bound to a document and the configured directive attributes.
     *
     * @param {TemplateRendererConfig} config Renderer configuration.
     */
    constructor(config) {
        this.document = config.document;
        this.viewTag = config.viewTag.toUpperCase();
        this.loopAttribute = config.loopAttribute;
        this.ifAttribute = config.ifAttribute;
        this.elseAttribute = config.elseAttribute;
        this.dataAttribute = config.dataAttribute;
        this.dataByElement = new WeakMap();
        this.loops = new LoopExpander({
            document: config.document,
            loopAttribute: this.loopAttribute,
            ifAttribute: this.ifAttribute,
            viewTag: this.viewTag,
            renderer: this,
        });
    }

    /**
     * Returns the data a view placeholder was rendered with.
     *
     * @param {Element} element View placeholder element.
     * @returns {object|undefined} Data of the placeholder scope, or undefined when unrecorded.
     */
    getData(element) {
        return this.dataByElement.get(element);
    }

    /**
     * Resolves conditions, expands loops, and interpolates text inside a parsed view fragment.
     *
     * @param {ParentNode} root Fragment or element to render in place.
     * @param {object} data Data resolved by placeholders in this scope.
     * @returns {void}
     * @throws {Error} When a loop expression, declared data, or a directive on a view placeholder fails.
     */
    render(root, data) {
        this.renderChildren(root, data);
    }

    /**
     * Renders the child nodes of a node with the given data.
     *
     * Each child is rendered in authored order and reports the pairing state for the
     * following sibling, so an else element pairs with the condition element
     * immediately before it in the same run. Comments are tolerated because they are
     * invisible, and so is text that renders as whitespace only, while visible text,
     * a loop element, or any other node type ends the run. Text is interpolated before
     * it is measured, so a placeholder that resolves to whitespace keeps the pair
     * intact and one that resolves to visible text breaks it.
     *
     * @param {ParentNode} root Node whose children are rendered.
     * @param {object} data Data resolved by placeholders in this scope.
     * @returns {void}
     * @throws {Error} When a loop expression, declared data, or a directive on a view placeholder fails.
     */
    renderChildren(root, data) {
        let previousCondition = null;

        for (const node of [...root.childNodes]) {
            previousCondition = this.renderChild({
                node,
                data,
                previousCondition,
            });
        }
    }

    /**
     * Renders one child node and returns the condition state a following else pairs with.
     *
     * The returned state is the outcome of the element as a whole, never null after a
     * paired else: a removed else leaves a satisfied chain, an else without its own
     * condition that rendered is a satisfied chain too, and an else whose own condition
     * was falsy hands on that falsy outcome so the next else can still render. A plain
     * element with no condition ends the run, while a failed condition counts as
     * rendered. That is what makes an else-if chain and a duplicate else mutually
     * exclusive.
     *
     * An orphan else ends the run as well, even though it renders: its pairing failed,
     * so it is a directive error rather than a branch, and the next else therefore
     * reports its own orphan error instead of being removed silently.
     *
     * @param {object} options Child options.
     * @param {Node} options.node Child node to render.
     * @param {object} options.data Data resolved by placeholders in this scope.
     * @param {import("./condition.js").ConditionOutcome|null} options.previousCondition State the preceding sibling left for this element, or null when no condition element precedes it.
     * @returns {import("./condition.js").ConditionOutcome|null} State the following sibling pairs with.
     * @throws {Error} When a loop expression, declared data, or a directive on a view placeholder fails.
     */
    renderChild({ node, data, previousCondition }) {
        if (node.nodeType === TEXT_NODE) {
            node.data = parseTemplate(node.data, data);

            return node.data.trim() === "" ? previousCondition : null;
        }

        if (node.nodeType === COMMENT_NODE) {
            return previousCondition;
        }

        if (node.nodeType !== ELEMENT_NODE) {
            return null;
        }

        const pairing = node.hasAttribute(this.elseAttribute)
            ? applyElseDirective({
                  element: node,
                  elseAttribute: this.elseAttribute,
                  ifAttribute: this.ifAttribute,
                  viewTag: this.viewTag,
                  previousCondition,
              })
            : null;

        if (pairing !== null && pairing.rendered === false) {
            return SATISFIED_CONDITION;
        }

        // Raw-text elements support conditions only, so a loop on one is consumed by
        // the element step instead of being expanded here.
        if (node.hasAttribute(this.loopAttribute) && !isRawTextElement(node)) {
            this.renderLoopedChild({ element: node, data, pairing });

            return null;
        }

        const outcome = this.renderElement(node, data, { pairing });

        if (pairing === null) {
            return outcome;
        }

        if (pairing.failed) {
            return null;
        }

        return outcome ?? SATISFIED_CONDITION;
    }

    /**
     * Renders a child that carries the loop attribute, which the caller treats as the end
     * of the sibling run.
     *
     * A failed pairing stops before the loop starts, so the orphan element keeps its place
     * and its recorded error. All three directive attributes are consumed without being
     * evaluated: the loop is never expanded, the declared data is never resolved, and the
     * element's own condition is never evaluated, because nothing in the element renders.
     * Evaluating any of them would escalate a local directive error into a view failure, a
     * branch decision, or an error message that replaces the one the pairing already
     * recorded. Its children stay unrendered, because loop body is content to be repeated
     * rather than a rendered subtree.
     *
     * @param {object} options Loop options.
     * @param {Element} options.element Element carrying the loop attribute.
     * @param {object} options.data Data resolved by placeholders in this scope.
     * @param {import("./condition.js").ConditionOutcome|null} options.pairing Outcome of the else pairing of this element, or null when it carries no else attribute.
     * @returns {void}
     * @throws {Error} When {@link LoopExpander.expand} rejects the loop expression or resolved items, or a directive on a view placeholder fails.
     */
    renderLoopedChild({ element, data, pairing }) {
        if (pairing?.failed === true) {
            element.removeAttribute(this.loopAttribute);
            element.removeAttribute(this.dataAttribute);
            element.removeAttribute(this.ifAttribute);

            return;
        }

        this.loops.expand({ element, data });
    }

    /**
     * Renders an element subtree in the scope declared by its data attribute.
     *
     * The declared data is resolved before the condition is evaluated, so a
     * condition on the same element reads the element's own data, and the element's
     * own condition then acts as an else-if branch when an else directive selected
     * it. A falsy condition removes the element and its whole subtree before any
     * child is rendered, so nothing inside a hidden branch is interpolated, expanded,
     * or recorded as a view. A failing condition keeps the element and reports the
     * failure on it.
     *
     * A `<template>` selected by a condition renders its content and is replaced by
     * it, mirroring how a repeated template is handled, because the wrapper itself
     * has no meaning in the rendered output. Selection is either a truthy condition
     * of its own or an else directive that paired it with a falsy condition element.
     * A failed condition, including an orphan else, keeps the wrapper, because
     * replacing it would drop the recorded error along with it.
     *
     * Raw-text elements are the one exception: they support conditions only. Their
     * condition is evaluated in the surrounding scope, because they never get a
     * declared data scope, and their text is never interpolated and their content is
     * never walked, because it is script or style text rather than markup. A loop and a
     * declared data attribute on them are consumed without being resolved, so such an
     * element renders once with its directives consumed and its text intact.
     *
     * View placeholders are recorded with the scope they were rendered in, for when
     * their content is loaded later.
     *
     * @param {Element} element Element to render.
     * @param {object} data Data resolved by placeholders in the parent scope.
     * @param {object} [options] Rendering options.
     * @param {import("./condition.js").ConditionOutcome|null} [options.pairing] Outcome of the else pairing of this element, or null when it carries no else attribute.
     * @returns {import("./condition.js").ConditionOutcome|null} Outcome of the element condition, or null when the element carries none.
     * @throws {Error} When {@link resolveElementData} rejects the declared data, or a directive on a view placeholder fails.
     */
    renderElement(element, data, { pairing = null } = {}) {
        if (isRawTextElement(element)) {
            element.removeAttribute(this.loopAttribute);
            element.removeAttribute(this.dataAttribute);

            return applyIfDirective({
                element,
                ifAttribute: this.ifAttribute,
                data,
                viewTag: this.viewTag,
            });
        }

        const elementData = this.resolveElementData(element, data);
        const condition = applyIfDirective({
            element,
            ifAttribute: this.ifAttribute,
            data: elementData,
            viewTag: this.viewTag,
        });

        if (condition !== null && condition.rendered === false) {
            return condition;
        }

        const hasFailed = pairing?.failed === true || condition?.failed === true;
        // An orphan else counts as failed through its pairing outcome, so the pairing
        // that survives the failed check is the one that selected this element.
        const hasElsePairing = pairing !== null;
        const isExpandingTemplate = hasFailed === false
            && element.tagName === TEMPLATE_TAG
            && (hasElsePairing || condition !== null);

        if (isExpandingTemplate) {
            this.renderChildren(element.content, elementData);
            element.replaceWith(element.content);

            return condition;
        }

        if (element.tagName === this.viewTag) {
            this.dataByElement.set(element, elementData);
        }

        this.renderChildren(element, elementData);

        return condition;
    }

    /**
     * Resolves and consumes the data declared by an element.
     *
     * The attribute is removed after a successful resolution so directives do not
     * leak into the rendered DOM.
     *
     * @param {Element} element Element that may declare data.
     * @param {object} data Data resolved by placeholders in the parent scope.
     * @returns {object} Parent data, or parent data with the declared keys overlaid.
     * @throws {Error} When {@link resolveDataAttribute} rejects the declared data.
     */
    resolveElementData(element, data) {
        const elementData = resolveDataAttribute(
            element.getAttribute(this.dataAttribute),
            data,
        );

        element.removeAttribute(this.dataAttribute);

        return elementData;
    }
}
