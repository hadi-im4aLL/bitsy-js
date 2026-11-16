import { LifeCycle } from "./core/lifecycle.js";
import { View } from "./core/view.js";

/**
 * Configuration accepted by the {@link Roolith} constructor.
 *
 * @typedef {object} RoolithSettings
 * @property {string} [viewTag] Tag name used to declare a view placeholder in markup.
 * @property {boolean} [viewCache] Whether view requests may be served from the HTTP cache.
 * @property {string} [viewErrorClassName] Class name applied to the element that replaces a failed view.
 * @property {boolean} [enableEvents] Whether view lifecycle events are dispatched and subscribable.
 * @property {string} [eventNamePrefix] Prefix used when naming dispatched lifecycle events.
 */

/**
 * Entry point of the library: wires the view renderer and the lifecycle event helpers
 * together and exposes a single instance oriented API for the host page.
 */
export class Roolith {
    /**
     * Creates a Roolith instance with defaults merged with the given settings.
     *
     * @param {RoolithSettings} [settings] Optional overrides for the default settings.
     */
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
        this._lifeCycle = new LifeCycle(this.settings);
    }

    /**
     * Renders every view declared in the document, including nested views.
     *
     * @returns {Promise<void>} Resolves once all views have been rendered or replaced with errors.
     */
    async run() {
        await this._view.render();
    }

    /**
     * Subscribes to the render event of one or more views.
     *
     * @param {string|string[]} src View source path or absolute URL, matching the `src` attribute.
     * @param {(detail: {url: URL, nodes: Node[]}) => void} callback Invoked with the rendered view URL and nodes.
     * @returns {() => void} Function that removes the subscription when called.
     */
    onViewRendered(src, callback) {
        return this._lifeCycle.onViewRendered(src, callback);
    }
}
