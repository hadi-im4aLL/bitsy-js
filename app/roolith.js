import { View } from "./core/view.js";

export class Roolith {
    constructor(settings) {
        this.settings = {
            viewTag: `r-view`,
            viewCache: false,
            viewErrorClassName: `r-view-error`,
            ...settings,
        };

        this._view = new View(this.settings);
    }

    run() {
        this._view.render();
    }

    onViewRendered(src, callback) {
        document.addEventListener("r-view:rendered", (event) => {
            console.log(event.detail.src);

            if (event.detail.src === src) {
                callback(event.detail);
            }
        });
    }
}
