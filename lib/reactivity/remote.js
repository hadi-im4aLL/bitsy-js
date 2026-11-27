import { parseResponse } from "../utils/response.js";

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
            throw new Error(`HTTP ${res.status} ${res.statusText} - ${body}`);
        }

        return await parseResponse(res);
    }

    async handle() {
        const { _, element, value } = this.settings;

        const requireConfirm = element.hasAttribute(`${this.eventAttrPrefix}-confirm`);
        if (requireConfirm) {
            const confirmMessage = element.getAttribute(`${this.eventAttrPrefix}-confirm`);

            if (!window.confirm(confirmMessage)) {
                return;
            }
        }

        const removeIndicator = this.addLoadingIndicator(element);

        try {
            const fetchOption = {
                method: element.getAttribute(`${this.eventAttrPrefix}-remote-method`) || this.settings.remoteMethod,
                headers: {},
            };

            if (fetchOption.method.toUpperCase() !== "GET") {
                const payload = element.getAttribute(`${this.eventAttrPrefix}-remote-payload`);

                if (payload) {
                    fetchOption.body = JSON.stringify(JSON.parse(payload));

                    const remoteContent =
                        element.getAttribute(`${this.eventAttrPrefix}-remote-content`) || this.settings.remoteContent;

                    if (remoteContent === "json") {
                        fetchOption.headers["Content-Type"] = "application/json";
                    }
                }
            }

            const result = await this.callApi(value, fetchOption);
            this.renderResult(element, result);
        } catch (error) {
            console.error("Remote request failed:", error);
        } finally {
            removeIndicator();
        }
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
        const indicatorClass = element.getAttribute(`${this.eventAttrPrefix}-indicator`) || this.settings.indicator;

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
