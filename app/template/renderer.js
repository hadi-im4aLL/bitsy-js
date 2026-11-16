import { resolveDataAttribute } from "./data-attribute.js";
import { parseTemplate } from "./interpolate.js";
import { resolveLoop } from "./loop.js";

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
const TEMPLATE_TAG = "TEMPLATE";
const RAW_TEXT_TAGS = ["SCRIPT", "STYLE"];

/**
 * Configuration accepted by {@link TemplateRenderer}.
 *
 * @typedef {object} TemplateRendererConfig
 * @property {Document} document Document used to create new nodes.
 * @property {string} viewTag Tag name of view placeholders, whose data is recorded.
 * @property {string} loopAttribute Attribute that marks an element for repetition.
 * @property {string} dataAttribute Attribute that declares data for an element subtree.
 */

/**
 * Expands loops and interpolates `{path}` placeholders in parsed view content.
 *
 * Rendering mutates the given fragment in place. Every element matching the
 * configured view tag is recorded with the data of the scope it was rendered in, so
 * nested views can resolve item values when they are loaded later.
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
        this.dataAttribute = config.dataAttribute;
        this.dataByElement = new WeakMap();
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
     * Expands loops and interpolates text inside a parsed view fragment.
     *
     * @param {ParentNode} root Fragment or element to render in place.
     * @param {object} data Data resolved by placeholders in this scope.
     * @returns {void}
     * @throws {Error} When a loop expression is malformed or does not resolve to an array.
     */
    render(root, data) {
        this.renderChildren(root, data);
    }

    /**
     * Renders the child nodes of a node with the given data.
     *
     * Text nodes are interpolated, elements carrying the loop attribute are replaced
     * by one clone per item, and other elements are rendered recursively.
     *
     * @param {ParentNode} root Node whose children are rendered.
     * @param {object} data Data resolved by placeholders in this scope.
     * @returns {void}
     */
    renderChildren(root, data) {
        for (const node of [...root.childNodes]) {
            if (node.nodeType === TEXT_NODE) {
                node.data = parseTemplate(node.data, data);

                continue;
            }

            if (node.nodeType !== ELEMENT_NODE) {
                continue;
            }

            if (RAW_TEXT_TAGS.includes(node.tagName)) {
                continue;
            }

            if (node.hasAttribute(this.loopAttribute)) {
                this.expandLoop(node, data);

                continue;
            }

            this.renderElement(node, data);
        }
    }

    /**
     * Renders an element subtree in the scope declared by its data attribute.
     *
     * The declared data is resolved before descending so it applies to the whole
     * subtree, and view placeholders are recorded with the same scope for when their
     * content is loaded later.
     *
     * @param {Element} element Element to render.
     * @param {object} data Data resolved by placeholders in the parent scope.
     * @returns {void}
     * @throws {Error} When {@link resolveDataAttribute} rejects the declared data.
     */
    renderElement(element, data) {
        const elementData = this.resolveElementData(element, data);

        if (element.tagName === this.viewTag) {
            this.dataByElement.set(element, elementData);
        }

        this.renderChildren(element, elementData);
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

    /**
     * Replaces an element carrying the loop attribute with one rendered clone per item.
     *
     * A `<template>` carrying the loop attribute repeats its content, while any other
     * element repeats itself. Use the template form for a group of siblings or when a
     * wrapper such as `<ul>` must appear once instead of once per item.
     *
     * @param {Element} element Element carrying the loop attribute.
     * @param {object} data Data resolved by placeholders in the outer scope.
     * @returns {void}
     * @throws {Error} When {@link resolveLoop} rejects the expression or resolved items.
     */
    expandLoop(element, data) {
        const expression = element.getAttribute(this.loopAttribute);
        const { name, items } = resolveLoop(expression, data);

        const isTemplate = element.tagName === TEMPLATE_TAG;
        const output = this.document.createDocumentFragment();

        for (const item of items) {
            const itemData = { ...data, [name]: item };
            const clone = isTemplate
                ? element.content.cloneNode(true)
                : element.cloneNode(true);

            if (!isTemplate) {
                clone.removeAttribute(this.loopAttribute);
                this.renderElement(clone, itemData);
            } else {
                this.renderChildren(clone, itemData);
            }

            output.append(clone);
        }

        element.replaceWith(output);
    }
}
