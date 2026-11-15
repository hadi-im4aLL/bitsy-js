import { View } from "./core/view.js";

export class Roolith {
    constructor(settings) {
        this.settings = {
            viewTag: 'r-view',
            viewCache: false,
            ...settings,
        };

        this._view = new View(this.settings);
    }

    run() {
        this._view.render();
    }
}
