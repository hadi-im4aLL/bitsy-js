/**
 * Regex fragment matching a quoted string literal, including its quotes.
 *
 * Both quote styles are supported and a backslash escapes the next character, so
 * `'a{b'` and `"x=y"` are single tokens whose content is never rescanned for
 * directive characters. The fragment is shared so the data object parser and the
 * expression tokenizer accept exactly the same string literals.
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
 * Quotes text for an error message, escaping backslashes and embedded double
 * quotes.
 *
 * Text such as the source `"a`, the token text `'a"b'`, or a lone backslash would
 * otherwise produce a message with ambiguous quoting, where a backslash appears to
 * escape the closing quote. One helper serves both grammars, so the expression
 * source, the token text, the unexpected character, and every data object message
 * quote text the same way.
 *
 * @param {string} text Text to quote.
 * @returns {string} Text wrapped in double quotes, with backslashes and embedded quotes escaped.
 */
export function quoteText(text) {
    return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Removes the quotes from a string token and applies standard escapes.
 *
 * An unknown escape sequence drops the backslash and keeps the character, so
 * `'\q'` reads as `q`. That is the existing `r-data` behaviour as well.
 *
 * @param {string} raw Quoted string token, including its quotes.
 * @returns {string} Unquoted string value.
 */
export function unquote(raw) {
    return raw
        .slice(1, -1)
        .replace(/\\(.)/g, (escape, character) => ESCAPES[character] ?? character);
}
