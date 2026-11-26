import { effect, isSignal } from "../reactivity/signal.js";
import { Evaluator } from "../utils/evaluator.js";
import { ConditionDirective } from "./condition.directive.js";
import { RawJSDirective } from "./raw-js.directive.js";

export class ForLoopDirective {
    constructor() {
        this.config = {};
        this.evaluator = null;
    }

    setConfig(data) {
        this.config = { ...data };
        this.evaluator = new Evaluator({
            config: this.config,
            dataBinderInstance: this.config.dataBinder,
            usedForTag: this.config.tags.forLoop,
        });
    }

    register(settings) {
        this.setConfig(settings);

        return this.render();
    }

    render() {
        const disposers = [];
        const elements = this.getAllElements();

        for (const element of elements) {
            const dispose = this.bindLoop(element);
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

    getAllElements(root = this.config.root || document) {
        return Array.from(root.querySelectorAll(`[${this.config.tags.forLoop}]`));
    }

    parseDescriptor(element) {
        const descriptor = element.getAttribute(this.config.tags.forLoop)?.trim();
        if (!descriptor) {
            return null;
        }

        const match = descriptor.match(/^(\w+)\s+of\s+(.+)$/);
        if (!match) {
            return null;
        }

        return {
            keyName: match[1].trim(),
            listExpr: match[2].trim(),
        };
    }

    bindLoop(originalElement) {
        const parsed = this.parseDescriptor(originalElement);
        if (!parsed) {
            return null;
        }

        const { keyName, listExpr } = parsed;
        const baseScope = this.evaluator.getScopedData(originalElement);

        const templateElement = originalElement.cloneNode(true);
        templateElement.removeAttribute(this.config.tags.forLoop);

        const anchor = document.createComment(`b-for:${keyName} of ${listExpr}`);
        originalElement.replaceWith(anchor);

        const conditionDirective = new ConditionDirective();
        conditionDirective.setConfig(this.config);

        const rawJsDirective = new RawJSDirective();
        rawJsDirective.setConfig(this.config);

        let renderedNodes = [];
        let itemDisposers = [];

        const clearRendered = () => {
            for (const dispose of itemDisposers) {
                dispose();
            }
            itemDisposers = [];

            for (const node of renderedNodes) {
                node.remove();
            }
            renderedNodes = [];
        };

        const stopEffect = effect(() => {
            clearRendered();

            let list = this.evaluator.evaluate(listExpr, baseScope, {
                silent: true,
                fallback: null,
            });

            if (isSignal(list)) {
                list = list();
            }

            if (!Array.isArray(list)) {
                return;
            }

            const count = list.length;
            const fragment = document.createDocumentFragment();
            const nextNodes = [];

            for (const [index, item] of list.entries()) {
                const _isFirst = index === 0;
                const _isLast = index === count - 1;

                const loopScope = {
                    ...baseScope,
                    [keyName]: item,
                    _index: index,
                    _isFirst,
                    _isLast,
                };

                const clonedElement = templateElement.cloneNode(true);

                if (this.config.dataBinder) {
                    const disposeBind = this.config.dataBinder.bindSubtree(
                        clonedElement,
                        loopScope,
                    );
                    itemDisposers.push(disposeBind);
                }

                const disposeIf = conditionDirective.process(clonedElement, loopScope);
                itemDisposers.push(disposeIf);

                const disposeJs = rawJsDirective.process(clonedElement, loopScope);
                itemDisposers.push(disposeJs);

                if (this.config.eventHandler) {
                    const disposeEvents = this.config.eventHandler.listenOn(
                        clonedElement,
                        loopScope,
                    );
                    itemDisposers.push(disposeEvents);
                }

                const containerTag = this.config.tags.container;
                if (containerTag) {
                    for (const containerNode of clonedElement.querySelectorAll(containerTag)) {
                        containerNode.replaceWith(...containerNode.childNodes);
                    }
                }

                fragment.appendChild(clonedElement);
                nextNodes.push(clonedElement);
            }

            if (anchor.parentNode) {
                anchor.parentNode.insertBefore(fragment, anchor.nextSibling);
                renderedNodes = nextNodes;
            }
        });

        return () => {
            stopEffect();
            clearRendered();
            anchor.remove();
        };
    }
}
