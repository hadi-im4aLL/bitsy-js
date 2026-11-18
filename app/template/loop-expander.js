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
 * @property {(root: ParentNode, data: object) => void} renderChildren Renders repeated template content in an item scope that overlays the loop variable and the loop metadata on the loop's own scope.
 * @property {(element: Element, data: object) => import("./condition.js").ConditionOutcome|null} renderElement Renders one repeated clone in an item scope that overlays the loop variable and the loop metadata on the loop's own scope.
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
 *
 * Every item is rendered in a new scope that overlays the loop variable and the loop
 * metadata `$index`, `$first`, `$last`, and `$length` on that base scope. The
 * metadata is written into the item scope only, so it never reaches the outer scope
 * or the data object the caller passed in, and a nested loop shadows the metadata of
 * the loop around it inside its own body.
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
     * Each copy is rendered in a scope that overlays the loop variable and the loop
     * metadata on the template's own declared data or on the outer data. The metadata
     * is `$index` (0 based), `$first`, `$last`, and `$length`, and it is visible to
     * every directive and every placeholder in the copy, including a nested view and
     * the data that view declares for itself. Because the metadata lives on a new
     * object, the outer scope and the caller's data object keep no loop keys, so a
     * sibling after the loop cannot read them.
     *
     * @param {object} options Expansion options.
     * @param {Element} options.element Element carrying the loop attribute.
     * @param {object} options.data Data resolved by placeholders in the outer scope. The element form overlays the item scope on `data`; the template form first resolves the template's declared data over `data` and overlays the item scope on that. Neither the outer data nor the caller's object is mutated.
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

        for (const [index, item] of items.entries()) {
            const itemData = createItemScope(scope, name, item, index, items);

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

/**
 * Builds the scope of one loop item by overlaying the loop variable and the loop
 * metadata on the scope the loop was expanded in.
 *
 * `$index` is the zero-based position of the item, `$first` and `$last` mark the
 * ends of the resolved list, and `$length` is the number of resolved items. An
 * empty list produces no item, so it produces no metadata either. The new object
 * is the only place the metadata is written, so the base scope and the caller's
 * data object are never mutated and a sibling after the loop cannot read the
 * metadata.
 *
 * A nested loop spreads its own base scope, which already contains the metadata of
 * the loop around it, and then writes its own metadata last. The inner loop
 * therefore shadows the outer metadata inside its body, so reading `$index` there
 * gives the inner position. Capturing an outer position needs a value stored in the
 * outer item, because each loop owns the metadata names.
 *
 * Because the metadata is written after the loop variable, a loop variable named
 * after a metadata key, such as `$index`, is overwritten by the metadata, so its
 * item is not reachable through that name.
 *
 * @param {object} scope Scope the loop was expanded in: the template's own declared data or the outer data.
 * @param {string} name Loop variable name, which overlays any outer key of the same name.
 * @param {unknown} item Item of the current iteration.
 * @param {number} index Zero-based position of the item in the resolved list.
 * @param {unknown[]} items Resolved items of the loop, whose length defines `$length` and `$last`. The list is passed instead of its length so the two numbers of the call site can never be transposed.
 * @returns {object} Item scope with the loop variable and the loop metadata overlaid.
 */
function createItemScope(scope, name, item, index, items) {
    return {
        ...scope,
        [name]: item,
        $index: index,
        $first: index === 0,
        $last: index === items.length - 1,
        $length: items.length,
    };
}
