import { DataBind } from "./data-bind/data-bind.js";
import { Fragment } from "./fragment/fragment.js";

export class Roolith {
    constructor() {
        this.dataBind = new DataBind();
        this.fragment = new Fragment();
    }

    run() {
        this.dataBind.bootstrap();
        this.fragment.bootstrap();
    }
}
