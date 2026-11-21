import { DataBind } from "./data-bind/data-bind.js";
import { Directive } from "./directives/directive.js";
import { Container } from "./fragment/container.js";
import { Fragment } from "./fragment/fragment.js";
import { Event } from "./utils/event.js";

export class BitsyJS {
    constructor(settings) {
        this.config = {
            tags: {
                dataBind: `b-data`,
                forLoop: `b-for`,
                view: `b-view`,
                container: `b-container`,
                conditionIf: `b-if`,
                rawJs: `b-js`,
            },
            data: {}
        };

        this.settings = settings ? { ...this.config, ...settings } : { ...this.config };

        this.fragment = new Fragment({ ...this.settings });
        this.dataBind = new DataBind({ ...this.settings });
        this.directive = new Directive({ ...this.settings, dataBinder: this.dataBind });
        this.container = new Container({ ...this.settings });
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
