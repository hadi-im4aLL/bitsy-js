import { readDataPath } from "./interpolate.js";
import {
    STRING_LITERAL_PATTERN,
    quoteText,
    unquote,
} from "./string-literal.js";

/**
 * Lexer pattern matching one token of an object literal at the current index.
 *
 * The pattern is stateful: it uses the sticky `y` flag, so `lastIndex` both
 * decides where matching starts and advances to the end of the match. String
 * literals come from the shared fragment, so keys and values follow the same
 * quoting and escape rules as expression strings.
 */
const TOKEN_PATTERN = new RegExp(
    String.raw`\s*(?:(?<string>${STRING_LITERAL_PATTERN})|(?<punctuation>[{}:,])|(?<number>-?\d+(?:\.\d+)?)|(?<word>[A-Za-z_$][\w$]*(?:\.[\w$]+)*))`,
    "y",
);

/**
 * Key named after the prototype accessor, which assignment cannot store.
 *
 * Assigning this key on a plain object sets the prototype instead of creating an
 * own property, so the declared data would be dropped silently.
 */
const PROTOTYPE_KEY = "__proto__";

/**
 * Parses the object literal declared by a data attribute and resolves its values
 * against parent data.
 *
 * The grammar is deliberately narrow so it can never execute code:
 *
 * ```text
 * object := "{" [pair ("," pair)* [","]] "}"
 * pair   := key ":" value
 * key    := identifier | quoted string
 * value  := quoted string | number | true | false | null | dotted data path
 * ```
 *
 * Unquoted words are resolved as data paths, so `{ title: heading }` reads
 * `heading` from the parent scope while `{ title: 'heading' }` is the literal
 * string. Values are resolved independently against parent data, never against
 * keys declared earlier in the same object, and a path that does not resolve is an
 * error so typos stay visible. Nested objects and arrays are not supported; model
 * structured data in the JavaScript `data` option and reference it by path.
 *
 * @example
 * parseDataObject("{ title: heading, count: 2, featured: true }", { heading: "Products" });
 * // { title: "Products", count: 2, featured: true }
 *
 * @param {string} source Object literal text, including its braces.
 * @param {object} data Data the unquoted paths are resolved against.
 * @returns {object} Object with one resolved value per declared key.
 * @throws {Error} When the literal is malformed, declares the `__proto__` key, or a path does not resolve.
 */
export function parseDataObject(source, data) {
    const tokens = tokenize(source);
    const reader = { tokens, index: 0 };
    const result = parsePairs(reader, data);

    if (reader.index < tokens.length) {
        throw new Error(
            `Invalid data object: unexpected ${describeToken(peek(reader))} after "}"`,
        );
    }

    return result;
}

/**
 * Tokenizes an object literal into strings, numbers, words, and punctuation.
 *
 * @param {string} source Object literal text.
 * @returns {Array<{type: string, raw: string, value: unknown}>} Tokens in source order.
 * @throws {Error} When the source contains an unsupported character.
 */
function tokenize(source) {
    const tokens = [];
    let index = 0;

    while (source.slice(index).trim() !== "") {
        TOKEN_PATTERN.lastIndex = index;

        const match = TOKEN_PATTERN.exec(source);

        if (!match) {
            const start = index + source.slice(index).search(/\S/);

            throw new Error(
                `Invalid data object: unexpected character ${quoteText(source[start])}`,
            );
        }

        index = TOKEN_PATTERN.lastIndex;
        tokens.push(createToken(match.groups));
    }

    return tokens;
}

/**
 * Creates a token from the matched lexer groups.
 *
 * @param {object} groups Named capture groups of the lexer pattern.
 * @returns {{type: string, raw: string, value: unknown}} Parsed token.
 */
function createToken(groups) {
    if (groups.string !== undefined) {
        return {
            type: "string",
            raw: groups.string,
            value: unquote(groups.string),
        };
    }

    if (groups.number !== undefined) {
        return {
            type: "number",
            raw: groups.number,
            value: Number(groups.number),
        };
    }

    if (groups.punctuation !== undefined) {
        return {
            type: "punctuation",
            raw: groups.punctuation,
            value: groups.punctuation,
        };
    }

    return { type: "word", raw: groups.word, value: groups.word };
}

/**
 * Parses `{ key: value, ... }` and resolves each value against parent data.
 *
 * @param {{tokens: Array<object>, index: number}} reader Token cursor.
 * @param {object} data Data the unquoted paths are resolved against.
 * @returns {object} Object with one resolved value per declared key.
 * @throws {Error} When a key, value, or separator is invalid.
 */
