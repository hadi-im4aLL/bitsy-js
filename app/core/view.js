export class View {
    constructor(settings) {
        this.config = {
            tagName: settings.viewTag,
            useCache: settings.viewCache,
            errorClassName: settings.viewErrorClassName,
            events: settings.enableEvents,
            eventPrefix: settings.eventNamePrefix,
        };
    }

    getNodes(root = document) {
        return root.querySelectorAll(this.config.tagName);
    }

    resolveUrl(srcPath, baseUrl = document.baseURI) {
        if (!srcPath) {
            throw new Error('View node is missing a "src" attribute');
        }

        return new URL(srcPath, baseUrl);
    }

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

    async getFragments(nodes, parentUrl) {
        const requests = new Map();

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

    async render() {
        await this.renderNodes(this.getNodes(), document.baseURI, new Set());

        this.emit('ready');
    }

    async renderNodes(nodes, parentUrl, ancestors) {
        const fragments = await this.getFragments(nodes, parentUrl);

        await Promise.all(
            fragments.map((fragment) => this.renderFragment(fragment, ancestors)),
        );
    }

    async renderFragment(fragment, ancestors = new Set()) {
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

        const nestedViews = this.getNodes(template.content);

        if (nestedViews.length > 0) {
            await this.renderNodes(
                nestedViews,
                fragment.url,
                new Set(ancestors).add(fragment.url.href),
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

    renderErrorFragment(fragment) {
        fragment.node.setAttribute(
            "data-view-error",
            fragment.error.message,
        );

        const div = document.createElement("div");
        div.innerHTML = fragment.error.message;
        div.className = this.config.errorClassName;
        fragment.node.replaceWith(div);

        this.emit('error', { src: fragment.srcFile, error: fragment.error });
    }

    emit(name, detail) {
        if (!this.config.events) {
            return;
        }

        document.dispatchEvent(
            new CustomEvent(`${this.config.eventPrefix}:${name}`, { detail }),
        );
    }
}
