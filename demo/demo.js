import { Roolith } from "../app/roolith.js";

/**
 * Starts a demo page by rendering its views through one configured Roolith
 * instance and exposing that instance on `window.Roolith`.
 *
 * A page that needs lifecycle events subscribes in `setup`, because `run()`
 * dispatches those events and a listener added afterwards receives nothing.
 *
 * @param {object} [options]
 * @param {object} [options.data] Root data every view of the page inherits.
 * @param {(roolith: import("../app/roolith.js").Roolith) => void} [options.setup] Runs before the render pass, so the page can subscribe to lifecycle events.
 * @returns {Promise<import("../app/roolith.js").Roolith>} Instance after the render pass finished.
 */
export async function startDemo({ data = {}, setup } = {}) {
    const roolith = new Roolith({ data });

    if (typeof setup === "function") {
        setup(roolith);
    }

    await roolith.run();

    window.Roolith = roolith;

    return roolith;
}
