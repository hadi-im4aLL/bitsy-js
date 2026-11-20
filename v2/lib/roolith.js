import { DataBind } from "./data-bind/data-bind.js";
import { Fragment } from "./fragment/fragment.js";

export class Roolith {
    constructor(settings) {
        this.settings = settings ? { ...settings } : {};

        this.dataBind = new DataBind({
            globalData: this.settings.data ? { ...this.settings.data } : {},
        });

        this.fragment = new Fragment();
    }

    run() {
        this.dataBind.bootstrap();
        this.fragment.bootstrap();
    }
}
