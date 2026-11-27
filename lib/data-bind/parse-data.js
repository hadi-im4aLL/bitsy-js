export function parseData(text) {
    if (typeof text !== "string") {
        throw new TypeError("Data must be a string");
    }

    const source = text.trim();

    if (source === "") {
        return {};
    }

    return parseNested(evaluate(source, text));
}

function evaluate(source, original) {
    try {
        return new Function(`return (${source})`)();
    } catch (error) {
        throw new SyntaxError(`Invalid data string: ${original}`, { cause: error });
    }
}

function parseNested(value) {
    if (Array.isArray(value)) {
        return value.map(parseNested);
    }

    if (value !== null && typeof value === "object") {
        for (const key of Object.keys(value)) {
            value[key] = parseNested(value[key]);
        }

        return value;
    }

    if (typeof value === "string") {
        return parseNestedString(value);
    }

    return value;
}

function parseNestedString(value) {
    const source = value.trim();

    if (!/^[{[]/.test(source)) {
        return value;
    }

    try {
        return parseNested(evaluate(source, value));
    } catch {
        return value;
    }
}
