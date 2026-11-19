/**
 * An element whose content arrives from a remote response.
 *
 * @typedef {object} RemoteTarget
 * @property {Element} element
 * @property {string|null} source
 * @property {object} data
 */

/**
 * Collects the remote targets discovered by one render walk.
 *
 * A collector belongs to a single walk, so a walk that throws drops its own targets instead of leaving them for the next walk.
 */
export class RemoteTargetCollector {
    /**
     * Recorded targets, private so {@link RemoteTargetCollector#record} stays the only writer.
     *
     * @type {RemoteTarget[]}
     */
    #targets;

    /**
     * Creates an empty collector.
     */
    constructor() {
        this.#targets = [];
    }

    /**
     * Records a target in discovery order.
     *
     * @param {RemoteTarget} target
     */
    record(target) {
        this.#targets.push(target);
    }

    /**
     * Returns a snapshot of the recorded targets and empties the collector, so a drained collector cannot report its targets twice.
     *
     * @returns {RemoteTarget[]}
     */
    drain() {
        const targets = [...this.#targets];

        this.#targets = [];

        return targets;
    }
}
