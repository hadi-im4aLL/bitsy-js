import {
    SATISFIED_CONDITION,
    applyElseDirective,
} from "./condition.js";
import {
    COMMENT_NODE,
    ELEMENT_NODE,
    TEXT_NODE,
    isRawTextElement,
} from "./dom-nodes.js";
import { ElementRenderer } from "./element-renderer.js";
import { parseTemplate } from "./interpolate.js";
import { LoopExpander } from "./loop-expander.js";

/**
 * Configuration accepted by {@link TemplateRenderer}.
 *
 * @typedef {object} TemplateRendererConfig
 * @property {Document} document
 * @property {string} viewTag
 * @property {string} loopAttribute
 * @property {string} ifAttribute
 * @property {string} elseAttribute
 * @property {string} dataAttribute
 * @property {string} remoteAttribute
 */

/**
 * Renders parsed view content: sibling order, condition pairing, loops, interpolation, and the element step.
 *
 * Remote requests are asynchronous while the walk is not, so targets are recorded into the collector and loaded by the caller after the walk.
 */
export class TemplateRenderer {
    /**
     * Creates a renderer bound to a document and the configured directive attributes.
     *
     * @param {TemplateRendererConfig} config
     */
    constructor(config) {
        this.viewTag = config.viewTag.toUpperCase();
        this.loopAttribute = config.loopAttribute;
        this.ifAttribute = config.ifAttribute;
        this.elseAttribute = config.elseAttribute;
        this.dataAttribute = config.dataAttribute;
        this.remoteAttribute = config.remoteAttribute;
        this.elements = new ElementRenderer({
            viewTag: this.viewTag,
            loopAttribute: this.loopAttribute,
            ifAttribute: this.ifAttribute,
            elseAttribute: this.elseAttribute,
            dataAttribute: this.dataAttribute,
            remoteAttribute: this.remoteAttribute,
            renderer: this,
        });
        this.loops = new LoopExpander({
            document: config.document,
            loopAttribute: this.loopAttribute,
            ifAttribute: this.ifAttribute,
            remoteAttribute: this.remoteAttribute,
            viewTag: this.viewTag,
            renderer: this,
        });
    }

    /**
     * Returns the data a view placeholder was rendered with.
     *
     * @param {Element} element
     * @returns {object|undefined}
     */
    getData(element) {
        return this.elements.getData(element);
    }

    /**
     * Renders the child nodes of a node in the given data scope.
     *
     * Each child reports the pairing state for the following sibling, so an else pairs with the condition element immediately before it in the same run.
     *
     * @param {object} options
     * @param {ParentNode} options.root
     * @param {object} options.data
     * @param {import("../utils/remote-target-collector.js").RemoteTargetCollector} options.collector
     * @throws {Error} When a loop expression, declared data, or a directive on a view placeholder fails.
     */
    renderChildren({ root, data, collector }) {
        let previousCondition = null;

        for (const node of [...root.childNodes]) {
            previousCondition = this.renderChild({
                node,
                data,
                previousCondition,
                collector,
            });
        }
    }

    /**
     * Renders one child node and returns the pairing state a following else reads.
     *
     * A failed pairing returns null rather than a satisfied chain, so consecutive orphan elses each report their own error.
     *
     * @param {object} options
     * @param {Node} options.node
     * @param {object} options.data
     * @param {import("./condition.js").ConditionOutcome|null} options.previousCondition
     * @param {import("../utils/remote-target-collector.js").RemoteTargetCollector} options.collector
     * @returns {import("./condition.js").ConditionOutcome|null}
     * @throws {Error} When a loop expression, declared data, or a directive on a view placeholder fails.
     */
    renderChild({ node, data, previousCondition, collector }) {
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
            this.renderLoopedChild({ element: node, data, pairing, collector });

            return null;
        }

        const outcome = this.renderElement({
            element: node,
            data,
            pairing,
            collector,
        });

        if (pairing === null) {
            return outcome;
        }

        if (pairing.failed) {
            return null;
        }

        return outcome ?? SATISFIED_CONDITION;
    }

    /**
     * Renders a child that carries the loop attribute, which the caller treats as the end of the sibling run.
     *
     * A failed pairing consumes every directive without evaluating any of them, because nothing in the element renders and evaluating one would escalate a local error to a view failure.
     *
     * @param {object} options
     * @param {Element} options.element
     * @param {object} options.data
     * @param {import("./condition.js").ConditionOutcome|null} options.pairing
     * @param {import("../utils/remote-target-collector.js").RemoteTargetCollector} options.collector
     * @throws {Error} When {@link LoopExpander.expand} rejects the loop expression or resolved items, or a directive on a view placeholder fails.
     */
    renderLoopedChild({ element, data, pairing, collector }) {
        if (pairing?.failed === true) {
            element.removeAttribute(this.loopAttribute);
            element.removeAttribute(this.dataAttribute);
            element.removeAttribute(this.ifAttribute);
            element.removeAttribute(this.remoteAttribute);

            return;
        }

        this.loops.expand({ element, data, collector });
    }

    /**
     * Renders one element subtree, which the loop expander repeats back through this renderer.
     *
     * @param {object} options
     * @param {Element} options.element
     * @param {object} options.data
     * @param {import("./condition.js").ConditionOutcome|null} [options.pairing]
     * @param {import("../utils/remote-target-collector.js").RemoteTargetCollector} options.collector
     * @returns {import("./condition.js").ConditionOutcome|null}
     * @throws {Error} When the declared data is rejected, or a directive on a view placeholder fails.
     */
    renderElement({ element, data, pairing = null, collector }) {
        return this.elements.render({ element, data, pairing, collector });
    }

    /**
     * Resolves and consumes the data declared by an element.
     *
     * @param {Element} element
     * @param {object} data
     * @returns {object}
     * @throws {Error} When the declared data is rejected.
     */
    resolveElementData(element, data) {
        return this.elements.resolveElementData(element, data);
    }
}
