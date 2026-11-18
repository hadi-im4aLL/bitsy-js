import { applyIfDirective } from "./condition.js";
import { resolveDataAttribute } from "./data-attribute.js";
import { TEMPLATE_TAG, isRawTextElement } from "./dom-nodes.js";

/**
 * Rendering surface an {@link ElementRenderer} hands traversal back to.
 *
 * @typedef {object} ElementRendererSurface
 * @property {(options: {root: ParentNode, data: object, collector: import("../utils/remote-target-collector.js").RemoteTargetCollector}) => void} renderChildren
 */

/**
 * Configuration accepted by {@link ElementRenderer}.
 *
 * @typedef {object} ElementRendererConfig
 * @property {string} viewTag
 * @property {string} loopAttribute
 * @property {string} ifAttribute
 * @property {string} elseAttribute
 * @property {string} dataAttribute
 * @property {string} remoteAttribute
 * @property {ElementRendererSurface} renderer
 */

/**
 * Values one element kind renders from.
 *
 * @typedef {object} ElementRenderOptions
 * @property {Element} element
 * @property {object} data
 * @property {import("./condition.js").ConditionOutcome|null} pairing
 * @property {import("./condition.js").ConditionOutcome|null} [condition]
 * @property {import("../utils/remote-target-collector.js").RemoteTargetCollector} collector
 */

/**
 * One element kind the render dispatcher can delegate to.
 *
 * @typedef {object} ElementKind
 * @property {(element: Element) => boolean} matches
 * @property {boolean} [keepsParentData]
 * @property {(options: ElementRenderOptions) => import("./condition.js").ConditionOutcome|null} render
 */

/**
 * Renders one element subtree: its declared data, its condition, and its children.
 */
export class ElementRenderer {
    /**
     * Creates an element renderer bound to the directive attributes and the renderer.
     *
     * @param {ElementRendererConfig} config
     */
    constructor(config) {
        this.viewTag = config.viewTag;
        this.loopAttribute = config.loopAttribute;
        this.ifAttribute = config.ifAttribute;
        this.elseAttribute = config.elseAttribute;
        this.dataAttribute = config.dataAttribute;
        this.remoteAttribute = config.remoteAttribute;
        this.renderer = config.renderer;
        this.dataByElement = new WeakMap();
        // Matched in order, so the first kind that accepts the element renders it.
        this.kinds = [
            {
                // Raw text supports conditions only, so its data is consumed rather than resolved.
                matches: (element) => isRawTextElement(element),
                keepsParentData: true,
                render: (options) => this.renderRawText(options),
            },
            {
                matches: (element) => element.tagName === TEMPLATE_TAG,
                render: (options) => this.renderTemplate(options),
            },
            {
                matches: (element) => element.tagName === this.viewTag,
                render: (options) => this.renderViewPlaceholder(options),
            },
            {
                matches: (element) => element.hasAttribute(this.remoteAttribute),
                render: (options) => this.renderRemoteTarget(options),
            },
            {
                matches: () => true,
                render: (options) => this.renderPlainElement(options),
            },
        ];
    }

    /**
     * Returns the data a view placeholder was rendered with.
     *
     * @param {Element} element
     * @returns {object|undefined}
     */
    getData(element) {
        return this.dataByElement.get(element);
    }

    /**
     * Renders one element by classifying it and delegating to the first matching kind.
     *
     * Only the raw-text kind renders in the parent scope; every other kind renders after its own data and condition are resolved.
     *
     * @param {object} options
     * @param {Element} options.element
     * @param {object} options.data
     * @param {import("./condition.js").ConditionOutcome|null} [options.pairing]
     * @param {import("../utils/remote-target-collector.js").RemoteTargetCollector} options.collector
     * @returns {import("./condition.js").ConditionOutcome|null}
     * @throws {Error} When {@link resolveElementData} rejects the declared data, or a directive on a view placeholder fails.
     */
    render({ element, data, pairing = null, collector }) {
        const kind = this.kinds.find((candidate) => candidate.matches(element));

        return kind.keepsParentData === true
            ? kind.render({ element, data, pairing, collector })
            : this.renderResolved({ element, data, pairing, collector, kind });
    }

