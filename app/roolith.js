import { LifeCycle } from "./view/life-cycle.js";
import { View } from "./view/view.js";

/**
 * Configuration accepted by the {@link Roolith} constructor.
 *
 * @typedef {object} RoolithSettings
 * @property {string} [viewTag]
 * @property {string} [loopAttribute]
 * @property {string} [ifAttribute]
 * @property {string} [elseAttribute]
 * @property {string} [dataAttribute]
 * @property {string} [remoteAttribute]
 * @property {boolean} [viewCache]
 * @property {string} [viewErrorClassName]
 * @property {boolean} [enableEvents]
 * @property {string} [eventNamePrefix]
 * @property {object} [data]
 */

/**
 * Entry point of the library: wires the view renderer and the lifecycle event helpers together.
 */
export class Roolith {
    /**
     * Creates a Roolith instance with defaults merged with the given settings.
     *
     * @param {RoolithSettings} [settings]
     */
    constructor(settings) {
        this.settings = {
            viewTag: `r-view`,
            loopAttribute: `r-for`,
            ifAttribute: `r-if`,
            elseAttribute: `r-else`,
            dataAttribute: `r-data`,
            remoteAttribute: `r-remote`,
            viewCache: false,
            viewErrorClassName: `r-view-error`,
            enableEvents: true,
            eventNamePrefix: `r-view`,
            data: {},
            ...settings,
        };

        this._view = new View(this.settings);
        this._lifeCycle = new LifeCycle(this.settings);
    }

    /**
     * Renders every view declared in the document, including nested views.
     *
     * @returns {Promise<void>}
     */
    async run() {
        await this._view.render();
    }

    /**
     * Subscribes to the render event of one or more views.
     *
     * @param {string|string[]} src
     * @param {(detail: {url: URL, nodes: Node[]}) => void} callback
     * @returns {() => void}
     */
    onViewRendered(src, callback) {
        return this._lifeCycle.onViewRendered(src, callback);
    }
}
