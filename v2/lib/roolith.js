import { DataBind } from "./data-bind/data-bind.js";
import { Directive } from "./directives/directive.js";
import { Fragment } from "./fragment/fragment.js";

export class Roolith {
    constructor(settings) {
        this.settings = settings ? { ...settings } : {};
        const globalData = this.settings.data ? { ...this.settings.data } : {};

        this.dataBind = new DataBind({
            globalData
        });

        this.directive = new Directive({
            globalData
        });

        this.fragment = new Fragment();
    }

    run() {
        this.dataBind.bootstrap();
        this.directive.bootstrap();
        this.fragment.bootstrap();
    }
}
