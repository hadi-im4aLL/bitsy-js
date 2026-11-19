/**
 * Regex fragment matching a quoted string literal, including its quotes.
 *
 * Shared so the data object parser and the expression tokenizer accept exactly the same string literals.
 */
export const STRING_LITERAL_PATTERN = String.raw`"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'`;

/**
 * Characters with a standard escape sequence inside a string literal.
 */
const ESCAPES = {
    "n": "\n",
    "r": "\r",
    "t": "\t",
    "\\": "\\",
    "'": "'",
    '"': '"',
};

/**
 * Quotes text for an error message, escaping backslashes and embedded double quotes.
 *
 * @param {string} text
 * @returns {string}
 */
export function quoteText(text) {
    return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Removes the quotes from a string token and applies standard escapes.
 *
 * An unknown escape sequence drops the backslash and keeps the character.
 *
 * @param {string} raw
 * @returns {string}
 */
export function unquote(raw) {
    return raw
        .slice(1, -1)
        .replace(/\\(.)/g, (escape, character) => ESCAPES[character] ?? character);
}
