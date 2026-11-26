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

    getFieldValue(field) {
        if (!field) {
            return "";
        }

        const value = field.value;

        if (typeof value === "string") {
            return value;
        }

        if (value === null || value === undefined) {
            return "";
        }

        return String(value);
    }

    findFieldByName(field, name) {
        const form = field.form || (typeof field.closest === "function" ? field.closest("form") : null);
        const found = form && form.elements ? form.elements.namedItem(name) : null;

        if (!found) {
            return null;
        }

        if (typeof found.value === "string") {
            return found;
        }

        if (typeof found.length === "number") {
            return found.length > 0 ? found[0] : null;
        }

        return null;
    }

    isRadioGroupChecked(field) {
        const form = field.form;

        if (!form || !field.name) {
            return Boolean(field.checked);
        }

        const group = form.elements.namedItem(field.name);

        if (!group || typeof group.length !== "number") {
            return Boolean(field.checked);
        }

        for (let index = 0; index < group.length; index += 1) {
            if (group[index].checked) {
                return true;
            }
        }

        return false;
    }

    validateRequired(field, value) {
        if (!value) {
            return null;
        }

        if (field.type === "checkbox") {
            return field.checked ? null : this.config.messages.required;
        }

        if (field.type === "radio") {
            return this.isRadioGroupChecked(field) ? null : this.config.messages.required;
        }

        const current = this.getFieldValue(field).trim();

        return current ? null : this.config.messages.required;
    }

    validateEmail(field, value) {
        if (!value) {
            return null;
        }

        const email = this.getFieldValue(field).trim();

        if (!email) {
            return null;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return this.config.messages.email;
        }

        return null;
    }

    validateMin(field, value) {
        if (!value) {
            return null;
        }

        const current = this.getFieldValue(field);

        if (current && current.length < value) {
            return this.config.messages.min.replace("{min}", value);
        }

        return null;
    }

    validateMax(field, value) {
        if (!value) {
            return null;
        }

        const current = this.getFieldValue(field);

        if (current && current.length > value) {
            return this.config.messages.max.replace("{max}", value);
        }

        return null;
    }

    validatePattern(field, value) {
        if (!value) {
            return null;
        }

        const current = this.getFieldValue(field);

        if (!current) {
            return null;
        }

        if (!new RegExp(value).test(current)) {
            return this.config.messages.pattern;
        }

        return null;
    }

    validateLength(field, value) {
        if (!value) {
            return null;
        }

        const current = this.getFieldValue(field);

        if (current && current.length !== value) {
            return this.config.messages.length.replace("{length}", value);
        }

        return null;
    }

    validateTime(field, value) {
        if (!value) {
            return null;
        }

        const current = this.getFieldValue(field).trim();

        if (!current) {
            return null;
        }

        const timePattern = /^(?:(?:[01]\d|2[0-3]|[1-9]):[0-5]\d|(?:0?[1-9]|1[0-2]):[0-5]\d ?(?:a\.?m\.?|p\.?m\.?))$/i;

        if (!timePattern.test(current)) {
            return this.config.messages.time;
        }

        return null;
    }

    parseDateValue(value, pattern) {
        const tokens = {
            Y: { source: "(\\d{4})", part: "year" },
            m: { source: "(1[0-2]|0?[1-9])", part: "month" },
            d: { source: "(3[01]|[12]\\d|0?[1-9])", part: "day" }
        };

        const order = [];
        let source = "";

        for (const character of pattern) {
            const token = tokens[character];

            if (!token) {
                source += character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                continue;
            }

            source += token.source;
            order.push(token.part);
        }

        const match = new RegExp(`^${source}$`).exec(value);

        if (!match) {
            return null;
        }

        const parts = {};

        order.forEach((part, index) => {
            parts[part] = Number(match[index + 1]);
        });

        return parts;
    }

    isRealDate(year, month, day) {
        if (!year || !month || !day) {
            return false;
        }

        const date = new Date(0);
        date.setUTCFullYear(year, month - 1, day);

        return date.getUTCFullYear() === year &&
            date.getUTCMonth() === month - 1 &&
            date.getUTCDate() === day;
    }

    validateDate(field, value) {
        if (!value) {
            return null;
        }

        const current = this.getFieldValue(field).trim();

        if (!current) {
            return null;
        }

        // date:d/m/Y uses the supplied pattern, date / date:true fall back to the strict Y-m-d shape
        const isPattern = typeof value === "string" && /^[Ymd\s/,.-]+$/.test(value);

        if (!isPattern && !/^\d{4}-\d{2}-\d{2}$/.test(current)) {
            return this.config.messages.date;
        }

        const parts = this.parseDateValue(current, isPattern ? value : "Y-m-d");

        if (!parts || !this.isRealDate(parts.year, parts.month, parts.day)) {
            return this.config.messages.date;
        }

        return null;
    }

    validateJsDate(field, value) {
        if (!value) {
            return null;
        }

        const current = this.getFieldValue(field).trim();

        if (!current) {
            return null;
        }

        if (Number.isNaN(Date.parse(current))) {
            return this.config.messages.jsDate;
        }

        return null;
    }

    validateNumber(field, value) {
        if (!value) {
            return null;
        }

        const current = this.getFieldValue(field).trim();

        if (!current) {
            return null;
        }

        if (!Number.isFinite(Number(current))) {
            return this.config.messages.number;
        }

        return null;
    }

    validateInt(field, value) {
        if (!value) {
            return null;
        }

        const current = this.getFieldValue(field).trim();

        if (!current) {
            return null;
        }

        const numeric = Number(current);

        if (!Number.isFinite(numeric) || !Number.isInteger(numeric)) {
            return this.config.messages.int;
        }

        return null;
    }

    validateFloat(field, value) {
        if (!value) {
            return null;
        }

        const current = this.getFieldValue(field).trim();

        if (!current) {
            return null;
        }

        if (!Number.isFinite(Number(current))) {
            return this.config.messages.float;
        }

        return null;
    }

    validateBool(field, value) {
        if (!value) {
            return null;
        }

        if (field.type === "checkbox" || field.type === "radio") {
            return null;
        }

        const current = this.getFieldValue(field).trim().toLowerCase();

        if (!current) {
            return null;
        }

        const accepted = ["true", "false", "1", "0", "yes", "no", "on", "off"];

        if (!accepted.includes(current)) {
            return this.config.messages.bool;
        }

        return null;
    }

    validateSame(field, value) {
        if (!value) {
            return null;
        }

        const current = this.getFieldValue(field);

        if (!current) {
            return null;
        }

        const compareField = this.findFieldByName(field, value);

        if (!compareField || this.getFieldValue(compareField) !== current) {
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
