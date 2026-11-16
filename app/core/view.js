export class View {
    constructor(settings) {
        this.settings = { ...settings };
    }

    getNodes(root = document) {
        const { viewTag } = this.settings;

        return root.querySelectorAll(viewTag);
    }

    resolveUrl(srcPath, baseUrl = document.baseURI) {
        if (!srcPath) {
            throw new Error('View node is missing a "src" attribute');
        }

        return new URL(srcPath, baseUrl);
    }

    async getViewContent(url) {
        const settings = {};

        if (this.settings.viewCache === false) {
            settings['cache'] = 'no-cache';
        }

        const response = await fetch(url, settings);

        if (!response.ok) {
            throw new Error(
                `Failed to load view "${srcPath}" (${response.status})`,
            );
        }

        return await response.text();
    }

    async getDetails(nodes, parentUrl = document.baseURI) {
        const nodeItems = nodes ? [...nodes] : [...this.getNodes()];
        const requests = new Map();

        return await Promise.all(
            nodeItems.map(async (node) => {
                const srcFile = node.getAttribute("src");
                const fragment = {
                    srcFile,
                    url: null,
                    content: "",
                    error: null,
                    node,
                };

                fragment.url = this.resolveUrl(srcFile, parentUrl);

                if (!requests.has(fragment.url.href)) {
                    requests.set(fragment.url.href, this.getViewContent(fragment.url));
                }

                try {
                    fragment.content = await requests.get(fragment.url.href);
                } catch (error) {
                    fragment.error = error;
                }

                return fragment;
            }),
        );
    }

    async render() {
        const details = await this.getDetails();
        console.log(details);

        for (const fragment of details) {
            if (fragment.error) {
                console.error(fragment.error);
                this.renderErrorFragment(fragment);
                continue;
            }

            await this.renderFragment(fragment);
        }
    }

    async renderFragment(fragment) {
        const template = document.createElement("template");
        template.innerHTML = fragment.content;

        const nestedViews = this.getNodes(template.content);
        if (nestedViews.length > 0) {
            fragment['children'] = await this.getDetails(nestedViews, fragment.url);
        }

        fragment.node.replaceWith(template.content);
    }

    renderErrorFragment(fragment) {
        fragment.node.setAttribute(
            "data-view-error",
            fragment.error.message,
        );

        const div = document.createElement("div");
        div.innerHTML = fragment.error.message;
        div.className = this.settings.viewErrorClassName;
        fragment.node.replaceWith(div);
    }
}
