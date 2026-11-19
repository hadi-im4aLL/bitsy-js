import { readSource } from "./source-value.js";

/**
 * Loads view content declared by the `src` attribute.
 *
 * A blank source is rejected by the injected URL resolution, because a WHATWG URL parse would otherwise resolve it against the containing document.
 */
export class SrcViewSource {
    /**
     * Creates the source from its collaborators.
     *
     * @param {object} options
     * @param {(source: string|null, baseUrl: string|URL) => URL} options.resolveUrl
     * @param {(url: URL, requests: Map<string, Promise<import("./resource-loader.js").LoadedResource>>) => Promise<import("./resource-loader.js").LoadedResource>} options.loadResource
     * @param {import("./view-source-resolver.js").ViewSourceContent} options.content
     */
    constructor({ resolveUrl, loadResource, content }) {
        this.resolveUrl = resolveUrl;
        this.loadResource = loadResource;
        this.content = content;
    }

    /**
     * Loads the content of a placeholder that declares its source through `src`.
     *
     * @param {object} options
     * @param {Element} options.node
     * @param {string|URL} options.parentUrl
     * @param {import("./render-pass.js").RenderPass} options.pass
     * @returns {Promise<import("./view-source-resolver.js").ViewFragment>}
     */
    async load({ node, parentUrl, pass }) {
        const fragment = {
            srcFile: readSource(node, "src"),
            url: null,
            content: "",
            node,
            error: null,
            source: this,
        };

        try {
            fragment.url = this.resolveUrl(fragment.srcFile, parentUrl);

            const resource = await this.loadResource(
                fragment.url,
                pass.requests,
            );

            fragment.content = resource.content;
        } catch (error) {
            fragment.error = error;
        }

        return fragment;
    }

    /**
     * Renders the loaded content as markup, resolving it against the view URL.
     *
     * @param {object} options
     * @param {import("./view-source-resolver.js").ViewFragment} options.fragment
     * @param {object} options.data
     * @param {import("./render-pass.js").RenderPass} options.pass
     * @returns {Promise<Node[]>}
     * @throws {Error} When a directive inside the content fails.
     */
    async render({ fragment, data, pass }) {
        return await this.content.renderMarkup({
            content: fragment.content,
            baseUrl: fragment.url,
            pass: pass.derive({ ancestorUrl: fragment.url, data }),
        });
    }
}
