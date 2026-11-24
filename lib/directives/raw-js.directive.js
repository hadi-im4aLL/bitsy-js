import { Evaluator } from "../utils/evaluator.js";

export class RawJSDirective {
    constructor(dataBinder) {
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
            usedForTag: this.config.tags.rawJs
        });
    }

    register(settings) {
        this.setConfig(settings);

        this.process();
    }

    process() {
        const elements = this.getAllElements();

        for (const element of elements) {
            const data = this.evaluator.getData(element);

            element.innerHTML = data;
            element.removeAttribute(this.config.tags.rawJs);
        }
    }

    getAllElements(root = this.config.root || document) {
        return root.querySelectorAll(`[${this.config.tags.rawJs}]`);
    }
}
