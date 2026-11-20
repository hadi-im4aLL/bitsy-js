import { parseTemplate } from "../utils/parse-template.js";

export class ConditionDirective {
    constructor() {
        this.globalData = {};
        this.config = {
            tag: `r-if`
        }
    }

    setGlobalData(globalData) {
        this.globalData = { ...globalData };
    }

    register(globalData) {
        this.setGlobalData(globalData);

        console.log(`condition directive init`);
    }
}
