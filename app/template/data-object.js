import { readDataPath } from "./interpolate.js";
import {
    STRING_LITERAL_PATTERN,
    quoteText,
    unquote,
} from "./string-literal.js";

/**
 * Lexer pattern matching one token of an object literal at the current index.
 *
 * The pattern is stateful: it uses the sticky `y` flag, so `lastIndex` both decides where matching starts and advances to the end of the match.
 */
const TOKEN_PATTERN = new RegExp(
    String.raw`\s*(?:(?<string>${STRING_LITERAL_PATTERN})|(?<punctuation>[{}:,])|(?<number>-?\d+(?:\.\d+)?)|(?<word>[A-Za-z_$][\w$]*(?:\.[\w$]+)*))`,
    "y",
);

/**
 * Key named after the prototype accessor, which assignment cannot store.
 */
const PROTOTYPE_KEY = "__proto__";

/**
 * Parses the object literal declared by a data attribute and resolves its values against parent data.
 *
 * Unquoted words are data paths and nested objects and arrays are not supported; values resolve independently against the parent data.
 *
 * @param {string} source
 * @param {object} data
 * @returns {object}
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
 * @param {string} source
 * @returns {Array<{type: string, raw: string, value: unknown}>}
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
 * @param {object} groups
 * @returns {{type: string, raw: string, value: unknown}}
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
 * @param {{tokens: Array<object>, index: number}} reader
 * @param {object} data
 * @returns {object}
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
 * A `__proto__` key is rejected because assignment would replace the prototype instead of creating the key.
 *
 * @param {{type: string, raw: string, value: unknown}} token
 * @returns {string}
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
 * @param {{type: string, raw: string, value: unknown}} token
 * @returns {string}
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
 * @param {{type: string, raw: string, value: unknown}} token
 * @param {object} data
 * @returns {unknown}
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
 * @param {{tokens: Array<object>, index: number}} reader
 * @param {string} character
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
 * @param {{tokens: Array<object>, index: number}} reader
 * @returns {{type: string, raw: string, value: unknown}|undefined}
 */
function peek(reader) {
    return reader.tokens[reader.index];
}

/**
 * Consumes and returns the token at the current cursor position.
 *
 * @param {{tokens: Array<object>, index: number}} reader
 * @returns {{type: string, raw: string, value: unknown}}
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
 * @param {{type: string, value: unknown}|undefined} token
 * @param {string} character
 * @returns {boolean}
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
 * @param {{raw: string}|undefined} token
 * @returns {string}
 */
function describeToken(token) {
    return token === undefined ? "end of input" : quoteText(token.raw);
}
