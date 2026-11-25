import { Directive } from "../directives/directive.js";
import { parseTemplate } from "../utils/parse-template.js";

export class Remote {
    constructor(settings) {
        /*
        data-b-event-target="#user-data"
        data-b-event-remote-method="GET"
        data-b-event-remote-payload="{ 'id': 1 }"
        data-b-event-remote-content="json"
        data-b-event-indicator="is--loading"
        data-b-event-confirm="Are you sure?"
        data-b-event-debounce="1s"
        data-b-event-emit="jsonUserLoaded"
        */

        this.settings = {
            remoteMethod: "GET",
            target: null,
            remoteContent: "json",
            indicator: "is--loading",
            confirm: null,
            debounce: null,
            emit: null,
            ...settings,
        };

        this.eventAttrPrefix = `data-${this.settings.config.tags.event}`;
    }

    async callApi(url, options = {}) {
        const res = await fetch(url, options);

        if (!res.ok) {
            const body = await res.text();
            throw new Error(`HTTP ${res.status} ${res.statusText} — ${body}`);
        }

        const type = (res.headers.get("content-type") || "").toLowerCase();

        if (type.includes("json")) {
            return await res.json();
        }

        if (type.includes("html") || type.startsWith("text/")) {
            return await res.text();
        }

        if (type.includes("image/")) {
            return await res.blob();
        }

        const text = await res.text();

        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }

    async handle() {
        const { eventName, element, value } = this.settings;

        const fetchOption = {
            method:
                element.getAttribute(`${this.eventAttrPrefix}-remote-method`) ||
                this.settings.remoteMethod,
            header:
                element.getAttribute(`${this.eventAttrPrefix}-remote-content`) === "json"
                    ? {
                          "Content-Type": "application/json",
                      }
                    : {},
        };

        if (fetchOption.method.toUpperCase() !== "GET") {
            const payload = element.getAttribute(`${this.eventAttrPrefix}-remote-payload`);
            fetchOption.body = payload ? JSON.stringify(JSON.parse(payload)) : null;
        }

        const removeIndicator = this.addLoadingIndicator(element);
        const result = await this.callApi(value, fetchOption);
        this.renderResult(element, result);

        removeIndicator();
    }

    renderResult(element, result) {
        const targetElement = this.getTargetElement(element);

        if (!targetElement) {
            return;
        }

        const useTemplateTag = this.settings.config.tags.useTemplate;
        const templateId = targetElement.getAttribute(useTemplateTag);
        const templateElement = templateId ? document.querySelector(templateId) : null;

        if (templateElement) {
            this.renderTemplate(templateElement, result, targetElement);
        } else {
            if (typeof result === "object") {
                targetElement.innerHTML = JSON.stringify(result, null, 2);
            } else {
                targetElement.innerHTML = result;
            }
        }
    }

    renderTemplate(templateElement, result, targetElement) {
        const varName = templateElement.getAttribute(this.settings.config.tags.remoteData);
        const data = {};
        data[varName] = result;

        const configData = { ...this.settings.config };
        configData.data = { ...data };

        // data bind
        const newTemplateElementContent = parseTemplate(templateElement.innerHTML, data);
        templateElement.innerHTML = newTemplateElementContent;

        // directive
        const fragment = templateElement.content.cloneNode(true);
        const hasAnyDirectives = fragment.querySelectorAll(`[${configData.tags.forLoop}], [${configData.tags.conditionIf}]`).length > 0;
        if (hasAnyDirectives) {
            this.renderDirectives(fragment, configData);
        }

        // append or replace
        const isKeepExistingContent = targetElement.hasAttribute(configData.tags.keepExisting);
        if (isKeepExistingContent) {
            targetElement.append(fragment);
        } else {
            targetElement.replaceChildren(fragment);
        }
    }

    renderDirectives(fragment, configData) {
        const directive = new Directive({ ...configData, dataBinder: this.settings.config.dataBinder, root: fragment });
        directive.bootstrap();
    }

    addLoadingIndicator(element) {
        const target = this.getTargetElement(element) || element;
        const indicatorClass =
            element.getAttribute(`${this.eventAttrPrefix}-indicator`) || this.settings.indicator;

        if (indicatorClass && target) {
            target.classList.add(indicatorClass);

            return () => target.classList.remove(indicatorClass);
        }

        return () => {};
    }

    getTargetElement(element) {
        const targetSelector = element.getAttribute(`${this.eventAttrPrefix}-target`);
        const targetElement = targetSelector ? document.querySelector(targetSelector) : null;

        return targetElement || null;
    }
}
