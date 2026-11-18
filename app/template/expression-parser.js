import {
    COMPARISON_OPERATORS,
    createExpressionError,
    tokenizeExpression,
} from "./expression-tokenizer.js";
import { quoteText } from "./string-literal.js";

/**
 * Reserved words that are literals rather than data paths.
 */
const LITERAL_VALUES = new Map([
    ["true", true],
    ["false", false],
    ["null", null],
]);

/**
 * Arithmetic operators, rejected wherever they appear.
 */
const ARITHMETIC_OPERATORS = ["+", "-", "*", "/", "%"];

/**
 * Detail reported when a comma appears where a list is not supported.
 */
const COMMA_REJECTION =
    'unexpected ",": expressions take a single value, so a list is not supported';

/**
 * Detail reported when a colon appears outside an object literal.
 */
const COLON_REJECTION =
    "a colon is only valid inside object literals, which are not supported";

/**
 * Rejection messages shared by every position.
 *
 * @type {Map<string, string>}
 */
const BASE_REJECTIONS = new Map([
    ["{", "object literals are not supported"],
    ["}", "object literals are not supported"],
    ["=", "assignment is not supported"],
    [",", COMMA_REJECTION],
    [":", COLON_REJECTION],
]);

/**
 * Rejection messages for punctuation found where a primary is expected.
 *
 * @type {Map<string, string>}
 */
const PRIMARY_REJECTIONS = new Map([
    ...BASE_REJECTIONS,
    ["[", "array literals are not supported"],
    ["]", "array literals are not supported"],
]);

/**
 * Rejection messages for punctuation found directly after a complete operand.
 *
 * @type {Map<string, string>}
 */
const TRAILING_REJECTIONS = new Map([
    ...BASE_REJECTIONS,
    ["(", "function calls are not supported"],
    ["[", "index access is not supported"],
    ["]", "index access is not supported"],
]);

/**
 * Rejection messages for punctuation found where a closing parenthesis is expected.
 *
 * A genuine closer is filtered out, so `(a]` reports the missing `)` instead of borrowing the index-access name.
 *
 * @type {Map<string, string>}
 */
const CLOSING_REJECTIONS = new Map(
    [...TRAILING_REJECTIONS].filter(
        ([key]) => key !== "]" && key !== "}",
    ),
);

/**
 * Detail reported when an arithmetic operator appears where an operand belongs.
 */
const ARITHMETIC_REJECTION = "arithmetic is not supported";

/**
 * Builds the detail reported when a comparison operator follows a consumed comparison operator.
 *
 * @param {import("./expression-tokenizer.js").ExpressionToken} token
 * @returns {string}
 */
function chainedComparisonRejection(token) {
    return `comparison operators cannot be chained, found ${formatToken(token)}`;
}

/**
 * Builds the detail reported when a comparison operator appears where a primary is expected.
 *
 * @param {import("./expression-tokenizer.js").ExpressionToken} token
 * @returns {string}
 */
function primaryComparisonRejection(token) {
    return `comparison operator ${formatToken(token)} must follow an operand`;
}

/**
 * Cursor over the tokens of one expression.
 *
 * @typedef {object} ExpressionReader
 * @property {import("./expression-tokenizer.js").ExpressionToken[]} tokens
 * @property {number} index
 * @property {string} source
 */

/**
 * A literal value such as `42`, `'open'`, `true`, `false`, or `null`.
 *
 * @typedef {object} ExpressionLiteralNode
 * @property {"literal"} type
 * @property {unknown} value
 */

/**
 * A dotted data path read from the evaluation scope, such as `user.name`.
 *
 * @typedef {object} ExpressionPathNode
 * @property {"path"} type
 * @property {string} path
 */

/**
 * A logical negation of a nested expression.
 *
 * @typedef {object} ExpressionNotNode
 * @property {"not"} type
 * @property {ExpressionNode} operand
 */

/**
 * A short-circuiting `&&` or `||` between two operands.
 *
 * @typedef {object} ExpressionLogicalNode
 * @property {"and"|"or"} type
 * @property {ExpressionNode} left
 * @property {ExpressionNode} right
 */

/**
 * A comparison between two unary expressions.
 *
 * @typedef {object} ExpressionComparisonNode
 * @property {"comparison"} type
 * @property {string} operator
 * @property {ExpressionNode} left
 * @property {ExpressionNode} right
 */

/**
 * Node of a parsed expression tree.
 *
 * @typedef {ExpressionLiteralNode|ExpressionPathNode|ExpressionNotNode|ExpressionLogicalNode|ExpressionComparisonNode} ExpressionNode
 */

