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
            return { method: 'GET' };
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
            target.innerHTML = await response.text();

            this.removeForm();
        } catch (error) {
            console.error('Error submitting form:', error);
        } finally {
            this.isSubmitting = false;
            this.toggleSubmitControls(false);
        }
    }
}
