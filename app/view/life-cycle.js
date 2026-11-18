/**
 * Builds subscriptions to the view lifecycle events dispatched by the renderer, matching the events of specific view sources.
 */
export class LifeCycle {
    /**
     * Creates a lifecycle helper from the merged Roolith settings.
     *
     * @param {import("../roolith.js").RoolithSettings} settings
     */
    constructor(settings) {
        this.settings = { ...settings };
    }

    /**
     * Subscribes to render events of one or more views.
     *
     * @param {string|string[]} src
     * @param {(detail: {url: URL, nodes: Node[]}) => void} callback
     * @returns {() => void} Function that removes the subscription when called.
     * @throws {Error} When lifecycle events are disabled.
     */
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

    /**
     * Creates a predicate that decides whether a rendered view URL belongs to a source.
     *
     * Absolute sources are compared exactly, while relative sources match any URL whose path ends with the source path.
     *
     * @param {string} src
     * @returns {(url: URL) => boolean}
     */
    createViewMatcher(src) {
        if (src.includes("://")) {
            const target = new URL(src);

            return (url) => url.href === target.href;
        }

        const suffix = `/${src.replace(/^\.?\//, "")}`;

        return (url) => url.pathname.endsWith(suffix);
    }
}
