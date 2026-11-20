import { DataBind } from "./data-bind/data-bind.js";
import { Directive } from "./directives/directive.js";
import { Container } from "./fragment/container.js";
import { Fragment } from "./fragment/fragment.js";
import { Event } from "./utils/event.js";

export class BitsyJS {
    constructor(settings) {
        this.settings = settings ? { ...settings } : {};
        const globalData = this.settings.data ? { ...this.settings.data } : {};

        this.fragment = new Fragment();

        this.dataBind = new DataBind({
            globalData
        });

        this.directive = new Directive({
            globalData
        });

        this.container = new Container();
    }

    async run() {
        await this.fragment.bootstrap();
        this.dataBind.bootstrap();
        this.directive.bootstrap();

        this.container.flush();
        this.dataBind.flush();

        Event.dispatch('bitsy.render');
    }

    on(eventName, callback) {
        const name = `bitsy.${eventName}`;

        Event.listen(name, (_, arg) => {
            callback(arg);
        });

        return this;
    }

    ready(callback) {
        this.on('render', callback);
    }
}
