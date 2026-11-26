import { effect, isSignal } from "../reactivity/signal.js";
import { Evaluator } from "../utils/evaluator.js";
import { replaceTagWithAnotherTag } from "../utils/utils.js";

export class ConditionDirective {
    constructor() {
        this.config = {};
        this.dataBinder = null;
        this.evaluator = null;
    }

    setConfig(data) {
        this.config = { ...data };

        this.dataBinder = this.config.dataBinder;
        this.evaluator = new Evaluator({
            config: this.config,
            dataBinderInstance: this.dataBinder,
            usedForTag: this.config.tags.conditionIf,
        });
    }

    register(settings) {
        this.setConfig(settings);

        return this.process();
    }

    process(root = this.config.root || document, extraScope = null) {
        const disposers = [];
        const elements = this.getAllElements(root);

        for (const element of elements) {
            const dispose = this.processElement(element, extraScope);
            if (dispose) {
                disposers.push(dispose);
            }
        }

        return () => {
            for (const dispose of disposers) {
                dispose();
            }
        };
    }

    processElement(element, extraScope = null) {
        const conditionTag = this.config.tags.conditionIf;
        const expression = element.getAttribute(conditionTag)?.trim();
        if (!expression) {
            return null;
        }

        const scopedData = extraScope
            ? { ...this.evaluator.getScopedData(element), ...extraScope }
            : this.evaluator.getScopedData(element);

        let target = element;
        let showDisplay;

        if (element.tagName.toLowerCase() === this.config.tags.container) {
            target = replaceTagWithAnotherTag(element, "span");
            target.removeAttribute(conditionTag);
            showDisplay = "inline-block";
        } else {
            target.removeAttribute(conditionTag);
            showDisplay = target.style.display && target.style.display !== "none" ? target.style.display : "";
        }

        return effect(() => {
            let result = this.evaluator.evaluate(expression, scopedData);
            if (isSignal(result)) {
                result = result();
            }

            target.style.display = result ? showDisplay : "none";
        });
    }

    getAllElements(root = this.config.root || document) {
        const elements = Array.from(root.querySelectorAll(`[${this.config.tags.conditionIf}]`));

        if (root.nodeType === Node.ELEMENT_NODE && root.hasAttribute(this.config.tags.conditionIf)) {
            elements.unshift(root);
        }

        return elements;
    }
}
