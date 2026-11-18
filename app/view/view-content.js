import { TemplateRenderer } from "../template/template-renderer.js";
import { RemoteTargetCollector } from "../utils/remote-target-collector.js";
import { RemoteLoader } from "./remote-loader.js";
import {
    REMOTE_PENDING_STATE,
    REMOTE_STATE_ATTRIBUTE,
} from "./remote-state.js";

/**
 * Configuration accepted by {@link ViewContent}.
 *
 * @typedef {object} ViewContentConfig
 * @property {Document} document
 * @property {string} viewTag
 * @property {string} loopAttribute
 * @property {string} ifAttribute
 * @property {string} elseAttribute
 * @property {string} dataAttribute
 * @property {string} remoteAttribute
 * @property {(source: string, baseUrl: string|URL) => URL} resolveUrl
 * @property {(url: URL, requests: Map<string, Promise<import("./resource-loader.js").LoadedResource>>) => Promise<import("./resource-loader.js").LoadedResource>} loadResource
 * @property {(options: {nodes: Iterable<Element>, parentUrl: string|URL, pass: import("./render-pass.js").RenderPass}) => Promise<void>} renderViews
 */

/**
 * Turns content into rendered nodes.
 *
 * The class owns the template renderer, the remote loader, markup parsing, subtree walking, the remote targets of one walk, and the collection of nested views.
 */
export class ViewContent {
    /**
     * Creates the content pipeline from the directive configuration and its collaborators.
     *
     * @param {ViewContentConfig} config
     */
    constructor(config) {
        this.viewTag = config.viewTag;
        this.renderViews = config.renderViews;
        this.document = config.document;
        this.templateRenderer = new TemplateRenderer({
            document: config.document,
            viewTag: config.viewTag,
            loopAttribute: config.loopAttribute,
            ifAttribute: config.ifAttribute,
            elseAttribute: config.elseAttribute,
            dataAttribute: config.dataAttribute,
            remoteAttribute: config.remoteAttribute,
        });
        this.remotes = new RemoteLoader({
            document: config.document,
            remoteAttribute: config.remoteAttribute,
            resolveUrl: config.resolveUrl,
            loadResource: config.loadResource,
            renderMarkup: (options) => this.renderMarkup(options),
            renderSubtree: (options) => this.renderSubtree(options),
        });
    }

    /**
     * Renders markup and returns the nodes it produced.
     *
     * The markup is parsed into an inert template first, so nothing touches the document until its directives have rendered.
     *
     * @throws {Error} When a directive inside the markup fails.
     */
    async renderMarkup({ content, baseUrl, pass }) {
        const template = this.document.createElement("template");

        template.innerHTML = content;
        await this.renderSubtree({ root: template.content, baseUrl, pass });

        return [...template.content.childNodes];
    }

    /**
     * Renders the existing children of a node, then their remote targets, then their views.
     *
     * Remote targets are drained before views are collected, because remote markup brings its own placeholders into the tree and resolves them against its own URL.
     *
     * @throws {Error} When a directive inside the subtree fails.
     */
    async renderSubtree({ root, baseUrl, pass }) {
        const collector = new RemoteTargetCollector();

        this.templateRenderer.renderChildren({
            root,
            data: pass.data,
            collector,
        });
        await this.renderRemoteTargets({
            targets: collector.drain(),
            baseUrl,
            pass,
        });

        const views = root.querySelectorAll(this.viewTag);

        if (views.length > 0) {
            await this.renderViews({ nodes: views, parentUrl: baseUrl, pass });
        }
    }

    /**
     * Loads and applies the remote targets of one walk.
     */
    async renderRemoteTargets({ targets, baseUrl, pass }) {
        if (targets.length === 0) {
            return;
        }

        await this.remotes.renderTargets(targets, baseUrl, pass);
    }

    /**
     * Interprets a remote view response by its media type and returns the nodes that replace the placeholder.
     *
     * @returns {Promise<Node[]>}
     * @throws {Error} When a directive inside the response fails or a JSON body is invalid.
     */
    async renderViewResponse({ url, data, content, contentType, pass }) {
        return await this.remotes.renderViewResponse({
            url,
            data,
            content,
            contentType,
            pass,
        });
    }

    /**
     * Normalizes and resolves a declared remote source, rejecting a blank one.
     *
     * @returns {{source: string, url: URL}}
     * @throws {Error} When the source declares nothing or cannot be resolved.
     */
    resolveRemoteSource({ source, baseUrl }) {
        return this.remotes.resolveRemoteSource(source, baseUrl);
    }

    /**
     * Marks an element while its remote request is pending.
     */
    markPending(element) {
        element.setAttribute(REMOTE_STATE_ATTRIBUTE, REMOTE_PENDING_STATE);
    }

    /**
     * Returns the data a view placeholder was rendered with.
     */
    getRecordedData(element) {
        return this.templateRenderer.getData(element);
    }

    /**
     * Resolves and consumes the data declared by an element.
     *
     * @throws {Error} When the declared data is rejected.
     */
    resolveElementData({ element, data }) {
        return this.templateRenderer.resolveElementData(element, data);
    }
}
