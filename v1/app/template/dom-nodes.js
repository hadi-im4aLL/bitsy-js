/**
 * DOM node kind and tag constants shared by the template modules.
 *
 * Only DOM vocabulary belongs here; a directive or rendering decision stays next to the module that owns it.
 */

/**
 * `nodeType` value of an element node.
 */
export const ELEMENT_NODE = 1;

/**
 * `nodeType` value of a text node.
 */
export const TEXT_NODE = 3;

/**
 * `nodeType` value of a comment node.
 */
export const COMMENT_NODE = 8;

/**
 * Tag name of a `<template>` element, whose content is rendered in its place.
 *
 * A DOM `tagName` is upper case, so comparisons against this value are deliberate.
 */
export const TEMPLATE_TAG = "TEMPLATE";

/**
 * Tag names whose content is raw text rather than renderable markup.
 */
const RAW_TEXT_TAGS = ["SCRIPT", "STYLE"];

/**
 * Checks whether an element holds raw text instead of renderable markup.
 */
export function isRawTextElement(element) {
    return RAW_TEXT_TAGS.includes(element.tagName);
}
