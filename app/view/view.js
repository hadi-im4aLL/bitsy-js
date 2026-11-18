import { RenderPass } from "./render-pass.js";
import { RemoteViewSource } from "./remote-view-source.js";
import { ResourceLoader } from "./resource-loader.js";
import { SrcViewSource } from "./src-view-source.js";
import { ViewContent } from "./view-content.js";
import { ViewSourceResolver } from "./view-source-resolver.js";

/**
 * Configuration a {@link View} derives from the merged Roolith settings.
 *
 * @typedef {object} ViewConfig
 * @property {string} tagName
 * @property {boolean} useCache
 * @property {string} errorClassName
 * @property {string} shadowAttribute
 * @property {boolean} events
 * @property {string} eventPrefix
 */

/**
 * Loads view content referenced by placeholder elements and places it, either in place of the placeholder or in an open shadow root on it, recursively rendering nested views.
 *
 * The class owns the document pipeline: where placeholders are found, which URL a relative source resolves against, where rendered content is placed, how a failure replaces a placeholder, and which lifecycle events fire.
 */
export class View {
    /**
     * Attribute marking a host this pipeline placed as a shadow host.
     *
     * Fixed rather than configurable, matching `data-r-error` and `data-r-remote`, because it reports library state rather than a template directive.
     *
     * @type {string}
     */
    static SHADOW_HOST_ATTRIBUTE = "data-r-shadow-host";

    /**
     * Creates a renderer from the merged Roolith settings.
     *
     * The same transport is injected twice with different labels below, because a remote-sourced view reports as a view while a remote element reports as a remote.
     *
     * @param {import("../roolith.js").RoolithSettings} settings
     */
    constructor(settings) {
        /**
         * Settings this view reads after construction.
         *
         * @type {ViewConfig}
         */
        this.config = {
            tagName: settings.viewTag,
            useCache: settings.viewCache,
            errorClassName: settings.viewErrorClassName,
            shadowAttribute: settings.shadowAttribute,
            events: settings.enableEvents,
            eventPrefix: settings.eventNamePrefix,
        };
        this.data = settings.data ?? {};
        this.resources = new ResourceLoader({ useCache: this.config.useCache });
        this.loadResource = (url, requests) =>
            this.resources.loadOrThrow(url, requests, "view");
        /**
         * Content pipeline that turns view markup into nodes.
         *
         * @type {import("./view-content.js").ViewContent}
         */
        this.content = new ViewContent({
            document,
            viewTag: this.config.tagName,
            loopAttribute: settings.loopAttribute,
            ifAttribute: settings.ifAttribute,
            elseAttribute: settings.elseAttribute,
            dataAttribute: settings.dataAttribute,
            remoteAttribute: settings.remoteAttribute,
            resolveUrl: (source, baseUrl) => this.resolveUrl(source, baseUrl),
            loadResource: (url, requests) =>
                this.resources.loadOrThrow(url, requests, "remote"),
            renderViews: (options) => this.renderNodes(options),
        });
        this.sources = new ViewSourceResolver({
            remoteAttribute: settings.remoteAttribute,
            remote: new RemoteViewSource({
                remoteAttribute: settings.remoteAttribute,
                resolveUrl: (source, baseUrl) => this.resolveUrl(source, baseUrl),
                loadResource: this.loadResource,
                content: this.content,
            }),
            src: new SrcViewSource({
                resolveUrl: (source, baseUrl) => this.resolveUrl(source, baseUrl),
                loadResource: this.loadResource,
                content: this.content,
            }),
        });
    }

    /**
     * Collects view placeholder elements inside the given root.
     *
     * A host this pipeline placed is a rendered host rather than a pending placeholder, so a later pass does not load it again. Neither signal is enough on its own: the fixed library state attribute is author-collidable, so a marked placeholder with no root must still load, while a root without the marker is a placeholder this pipeline did not place and must still reach placement and fail loudly there.
     */
    getNodes(root = document) {
        return [...root.querySelectorAll(this.config.tagName)].filter(
            (node) => !(node.hasAttribute(View.SHADOW_HOST_ATTRIBUTE) && node.shadowRoot !== null),
        );
    }

    /**
     * Resolves a view `src` value into an absolute URL.
     *
     * The value is trimmed first, so a blank source is a directive error rather than a reference that resolves to the containing document.
     *
     * @throws {Error} When `srcPath` declares no source.
     */
    resolveUrl(srcPath, baseUrl = document.baseURI) {
        const source = typeof srcPath === "string" ? srcPath.trim() : "";

        if (source === "") {
            throw new Error('View node is missing a "src" attribute');
        }

        return new URL(source, baseUrl);
    }

    /**
     * Renders all views declared in the document and announces that rendering finished.
     */
    async render() {
        await this.renderNodes({
            nodes: this.getNodes(),
            parentUrl: document.baseURI,
            pass: RenderPass.create({ hostData: this.data }),
        });

        this.emit("ready");
    }

