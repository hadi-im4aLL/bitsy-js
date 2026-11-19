import { Fragment } from "./fragment/fragment.js";

export class Roolith {
    constructor() {
        this.fragment = new Fragment();
    }

    run() {
        this.fragment.bootstrap();
    }
}
