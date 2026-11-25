export class Evaluator {
    constructor({ config, dataBinderInstance, usedForTag }) {
        this.config = { ...config };
        this.dataBinder = dataBinderInstance;
        this.usedForTag = usedForTag;

        this.evaluationCache = new Map();
    }

    getData(element) {
        const scopedData = this.getScopedData(element);
        const expression = this.getExpression(element);

        return this.evaluate(expression, scopedData);
    }

    evaluate(expression, scopedData) {
        const fn = this.compile(expression);
        if (!fn) {
            return false;
        }

        const scope = this.scope(scopedData);

        try {
            return fn.call(scope, scope);
        } catch (err) {
            console.error(`[${this.usedForTag}] runtime error in "${expression}"`, err);

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
                `[${this.usedForTag}] syntax error in "${expression}"`,
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

    getScopedData(element) {
        const closestDataBindElement = element.closest(
            `[${this.config.tags.dataBind}]`,
        );
        const closestState = this.dataBinder.getRawData(closestDataBindElement);

        let loopData = {};
        if (element._loopData) {
            loopData = { ...element._loopData };
        }

        if (!closestState) {
            return { ...this.config.data, ...loopData };
        }

        return { ...this.config.data, ...closestState, ...loopData };
    }

    getExpression(element) {
        return element.getAttribute(this.usedForTag).trim();
    }
}
