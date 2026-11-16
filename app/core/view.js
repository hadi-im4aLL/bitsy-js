export class View {
    constructor(settings) {
        this.settings = { ...settings };
    }

    getNodes() {
        const { viewTag } = this.settings;

        return document.querySelectorAll(viewTag);
    }

    async getViewContent(srcPath) {
        if (!srcPath) {
            throw new Error('View node is missing a "src" attribute');
        }

        const url = new URL(srcPath, document.baseURI);
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

    async getDetails() {
        const requests = new Map();

        return await Promise.all(
            [...this.getNodes()].map(async (node) => {
                const srcFile = node.getAttribute("src");

                if (!requests.has(srcFile)) {
                    requests.set(srcFile, this.getViewContent(srcFile));
                }

                const fragment = {
                    srcFile,
                    content: "",
                    error: null,
                    node,
                };

                try {
                    fragment.content = await requests.get(srcFile);
                } catch (error) {
                    fragment.error = error;
                }

                return fragment;
            }),
        );
    }

    replaceView(node, content) {
        const template = document.createElement("template");
        template.innerHTML = content;
        node.replaceWith(template.content);
    }

    async render() {
        const details = await this.getDetails();

        for (const fragment of details) {
            if (fragment.error) {
                console.error(fragment.error);

                fragment.node.setAttribute(
                    "data-view-error",
                    fragment.error.message,
                );

                const div = document.createElement("div");
                div.innerHTML = fragment.error.message;
                div.className = this.settings.viewErrorClassName;
                fragment.node.replaceWith(div);

                continue;
            }

            this.replaceView(fragment.node, fragment.content);
        }
    }
}
