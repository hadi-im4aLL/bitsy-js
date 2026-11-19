/**
 * Values a derived render pass may change.
 *
 * @typedef {object} RenderPassDerivation
 * @property {string|URL|null} [ancestorUrl]
 * @property {object} [data]
 */

/**
 * Value object threaded through one render pass: the ancestor chain, the data scope, and the per-pass request map.
 *
 * This class is the only writer of the pass shape, so a new field lands here and every consumer follows.
 */
export class RenderPass {
    /**
     * Creates a pass from the state it carries.
     *
     * @param {object} values
     * @param {Set<string>} values.ancestors
     * @param {object} values.data
     * @param {Map<string, Promise<import("./resource-loader.js").LoadedResource>>} values.requests
     */
    constructor({ ancestors, data, requests }) {
        this.ancestors = ancestors;
        this.data = data;
        this.requests = requests;
    }

    /**
     * Creates a fresh pass with an empty ancestor chain and its own request map.
     *
     * @param {object} [options]
     * @param {object} [options.hostData]
     * @returns {RenderPass}
     */
    static create({ hostData = {} } = {}) {
        return new RenderPass({
            ancestors: new Set(),
            data: hostData,
            requests: new Map(),
        });
    }

    /**
     * Derives the pass of content declared by the document this pass renders.
     *
     * The ancestor set is copied and the request map is shared, so one URL still loads once per pass.
     *
     * @param {RenderPassDerivation} [values]
     * @returns {RenderPass}
     */
    derive({ ancestorUrl = null, data = this.data } = {}) {
        const ancestors = new Set(this.ancestors);

        if (ancestorUrl !== null) {
            ancestors.add(String(ancestorUrl));
        }

        return new RenderPass({ ancestors, data, requests: this.requests });
    }
}
