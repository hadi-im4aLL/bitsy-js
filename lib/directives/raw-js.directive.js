import { effect, isSignal } from "../reactivity/signal.js";
import { Evaluator } from "../utils/evaluator.js";

export class RawJSDirective {
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
            usedForTag: this.config.tags.rawJs,
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
        const rawJsTag = this.config.tags.rawJs;
        const expression = element.getAttribute(rawJsTag)?.trim();
        if (!expression) {
            return null;
        }

        const scopedData = extraScope
            ? { ...this.evaluator.getScopedData(element), ...extraScope }
            : this.evaluator.getScopedData(element);

        element.removeAttribute(rawJsTag);

        return effect(() => {
            let result = this.evaluator.evaluate(expression, scopedData);
            if (isSignal(result)) {
                result = result();
            }

            element.innerHTML = typeof result === "undefined" || result === null ? "" : result;
        });
    }

    getAllElements(root = this.config.root || document) {
        const elements = Array.from(root.querySelectorAll(`[${this.config.tags.rawJs}]`));

        if (root.nodeType === Node.ELEMENT_NODE && root.hasAttribute(this.config.tags.rawJs)) {
            elements.unshift(root);
        }

        return elements;
    }
}
