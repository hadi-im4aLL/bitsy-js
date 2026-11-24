import { parseTemplate } from "../utils/parse-template.js";

export class ForLoopDirective {
    constructor() {
        this.config = {};
    }

    setConfig(data) {
        this.config = { ...data };
    }

    register(settings) {
        this.setConfig(settings);

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

    getAllElements(root = this.config.root || document) {
        return root.querySelectorAll(`[${this.config.tags.forLoop}]`);
    }

    getContent(element) {
        return element.innerHTML;
    }

    resolveData(element) {
        const operator = 'of';
        const descriptor = element.getAttribute(this.config.tags.forLoop);
        const descriptorArray = descriptor.split(operator).map(v => v.trim());
        const dataKey = descriptorArray[0];
        const resolveVariableName = descriptorArray[1];

        if (this.config.data[resolveVariableName]) {
            return {
                [dataKey]: this.config.data[resolveVariableName],
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
        if (!definition.data) {
            return;
        }

        const originalElement = definition.element;
        const newElements = [];
        const keyName = definition.data.key;
        const count = definition.data[keyName].length;

        for (const [index, item] of definition.data[keyName].entries()) {
            const _isFirst = index === 0;
            const _isLast = index === (count - 1);

            const content = parseTemplate(definition.content, {
                [keyName]: item,
                _index: index,
                _isFirst,
                _isLast,
            });

            const clonedElement = originalElement.cloneNode(true);
            clonedElement.removeAttribute(this.config.tags.forLoop);
            clonedElement.innerHTML = content;

            for (const conditionalElement of clonedElement.querySelectorAll(`[${this.config.tags.conditionIf}]`)) {
                conditionalElement._loopData = {
                    _index: index,
                    _isFirst,
                    _isLast,
                };
            }

            newElements.push(clonedElement);
        }

        originalElement.removeAttribute(this.config.tags.forLoop);
        originalElement.replaceWith(...newElements);
    }
}
