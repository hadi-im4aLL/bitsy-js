import { applyIfDirective } from "./condition.js";
import { TEMPLATE_TAG } from "./dom-nodes.js";
import { resolveLoop } from "./loop.js";

/**
 * Rendering surface a {@link LoopExpander} uses to render repeated markup.
 *
 * @typedef {object} LoopRenderer
 * @property {(options: {root: ParentNode, data: object, collector: import("../utils/remote-target-collector.js").RemoteTargetCollector}) => void} renderChildren
 * @property {(options: {element: Element, data: object, collector: import("../utils/remote-target-collector.js").RemoteTargetCollector}) => import("./condition.js").ConditionOutcome|null} renderElement
 * @property {(element: Element, data: object) => object} resolveElementData
 */

/**
 * Configuration accepted by {@link LoopExpander}.
 *
 * @typedef {object} LoopExpanderConfig
 * @property {Document} document
 * @property {string} loopAttribute
 * @property {string} ifAttribute
 * @property {string} remoteAttribute
 * @property {string} viewTag
 * @property {LoopRenderer} renderer
 */

/**
 * Expands elements and templates marked with the loop attribute into one rendered copy per item.
 *
 * A template repeats its content and its declared data gates and scopes the whole group, while any other element repeats itself with per-item data.
 */
export class LoopExpander {
    /**
     * Creates an expander bound to a document, the directive attributes, and the renderer.
     *
     * @param {LoopExpanderConfig} config
     */
    constructor(config) {
        this.document = config.document;
        this.loopAttribute = config.loopAttribute;
        this.ifAttribute = config.ifAttribute;
        this.remoteAttribute = config.remoteAttribute;
        this.viewTag = config.viewTag;
        this.renderer = config.renderer;
    }

    /**
     * Replaces an element carrying the loop attribute with one rendered copy per item.
     *
     * The loop attribute is consumed before any other step, and each copy renders in a new item scope, so the outer scope keeps no loop keys.
     *
     * @param {object} options
     * @param {Element} options.element
     * @param {object} options.data
     * @param {import("../utils/remote-target-collector.js").RemoteTargetCollector} options.collector
     * @throws {Error} When {@link resolveLoop} rejects the expression or resolved items, or a directive on a view placeholder fails.
     */
    expand({ element, data, collector }) {
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
            // guards instead of being dropped with the wrapper. Neither reaches the
            // element step, so the remote attribute is consumed here.
            element.removeAttribute(this.remoteAttribute);

            return;
        }

        const { name, items } = resolveLoop(expression, scope);
        const output = this.document.createDocumentFragment();

        for (const [index, item] of items.entries()) {
            const itemData = this.createItemScope({
                scope,
                name,
                item,
                index,
                items,
            });

            if (isTemplate) {
                const content = element.content.cloneNode(true);

                this.renderer.renderChildren({
                    root: content,
                    data: itemData,
                    collector,
                });
                output.append(content);

                continue;
            }

            const clone = element.cloneNode(true);

            // Attached before rendering so a falsy condition can remove the clone
            // from the output.
            output.append(clone);
            this.renderer.renderElement({
                element: clone,
                data: itemData,
                collector,
            });
        }

        element.replaceWith(output);
    }

    /**
     * Builds the scope of one loop item by overlaying the loop variable and `$index`, `$first`, `$last`, and `$length` on the loop's scope.
     *
     * Metadata is written last, so a nested loop shadows the outer metadata and a loop variable named after a metadata key is overwritten.
     *
     * @param {object} options
     * @param {object} options.scope
     * @param {string} options.name
     * @param {unknown} options.item
     * @param {number} options.index
     * @param {unknown[]} options.items
     * @returns {object}
     */
    createItemScope({
        scope,
        name,
        item,
        index,
        items,
    }) {
        return {
            ...scope,
            [name]: item,
            $index: index,
            $first: index === 0,
            $last: index === items.length - 1,
            $length: items.length,
        };
    }
}
