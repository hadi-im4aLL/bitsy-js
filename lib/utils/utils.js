export function replaceTagWithAnotherTag(element, newTag = "div") {
    if (!element) {
        return null;
    }

    const tag = document.createElement(newTag);

    for (const attr of element.attributes) {
        tag.setAttribute(attr.name, attr.value);
    }

    while (element.firstChild) {
        tag.appendChild(element.firstChild);
    }

    element.parentNode.replaceChild(tag, element);
    return tag;
}

export function castNumber(value) {
    if (typeof value === "string" && value.trim() !== "" && !Number.isNaN(Number(value))) {
        return Number(value);
    }

    return value;
}
