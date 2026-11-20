import { parseTemplate } from "../utils/parse-template.js";

export class ForLoopDirective {
    constructor() {
        this.globalData = {};
        this.config = {
            tag: `r-for`
        }
    }

    setGlobalData(globalData) {
        this.globalData = { ...globalData };
    }

    setTag(tag) {
        this.config.tag = tag;
    }

    register(settings) {
        this.setGlobalData(settings.data);
        this.setTag(settings.tags.forLoop);

        this.render();
    }

    render() {
        const definitions = [];
        const elements = this.getAllElements();

        for (const element of elements) {
            definitions.push({
                element,
                data: this.resolveData(element),
                content: this.getContent(element),
            });
        }

        this.renderDefinitions(definitions);
    }

    getAllElements(root = document) {
        return root.querySelectorAll(`[${this.config.tag}]`);
    }

    getContent(element) {
        return element.innerHTML;
    }

    resolveData(element) {
        const operator = 'of';
        const descriptor = element.getAttribute(this.config.tag);
        const descriptorArray = descriptor.split(operator).map(v => v.trim());
        const dataKey = descriptorArray[0];
        const resolveVariableName = descriptorArray[1];

        if (this.globalData[resolveVariableName]) {
            return {
                [dataKey]: this.globalData[resolveVariableName],
                key: dataKey,
            }
        }

        return null;
    }

    renderDefinitions(definitions) {
        for (const definition of definitions) {
            this.renderDefinition(definition);
        }
    }

    renderDefinition(definition) {
        const originalElement = definition.element;
        const newElements = [];
        const keyName = definition.data.key;
        const count = definition.data[keyName].length;

        for (const [index, item] of definition.data[keyName].entries()) {
            const content = parseTemplate(definition.content, {
                [keyName]: item,
                _index: index,
                _isFirst: index === 0,
                _isLast: index === (count - 1),
            });

            const clonedElement = originalElement.cloneNode(true);
            clonedElement.removeAttribute(this.config.tag);
            clonedElement.innerHTML = content;

            newElements.push(clonedElement);
        }

        originalElement.removeAttribute(this.config.tag);
        originalElement.replaceWith(...newElements);
    }
}
