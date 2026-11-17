/**
 * DOM node kind and tag constants shared by the template modules.
 *
 * The renderer dispatches on node kind and tag name, and the loop expander needs the
 * same template tag and the same raw-text exception, so these values live here
 * instead of being redeclared in each module. Only DOM vocabulary belongs here; a
 * directive or rendering decision stays next to the module that owns it.
 */

/**
 * `nodeType` value of an element node.
 *
 * @type {number}
 */
export const ELEMENT_NODE = 1;

/**
 * `nodeType` value of a text node.
 *
 * @type {number}
 */
export const TEXT_NODE = 3;

/**
 * `nodeType` value of a comment node.
 *
 * @type {number}
 */
export const COMMENT_NODE = 8;

/**
 * Tag name of a `<template>` element, whose content is rendered in its place.
 *
 * A DOM `tagName` is upper case, so comparisons against this value are deliberate.
 *
 * @type {string}
 */
export const TEMPLATE_TAG = "TEMPLATE";

/**
 * Tag names whose content is raw text rather than renderable markup.
 *
 * Module-private: {@link isRawTextElement} is the only consumer, so the list is not
 * part of the shared vocabulary of this module.
 *
 * @type {string[]}
 */
const RAW_TEXT_TAGS = ["SCRIPT", "STYLE"];

/**
 * Checks whether an element holds raw text instead of renderable markup.
 *
 * The text content of such an element is script or style source, so its children are
 * source text rather than a subtree of markup. What a renderer does with that is its
 * own decision; this predicate only names the kind of element.
 *
 * @param {Element} element Element to check.
 * @returns {boolean} True when the element's content is raw text.
 */
export function isRawTextElement(element) {
    return RAW_TEXT_TAGS.includes(element.tagName);
}
