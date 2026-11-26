import { parseResponse } from "../utils/response.js";

/**
 * data-b-event-target="#user-data"
 * data-b-event-remote-method="GET"
 * data-b-event-remote-payload="{ 'id': 1 }"
 * data-b-event-remote-content="json"
 * data-b-event-indicator="is--loading"
 * data-b-event-confirm="Are you sure?"
 * data-b-event-debounce="1s"
 * data-b-event-emit="jsonUserLoaded"
 */
export class Remote {
    constructor(settings) {
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

        return await parseResponse(res);
    }

    async handle() {
        const { _, element, value } = this.settings;

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

        this.settings.config.templateRenderer.render(targetElement, result);
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
