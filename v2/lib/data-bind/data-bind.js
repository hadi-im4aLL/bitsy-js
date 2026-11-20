import { parseData } from './parse-data.js';
import { parseTemplate } from './parse-template.js';

export class DataBind {
    constructor() {
        this.config = {
            tag: `r-data`
        }
    }

    bootstrap() {
        const nodes = this.getAllNodes();
        const tree = this.generateTree(nodes);

        this.renderTree(tree);
    }

    getAllNodes(root = document) {
        const { tag } = this.config;

        return root.querySelectorAll(`[${tag}]`);
    }

    generateTree(nodes) {
        const tree = [];

        for (const node of nodes) {
            const data = this.getData(node);
            const content = this.getContent(node, data);

            tree.push({
                node,
                data,
                content
            });
        }

        return tree;
    }

    getData(node) {
        const dataString = node.getAttribute(this.config.tag);

        return parseData(dataString);
    }

    getContent(node, data) {
        const template = node.innerHTML;

        return parseTemplate(template, data);
    }

    renderTree(tree) {
        for (const item of tree) {
            item.node.innerHTML = item.content;
        }
    }
}
