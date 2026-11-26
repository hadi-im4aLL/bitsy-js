import { castNumber } from "../utils/utils.js";
import { ValidateMethod } from "./validate-method.js";

export class Validate {
    constructor(settings) {
        this.settings = { root: document, ...settings };

        this.config = {
            classNames: {
                errorClassName: "error",
                successClassName: "success"
            },
            messages: {
                required: "This field is required",
                email: "Please enter a valid email address",
                min: "The value needs to be at least {min} characters",
                max: "The value needs to be at most {max} characters",
                number: "Please enter a valid number",
                bool: "Please enter a valid boolean",
                same: "The values do not match {field}",
                url: "Please enter a valid URL",
                date: "Please enter a valid date",
                jsDate: "Please enter a valid date",
                datetime: "Please enter a valid date and time",
                time: "Please enter a valid time",
                pattern: "Please enter a valid value matching the pattern",
                length: "The value must be exactly {length} characters",
                int: "Please enter a valid integer",
                float: "Please enter a valid float",
            },
            addClassToParent: true,
            addClassToField: true,
            isAjax: false,
            isAfterSubmitSwapHtml: false,
            swapHtmlSelector: null, // #template-element-id
            swapHtmlContent: null, // response data with only parseTemplate
        };

        this.formTag = this.settings.tags.validateForm;
        this.ruleTag = this.settings.tags.validateRule;
        this.messageTag = this.settings.tags.validateMessage;
        this.errorMessageTag = this.settings.tags.validateErrorMessage;

        this.validateMethod = new ValidateMethod({ ...this.config });
    }

    bootstrap() {
        const forms = this.getForms();

        forms.forEach(form => {
            form.addEventListener("submit", (event) => {
                const isValid = this.validateForm(form);

                if (!isValid) {
                    event.preventDefault();
                    return;
                }

                form.requestSubmit();
            });
        });
    }

    getForms() {
        return this.settings.root.querySelectorAll(`[${this.formTag}]`);
    }

    validateForm(form) {
        const rules = this.getRules(form);
        const result = [];

        for (const rule of rules) {
            result.push(this.validateRule(rule));
        }

        this.addOrRemoveClasses(result);
        this.addOrRemoveErrorMessages(result);

        return result.every(r => r.isValid);
    }

    addOrRemoveClasses(result) {
        const errorClassName = this.config.classNames.errorClassName;
        const successClassName = this.config.classNames.successClassName;

        for (const data of result) {
            const { field, isValid } = data;

            if (this.config.addClassToField) {
                if (isValid) {
                    field.classList.remove(errorClassName);
                    field.classList.add(successClassName);
                } else {
                    field.classList.remove(successClassName);
                    field.classList.add(errorClassName);
                }
            }

            if (this.config.addClassToParent) {
                const parent = field.parentElement;
                if (!parent) {
                    continue;
                }

                if (isValid) {
                    parent.classList.remove(errorClassName);
                    parent.classList.add(successClassName);
                } else {
                    parent.classList.remove(successClassName);
                    parent.classList.add(errorClassName);
                }
            }
        }
    }

    addOrRemoveErrorMessages(result) {
        for (const data of result) {
            const { field, isValid, errors } = data;
            const messageElement = field.closest("form").querySelector(`[${this.messageTag}="${field.name}"]`);

            if (!messageElement) {
                continue;
            }

            if (isValid) {
                messageElement.textContent = "";
            } else {
                const errorMessage = field.getAttribute(this.errorMessageTag);
                if (errorMessage) {
                    messageElement.textContent = errorMessage;
                    continue;
                }

                messageElement.textContent = errors.join(", ");
            }
        }
    }

    getRules(form) {
        const rules = [];
        const fields = form.querySelectorAll(`[${this.ruleTag}]`);

        for (const field of fields) {
            const rule = field.getAttribute(this.ruleTag);
            if (!rule) {
                continue;
            }

            const ruleArray = this.serializeRule(rule);

            rules.push({ field, rules: ruleArray });
        }

        return rules;
    }

    serializeRule(rule) {
        const arr = rule.split("|");
        const result = {};

        for (const item of arr) {
            const [key, value] = item.split(":");

            if (!value) {
                result[key] = true;
            } else {
                result[key] = castNumber(value);
            }
        }

        return result;
    }

    validateRule(ruleData) {
        const { field, rules } = ruleData;
        const result = { field, isValid: true, errors: [] };

        for (const key in rules) {
            const value = rules[key];
            const methodName = `validate${key.charAt(0).toUpperCase() + key.slice(1)}`;

            if (typeof this.validateMethod[methodName] === "function") {
                const hasError = this.validateMethod[methodName](field, value);

                if (hasError) {
                    result.isValid = false;
                    result.errors.push(hasError);
                }
            }
        }

        return result;
    }
}
