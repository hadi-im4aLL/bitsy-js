export class Container {
    constructor() {
        this.config = {
            tag: `r-container`,
        }
    }

    bootstrap() {
        this.cleanUp();
    }

    cleanUp() {
        const nodes = document.querySelectorAll(this.config.tag);

        for (const node of nodes) {
            node.replaceWith(...node.childNodes);
        }
    }
}