/**
 * Parses an expression into an abstract syntax tree.
 *
 * The grammar is deliberately narrow so template expressions can never execute code; `!` binds tighter than comparison, and comparisons cannot be chained.
 *
 * @param {string} source
 * @returns {ExpressionNode}
 * @throws {Error} When the source is not a string, is empty, or contains unsupported or malformed syntax.
 */
export function parseExpression(source) {
    const reader = { tokens: tokenizeExpression(source), index: 0, source };
    const node = parseOr(reader);

    expectEnd(reader);

    return node;
}

/**
 * Parses `and ("||" and)*`.
 *
 * @param {ExpressionReader} reader
 * @returns {ExpressionNode}
 */
function parseOr(reader) {
    let node = parseAnd(reader);

    while (isOperator(peek(reader), "||")) {
        next(reader);
        node = { type: "or", left: node, right: parseAnd(reader) };
    }

    return node;
}

/**
 * Parses `comparison ("&&" comparison)*`.
 *
 * @param {ExpressionReader} reader
 * @returns {ExpressionNode}
 */
function parseAnd(reader) {
    let node = parseComparison(reader);

    while (isOperator(peek(reader), "&&")) {
        next(reader);
        node = { type: "and", left: node, right: parseComparison(reader) };
    }

    return node;
}

/**
 * Parses `"!" unary | primary`.
 *
 * @param {ExpressionReader} reader
 * @returns {ExpressionNode}
 */
function parseUnary(reader) {
    if (isOperator(peek(reader), "!")) {
        next(reader);

        return { type: "not", operand: parseUnary(reader) };
    }

    return parsePrimary(reader);
}

/**
 * Parses `unary (comparisonOperator unary)?`.
 *
 * @param {ExpressionReader} reader
 * @returns {ExpressionNode}
 */
function parseComparison(reader) {
    const left = parseUnary(reader);
    const operator = peek(reader);

    if (isComparisonOperator(operator)) {
        next(reader);

        return {
            type: "comparison",
            operator: operator.value,
            left,
            right: parseComparisonOperand(reader),
        };
    }

    return left;
}

/**
 * Parses the operand that follows a consumed comparison operator.
 *
 * Another comparison operator here is a chained comparison, while every other operator still reaches {@link parseUnary}.
 *
 * @param {ExpressionReader} reader
 * @returns {ExpressionNode}
 * @throws {Error} When the operand starts with another comparison operator.
 */
function parseComparisonOperand(reader) {
    const token = peek(reader);

    if (isComparisonOperator(token)) {
        throw createExpressionError(
            reader.source,
            chainedComparisonRejection(token),
        );
    }

    return parseUnary(reader);
}

/**
 * Parses `"(" expression ")" | number | literal | path`.
 *
 * `-` only appears as the sign of a number literal here, so `count > -1` works while subtraction stays arithmetic.
 *
 * @param {ExpressionReader} reader
 * @returns {ExpressionNode}
 * @throws {Error} When the next token cannot start a primary.
 */
function parsePrimary(reader) {
    const token = peek(reader);

    if (isOperator(token, "(")) {
        next(reader);

        const node = parseOr(reader);

        expectOperator(reader, ")");

        return node;
    }

    if (isOperator(token, "-")) {
        return parseNegativeNumber(reader);
    }

    if (token.type === "string" || token.type === "number") {
        next(reader);

        return { type: "literal", value: token.value };
    }

    if (token.type === "identifier") {
        next(reader);

        const [firstSegment] = token.raw.split(".");

        if (LITERAL_VALUES.has(firstSegment)) {
            if (token.raw !== firstSegment) {
                throw createExpressionError(
                    reader.source,
                    `unexpected ${formatToken(token)}: ${quoteText(firstSegment)} is a literal, not a path`,
                );
            }

            return { type: "literal", value: LITERAL_VALUES.get(firstSegment) };
        }

        return { type: "path", path: token.raw };
    }

    const rejection = rejectedOperatorMessage(token, primaryComparisonRejection);

    if (rejection !== undefined) {
        throw createExpressionError(reader.source, rejection);
    }

    throwUnexpected(reader, token, PRIMARY_REJECTIONS);
}

/**
 * Parses a `-` sign followed by a number into a negative number literal.
 *
 * The sign is a token of its own, so whitespace between the sign and the digits is accepted.
 *
 * @param {ExpressionReader} reader
 * @returns {ExpressionLiteralNode}
 * @throws {Error} When the sign is not followed by a number.
 */
