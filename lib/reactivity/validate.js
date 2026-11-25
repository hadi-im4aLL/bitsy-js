import { castNumber } from "../utils/utils.js";

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
    }

    bootstrap() {
        console.log(this.settings);
        const forms = this.getForms();
        forms.forEach(form => {
            form.addEventListener("submit", (event) => {
                event.preventDefault();
                const isValid = this.validateForm(form);

                if (isValid) {
                    console.log("Form is valid");
                    // form.requestSubmit();
                }
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

        console.log(result);
        this.addOrRemoveClasses(result);

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

            if (typeof this[methodName] === "function") {
                const hasError = this[methodName](field, value);

                if (hasError) {
                    result.isValid = false;
                    result.errors.push(hasError);
                }
            }
        }

        return result;
    }

    validateRequired(field, value) {
        if (value && !field.value) {
            return this.config.messages.required;
        }

        return null;
    }

    validateEmail(field, value) {
        if (value && field.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) {
            return this.config.messages.email;
        }

        return null;
    }

    validateMin(field, value) {
        if (value && field.value && field.value.length < value) {
            return this.config.messages.min.replace("{min}", value);
        }

        return null;
    }

    validateMax(field, value) {
        if (value && field.value && field.value.length > value) {
            return this.config.messages.max.replace("{max}", value);
        }

        return null;
    }

    validatePattern(field, value) {
        if (value && field.value && !new RegExp(value).test(field.value)) {
            return this.config.messages.pattern;
        }

        return null;
    }

    validateLength(field, value) {
        if (value && field.value && field.value.length !== value) {
            return this.config.messages.length.replace("{length}", value);
        }

        return null;
    }

    validateTime(field, value) {
        if (value && field.value && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(field.value)) {
            return this.config.messages.time;
        }

        return null;
    }

    validateDate(field, value) {
        if (value && field.value && !/^\d{4}-\d{2}-\d{2}$/.test(field.value)) {
            return this.config.messages.date;
        }

        return null;
    }

    validateJsDate(field, value) {
        if (value && field.value && Number.isNaN(Date.parse(field.value))) {
            return this.config.messages.jsDate;
        }

        return null;
    }

    validateNumber(field, value) {
        if (value && field.value && Number.isNaN(Number(field.value))) {
            return this.config.messages.number;
        }

        return null;
    }

    validateInt(field, value) {
        if (value && field.value && !Number.isInteger(Number(field.value))) {
            return this.config.messages.int;
        }

        return null;
    }

    validateFloat(field, value) {
        if (value && field.value && Number.isNaN(Number(field.value))) {
            return this.config.messages.float;
        }

        return null;
    }

    validateBool(field, value) {
        if (value && field.value && typeof field.value !== "boolean") {
            return this.config.messages.bool;
        }

        return null;
    }

    validateSame(field, value) {
        const compareField = field.closest("form").querySelector(`[name="${value}"]`);
        if (!compareField) {
            return this.config.messages.same.replace("{field}", value);
        }

        if (value && field.value && field.value !== compareField.value) {
            return this.config.messages.same.replace("{field}", value);
        }

        return null;
    }

    validateRequiredIf(field, value) {
        console.log(field, value);
        // const [otherFieldName, expectedValue] = value.split(",");
        // const otherField = field.closest("form").querySelector(`[name="${otherFieldName}"]`);
        // if (!otherField) {
        //     return this.config.messages.requiredIf.replace("{field}", otherFieldName);
        // }

        // if (otherField.value === expectedValue && !field.value) {
        //     return this.config.messages.requiredIf.replace("{field}", otherFieldName);
        // }

        // return null;
    }
}