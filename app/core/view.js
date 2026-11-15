export class View {
    constructor(settings) {
        this.settings = { ...settings };
    }

    getNodes() {
        const { viewTag } = this.settings;

        return document.querySelectorAll(viewTag);
    }

    async getViewContent(srcPath) {
        const url = new URL(srcPath, document.baseURI);

        try {
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
        } catch (error) {
            console.error(error);

            return "";
        }
    }

    async getDetails() {
        const requests = new Map();

        return await Promise.all(
            [...this.getNodes()].map(async (node) => {
                const srcFile = node.getAttribute("src");

                if (!requests.has(srcFile)) {
                    requests.set(srcFile, this.getViewContent(srcFile));
                }

                return {
                    initialContent: node.innerHTML,
                    srcFile,
                    content: await requests.get(srcFile),
                    node,
                };
            }),
        );
    }

    async render() {
        const details = await this.getDetails();

        for (const fragment of details) {
            if (!fragment.content) {
                continue;
            }

            const template = document.createElement("template");
            template.innerHTML = fragment.content;
            fragment.node.replaceWith(template.content);
        }
    }
}
