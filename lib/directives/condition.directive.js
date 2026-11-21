import { Evaluator } from "../utils/evaluator.js";
import { replaceTagWithAnotherTag } from "../utils/utils.js";

export class ConditionDirective {
    constructor(dataBinder) {
        this.config = {};
        this.dataBinder = dataBinder;
        this.evaluator = null;
    }

    setConfig(data) {
        this.config = { ...data };
        this.evaluator = new Evaluator({
            config: this.config,
            dataBinderInstance: this.dataBinder,
            usedForTag: this.config.tags.rawJs
        });
    }

    register(settings) {
        this.setConfig(settings);

        this.process();
    }

    process() {
        const conditionTag = this.config.tags.conditionIf;
        const elements = this.getAllElements();

        for (const element of elements) {
            const data = this.evaluator.getData(element);

            if (element.tagName.toLowerCase() === this.config.tags.container) {
                const newElement = replaceTagWithAnotherTag(element, 'span');
                newElement.style.display = data ? 'inline-block' : 'none';

                newElement.removeAttribute(conditionTag);
            } else {
                element.style.display = data ? getComputedStyle(element).display : 'none';
                element.removeAttribute(conditionTag);
            }
        }
    }

    getAllElements() {
        return document.querySelectorAll(`[${this.config.tags.conditionIf}]`);
    }
}
