export class Container {
    constructor(options) {
        this.config = {
            tag: options.tags.container || `r-container`,
        };
    }

    flush() {
        const nodes = document.querySelectorAll(this.config.tag);

        for (const node of nodes) {
            node.replaceWith(...node.childNodes);
        }
    }
}