function parsePairs(reader, data) {
    expectPunctuation(reader, "{");

    const result = {};

    if (isPunctuation(peek(reader), "}")) {
        next(reader);

        return result;
    }

    while (true) {
        const key = readKey(next(reader));

        expectPunctuation(reader, ":");
        result[key] = resolveValue(next(reader), data);

        const separator = next(reader);

        if (isPunctuation(separator, "}")) {
            break;
        }

        if (!isPunctuation(separator, ",")) {
            throw new Error(
                `Invalid data object: expected "," or "}" but found ${describeToken(separator)}`,
            );
        }

        if (isPunctuation(peek(reader), "}")) {
            next(reader);
            break;
        }
    }

    return result;
}

/**
 * Reads a key token as an identifier or quoted string.
 *
 * A key named `__proto__` is rejected instead of assigned, because assignment
 * would replace the prototype and drop the declared key without a trace. The read
 * side already refuses to follow the prototype chain, so a key that assignment
 * cannot store as an own property has no meaning here. Every other key, including
 * names such as `constructor` and `toString`, is stored as an own property as
 * usual.
 *
 * @param {{type: string, raw: string, value: unknown}} token Key token.
 * @returns {string} Key name.
 * @throws {Error} When the token is not a valid key or names the prototype key.
 */
function readKey(token) {
    const key = readKeyName(token);

    if (key === PROTOTYPE_KEY) {
        throw new Error(
            `Invalid data object: data key "${key}" is not supported, because assigning it would replace the prototype instead of creating the key`,
        );
    }

    return key;
}

/**
 * Converts a key token into the key name it declares.
 *
 * @param {{type: string, raw: string, value: unknown}} token Key token.
 * @returns {string} Key name from a quoted string or an identifier.
 * @throws {Error} When the token is not a valid key.
 */
function readKeyName(token) {
    if (token.type === "string") {
        return token.value;
    }

    if (token.type === "word" && /^[A-Za-z_$][\w$]*$/.test(token.raw)) {
        return token.raw;
    }

    throw new Error(
        `Invalid data key ${describeToken(token)}: expected an identifier or quoted string`,
    );
}

/**
 * Resolves a value token into a literal or a data path lookup.
 *
 * @param {{type: string, raw: string, value: unknown}} token Value token.
 * @param {object} data Data the unquoted paths are resolved against.
 * @returns {unknown} Literal value or resolved data value.
 * @throws {Error} When the token is not a valid value or its path does not resolve.
 */
function resolveValue(token, data) {
    if (token.type === "string" || token.type === "number") {
        return token.value;
    }

    if (token.type !== "word") {
        throw new Error(
            `Invalid data value ${describeToken(token)}: expected a quoted string, number, true, false, null, or a dotted data path`,
        );
    }

    if (token.raw === "true") {
        return true;
    }

    if (token.raw === "false") {
        return false;
    }

    if (token.raw === "null") {
        return null;
    }

    const value = readDataPath(data, token.raw);

    if (value === undefined) {
        throw new Error(
            `Data value "${token.raw}" did not resolve to a value`,
        );
    }

    return value;
}

/**
 * Consumes a required punctuation token.
 *
 * @param {{tokens: Array<object>, index: number}} reader Token cursor.
 * @param {string} character Punctuation character expected next.
 * @returns {void}
 * @throws {Error} When the next token is different punctuation or missing.
 */
function expectPunctuation(reader, character) {
    const token = next(reader);

    if (!isPunctuation(token, character)) {
        throw new Error(
            `Invalid data object: expected "${character}" but found ${describeToken(token)}`,
        );
    }
}

/**
 * Reads the token that follows the current cursor position.
 *
 * @param {{tokens: Array<object>, index: number}} reader Token cursor.
 * @returns {{type: string, raw: string, value: unknown}|undefined} Next token, or undefined at the end.
 */
function peek(reader) {
    return reader.tokens[reader.index];
}

/**
 * Consumes and returns the token at the current cursor position.
 *
 * @param {{tokens: Array<object>, index: number}} reader Token cursor.
 * @returns {{type: string, raw: string, value: unknown}} Consumed token.
 * @throws {Error} When the cursor is past the last token.
 */
function next(reader) {
    const token = peek(reader);

    if (token === undefined) {
        throw new Error("Invalid data object: unexpected end of input");
    }

    reader.index += 1;

    return token;
}

/**
 * Checks whether a token is a specific punctuation character.
 *
 * @param {{type: string, value: unknown}|undefined} token Candidate token.
 * @param {string} character Punctuation character to compare against.
 * @returns {boolean} True when the token is the given punctuation character.
 */
function isPunctuation(token, character) {
    return (
        token !== undefined &&
        token.type === "punctuation" &&
        token.value === character
    );
}

/**
 * Describes a token for error messages.
 *
 * The token text is quoted with the shared helper, so a token that contains a
 * double quote or a backslash reads as clearly as the expression messages do.
 *
 * @param {{raw: string}|undefined} token Token to describe.
 * @returns {string} Quoted raw token text, or `end of input`.
 */
function describeToken(token) {
    return token === undefined ? "end of input" : quoteText(token.raw);
}
