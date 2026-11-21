import { replaceTagWithAnotherTag } from "../utils/utils.js";

export class ConditionDirective {
    constructor(dataBinder) {
        this.config = {};
        this.dataBinder = dataBinder;
        this.evaluationCache = new Map();
    }

    setConfig(data) {
        this.config = { ...data };
    }

    register(settings) {
        this.setConfig(settings);

        this.process();
    }

    process() {
        const conditionTag = this.config.tags.conditionIf;
        const elements = this.getAllElements();

        for (const element of elements) {
            const scopedData = this.getScopedData(element);
            const expression = this.getExpression(element);
            const evaluation = this.evaluateExpression(expression, scopedData);

            if (element.tagName.toLowerCase() === this.containerTag) {
                const newElement = replaceTagWithAnotherTag(element, 'span');
                newElement.style.display = evaluation ? 'inline-block' : 'none';

                newElement.removeAttribute(conditionTag);
            } else {
                element.style.display = evaluation ? getComputedStyle(element).display : 'none';
                element.removeAttribute(conditionTag);
            }
        }
    }

    getAllElements() {
        return document.querySelectorAll(`[${this.config.tags.conditionIf}]`);
    }

    getScopedData(element) {
        const closestDataBindElement = element.closest(
            `[${this.config.tags.dataBind}]`,
        );
        const closestState = this.dataBinder.getRawData(closestDataBindElement);

        let loopData = {};
        if (element._loopData) {
            loopData = { ...element._loopData }
        }

        if (!closestState) {
            return { ...this.config.data, ...loopData };
        }

        return { ...this.config.data, ...closestState, ...loopData };
    }

    getExpression(element) {
        return element.getAttribute(this.config.tags.conditionIf).trim();
    }

    evaluateExpression(expression, scopedData) {
        const fn = this.compile(expression);
        if (!fn) {
            return false;
        }

        const scope = this.scope(scopedData);

        try {
            return fn.call(scope, scope);
        } catch (err) {
            console.error(`[${this.config.tag}] runtime error in "${expr}"`, err);

            return false;
        }
    }

    compile(expression) {
        if (this.evaluationCache.has(expression)) {
            return this.evaluationCache.get(expression);
        }

        let fn = null;

        try {
            fn = new Function("__s__", `with (__s__) { return (${expression}); }`);
        } catch (err) {
            console.error(
                `[${this.config.tags.conditionIf}] syntax error in "${expression}"`,
                err,
            );
        }

        this.evaluationCache.set(expression, fn);

        return fn;
    }

    scope(state = {}) {
        return new Proxy(state, {
            has(target, key) {
                return key !== Symbol.unscopables;
            },
            get(target, key) {
                if (key === Symbol.unscopables) {
                    return undefined;
                }

                if (key in target) {
                    return target[key];
                }

                return globalThis[key];
            },
            set(target, key, value) {
                target[key] = value;

                return true;
            },
        });
    }
}
