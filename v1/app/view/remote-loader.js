import { reportDirectiveFailure } from "../utils/directive-failure.js";
import { isPlainObject } from "../utils/is-plain-object.js";
import {
    REMOTE_PENDING_STATE,
    REMOTE_STATE_ATTRIBUTE,
} from "./remote-state.js";
import {
    createMissingSourceError,
    normalizeSource,
} from "./source-value.js";

/**
 * Pipeline a {@link RemoteLoader} renders remote content through.
 *
 * @typedef {object} RemoteLoaderConfig
 * @property {Document} document
 * @property {string} remoteAttribute
 * @property {(source: string, baseUrl: string|URL) => URL} resolveUrl
 * @property {(url: URL, requests: Map<string, Promise<import("./resource-loader.js").LoadedResource>>) => Promise<import("./resource-loader.js").LoadedResource>} loadResource
 * @property {(options: {content: string, baseUrl: URL, pass: import("./render-pass.js").RenderPass}) => Promise<Node[]>} renderMarkup
 * @property {(options: {root: ParentNode, baseUrl: URL, pass: import("./render-pass.js").RenderPass}) => Promise<void>} renderSubtree
 */

/**
 * Loads remote content and renders its response for the node that declared it.
 *
 * On a plain element a markup response replaces the element's children and a data response renders them in the merged scope, while a view response is returned as nodes for the caller to place. A failure is reported on the declaring element instead of aborting the pass.
 */
export class RemoteLoader {
    /**
     * Creates a loader from the pipeline it renders remote content through.
     *
     * @param {RemoteLoaderConfig} config
     */
    constructor(config) {
        this.document = config.document;
        this.remoteAttribute = config.remoteAttribute;
        this.resolveUrl = config.resolveUrl;
        this.loadResource = config.loadResource;
        this.renderMarkup = config.renderMarkup;
        this.renderSubtree = config.renderSubtree;
    }

    /**
     * Loads and renders every remote target discovered in one piece of content.
     */
    async renderTargets(targets, parentUrl, pass) {
        await Promise.all(
            targets.map((target) => this.renderTarget(target, parentUrl, pass)),
        );
    }

    /**
     * Loads one remote target and renders its response into the element.
     *
     * The loading state is set before the request and removed on every path, and a failure is reported on the element instead of being thrown.
     */
    async renderTarget(target, parentUrl, pass) {
        const { element, data } = target;

        element.setAttribute(REMOTE_STATE_ATTRIBUTE, REMOTE_PENDING_STATE);

        try {
            const { source, url } = this.resolveRemoteSource(
                target.source,
                parentUrl,
            );

            if (pass.ancestors.has(url.href)) {
                throw new Error(`Circular remote reference "${source}"`);
            }

            const resource = await this.loadResource(url, pass.requests);

            await this.renderResponse({
                element,
                url,
                parentUrl,
                data,
                resource,
                pass,
            });
        } catch (error) {
            reportDirectiveFailure({ element, error });
        } finally {
            element.removeAttribute(REMOTE_STATE_ATTRIBUTE);
        }
    }

    /**
     * Normalizes and resolves a declared remote source.
     *
     * @returns {{source: string, url: URL}}
     * @throws {Error} When the source declares nothing or cannot be resolved.
     */
    resolveRemoteSource(rawSource, parentUrl) {
        const source = normalizeSource(rawSource);

        if (source === null) {
            throw createMissingSourceError(this.remoteAttribute);
        }

        return { source, url: this.resolveUrl(source, parentUrl) };
    }

    /**
     * Renders a successful response into the element that declared the target, by media type.
     *
     * Both paths build their nodes before committing, so a failure leaves the authored children untouched.
     *
     * @throws {Error} When the payload is invalid JSON or rendering the response fails.
     */
    async renderResponse({
        element,
        url,
        parentUrl,
        data,
        resource,
        pass,
    }) {
        if (this.isJsonContentType(resource.contentType)) {
            await this.renderDataResponse({
                element,
                parentUrl,
                data,
                payload: this.parseJson(resource.content, url),
                pass,
            });

            return;
        }

        const nodes = await this.renderMarkup({
            content: resource.content,
            baseUrl: url,
            pass: pass.derive({ ancestorUrl: url, data }),
        });

        element.replaceChildren(...nodes);
    }

    /**
     * Renders the element's own children in the scope the payload provides.
     *
     * The children render in a detached clone, and the payload overlays the element scope with the response winning.
     *
     * @throws {Error} When a directive inside the children fails.
     */
    async renderDataResponse({ element, parentUrl, data, payload, pass }) {
        const rendered = element.cloneNode(true);

        await this.renderSubtree({
            root: rendered,
            baseUrl: parentUrl,
            pass: pass.derive({ data: this.mergeData(data, payload) }),
        });

        element.replaceChildren(...rendered.childNodes);
    }

    /**
     * Interprets a view response by its media type and returns the nodes that replace the placeholder.
     *
     * The caller performs the replacement and the lifecycle event, because that is the view pipeline's contract.
     *
     * @returns {Promise<Node[]>}
     * @throws {Error} When a directive inside the response fails or a JSON body is invalid.
     */
    async renderViewResponse({ url, data, contentType, content, pass }) {
        if (!this.isJsonContentType(contentType)) {
            return await this.renderMarkup({
                content,
                baseUrl: url,
                pass: pass.derive({ ancestorUrl: url, data }),
            });
        }

        return await this.renderJsonViewPayload({ url, data, content, pass });
    }

    /**
     * Renders a remote JSON payload into the nodes that replace a view placeholder.
     *
     * An object payload with an `html` string is view content, and any other payload is shown as its escaped JSON text.
     *
     * @returns {Promise<Node[]>}
     * @throws {Error} When the payload is invalid JSON or rendering its markup fails.
     */
    async renderJsonViewPayload({ url, data, content, pass }) {
        const payload = this.parseJson(content, url);

        if (isPlainObject(payload) && typeof payload.html === "string") {
            return await this.renderMarkup({
                content: payload.html,
                baseUrl: url,
                pass: pass.derive({
                    ancestorUrl: url,
                    data: this.mergeData(data, payload.data),
                }),
            });
        }

        return [this.document.createTextNode(JSON.stringify(payload))];
    }

    /**
     * Checks whether a response media type makes the response data instead of markup.
     *
     * `application/json` is the only media type that makes a response data, so a structured suffix stays markup.
     */
    isJsonContentType(contentType) {
        return contentType === "application/json";
    }

    /**
     * Parses a JSON response body, naming the resource in a parse failure.
     *
     * @throws {Error} When the body is not valid JSON.
     */
    parseJson(content, url) {
        try {
            return JSON.parse(content);
        } catch (error) {
            throw new Error(`Invalid JSON in remote "${url.pathname}": ${error.message}`);
        }
    }

    /**
     * Overlays remote data on an element scope, with the response winning.
     *
     * The overlay is a spread, so a `__proto__` payload key becomes an own data property instead of a prototype write.
     */
    mergeData(scope, payload) {
        return isPlainObject(payload) ? { ...scope, ...payload } : scope;
    }
}
