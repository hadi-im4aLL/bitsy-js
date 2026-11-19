import { flattenFragmentTree } from './flatten-fragment-tree.js';

export class Fragment {
    constructor() {
        this.config = {
            tag: 'r-view',
        }

        this.fragments = [];
    }

    async bootstrap() {
        const tree = await this.generateFragmentTree();
        const flattenTree = flattenFragmentTree(tree, this.config.tag);

        for (const item of flattenTree) {
            this.replaceNode(item.fragment, item.content);
        }
    }

    replaceNode(node, content) {
        node.replaceWith(document.createRange().createContextualFragment(content));
    }

    async generateFragmentTree(nodes, baseFragmentUrl = document.baseURI) {
        const fragments = nodes ? [...nodes] : [...this.getAllFragments()];
        const tree = await this.getTree(fragments, baseFragmentUrl);

        return tree;
    }

    async getTree(fragments, baseFragmentUrl = document.baseURI) {
        const tree = [];

        for (const fragment of fragments) {
            const url = this.getFragmentUrl(fragment, baseFragmentUrl);
            const content = await this.fetchContent(url);
            const children = await this.getNestedFragment(content, url.href);

            tree.push({
                url,
                content,
                children,
                fragment
            });
        }

        return tree;
    }

    getAllFragments(root = document) {
        const fragmentTag = this.config.tag;

        return root.querySelectorAll(fragmentTag);
    }

    getFragmentUrl(fragment, baseUri = document.baseURI) {
        const srcPath = fragment.getAttribute('src');

        return new URL(srcPath, baseUri);
    }

    async fetchContent(url) {
        const response = await fetch(url);
        const data = await response.text();

        return data;
    }

    async getNestedFragment(content, baseFragmentUrl) {
        const doc = new DOMParser().parseFromString(content, 'text/html');
        const fragments = doc.querySelectorAll(this.config.tag);

        if (fragments.length === 0) {
            return [];
        }

        const tree = await this.generateFragmentTree(fragments, baseFragmentUrl);

        return tree;
    }
}
