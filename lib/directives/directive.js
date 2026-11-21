import { ConditionDirective } from "./condition.directive.js";
import { ForLoopDirective } from "./for-loop.directive.js";
import { RawJSDirective } from "./raw-js.directive.js";

export class Directive {
    constructor(options) {
        this.options = options ? { ...options } : {};

        this.directives = [
            new ForLoopDirective(),
            new ConditionDirective(options.dataBinder),
            new RawJSDirective(options.dataBinder),
        ];
    }

    activate() {
        for (const directive of this.directives) {
            directive.register(this.options);
        }
    }

    bootstrap() {
        this.activate();
    }
}
