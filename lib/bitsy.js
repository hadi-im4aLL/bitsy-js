import { DataBind } from "./data-bind/data-bind.js";
import { Directive } from "./directives/directive.js";
import { Container } from "./fragment/container.js";
import { Fragment } from "./fragment/fragment.js";
import { EventHandler } from "./reactivity/event-handler.js";
import { Event } from "./utils/event.js";
import { Validate } from "./reactivity/validate.js";

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
                event: `b-event`,
                remoteData: `data-b-remote-data`,
                useTemplate: `data-b-use-template`,
                keepExisting: `data-b-keep-existing`,
                validateForm: `data-b-validate-form`,
                validateRule: `data-b-validate`,
                validateMessage: `data-b-validate-message`
            },
            data: {}
        };

        this.settings = settings ? { ...this.config, ...settings } : { ...this.config };

        this.fragment = new Fragment({ ...this.settings });
        this.dataBind = new DataBind({ ...this.settings });
        this.directive = new Directive({ ...this.settings, dataBinder: this.dataBind });
        this.container = new Container({ ...this.settings });
        this.eventHandler = new EventHandler({ ...this.settings, dataBinder: this.dataBind });
        this.validate = new Validate({ ...this.settings });
    }

    async run() {
        await this.fragment.bootstrap();
        this.dataBind.bootstrap();
        this.directive.bootstrap();
        this.container.flush();
        this.dataBind.flush();
        this.eventHandler.listen();
        this.validate.bootstrap();

        Event.dispatch('bitsy.rendered');
    }

    on(eventName, callback) {
        const name = `bitsy.${eventName}`;

        Event.listen(name, (_, arg) => {
            callback(arg);
        });

        return this;
    }

    ready(callback) {
        this.on('rendered', callback);
    }
}
