import { Directive } from '../directives/directive.js';
import { parseResponse } from '../utils/response.js';
import { parseTemplate } from '../utils/parse-template.js';

export class FormSubmissionHandler {
    constructor(settings, form, event) {
        this.settings = { ...settings };
        this.form = typeof form === 'string' ? document.querySelector(form) : form;
        this.event = event;

        this.isAjax = this.form.getAttribute(this.settings.tags.formAjax) === 'true';
        this.ajaxRenderSelector = this.form.getAttribute(this.settings.tags.formAjaxRender);
        this.removeOnSubmit = this.form.getAttribute(this.settings.tags.formRemoveOnSubmit) === 'true';
        this.isSubmitting = false;
        this.ajaxMethods = ['get', 'post', 'put', 'patch', 'delete'];
    }

    submit() {
        if (this.isAjax) {
            this.event.preventDefault();
            this.ajaxSubmit();
            return;
        }

        this.form.requestSubmit();
    }

    getFormParams() {
        return new URLSearchParams(new FormData(this.form));
    }

    removeForm() {
        if (!this.removeOnSubmit) {
            return;
        }

        this.form.remove();
    }

    getMethod() {
        const attributeMethod = (this.form.getAttribute('method') || '').trim().toLowerCase();
        const propertyMethod = (this.form.method || '').trim().toLowerCase();
        const method = this.ajaxMethods.includes(attributeMethod) ? attributeMethod : propertyMethod;

        return this.ajaxMethods.includes(method) ? method : 'get';
    }

    getRequestUrl(method, params) {
        const url = new URL(this.form.action || window.location.href, document.baseURI);

        if (method === 'get') {
            for (const [name, value] of params) {
                url.searchParams.append(name, value);
            }
        }

        return url.toString();
    }

    getRequestInit(method, params) {
        if (method === 'get') {
            return {
                method: 'GET'
            };
        }

        return {
            method: method.toUpperCase(),
            body: params,
        };
    }

    toggleSubmitControls(disabled) {
        if (!this.form.isConnected) {
            return;
        }

        const selector = 'button[type="submit"], input[type="submit"]';

        this.form.querySelectorAll(selector).forEach(control => {
            control.disabled = disabled;
        });
    }

    async ajaxSubmit() {
        if (this.isSubmitting) {
            return;
        }

        const target = this.ajaxRenderSelector ? document.querySelector(this.ajaxRenderSelector) : null;

        if (!target) {
            console.warn('No target element found for AJAX form submission.');
            return;
        }

        const method = this.getMethod();
        const params = this.getFormParams();

        this.isSubmitting = true;
        this.toggleSubmitControls(true);

        try {
            const response = await fetch(this.getRequestUrl(method, params), this.getRequestInit(method, params));
            const result = await parseResponse(response);

            this.renderResponse(target, result);
            this.removeForm();
        } catch (error) {
            console.error('Error submitting form:', error);
        } finally {
            this.isSubmitting = false;
            this.toggleSubmitControls(false);
        }
    }

    renderResponse(target, result) {
        const useTemplateTag = this.settings.tags.useTemplate;
        const templateId = target.getAttribute(useTemplateTag);
        const templateElement = templateId ? document.querySelector(templateId) : null;

        if (templateElement) {
            this.renderTemplate(templateElement, result, target);
            return;
        }

        if (typeof result === 'object') {
            target.innerHTML = JSON.stringify(result, null, 2);
            return;
        }

        target.innerHTML = result;
    }

    renderTemplate(templateElement, result, targetElement) {
        const varName = templateElement.getAttribute(this.settings.tags.remoteData);
        const data = {};
        data[varName] = result;

        const configData = { ...this.settings };
        configData.data = { ...data };

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
        const directive = new Directive({ ...configData, dataBinder: this.settings.dataBinder, root: fragment });
        directive.bootstrap();
    }
}