function parseNegativeNumber(reader) {
    next(reader);

    const token = next(reader);

    if (token.type !== "number") {
        throw createExpressionError(
            reader.source,
            `expected a number after "-" but found ${formatToken(token)}`,
        );
    }

    return { type: "literal", value: -token.value };
}

/**
 * Consumes a required operator token.
 *
 * @param {ExpressionReader} reader
 * @param {string} operator
 * @throws {Error} When the next token is a different operator or the input ended.
 */
function expectOperator(reader, operator) {
    const token = next(reader);

    if (isOperator(token, operator)) {
        return;
    }

    const rejection =
        rejectedOperatorMessage(token) ?? rejectionFor(token, CLOSING_REJECTIONS);

    if (rejection !== undefined) {
        throw createExpressionError(reader.source, rejection);
    }

    throw createExpressionError(
        reader.source,
        `expected "${operator}" but found ${formatToken(token)}`,
    );
}

/**
 * Verifies that the expression ended after a complete parse.
 *
 * @param {ExpressionReader} reader
 * @throws {Error} When tokens remain after the parsed expression.
 */
function expectEnd(reader) {
    const token = peek(reader);

    if (token.type === "end") {
        return;
    }

    const rejection = rejectedOperatorMessage(token);

    if (rejection !== undefined) {
        throw createExpressionError(reader.source, rejection);
    }

    throwUnexpected(reader, token, TRAILING_REJECTIONS);
}

/**
 * Reads the token at the cursor without consuming it.
 *
 * @param {ExpressionReader} reader
 * @returns {import("./expression-tokenizer.js").ExpressionToken}
 */
function peek(reader) {
    return reader.tokens[reader.index];
}

/**
 * Consumes and returns the token at the cursor.
 *
 * The cursor stops on the trailing end token, so reading past the input keeps returning it instead of undefined.
 *
 * @param {ExpressionReader} reader
 * @returns {import("./expression-tokenizer.js").ExpressionToken}
 */
function next(reader) {
    const token = peek(reader);

    reader.index = Math.min(reader.index + 1, reader.tokens.length - 1);

    return token;
}

/**
 * Checks whether a token is a specific operator.
 *
 * @param {import("./expression-tokenizer.js").ExpressionToken|undefined} token
 * @param {string} operator
 * @returns {boolean}
 */
function isOperator(token, operator) {
    return token !== undefined && token.type === "operator" && token.value === operator;
}

/**
 * Checks whether a token is a comparison operator.
 *
 * @param {import("./expression-tokenizer.js").ExpressionToken|undefined} token
 * @returns {boolean}
 */
function isComparisonOperator(token) {
    return token !== undefined && token.type === "operator" && COMPARISON_OPERATORS.includes(token.value);
}

/**
 * Formats a token for an error message.
 *
 * @param {import("./expression-tokenizer.js").ExpressionToken} token
 * @returns {string}
 */
function formatToken(token) {
    return token.type === "end" ? "end of input" : quoteText(token.raw);
}

/**
 * Looks up the rejection message for a token at the current position.
 *
 * @param {import("./expression-tokenizer.js").ExpressionToken} token
 * @param {Map<string, string>} rejections
 * @returns {string|undefined}
 */
function rejectionFor(token, rejections) {
    return token.type === "operator" ? rejections.get(token.value) : undefined;
}

/**
 * Diagnoses an operator the grammar accepts elsewhere but not at this position.
 *
 * @param {import("./expression-tokenizer.js").ExpressionToken} token
 * @param {(token: import("./expression-tokenizer.js").ExpressionToken) => string} [comparisonRejection]
 * @returns {string|undefined}
 */
function rejectedOperatorMessage(
    token,
    comparisonRejection = chainedComparisonRejection,
) {
    if (token.type !== "operator") {
        return undefined;
    }

    if (ARITHMETIC_OPERATORS.includes(token.value)) {
        return ARITHMETIC_REJECTION;
    }

    if (COMPARISON_OPERATORS.includes(token.value)) {
        return comparisonRejection(token);
    }

    return undefined;
}

/**
 * Throws the error for a token that cannot appear at the current position.
 *
 * @param {ExpressionReader} reader
 * @param {import("./expression-tokenizer.js").ExpressionToken} token
 * @param {Map<string, string>} rejections
 * @returns {never}
 * @throws {Error} Naming the rejected construct or the unexpected token.
 */
function throwUnexpected(reader, token, rejections) {
    throw createExpressionError(
        reader.source,
        rejectionFor(token, rejections) ?? `unexpected ${formatToken(token)}`,
    );
}
