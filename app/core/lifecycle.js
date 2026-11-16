export class LifeCycle {
    constructor(settings) {
        this.settings = { ...settings };
    }

    onViewRendered(src, callback) {
        if (!this.settings.enableEvents) {
            throw new Error('RoolithJS: Event is disabled');
        }

        const sources = Array.isArray(src) ? src : [src];
        const matchers = sources.map((source) => this.createViewMatcher(source));
        const eventName = `${this.settings.eventNamePrefix}:rendered`;

        const handler = (event) => {
            if (!matchers.some((matches) => matches(event.detail.url))) {
                return;
            }

            const { url, nodes } = event.detail;

            callback({ url, nodes });
        };

        document.addEventListener(eventName, handler);

        return () => document.removeEventListener(eventName, handler);
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
