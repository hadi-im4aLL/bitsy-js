import { TemplateRenderer } from "../template/renderer.js";

/**
 * Resolved configuration used internally by {@link View}.
 *
 * @typedef {object} ViewConfig
 * @property {string} tagName Tag name used to find view placeholders.
 * @property {boolean} useCache Whether view requests may be served from the HTTP cache.
 * @property {string} errorClassName Class name applied to the element that replaces a failed view.
 * @property {boolean} events Whether lifecycle events are dispatched.
 * @property {string} eventPrefix Prefix used when naming dispatched lifecycle events.
 */

/**
 * A single view placeholder together with the result of loading its content.
 *
 * @typedef {object} ViewFragment
 * @property {string|null} srcFile Value of the placeholder `src` attribute.
 * @property {URL|null} url Resolved absolute URL of the view, or null when resolution failed.
 * @property {string} content Raw HTML loaded from the view, or an empty string on failure.
 * @property {Error|null} error Failure raised while resolving or loading the view.
 * @property {Element} node Placeholder element that the view is rendered into.
 */

/**
 * Loads view HTML referenced by placeholder elements and replaces the placeholders,
 * recursively rendering any views nested inside the loaded content.
 */
export class View {
    /**
     * Creates a renderer from the merged Roolith settings.
     *
     * @param {import("../roolith.js").RoolithSettings} settings Effective Roolith settings.
     */
    constructor(settings) {
        this.config = {
            tagName: settings.viewTag,
            useCache: settings.viewCache,
            errorClassName: settings.viewErrorClassName,
            events: settings.enableEvents,
            eventPrefix: settings.eventNamePrefix,
        };
        this.data = settings.data ?? {};
        this.templateRenderer = new TemplateRenderer({
            document,
            viewTag: this.config.tagName,
            loopAttribute: settings.loopAttribute,
            dataAttribute: settings.dataAttribute,
        });
    }

    /**
     * Collects view placeholder elements inside the given root.
     *
     * @param {ParentNode} [root] Node to search, such as a document or template content.
     * @returns {NodeListOf<Element>} Matching placeholder elements.
     */
    getNodes(root = document) {
        return root.querySelectorAll(this.config.tagName);
    }

    /**
     * Resolves a view `src` value into an absolute URL.
     *
     * @param {string|null} srcPath Raw value of the `src` attribute.
     * @param {string|URL} [baseUrl] Base used to resolve relative paths.
     * @returns {URL} Absolute URL of the view.
     * @throws {Error} When `srcPath` is empty.
     */
    resolveUrl(srcPath, baseUrl = document.baseURI) {
        if (!srcPath) {
            throw new Error('View node is missing a "src" attribute');
        }

        return new URL(srcPath, baseUrl);
    }

    /**
     * Fetches the HTML of a single view, bypassing the HTTP cache when caching is disabled.
     *
     * @param {URL} url Absolute URL of the view.
     * @returns {Promise<string>} HTML content of the view.
     * @throws {Error} When the request fails or the response is not successful.
     */
    async getViewContent(url) {
        const options = {};

        if (this.config.useCache === false) {
            options['cache'] = 'no-cache';
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            throw new Error(
                `Failed to load view "${url.pathname}" (${response.status})`,
            );
        }

        return await response.text();
    }

    /**
     * Loads the content of every given placeholder, resolving each distinct URL once
     * so duplicate references share a single request.
     *
     * The request map belongs to the render pass, so the same absolute URL loaded at
     * the root and inside a nested view is requested only once.
     *
     * @param {Iterable<Element>} nodes Placeholder elements to load.
     * @param {string|URL} parentUrl Base URL that relative `src` values resolve against.
     * @param {Map<string, Promise<string>>} [requests] Requests already made during this render pass.
     * @returns {Promise<ViewFragment[]>} One fragment per placeholder, with errors captured rather than thrown.
     */
    async getFragments(nodes, parentUrl, requests = new Map()) {
        return await Promise.all(
            [...nodes].map(async (node) => {
                const srcFile = node.getAttribute("src");
                const fragment = {
                    srcFile,
                    url: null,
                    content: "",
                    error: null,
                    node,
                };

                try {
                    fragment.url = this.resolveUrl(srcFile, parentUrl);

                    if (!requests.has(fragment.url.href)) {
                        requests.set(
                            fragment.url.href,
                            this.getViewContent(fragment.url),
                        );
                    }

                    fragment.content = await requests.get(fragment.url.href);
                } catch (error) {
                    fragment.error = error;
                }

                return fragment;
            }),
        );
    }

