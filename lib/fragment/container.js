export class Container {
    constructor(options) {
        this.config = {
            tag: options.tags.container || `b-container`,
            root: options.root || document,
        };
    }

    flush() {
        const nodes = this.config.root.querySelectorAll(this.config.tag);

        for (const node of nodes) {
            node.replaceWith(...node.childNodes);
        }
    }
}
