/**
 * Outcome of loading one resource for a render pass.
 *
 * A failed load is described rather than thrown, so several consumers can read one shared request without deciding the outcome for each other.
 *
 * @typedef {object} LoadedResource
 * @property {boolean} ok
 * @property {number} status
 * @property {string} content
 * @property {string} contentType
 * @property {Error|null} error
 */

/**
 * Loads resources over HTTP and shares one request per absolute URL inside a render pass.
 */
export class ResourceLoader {
    /**
     * Creates a loader from the resolved cache setting.
     *
     * @param {object} config
     * @param {boolean} config.useCache
     */
    constructor(config) {
        this.useCache = config.useCache;
    }

    /**
     * Loads a URL once per render pass.
     *
     * @param {URL} url
     * @param {Map<string, Promise<LoadedResource>>} [requests]
     * @returns {Promise<LoadedResource>}
     */
    async load(url, requests = new Map()) {
        if (!requests.has(url.href)) {
            requests.set(url.href, this.request(url));
        }

        return await requests.get(url.href);
    }

    /**
     * Loads a resource and turns a failed request into a contextual error.
     *
     * @param {URL} url
     * @param {Map<string, Promise<LoadedResource>>} requests
     * @param {string} resourceLabel
     * @returns {Promise<LoadedResource>}
     * @throws {Error} When the request failed or the response status was not successful.
     */
    async loadOrThrow(url, requests, resourceLabel) {
        const resource = await this.load(url, requests);

        if (resource.error !== null) {
            throw resource.error;
        }

        if (resource.ok === false) {
            throw new Error(
                `Failed to load ${resourceLabel} "${url.pathname}" (${resource.status})`,
            );
        }

        return resource;
    }

    /**
     * Performs one request and captures its outcome.
     *
     * A network failure is captured as well, so a shared request never rejects.
     *
     * @param {URL} url
     * @returns {Promise<LoadedResource>}
     */
    async request(url) {
        const options = {};

        if (this.useCache === false) {
            options["cache"] = "no-cache";
        }

        try {
            const response = await fetch(url, options);

            return {
                ok: response.ok,
                status: response.status,
                content: response.ok ? await response.text() : "",
                contentType: this.readContentType(response),
                error: null,
            };
        } catch (error) {
            return {
                ok: false,
                status: 0,
                content: "",
                contentType: "",
                error,
            };
        }
    }

    /**
     * Reads the media type of a response, dropping parameters and lower casing the value.
     *
     * @param {{headers: {get: (name: string) => string|null}}} response
     * @returns {string}
     */
    readContentType(response) {
        const header = response.headers.get("content-type") ?? "";

        return header.split(";")[0].trim().toLowerCase();
    }
}
