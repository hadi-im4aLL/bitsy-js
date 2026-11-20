import { ConditionDirective } from "./condition.directive.js";
import { ForLoopDirective } from "./for-loop.directive.js";

export class Directive {
    constructor(options) {
        this.options = options ? { ...options } : {};

        this.config = {
            globalData: this.options.globalData,
        }

        this.directives = [
            new ForLoopDirective(),
            new ConditionDirective(),
        ];
    }

    activate() {
        const globalData = { ...this.config.globalData };

        for (const directive of this.directives) {
            directive.register(globalData);
        }
    }

    bootstrap() {
        this.activate();
    }
}
