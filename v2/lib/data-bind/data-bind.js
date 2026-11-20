import { parseData } from './parse-data.js';
import { parseTemplate } from '../utils/parse-template.js';

export class DataBind {
    constructor(options) {
        this.options = options ? { ...options } : {};

        this.config = {
            tag: this.options.tags.dataBind || `r-data`,
            globalData: this.options.data,
        };

        this.dataMap = new WeakMap();
    }

    bootstrap() {
        const nodes = this.getAllNodes();
        const tree = this.generateTree(nodes);

        this.renderTree(tree);
    }

    flush() {
        const nodes = this.getAllNodes();

        for (const node of nodes) {
            node.removeAttribute(this.config.tag);
        }
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

            this.attachData(node, data);

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

        return parseTemplate(template, { ...this.config.globalData, ...data });
    }

    renderTree(tree) {
        for (const item of tree) {
            item.node.innerHTML = item.content;
        }
    }

    attachData(node, data) {
        const prevData = this.getRawData(node);

        this.dataMap.set(node, { ...prevData, ...data });
    }

    getRawData(node) {
        return this.dataMap.has(node) ? this.dataMap.get(node) : null;
    }
}