    /**
     * Resolves the element data and condition every walked kind depends on, then renders that kind.
     *
     * Declared data resolves before the condition, so a condition on the element reads its own data.
     *
     * @param {object} options
     * @param {Element} options.element
     * @param {object} options.data
     * @param {import("./condition.js").ConditionOutcome|null} options.pairing
     * @param {import("../utils/remote-target-collector.js").RemoteTargetCollector} options.collector
     * @param {ElementKind} options.kind
     * @returns {import("./condition.js").ConditionOutcome|null}
     * @throws {Error} When {@link resolveElementData} rejects the declared data, or a directive on a view placeholder fails.
     */
    renderResolved({ element, data, pairing, collector, kind }) {
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

        return kind.render({
            element,
            data: elementData,
            pairing,
            condition,
            collector,
        });
    }

    /**
     * Renders a raw-text element, which supports conditions only and is never walked.
     *
     * Its loop, data, and remote attributes are consumed without being evaluated.
     *
     * @param {ElementRenderOptions} options
     * @returns {import("./condition.js").ConditionOutcome|null}
     */
    renderRawText({ element, data }) {
        element.removeAttribute(this.loopAttribute);
        element.removeAttribute(this.dataAttribute);
        element.removeAttribute(this.remoteAttribute);

        return applyIfDirective({
            element,
            ifAttribute: this.ifAttribute,
            data,
            viewTag: this.viewTag,
        });
    }

    /**
     * Renders a template, replacing the wrapper with its content when a condition or an else pairing selected it.
     *
     * An unselected or failed template keeps its wrapper and is not walked, so a recorded error stays observable.
     *
     * @param {ElementRenderOptions} options
     * @returns {import("./condition.js").ConditionOutcome|null}
     */
    renderTemplate({
        element,
        data,
        pairing,
        condition,
        collector,
    }) {
        element.removeAttribute(this.remoteAttribute);

        const hasFailed = pairing?.failed === true || condition?.failed === true;
        const hasElsePairing = pairing !== null;
        const isSelected = hasFailed === false
            && (hasElsePairing || condition !== null);

        if (isSelected) {
            this.renderer.renderChildren({
                root: element.content,
                data,
                collector,
            });
            element.replaceWith(element.content);
        }

        return condition;
    }

    /**
     * Renders a view placeholder and records the data of its scope for later loading.
     *
     * The remote attribute is kept, because the placeholder is the view source rather than a remote target.
     *
     * @param {ElementRenderOptions} options
     * @returns {import("./condition.js").ConditionOutcome|null}
     */
    renderViewPlaceholder({ element, data, collector, condition }) {
        this.dataByElement.set(element, data);
        this.renderer.renderChildren({ root: element, data, collector });

        return condition;
    }

    /**
     * Records a remote target instead of rendering the element's children.
     *
     * @param {ElementRenderOptions} options
     * @returns {import("./condition.js").ConditionOutcome|null}
     */
    renderRemoteTarget({ element, data, collector, condition }) {
        this.recordRemote({ element, data, collector });

        return condition;
    }

    /**
     * Renders the children of a plain element in its resolved scope.
     *
     * @param {ElementRenderOptions} options
     * @returns {import("./condition.js").ConditionOutcome|null}
     */
    renderPlainElement({ element, data, collector, condition }) {
        this.renderer.renderChildren({ root: element, data, collector });

        return condition;
    }

    /**
     * Resolves and consumes the data declared by an element.
     *
     * The attribute is removed after a successful resolution, so directives do not leak into the rendered DOM.
     *
     * @param {Element} element
     * @param {object} data
     * @returns {object}
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

    /**
     * Records a remote target into the collector of the walk.
     *
     * The recorded shape is {@link import("../utils/remote-target-collector.js").RemoteTarget}: `element`, `source`, and `data`, where `source` is the declared value read before the attribute is removed. The attribute is removed here rather than after the response arrives, so a directive never leaks into the rendered DOM.
     *
     * @param {object} options
     * @param {Element} options.element
     * @param {object} options.data
     * @param {import("../utils/remote-target-collector.js").RemoteTargetCollector} options.collector
     */
    recordRemote({ element, data, collector }) {
        const source = element.getAttribute(this.remoteAttribute);

        element.removeAttribute(this.remoteAttribute);
        collector.record({ element, source, data });
    }
}
