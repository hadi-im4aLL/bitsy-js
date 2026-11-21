export function flattenFragmentTree(tree, tag) {
    if (!Array.isArray(tree)) {
        throw new TypeError('Fragment tree must be an array');
    }

    return tree.map((node) => {
        const { content } = flattenFragmentNode(node, tag);

        return {
            content,
            fragment: node.fragment,
        }
    });
}

function flattenFragmentNode(node, tag) {
    const children = Array.isArray(node.children) ? node.children : [];
    const childContents = children.map((child) => flattenFragmentNode(child, tag).content);

    return {
        content: inlineChildContent(node.content, childContents, tag),
    };
}

function inlineChildContent(content, childContents, tag) {
    if (typeof content !== 'string') {
        throw new TypeError('Fragment content must be a string');
    }

    const pattern = createFragmentTagPattern(tag);
    let childIndex = 0;

    return content.replace(pattern, (match) => {
        if (childIndex >= childContents.length) {
            return match;
        }

        const childContent = childContents[childIndex];

        childIndex += 1;

        return childContent;
    });
}

function createFragmentTagPattern(tag) {
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    return new RegExp(
        `<${escapedTag}\\b[^>]*\\/>|<${escapedTag}\\b[^>]*>[\\s\\S]*?<\\/${escapedTag}>`,
        'g',
    );
}
