import { LifeCycle } from "./core/lifecycle.js";
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
        this._lifeCycle = new LifeCycle(this.settings);
    }

    async run() {
        await this._view.render();
    }

    onViewRendered(src, callback) {
        return this._lifeCycle.onViewRendered(src, callback);
    }
}
