export class View {
    constructor(settings) {
        this.settings = { ...settings };
    }

    getNodes() {
        const { viewTag } = this.settings;

        return document.querySelectorAll(viewTag);
    }

    getViewKey(srcPath) {
        const segments = (srcPath || "")
            .split(/[\\/]/)
            .filter(
                (segment) => segment && segment !== "." && segment !== "..",
            );

        const fileName = segments.pop() || "";
        const baseName = fileName.replace(/\.[^.]+$/, "");

        return [...segments, baseName].join("_").replace(/[^a-zA-Z0-9_]/g, "_");
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
       const data = {};
       const nodes = this.getNodes();

       await Promise.all(
           [...nodes].map(async (node) => {
               const srcFile = node.getAttribute("src");
               const key = this.getViewKey(srcFile);

               data[key] = {
                   initialContent: node.innerHTML,
                   srcFile,
                   content: await this.getViewContent(srcFile),
                   node,
               };
           }),
       );

       return data;
    }

    async render() {
        const details = await this.getDetails();

        for (const property in details) {
            const fragment = details[property];

            if (!fragment.content) {
                continue;
            }

            const template = document.createElement("template");
            template.innerHTML = fragment.content;
            fragment.node.replaceWith(template.content);
        }
    }
}
