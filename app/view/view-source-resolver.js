/**
 * A single view placeholder together with the result of loading its content.
 *
 * @typedef {object} ViewFragment
 * @property {string|null} srcFile
 * @property {URL|null} url
 * @property {string} content
 * @property {Element} node
 * @property {Error|null} error
 * @property {ViewSource} source
 */

/**
 * Content source of a view placeholder, which captures its own failures and returns replacement nodes.
 *
 * @typedef {object} ViewSource
 * @property {(options: {node: Element, parentUrl: string|URL, pass: import("./render-pass.js").RenderPass}) => Promise<ViewFragment>} load
 * @property {(options: {fragment: ViewFragment, data: object, pass: import("./render-pass.js").RenderPass}) => Promise<Node[]>} render
 */

/**
 * Content pipeline a view source renders through, narrowed to the members both sources use.
 *
 * @typedef {object} ViewSourceContent
 * @property {(options: {content: string, baseUrl: URL, pass: import("./render-pass.js").RenderPass}) => Promise<Node[]>} renderMarkup
 * @property {(options: {source: string|null, baseUrl: string|URL}) => {source: string, url: URL}} resolveRemoteSource
 * @property {(element: Element) => void} markPending
 * @property {(options: {url: URL, data: object, content: string, contentType: string, pass: import("./render-pass.js").RenderPass}) => Promise<Node[]>} renderViewResponse
 */

/**
 * Selects the content source of a view placeholder, the only place that selects a source.
 */
export class ViewSourceResolver {
    /**
     * Creates a resolver from the available sources.
     *
     * @param {object} options
     */
    constructor({ remoteAttribute, remote, src }) {
        this.remoteAttribute = remoteAttribute;
        this.remote = remote;
        this.src = src;
    }

    /**
     * Returns the source that loads the given placeholder.
     *
     * @param {Element} node
     * @returns {ViewSource}
     */
    resolve(node) {
        return node.hasAttribute(this.remoteAttribute) ? this.remote : this.src;
    }
}
