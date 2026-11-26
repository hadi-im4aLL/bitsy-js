import { Evaluator } from "../utils/evaluator.js";
import { Remote } from "./remote.js";

export class EventHandler {
    constructor(settings = {}) {
        this.settings = { ...settings };

        this.eventType = {
            html: `handleHtml`,
            text: `handleText`,
            'add-class': `handleAddClass`,
            'remove-class': `handleRemoveClass`,
            'toggle-class': `handleToggleClass`,
            remote: `handleRemote`
        };

        this.evaluator = new Evaluator({
            config: this.settings,
            dataBinderInstance: this.settings.dataBinder,
            usedForTag: this.settings.tags?.on || "b-on",
        });
    }

    listen() {
        const elements = this.getAllElements();

        for (const element of elements) {
            const eventName = element.getAttribute(`data-${this.settings.tags.event}`);
            const handler = () => this.handler(eventName, element);

            element.addEventListener(eventName, handler);
        }

        this.listenOn(document);
    }

    listenOn(root = document, extraScope = null) {
        const prefix = `${this.settings.tags?.on || "b-on"}:`;
        const disposers = [];
        const elements = Array.from(root.querySelectorAll("*"));

        if (root.nodeType === Node.ELEMENT_NODE) {
            elements.unshift(root);
        }

        for (const element of elements) {
            const onAttrs = Array.from(element.attributes).filter((attr) =>
                attr.name.startsWith(prefix),
            );

            if (onAttrs.length === 0) {
                continue;
            }

            const scopedData = extraScope
                ? { ...this.evaluator.getScopedData(element), ...extraScope }
                : this.evaluator.getScopedData(element);

            for (const attr of onAttrs) {
                const eventName = attr.name.slice(prefix.length);
                const expression = attr.value.trim();

                element.removeAttribute(attr.name);

                if (!eventName || !expression) {
                    continue;
                }

                const listener = (event) => {
                    this.evaluator.execute(expression, scopedData, {
                        $event: event,
                        $el: element,
                    });
                };

                element.addEventListener(eventName, listener);
                disposers.push(() => {
                    element.removeEventListener(eventName, listener);
                });
            }
        }

        return () => {
            for (const dispose of disposers) {
                dispose();
            }
        };
    }

    getAllElements() {
        return document.querySelectorAll(`[data-${this.settings.tags.event}]`);
    }

    handler(eventName, element) {
        const eventModifiers = this.getEventModifiers(element);

        for (const [key, value] of Object.entries(eventModifiers)) {
            if (!this.eventType[key]) {
                continue;
            }

            const fn = this[this.eventType[key]];

            if (typeof fn !== 'function') {
                continue;
            }

            const resultFn = fn.apply(this, [eventName, element, value]);
            const revertTagData = element.getAttribute(`data-${this.settings.tags.event}-revert`);

            if (revertTagData && resultFn && typeof resultFn === 'function') {
                const ms = parseFloat(revertTagData) * 1000;

                setTimeout(() => {
                    resultFn();
                }, ms);
            }
        }
    }

    getEventModifiers(el) {
        const modifiers = {};

        for (const attr of el.attributes) {
            if (attr.name.startsWith(`data-${this.settings.tags.event}-`)) {
                const key = attr.name.slice(`data-${this.settings.tags.event}-`.length);
                modifiers[key] = attr.value;
            }
        }

        return modifiers;
    }

    handleHtml(_, element, value) {
        const oldValue = element.innerHTML;
        element.innerHTML = value;

        return () => element.innerHTML = oldValue;
    }

    handleText(_, element, value) {
        const oldValue = element.textContent;
        element.textContent = value;

        return () => element.textContent = oldValue;
    }

    handleAddClass(_, element, value) {
        element.classList.add(value);

        return () => element.classList.remove(value);
    }

    handleRemoveClass(_, element, value) {
        element.classList.remove(value);

        return () => element.classList.add(value);
    }

    handleToggleClass(_, element, value) {
        element.classList.toggle(value);

        return () => element.classList.toggle(value);
    }

    handleRemote(eventName, element, value) {
        const remote = new Remote({ eventName, element, value, config: this.settings });
        remote.handle();

        return null;
    }
}
