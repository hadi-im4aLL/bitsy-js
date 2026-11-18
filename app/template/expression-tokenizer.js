import { STRING_LITERAL_PATTERN, quoteText, unquote } from "./string-literal.js";

/**
 * Comparison operators, shared by the grammar module and the evaluator.
 */
export const COMPARISON_OPERATORS = Object.freeze([
    "===",
    "!==",
    ">=",
    "<=",
    ">",
    "<",
]);

/**
 * Loose equality operators, rejected at token level with a migration hint.
 */
const LOOSE_EQUALITY_OPERATORS = ["==", "!="];

/**
 * Remaining operator text: logic, negation, arithmetic, and the punctuation tokens the grammar reports by name.
 */
const OTHER_OPERATORS = [
    "&&",
    "||",
    "!",
    "+",
    "-",
    "*",
    "/",
    "%",
    "(",
    ")",
    ",",
    ":",
    "{",
    "}",
    "[",
    "]",
    "=",
];

/**
 * The declared operator vocabulary, sorted longest first so the lexer alternation matches the longest operator.
 */
const OPERATORS_BY_LENGTH = [
    ...COMPARISON_OPERATORS,
    ...LOOSE_EQUALITY_OPERATORS,
    ...OTHER_OPERATORS,
].sort((left, right) => right.length - left.length);

/**
 * Escapes regex metacharacters in an operator so the alternation matches it literally.
 *
 * @param {string} operator
 * @returns {string}
 */
function escapeOperator(operator) {
    return operator.replace(/[\\^$.*+?()\[\]{}|]/g, "\\$&");
}

/**
 * Operator alternative of the lexer pattern, built from the sorted vocabulary.
 */
const OPERATOR_PATTERN = OPERATORS_BY_LENGTH.map(escapeOperator).join("|");

/**
 * Lexer pattern matching one token at the current index.
 *
 * The pattern is stateful: it uses the sticky `y` flag, so `lastIndex` both decides where matching starts and advances to the end of the match.
 */
const TOKEN_PATTERN = new RegExp(
    String.raw`\s+`
        + `|(?<string>${STRING_LITERAL_PATTERN})`
        + String.raw`|(?<number>\d+(?:\.\d+)?)`
        + String.raw`|(?<identifier>[A-Za-z_$][\w$]*(?:\.[\w$]+)*)`
        + `|(?<operator>${OPERATOR_PATTERN})`,
    "y",
);

/**
 * A lexical token of the expression grammar.
 *
 * @typedef {object} ExpressionToken
 * @property {"string"|"number"|"identifier"|"operator"|"end"} type
 * @property {string} raw
 * @property {unknown} value
 */

/**
 * Splits expression text into tokens, skipping whitespace and appending an end token.
 *
 * Loose equality is rejected here because the operator text alone already diagnoses it.
 *
 * @param {string} source
 * @returns {ExpressionToken[]}
 * @throws {Error} When the source is not a string, is empty, or contains a syntax the tokenizer rejects.
 */
export function tokenizeExpression(source) {
    assertExpressionSource(source);

    const tokens = [];
    let index = 0;

    while (index < source.length) {
        TOKEN_PATTERN.lastIndex = index;

        const match = TOKEN_PATTERN.exec(source);

        if (match === null) {
            throwUnsupportedCharacter(source, index);
        }

        index = TOKEN_PATTERN.lastIndex;

        const token = createToken(match.groups);

        if (token === null) {
            continue;
        }

        if (LOOSE_EQUALITY_OPERATORS.includes(token.raw)) {
            throw createExpressionError(
                source,
                `loose equality "${token.raw}" is not supported, use "===" or "!=="`,
            );
        }

        tokens.push(token);
    }

    tokens.push({ type: "end", raw: "end of input", value: undefined });

    return tokens;
}

/**
 * Rejects expression source that cannot be tokenized or parsed at all.
 *
 * @param {unknown} source
 * @throws {Error} When the source is not a string or contains only whitespace.
 */
function assertExpressionSource(source) {
    if (typeof source !== "string") {
        throw createSourceError("expression must be a string");
    }

    if (source.trim() === "") {
        throw createSourceError("expression is empty");
    }
}

/**
 * Builds the error thrown for expression text that fails to tokenize or parse.
 *
 * @param {string} source
 * @param {string} detail
 * @returns {Error}
 */
export function createExpressionError(source, detail) {
    return new Error(`Invalid expression ${quoteText(source)}: ${detail}`);
}

/**
 * Builds the error thrown for source that is not usable expression text.
 *
 * @param {string} detail
 * @returns {Error}
 */
function createSourceError(detail) {
    return new Error(`Invalid expression: ${detail}`);
}

/**
 * Creates a token from the matched lexer groups.
 *
 * @param {object} groups
 * @returns {ExpressionToken|null}
 */
function createToken(groups) {
    if (groups.string !== undefined) {
        return { type: "string", raw: groups.string, value: unquote(groups.string) };
    }

    if (groups.number !== undefined) {
        return { type: "number", raw: groups.number, value: Number(groups.number) };
    }

    if (groups.identifier !== undefined) {
        return { type: "identifier", raw: groups.identifier, value: groups.identifier };
    }

    if (groups.operator !== undefined) {
        return { type: "operator", raw: groups.operator, value: groups.operator };
    }

    return null;
}

/**
 * Throws the error for a character the tokenizer cannot match.
 *
 * @param {string} source
 * @param {number} index
 * @throws {Error} Naming the unterminated string or the unexpected character.
 */
function throwUnsupportedCharacter(source, index) {
    const character = source[index];

    if (character === '"' || character === "'") {
        throw createExpressionError(source, "unterminated string");
    }

    throw createExpressionError(
        source,
        `unexpected character ${quoteText(character)}`,
    );
}