    /**
     * Renders all views declared in the document and announces that rendering finished.
     *
     * @returns {Promise<void>} Resolves once the full render pass completes.
     */
    async render() {
        await this.renderNodes(
            this.getNodes(),
            document.baseURI,
            new Set(),
            this.data,
            new Map(),
        );

        this.emit('ready');
    }

    /**
     * Loads and renders a set of placeholders that share the same base URL.
     *
     * @param {Iterable<Element>} nodes Placeholder elements to render.
     * @param {string|URL} parentUrl Base URL that relative `src` values resolve against.
     * @param {Set<string>} ancestors Absolute URLs of the views being rendered higher in the tree.
     * @param {object} [data] Data resolved by placeholders in the parent scope.
     * @param {Map<string, Promise<string>>} [requests] Requests already made during this render pass.
     * @returns {Promise<void>} Resolves once every placeholder has been rendered.
     */
    async renderNodes(
        nodes,
        parentUrl,
        ancestors,
        data = this.data,
        requests = new Map(),
    ) {
        const fragments = await this.getFragments(nodes, parentUrl, requests);

        await Promise.all(
            fragments.map((fragment) =>
                this.renderFragment(fragment, ancestors, data, requests),
            ),
        );
    }

    /**
     * Renders one loaded fragment in place of its placeholder, rendering nested views first.
     *
     * @param {ViewFragment} fragment Fragment to render.
     * @param {Set<string>} [ancestors] Absolute URLs of the views being rendered higher in the tree.
     * @param {object} [data] Data resolved by placeholders in the parent scope.
     * @param {Map<string, Promise<string>>} [requests] Requests already made during this render pass.
     * @returns {Promise<void>} Resolves once the fragment has been rendered or replaced with an error.
     */
    async renderFragment(
        fragment,
        ancestors = new Set(),
        data = this.data,
        requests = new Map(),
    ) {
        if (fragment.error) {
            console.error(fragment.error);
            this.renderErrorFragment(fragment);
            return;
        }

        if (ancestors.has(fragment.url.href)) {
            const error = new Error(`Circular view reference "${fragment.srcFile}"`);
            console.error(error);
            this.renderErrorFragment({ ...fragment, error });
            return;
        }

        const template = document.createElement("template");
        template.innerHTML = fragment.content;

        let scopedData;

        try {
            scopedData = this.templateRenderer.getData(fragment.node);

            if (scopedData === undefined) {
                scopedData = this.templateRenderer.resolveElementData(
                    fragment.node,
                    data,
                );
            }

            this.templateRenderer.render(template.content, scopedData);
        } catch (error) {
            const viewError = new Error(
                `View "${fragment.url.pathname}": ${error.message}`,
            );
            console.error(viewError);
            this.renderErrorFragment({ ...fragment, error: viewError });
            return;
        }

        const nestedViews = this.getNodes(template.content);

        if (nestedViews.length > 0) {
            await this.renderNodes(
                nestedViews,
                fragment.url,
                new Set(ancestors).add(fragment.url.href),
                scopedData,
                requests,
            );
        }

        const nodes = [...template.content.childNodes];

        fragment.node.replaceWith(template.content);

        this.emit('rendered', {
            src: fragment.srcFile,
            url: fragment.url,
            nodes,
        });
    }

    /**
     * Replaces a failed placeholder with an error element and announces the failure.
     *
     * The replacement element carries the configured error class and a
     * `data-view-error` attribute holding the message, so host styles and scripts can
     * inspect the failure after the placeholder is gone.
     *
     * @param {ViewFragment} fragment Fragment whose loading or rendering failed.
     * @returns {void}
     */
    renderErrorFragment(fragment) {
        const div = document.createElement("div");
        div.className = this.config.errorClassName;
        div.setAttribute("data-view-error", fragment.error.message);
        div.innerHTML = fragment.error.message;
        fragment.node.replaceWith(div);

        this.emit('error', { src: fragment.srcFile, error: fragment.error });
    }

    /**
     * Dispatches a lifecycle event on the document, unless events are disabled.
     *
     * @param {string} name Event name after the configured prefix, such as `rendered`.
     * @param {object} [detail] Payload delivered as `event.detail`.
     * @returns {void}
     */
    emit(name, detail) {
        if (!this.config.events) {
            return;
        }

        document.dispatchEvent(
            new CustomEvent(`${this.config.eventPrefix}:${name}`, { detail }),
        );
    }
}
