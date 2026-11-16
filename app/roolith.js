import { View } from "./core/view.js";

export class Roolith {
    constructor(settings) {
        this.settings = {
            viewTag: `r-view`,
            viewCache: false,
            viewErrorClassName: `r-view-error`,
            enableEvents: true,
            eventNamePrefix: `r-view`,
            ...settings,
        };

        this._view = new View(this.settings);
    }

    run() {
        this._view.render();
    }

    onViewRendered(src, callback) {
        if (!this.settings.enableEvents) {
            throw new Error('RoolithJS: Event is disabled');
        }

        const matches = this.createViewMatcher(src);

        const handler = (event) => {
            if (matches(event.detail.url)) {
                const { url, nodes } = event.detail;

                callback({ url, nodes });
            }
        };

        document.addEventListener(`${this.settings.eventNamePrefix}:rendered`, handler);

        return () => document.removeEventListener(`${this.settings.eventNamePrefix}:rendered`, handler);
    }

    createViewMatcher(src) {
        if (src.includes("://")) {
            const target = new URL(src);

            return (url) => url.href === target.href;
        }

        const suffix = `/${src.replace(/^\.?\//, "")}`;

        return (url) => url.pathname.endsWith(suffix);
    }
}
