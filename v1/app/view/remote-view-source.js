import { REMOTE_STATE_ATTRIBUTE } from "./remote-state.js";
import { readSource } from "./source-value.js";

/**
 * A view fragment loaded from a remote response.
 *
 * @typedef {import("./view-source-resolver.js").ViewFragment & {contentType: string}} RemoteViewFragment
 */

/**
 * Loads view content declared by the remote attribute.
 */
export class RemoteViewSource {
    /**
     * Creates the source from its collaborators.
     *
     * @param {object} options
     * @param {string} options.remoteAttribute
     * @param {(source: string|null, baseUrl: string|URL) => URL} options.resolveUrl
     * @param {(url: URL, requests: Map<string, Promise<import("./resource-loader.js").LoadedResource>>) => Promise<import("./resource-loader.js").LoadedResource>} options.loadResource
     * @param {import("./view-source-resolver.js").ViewSourceContent} options.content
     */
    constructor({ remoteAttribute, resolveUrl, loadResource, content }) {
        this.remoteAttribute = remoteAttribute;
        this.resolveUrl = resolveUrl;
        this.loadResource = loadResource;
        this.content = content;
    }

    /**
     * Loads the content of a placeholder that declares its source through the remote attribute.
     *
     * A `src` declared beside the remote source is requested without being awaited or rendered, because the remote response wins as the content source. The pending state is cleared on every path, because a placeholder that stays in the document as a shadow host would otherwise keep it.
     *
     * @param {object} options
     * @param {Element} options.node
     * @param {string|URL} options.parentUrl
     * @param {import("./render-pass.js").RenderPass} options.pass
     * @returns {Promise<RemoteViewFragment>}
     */
    async load({ node, parentUrl, pass }) {
        const remoteSource = readSource(node, this.remoteAttribute);
        const srcSource = readSource(node, "src");
        const fragment = {
            srcFile: remoteSource,
            url: null,
            content: "",
            contentType: "",
            node,
            error: null,
            source: this,
        };

        try {
            const resolved = this.content.resolveRemoteSource({
                source: remoteSource,
                baseUrl: parentUrl,
            });

            fragment.srcFile = resolved.source;
            fragment.url = resolved.url;

            // The source is captured in the fragment, so the directive is consumed
            // before the request instead of surviving on the placeholder.
            node.removeAttribute(this.remoteAttribute);
            this.content.markPending(node);

            if (srcSource !== null) {
                this.startUnusedSource(srcSource, parentUrl, pass.requests);
            }

            const resource = await this.loadResource(
                fragment.url,
                pass.requests,
            );

            fragment.content = resource.content;
            fragment.contentType = resource.contentType;
        } catch (error) {
            fragment.error = error;
        } finally {
            node.removeAttribute(REMOTE_STATE_ATTRIBUTE);
        }

        return fragment;
    }

    /**
     * Starts the declared `src` request of a placeholder whose content comes from its remote source.
     *
     * A resolution error or a rejected request is swallowed, because a source that is never rendered must not fail a view that rendered.
     *
     * @param {string} srcSource
     * @param {string|URL} parentUrl
     * @param {Map<string, Promise<import("./resource-loader.js").LoadedResource>>} requests
     */
    startUnusedSource(srcSource, parentUrl, requests) {
        let url;

        try {
            url = this.resolveUrl(srcSource, parentUrl);
        } catch {
            return;
        }

        this.loadResource(url, requests).catch(() => {});
    }

    /**
     * Renders the loaded remote response by its media type.
     *
     * @param {object} options
     * @param {RemoteViewFragment} options.fragment
     * @param {object} options.data
     * @param {import("./render-pass.js").RenderPass} options.pass
     * @returns {Promise<Node[]>}
     * @throws {Error} When a directive inside the response fails or a JSON body is invalid.
     */
    async render({ fragment, data, pass }) {
        return await this.content.renderViewResponse({
            url: fragment.url,
            data,
            content: fragment.content,
            contentType: fragment.contentType,
            pass,
        });
    }
}
