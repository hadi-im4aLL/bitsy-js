import { Directive } from "../directives/directive.js";
import { parseTemplate } from "../utils/parse-template.js";

export class TemplateRenderer {
    constructor(config) {
        this.config = config ? { ...config } : {};
    }

    render(targetElement, result) {
        const templateElement = this.getTemplateElement(targetElement);

        if (templateElement) {
            this.renderTemplate(templateElement, result, targetElement);
            return;
        }

        targetElement.innerHTML = typeof result === "object" ? JSON.stringify(result, null, 2) : result;
    }

    getTemplateElement(targetElement) {
        const templateId = targetElement.getAttribute(this.config.tags.useTemplate);

        return templateId ? document.querySelector(templateId) : null;
    }

    renderTemplate(templateElement, result, targetElement) {
        const varName = templateElement.getAttribute(this.config.tags.remoteData);
        const data = {};
        data[varName] = result;

        const configData = { ...this.config, data: { ...data } };

        // data bind
        const newTemplateElementContent = parseTemplate(templateElement.innerHTML, data);
        templateElement.innerHTML = newTemplateElementContent;

        // directive
        const fragment = templateElement.content.cloneNode(true);
        const hasAnyDirectives = fragment.querySelectorAll(`[${configData.tags.forLoop}], [${configData.tags.conditionIf}]`).length > 0;
        if (hasAnyDirectives) {
            this.renderDirectives(fragment, configData);
        }

        // append or replace
        const isKeepExistingContent = targetElement.hasAttribute(configData.tags.keepExisting);
        if (isKeepExistingContent) {
            targetElement.append(fragment);
        } else {
            targetElement.replaceChildren(fragment);
        }
    }

    renderDirectives(fragment, configData) {
        const directive = new Directive({ ...configData, dataBinder: this.config.dataBinder, root: fragment });
        directive.bootstrap();
    }
}
