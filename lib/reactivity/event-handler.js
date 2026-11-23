export class EventHandler {
    constructor(settings = {}) {
        this.settings = { ...settings };

        this.eventType = {
            html: `handleHtml`,
            text: `handleText`,
            'add-class': `handleAddClass`,
            'remove-class': `handleRemoveClass`,
            'toggle-class': `handleToggleClass`,
        };
    }

    listen() {
        const elements = this.getAllElements();

        for (const element of elements) {
            const eventName = element.getAttribute(`data-${this.settings.tags.event}`);
            const handler = () => this.handler(eventName, element);

            element.addEventListener(eventName, handler);
        }
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

            const resultFn = fn.apply(element, [eventName, element, value]);
            const revertTagData = element.getAttribute(`data-${this.settings.tags.event}-revert`);

            if (revertTagData) {
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
        const oldValue = element.innerHTML;
        element.innerText = value;

        return () => element.innerHTML = oldValue;
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
}
