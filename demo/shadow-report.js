/**
 * Writes a short report that compares a shadow root with the document.
 *
 * The report shows that `document.querySelectorAll` cannot see inside a shadow
 * root while the nodes delivered by `Roolith#onViewRendered` can, because those
 * nodes live in the host's shadow root.
 *
 * @param {object} options
 * @param {Node[]} options.nodes Rendered nodes delivered by `onViewRendered`.
 * @param {HTMLElement} options.report Element that displays the report.
 * @param {string} [options.selector] Class selector counted in both trees.
 */
export function reportShadowScope({ nodes, report, selector = ".shadow-card" }) {
    const root = nodes[0]?.getRootNode();
    const isShadowRoot = root instanceof ShadowRoot;
    const shadowCount = isShadowRoot ? root.querySelectorAll(selector).length : 0;
    const documentCount = document.querySelectorAll(selector).length;
    const host = isShadowRoot ? root.host : null;
    const isHostMarked = host !== null && host.hasAttribute("data-r-shadow-host");

    report.textContent = [
        `nodes[0].getRootNode() is a ShadowRoot: ${isShadowRoot}`,
        `shadowRoot.querySelectorAll("${selector}").length: ${shadowCount}`,
        `document.querySelectorAll("${selector}").length: ${documentCount}`,
        host === null
            ? "host: no shadow root found"
            : `host: <${host.tagName.toLowerCase()}>, data-r-shadow-host: ${isHostMarked}`,
    ].join("\n");
}
