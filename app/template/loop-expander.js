import { applyIfDirective } from "./condition.js";
import { TEMPLATE_TAG } from "./dom-nodes.js";
import { resolveLoop } from "./loop.js";

/**
 * Rendering surface a {@link LoopExpander} uses to render repeated markup.
 *
 * The expander only repeats markup, so it hands clones and template content back to
 * the renderer instead of walking them itself. This keeps traversal in one place and
 * lets repeated content support every directive the renderer supports.
 *
 * @typedef {object} LoopRenderer
 * @property {(root: ParentNode, data: object) => void} renderChildren Renders repeated template content in an item scope.
 * @property {(element: Element, data: object) => import("./condition.js").ConditionOutcome|null} renderElement Renders one repeated clone in an item scope.
 * @property {(element: Element, data: object) => object} resolveElementData Resolves and consumes the data a repeated template declares for itself, which gates and scopes the whole group.
 */

/**
 * Configuration accepted by {@link LoopExpander}.
 *
 * @typedef {object} LoopExpanderConfig
 * @property {Document} document Document used to create the output fragment.
 * @property {string} loopAttribute Attribute that marks an element for repetition.
 * @property {string} ifAttribute Attribute that marks an element with its condition.
 * @property {string} viewTag Configured view placeholder tag, in the upper case a DOM `tagName` uses.
 * @property {LoopRenderer} renderer Renderer that renders the repeated markup.
 */

/**
 * Expands elements and templates marked with the loop attribute into one rendered
 * copy per item.
 *
 * A `<template>` repeats its content, while any other element repeats itself. Use the
 * template form for a group of siblings or when a wrapper such as `<ul>` must appear
 * once instead of once per item.
 *
 * Template attributes are never cloned into the content, so the template resolves its
 * own declared data once and uses that scope for its condition, its loop expression,
 * and the base of every item scope. That is the only way declared data on a loop
 * template can apply, and it makes its condition gate the whole group. An element
 * form keeps its declared data on the element, so the data stays per item and is
 * resolved per clone against the item scope, which is also how its condition is
 * filtered per item.
 */
export class LoopExpander {
    /**
     * Creates an expander bound to a document, the directive attributes, and the renderer.
     *
     * @param {LoopExpanderConfig} config Expander configuration.
     */
    constructor(config) {
        this.document = config.document;
        this.loopAttribute = config.loopAttribute;
        this.ifAttribute = config.ifAttribute;
        this.viewTag = config.viewTag;
        this.renderer = config.renderer;
    }

    /**
     * Replaces an element carrying the loop attribute with one rendered copy per item.
     *
     * The loop attribute is consumed before any other step, so a repeated element
     * never carries it into the rendered DOM, including when the expansion stops
     * early.
     *
     * An element that never expands because its else pairing failed is handled by the
     * caller before this method runs, so the expander only sees elements that are
     * meant to repeat.
     *
     * @param {object} options Expansion options.
     * @param {Element} options.element Element carrying the loop attribute.
     * @param {object} options.data Data resolved by placeholders in the outer scope.
     * @returns {void}
     * @throws {Error} When {@link resolveLoop} rejects the expression or resolved items, or a directive on a view placeholder fails.
     */
    expand({ element, data }) {
        const expression = element.getAttribute(this.loopAttribute);

        element.removeAttribute(this.loopAttribute);

        const isTemplate = element.tagName === TEMPLATE_TAG;
        const scope = isTemplate
            ? this.renderer.resolveElementData(element, data)
            : data;
        const condition = isTemplate
            ? applyIfDirective({
                  element,
                  ifAttribute: this.ifAttribute,
                  data: scope,
                  viewTag: this.viewTag,
              })
            : null;

        if (
            condition !== null
            && (condition.rendered === false || condition.failed)
        ) {
            // A falsy condition already removed the whole group, while a failed one
            // keeps the wrapper so the recorded error stays next to the content it
            // guards instead of being dropped with the wrapper.
            return;
        }

        const { name, items } = resolveLoop(expression, scope);
        const output = this.document.createDocumentFragment();

        for (const item of items) {
            const itemData = { ...scope, [name]: item };

            if (isTemplate) {
                const content = element.content.cloneNode(true);

                this.renderer.renderChildren(content, itemData);
                output.append(content);

                continue;
            }

            const clone = element.cloneNode(true);

            // Attached before rendering so a falsy condition can remove the clone
            // from the output.
            output.append(clone);
            this.renderer.renderElement(clone, itemData);
        }

        element.replaceWith(output);
    }
}