    /**
     * Loads and renders a set of placeholders that share the same base URL.
     */
    async renderNodes({
        nodes,
        parentUrl,
        pass = RenderPass.create({ hostData: this.data }),
    }) {
        const fragments = await this.getFragments(nodes, parentUrl, pass);

        await Promise.all(
            fragments.map((fragment) => this.renderFragment(fragment, pass)),
        );
    }

    /**
     * Loads the content of every given placeholder, resolving each distinct URL once.
     */
    async getFragments(
        nodes,
        parentUrl,
        pass = RenderPass.create({ hostData: this.data }),
    ) {
        return await Promise.all(
            [...nodes].map((node) =>
                this.sources.resolve(node).load({ node, parentUrl, pass }),
            ),
        );
    }

    /**
     * Renders one loaded fragment and places its content, replacing the placeholder or retaining it as a shadow host.
     *
     * Rendering, placement, the lifecycle event, and the placeholder data scope share one `try`/`catch`, so a directive or data failure on a placeholder replaces the view instead of recording a failure on an element that is about to be replaced. A shadow view fails the same way, because its shadow root is attached only after its content rendered.
     */
    async renderFragment(
        fragment,
        pass = RenderPass.create({ hostData: this.data }),
    ) {
        if (fragment.error) {
            console.error(fragment.error);
            this.renderErrorFragment(fragment);

            return;
        }

        if (pass.ancestors.has(fragment.url.href)) {
            const error = new Error(
                `Circular view reference "${fragment.srcFile}"`,
            );

            console.error(error);
            this.renderErrorFragment({ ...fragment, error });

            return;
        }

        try {
            const nodes = await this.renderFragmentContent(fragment, pass);

            this.placeFragmentContent(fragment, nodes);

            this.emit("rendered", {
                src: fragment.srcFile,
                url: fragment.url,
                nodes,
            });
        } catch (error) {
            const viewError = new Error(
                `View "${fragment.url.pathname}": ${error.message}`,
            );

            console.error(viewError);
            this.renderErrorFragment({ ...fragment, error: viewError });
        }
    }

    /**
     * Places rendered content: inside an open shadow root when the placeholder opted in with the shadow attribute, in place of the placeholder otherwise.
     *
     * A shadow host stays in the document, so the method marks it with the fixed library state attribute, discards the placeholder children, consumes the attributes this pipeline read, and appends the rendered nodes to the shadow root. Nothing is forwarded, because placeholder children are a fallback rather than slot content; they are rendered and their views loaded first, and then dropped with the rest of the authored children.
     *
     * @param {import("./view-source-resolver.js").ViewFragment} fragment
     * @param {Node[]} nodes
     * @throws {DOMException} When the placeholder already hosts a shadow tree.
     */
    placeFragmentContent(fragment, nodes) {
        const host = fragment.node;

        if (!host.hasAttribute(this.config.shadowAttribute)) {
            host.replaceWith(...nodes);

            return;
        }

        const shadowRoot = host.attachShadow({ mode: "open" });

        // A replaced placeholder drops these attributes with it, while a retained
        // host would keep them, so the pipeline consumes the ones it read. The
        // remote attribute is already consumed by the source that read it.
        host.setAttribute(View.SHADOW_HOST_ATTRIBUTE, "");
        host.removeAttribute(this.config.shadowAttribute);
        host.removeAttribute("src");
        host.replaceChildren();
        shadowRoot.append(...nodes);
    }

    /**
     * Resolves the data scope of a placeholder and asks the fragment source to render the content in that scope.
     */
    async renderFragmentContent(fragment, pass) {
        const data = this.resolveFragmentData(fragment.node, pass.data);

        return await fragment.source.render({ fragment, data, pass });
    }

    /**
     * Resolves the data scope of a placeholder.
     *
     * A placeholder inside rendered content was recorded with the scope it rendered in, while a host placeholder resolves its own declared data here.
     *
     * @throws {Error} When the placeholder's declared data is rejected.
     */
    resolveFragmentData(node, data) {
        const scopedData = this.content.getRecordedData(node);

        if (scopedData !== undefined) {
            return scopedData;
        }

        return this.content.resolveElementData({ element: node, data });
    }

    /**
     * Replaces a failed placeholder with an error element and announces the failure.
     *
     * The message is assigned as text rather than as markup, because it can embed text taken from a response body.
     */
    renderErrorFragment(fragment) {
        const div = document.createElement("div");

        div.className = this.config.errorClassName;
        div.setAttribute("data-view-error", fragment.error.message);
        div.textContent = fragment.error.message;
        fragment.node.replaceWith(div);

        this.emit("error", { src: fragment.srcFile, error: fragment.error });
    }

    /**
     * Dispatches a lifecycle event on the document, unless events are disabled.
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
