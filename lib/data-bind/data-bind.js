import { effect, isSignal } from "../reactivity/signal.js";
import { Evaluator } from "../utils/evaluator.js";
import { parseData } from "./parse-data.js";

const PLACEHOLDER_REGEX = /\{([^{}]+)\}/g;
const HTML_TAG_REGEX = /<[a-z][\s\S]*>/i;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEMPLATE"]);

export class DataBind {
    constructor(options) {
        this.options = options ? { ...options } : {};

        this.config = {
            tag: this.options.tags?.dataBind || "b-data",
            forLoopTag: this.options.tags?.forLoop || "b-for",
            conditionIfTag: this.options.tags?.conditionIf || "b-if",
            rawJsTag: this.options.tags?.rawJs || "b-js",
            onTag: this.options.tags?.on || "b-on",
            globalData: this.options.data || {},
        };

        this.dataMap = new WeakMap();
        this.disposers = [];
        this.evaluator = new Evaluator({
            config: this.options,
            dataBinderInstance: this,
            usedForTag: this.config.tag,
        });
    }

    bootstrap() {
        const nodes = this.getAllNodes();
        const scopes = [];

        for (const node of nodes) {
            const localData = this.getData(node);
            this.attachData(node, localData);
            scopes.push({
                node,
                data: { ...this.config.globalData, ...localData },
            });
        }

        for (const scope of scopes) {
            const dispose = this.bindSubtree(scope.node, scope.data);
            this.disposers.push(dispose);
        }
    }

    flush() {
        const nodes = this.getAllNodes();

        for (const node of nodes) {
            node.removeAttribute(this.config.tag);
        }
    }

    getAllNodes(root = document) {
        const { tag } = this.config;

        return root.querySelectorAll(`[${tag}]`);
    }

    getData(node) {
        const dataString = node.getAttribute(this.config.tag);

        return parseData(dataString);
    }

    attachData(node, data) {
        const prevData = this.getRawData(node);

        this.dataMap.set(node, { ...prevData, ...data });
    }

    getRawData(node) {
        return node && this.dataMap.has(node) ? this.dataMap.get(node) : null;
    }

    getClosestData(element) {
        let current = element;

        while (current) {
            if (this.dataMap.has(current)) {
                return this.dataMap.get(current);
            }
            current = current.parentElement;
        }

        return null;
    }

    isDirectiveAttribute(attrName) {
        return (
            attrName === this.config.tag ||
            attrName === this.config.forLoopTag ||
            attrName === this.config.conditionIfTag ||
            attrName === this.config.rawJsTag ||
            attrName.startsWith(`${this.config.onTag}:`) ||
            attrName.startsWith("data-b-")
        );
    }

    evaluateExpression(expression, scopedData, rawMatch) {
        let value = this.evaluator.evaluate(expression.trim(), scopedData, {
            silent: true,
            fallback: undefined,
        });

        if (isSignal(value)) {
            value = value();
        }

        if (typeof value === "undefined" || value === null) {
            return rawMatch;
        }

        return value;
    }

    bindSubtree(root, scopedData) {
        const disposers = [];
        const textNodes = [];
        const elements = [];

        const walk = (node, isRoot) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                if (SKIP_TAGS.has(node.tagName)) {
                    return;
                }

                if (
                    !isRoot &&
                    (node.hasAttribute(this.config.tag) ||
                        node.hasAttribute(this.config.forLoopTag))
                ) {
                    return;
                }

                elements.push(node);

                for (const child of Array.from(node.childNodes)) {
                    walk(child, false);
                }
            } else if (node.nodeType === Node.TEXT_NODE) {
                if (PLACEHOLDER_REGEX.test(node.nodeValue)) {
                    PLACEHOLDER_REGEX.lastIndex = 0;
                    textNodes.push(node);
                }
            } else if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
                for (const child of Array.from(node.childNodes)) {
                    walk(child, false);
                }
            }
        };

        walk(root, true);

        for (const el of elements) {
            this.bindAttributes(el, scopedData, disposers);
        }

        for (const textNode of textNodes) {
            this.bindTextNode(textNode, scopedData, disposers);
        }

        return () => {
            for (const dispose of disposers) {
                dispose();
            }
        };
    }

    bindAttributes(element, scopedData, disposers) {
        for (const attr of Array.from(element.attributes)) {
            if (this.isDirectiveAttribute(attr.name)) {
                continue;
            }

            const template = attr.value;
            PLACEHOLDER_REGEX.lastIndex = 0;
            if (!PLACEHOLDER_REGEX.test(template)) {
                continue;
            }
            PLACEHOLDER_REGEX.lastIndex = 0;

            const attrName = attr.name;
            const dispose = effect(() => {
                const rendered = template.replace(PLACEHOLDER_REGEX, (rawMatch, expr) => {
                    return String(this.evaluateExpression(expr, scopedData, rawMatch));
                });

                element.setAttribute(attrName, rendered);

                if (
                    attrName === "value" &&
                    (element.tagName === "INPUT" ||
                        element.tagName === "TEXTAREA" ||
                        element.tagName === "SELECT") &&
                    element.value !== rendered
                ) {
                    element.value = rendered;
                }
            });

            disposers.push(dispose);
        }
    }

    bindTextNode(textNode, scopedData, disposers) {
        const source = textNode.nodeValue;
        const fragment = document.createDocumentFragment();
        const slots = [];

        let lastIndex = 0;
        PLACEHOLDER_REGEX.lastIndex = 0;

        let match = PLACEHOLDER_REGEX.exec(source);
        while (match !== null) {
            if (match.index > lastIndex) {
                fragment.appendChild(
                    document.createTextNode(source.slice(lastIndex, match.index)),
                );
            }

            const slotNode = document.createTextNode("");
            fragment.appendChild(slotNode);
            slots.push({
                rawMatch: match[0],
                expr: match[1],
                node: slotNode,
            });

            lastIndex = match.index + match[0].length;
            match = PLACEHOLDER_REGEX.exec(source);
        }

        if (lastIndex < source.length) {
            fragment.appendChild(document.createTextNode(source.slice(lastIndex)));
        }

        textNode.replaceWith(fragment);

        for (const slot of slots) {
            let currentNodes = [slot.node];

            const dispose = effect(() => {
                const value = this.evaluateExpression(slot.expr, scopedData, slot.rawMatch);
                const textValue = String(value);

                if (HTML_TAG_REGEX.test(textValue)) {
                    const tpl = document.createElement("template");
                    tpl.innerHTML = textValue;
                    const nextNodes = Array.from(tpl.content.childNodes);

                    if (nextNodes.length === 0) {
                        const emptyNode = document.createTextNode("");
                        nextNodes.push(emptyNode);
                    }

                    const anchor = currentNodes[0];
                    if (anchor?.parentNode) {
                        for (const n of nextNodes) {
                            anchor.parentNode.insertBefore(n, anchor);
                        }
                        for (const oldNode of currentNodes) {
                            oldNode.remove();
                        }
                        currentNodes = nextNodes;
                    }
                } else if (
                    currentNodes.length === 1 &&
                    currentNodes[0].nodeType === Node.TEXT_NODE
                ) {
                    currentNodes[0].nodeValue = textValue;
                } else {
                    const nextText = document.createTextNode(textValue);
                    const anchor = currentNodes[0];
                    if (anchor?.parentNode) {
                        anchor.parentNode.insertBefore(nextText, anchor);
                        for (const oldNode of currentNodes) {
                            oldNode.remove();
                        }
                        currentNodes = [nextText];
                    }
                }
            });

            disposers.push(dispose);
        }
    }
}
