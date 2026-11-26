import { ConditionDirective } from "./condition.directive.js";
import { ForLoopDirective } from "./for-loop.directive.js";
import { RawJSDirective } from "./raw-js.directive.js";

export class Directive {
    constructor(options) {
        const defaultOptions = {
            root: document,
        };

        this.options = options ? { ...defaultOptions, ...options } : { ...defaultOptions };

        this.directives = [new ForLoopDirective(), new ConditionDirective(), new RawJSDirective()];
    }

    bootstrap() {
        this.activate();
    }

    activate() {
        for (const directive of this.directives) {
            directive.register(this.options);
        }
    }
}
