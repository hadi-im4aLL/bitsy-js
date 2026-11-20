export class ConditionDirective {
    constructor() {
        this.globalData = {};
        this.config = {
            tag: `r-if`
        };
        this.data = [];
    }

    setGlobalData(globalData) {
        this.globalData = { ...globalData };
    }

    setTag(tag) {
        this.config.tag = tag;
    }

    register(settings) {
        this.setGlobalData(settings.data);
        this.setTag(settings.tags.conditionIf);

        this.process();
    }

    process() {
        const elements = this.getAllElements();

        console.log(elements);

    }

    getAllElements() {
        return document.querySelectorAll(`[${this.config.tag}]`);
    }
}
