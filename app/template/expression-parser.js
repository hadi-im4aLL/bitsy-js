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
 * Arithmetic operators, which the grammar does not support; the list exists only
 * so a leftover one is reported as arithmetic instead of an unexpected token.
 */
const ARITHMETIC_OPERATORS = ["+", "-", "*", "/", "%"];

/**
 * Detail reported when a comma appears.
 *
 * The grammar has no list, so a comma almost always means the author wrote call
 * arguments or a list of values, and the message names that instead of the
 * character.
 */
const COMMA_REJECTION =
    'unexpected ",": expressions take a single value, so a list is not supported';

/**
 * Detail reported when a colon appears.
 *
 * Colons only belong inside object literals, which the grammar rejects as a
 * whole, so a colon that reaches the parser is always a stray one.
 */
const COLON_REJECTION =
    "a colon is only valid inside object literals, which are not supported";

/**
 * Rejection messages shared by every position.
 *
 * The same character almost always means the same mistake wherever it appears, so
 * the shared wording lives here once and the position maps below add only their
 * own overrides. Assignment, a list, a stray colon, and an object literal
 * therefore read the same wherever the parser can report them, and only the
 * closing position drops `]` and `}` from this set, because a closer there is a
 * mismatched parenthesis rather than the construct those characters usually
 * signal.
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
 * Brackets report array literals here because no operand precedes them; a bracket
 * after a complete operand is reported as index access instead.
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
 * A bracket here reports index access and a parenthesis a function call, because
 * a complete operand already precedes them.
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
 * Rejection messages for punctuation found where a closing parenthesis is
 * expected.
 *
 * Derived from {@link TRAILING_REJECTIONS}, so a rejected construct keeps the name
 * it has after a complete operand: `(foo())` reports the function call,
 * `(items[0])` index access, and `(a { open: true })` an object literal. The two
 * genuine closers are filtered out here, because a `]` or `}` in this position is
 * a mismatched parenthesis rather than the construct those characters usually
 * signal, so `(a]` and `(a}` report the missing `)` instead of borrowing a name
 * they do not belong to.
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
 *
 * Arithmetic is rejected in every position with the same wording, so the message
 * lives here once and {@link rejectedOperatorMessage} returns it from every call
 * site.
 */
const ARITHMETIC_REJECTION = "arithmetic is not supported";

/**
 * Builds the detail reported when a comparison operator follows a consumed
 * comparison operator, or a complete comparison, such as the second `===` in
 * `a === === b` or the second operator in `a === b === c`.
 *
 * The chained position is the comparison, closing, and trailing position, so the
 * wording is shared by {@link parseComparisonOperand}, {@link expectOperator}, and
 * {@link expectEnd} and a chained comparison reads the same wherever it is
 * detected.
 *
 * @param {import("./expression-tokenizer.js").ExpressionToken} token Comparison operator that follows the consumed one.
 * @returns {string} Detail naming the chained operator.
 */
function chainedComparisonRejection(token) {
    return `comparison operators cannot be chained, found ${formatToken(token)}`;
}

/**
 * Builds the detail reported when a comparison operator appears where a primary
 * is expected, such as the `>` in `> 1`.
 *
 * Nothing is chained in that position, because no comparison precedes the
 * operator, so the message names the missing left operand instead of borrowing the
 * chained wording. {@link parsePrimary} passes it to
 * {@link rejectedOperatorMessage}, which keeps the decision between arithmetic and
 * comparison in one seam.
 *
 * @param {import("./expression-tokenizer.js").ExpressionToken} token Misplaced comparison operator.
 * @returns {string} Detail naming the operator and the operand it requires.
 */
function primaryComparisonRejection(token) {
    return `comparison operator ${formatToken(token)} must follow an operand`;
}

/**
 * Cursor over the tokens of one expression.
 *
 * @typedef {object} ExpressionReader
 * @property {import("./expression-tokenizer.js").ExpressionToken[]} tokens Tokens of the expression, terminated by an end token.
 * @property {number} index Index of the next token to consume.
 * @property {string} source Original expression text, used in error messages.
 */

/**
 * A literal value such as `42`, `'open'`, `true`, `false`, or `null`.
 *
 * @typedef {object} ExpressionLiteralNode
 * @property {"literal"} type Node kind.
 * @property {unknown} value Decoded literal value.
 */

/**
 * A dotted data path read from the evaluation scope, such as `user.name`.
 *
 * @typedef {object} ExpressionPathNode
 * @property {"path"} type Node kind.
 * @property {string} path Dotted path to read.
 */

/**
 * A logical negation of a nested expression.
 *
 * @typedef {object} ExpressionNotNode
 * @property {"not"} type Node kind.
 * @property {ExpressionNode} operand Operand whose truthiness is negated.
 */

/**
 * A short-circuiting `&&` or `||` between two operands.
 *
 * @typedef {object} ExpressionLogicalNode
 * @property {"and"|"or"} type Node kind.
 * @property {ExpressionNode} left Operand evaluated first.
 * @property {ExpressionNode} right Operand evaluated only when the left side does not short-circuit.
 */

/**
 * A comparison between two unary expressions.
 *
 * @typedef {object} ExpressionComparisonNode
 * @property {"comparison"} type Node kind.
 * @property {string} operator One of `===`, `!==`, `>`, `>=`, `<`, or `<=`.
 * @property {ExpressionNode} left Left operand.
 * @property {ExpressionNode} right Right operand.
 */

/**
 * Node of a parsed expression tree.
 *
 * @typedef {ExpressionLiteralNode|ExpressionPathNode|ExpressionNotNode|ExpressionLogicalNode|ExpressionComparisonNode} ExpressionNode
 */

/**
 * Parses an expression into an abstract syntax tree.
 *
 * The grammar is deliberately narrow so template expressions can never execute
 * code, matching the data object parser:
 *
 * ```text
 * expression := or
 * or         := and ("||" and)*
 * and        := comparison ("&&" comparison)*
 * comparison := unary (("===" | "!==" | ">" | "<" | ">=" | "<=") unary)?
 * unary      := "!" unary | primary
 * primary    := "(" expression ")" | number | literal | path
 * literal    := quoted string | true | false | null
 * number     := "-"? digit+ ("." digit+)?
 * path       := identifier ("." segment)*
 * identifier := [A-Za-z_$][\w$]*
 * segment    := [\w$]+
 * ```
 *
 * `!` binds tighter than comparison, matching JavaScript, so `!a === b` means
 * `(!a) === b` and negating a comparison needs parentheses.
 *
 * A number is digits with an optional fraction and an optional leading `-`, so
 * `3.5` and `-1` are numbers while exponents, a leading dot, and a trailing dot
 * are not accepted. A `-` may be separated from its digits by whitespace, so
 * `- 1` is the number -1, while `count - 1` stays rejected as arithmetic.
 *
 * Rejected punctuation is reported by name, and the name depends on the position
 * because the position shows what the author most likely meant: `(` after a
 * complete operand is a function call, `[` is index access there but an array
 * literal where a primary is expected, `{` and `}` are object literals, `=`
 * assignment, `,` a list, and `:` outside an object literal a stray colon. The
 * same names apply where a closing parenthesis is expected, so `(foo())`,
 * `(items[0])`, and `(a { open: true })` name the construct inside parentheses as
 * well. The one deliberate exception is a genuine closer in the wrong place: `(a]`
 * and `(a}` report the missing `)` instead of naming a construct those characters
 * do not belong to, and that asymmetry is intentional, because `(]` and `(}` sit
 * where no operand precedes them and are reported as the array and object literal
 * they suggest. Arithmetic is named in every position, so `count + 1`,
 * `(count + 1)`, `+1`, and `/ 2` all report arithmetic. A comparison operator that
 * follows a consumed comparison operator, or a complete comparison, reports that
 * comparisons cannot be chained, so `a === b === c` and `a === === b` read the
 * same, while one where a primary is expected reports that it must follow an
 * operand, because nothing is chained in `> 1`. A numeric path segment such as
 * `items.0.name` is a path read, while bracketed index access such as `items[0]`
 * stays unsupported. A reserved word is a literal and cannot start a path, so
 * `true.foo` is rejected instead of read as data.
 *
 * Parsing and evaluation are recursive, so a deeply nested expression, such as
 * thousands of `!` prefixes or parentheses, can exhaust the call stack and
 * surface as a `RangeError` instead of a syntax error. Sources are trusted view
 * markup, so no depth cap is applied.
 *
 * @example
 * parseExpression("isOpen && user.role === 'admin'");
 * // Returns an "and" node whose right operand is a "comparison" node.
 *
 * @param {string} source Expression text, without surrounding attribute quotes.
 * @returns {ExpressionNode} Root node of the parsed expression.
 * @throws {Error} `Invalid expression: expression must be a string` when source is not a string.
 * @throws {Error} `Invalid expression: expression is empty` when source contains only whitespace.
 * @throws {Error} When the expression contains unsupported or malformed syntax.
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
 * @param {ExpressionReader} reader Token cursor.
 * @returns {ExpressionNode} Left-associative chain of `or` nodes, or the nested operand.
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
 * @param {ExpressionReader} reader Token cursor.
 * @returns {ExpressionNode} Left-associative chain of `and` nodes, or the nested operand.
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
 * `!` binds to the unary that follows it, which is tighter than comparison, as in
 * JavaScript: `!a === b` is `(!a) === b`, and `!(a === b)` negates the whole
 * comparison.
 *
 * @param {ExpressionReader} reader Token cursor.
 * @returns {ExpressionNode} Negation node, or the primary that follows it.
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
 * Comparisons cannot be chained; `a < b < c` is rejected rather than read as
 * `(a < b) < c`. The right side is a unary, so `x === !y` parses as `x === (!y)`.
 *
 * @param {ExpressionReader} reader Token cursor.
 * @returns {ExpressionNode} Comparison node, or the single unary it starts with.
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
 * Another comparison operator here follows the one just consumed, so `a === === b`
 * and `a === !== b` are diagnosed as a chained comparison and keep the shared
 * chained wording instead of being reported as an operand with nothing on its
 * left. Every other operator still reaches {@link parsePrimary}, so `a === +1`
 * keeps the arithmetic wording and `a === -1` is read as a negative number.
 *
 * @param {ExpressionReader} reader Token cursor positioned after the comparison operator.
 * @returns {ExpressionNode} Operand on the right side of the comparison.
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
 * `-` only appears as the sign of a number literal here, which keeps `count > -1`
 * readable while subtraction stays rejected as arithmetic. A reserved word is a
 * literal, so `true.foo` is rejected instead of becoming a data path read, and
 * punctuation that cannot start a primary is reported as the construct it most
 * likely belongs to. Arithmetic keeps its shared wording here, so `(* 2)`, `+1`,
 * and `/ 2` report arithmetic, while a comparison operator reports that it must
 * follow an operand because nothing precedes it, so `> 1` names the missing operand
 * instead of a chained comparison; a comparison operator after a consumed one is
 * diagnosed by {@link parseComparisonOperand} instead. `-` never reaches that
 * diagnosis because it is consumed as a sign above, and `!` needs no entry here
 * because {@link parseUnary} handles it before this point.
 *
 * @param {ExpressionReader} reader Token cursor.
 * @returns {ExpressionNode} Parenthesized expression, literal, or path node.
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
 * The sign is a token of its own, so whitespace between the sign and the digits
 * is accepted and `- 1` is the same literal as `-1`.
 *
 * @param {ExpressionReader} reader Token cursor positioned on the `-` operator.
 * @returns {ExpressionLiteralNode} Negative number literal.
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
 * A rejected construct keeps its name inside parentheses: comma, assignment, and
 * colon are reported by that construct, so `(a, b)` reports the comma and `(a=1)`
 * assignment; a function call, index access, object literal, arithmetic operator,
 * or chained comparison is reported by name too, so `(a + 1)` reports arithmetic
 * exactly like `a + 1` does. Any other token, including a mismatched closer such
 * as the `]` in `(a]`, is reported as a wrong closer.
 *
 * @param {ExpressionReader} reader Token cursor.
 * @param {string} operator Operator expected next, such as `)`.
 * @returns {void}
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
 * A leftover arithmetic operator, comparison operator, or rejected punctuation is
 * reported by name, so the most likely mistakes get a message that names them
 * instead of a generic unexpected token. Arithmetic and chained comparisons share
 * their diagnosis with {@link expectOperator}, so both forms read the same at the
 * top level and inside parentheses.
 *
 * @param {ExpressionReader} reader Token cursor.
 * @returns {void}
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
 * @param {ExpressionReader} reader Token cursor.
 * @returns {import("./expression-tokenizer.js").ExpressionToken} Token at the cursor, which is the end token once the input is consumed.
 */
function peek(reader) {
    return reader.tokens[reader.index];
}

/**
 * Consumes and returns the token at the cursor.
 *
 * The cursor stops on the trailing end token, so reading past the input keeps
 * returning it instead of undefined.
 *
 * @param {ExpressionReader} reader Token cursor.
 * @returns {import("./expression-tokenizer.js").ExpressionToken} Consumed token.
 */
function next(reader) {
    const token = peek(reader);

    reader.index = Math.min(reader.index + 1, reader.tokens.length - 1);

    return token;
}

/**
 * Checks whether a token is a specific operator.
 *
 * @param {import("./expression-tokenizer.js").ExpressionToken|undefined} token Candidate token.
 * @param {string} operator Operator text to compare against.
 * @returns {boolean} True when the token is the given operator.
 */
function isOperator(token, operator) {
    return token !== undefined && token.type === "operator" && token.value === operator;
}

/**
 * Checks whether a token is a comparison operator.
 *
 * @param {import("./expression-tokenizer.js").ExpressionToken|undefined} token Candidate token.
 * @returns {boolean} True when the token is one of {@link COMPARISON_OPERATORS}.
 */
function isComparisonOperator(token) {
    return token !== undefined && token.type === "operator" && COMPARISON_OPERATORS.includes(token.value);
}

/**
 * Formats a token for an error message.
 *
 * The token text is quoted and escaped exactly like the expression source, so
 * `1 'a"b'` reads cleanly instead of embedding a bare quote.
 *
 * @param {import("./expression-tokenizer.js").ExpressionToken} token Token to format.
 * @returns {string} `end of input` or the quoted token text.
 */
function formatToken(token) {
    return token.type === "end" ? "end of input" : quoteText(token.raw);
}

/**
 * Looks up the rejection message for a token at the current position.
 *
 * @param {import("./expression-tokenizer.js").ExpressionToken} token Token that stopped the parse.
 * @param {Map<string, string>} rejections Messages by operator text for the current position.
 * @returns {string|undefined} Message naming the rejected construct, or undefined when no entry matches.
 */
function rejectionFor(token, rejections) {
    return token.type === "operator" ? rejections.get(token.value) : undefined;
}

/**
 * Diagnoses an operator the grammar accepts elsewhere but not at this position.
 *
 * An arithmetic operator is rejected wherever it appears, with the shared wording
 * from {@link ARITHMETIC_REJECTION}, so `count + 1`, `(count + 1)`, and `+1` all
 * read the same. A comparison operator gets the wording its position earns: the
 * default chained wording, because every caller but the primary position reports
 * an operator that follows a complete comparison, and the missing-operand wording
 * that {@link parsePrimary} supplies, where nothing is chained.
 *
 * @param {import("./expression-tokenizer.js").ExpressionToken} token Token that stopped the parse.
 * @param {(token: import("./expression-tokenizer.js").ExpressionToken) => string} [comparisonRejection] Builds the detail for a misplaced comparison operator.
 * @returns {string|undefined} Message naming the operator, or undefined when the token is not one recognised here.
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
 * A punctuation token with a known rejection message reports the construct it
 * belongs to, so `items[0]` reports index access instead of a bare `[`.
 *
 * @param {ExpressionReader} reader Token cursor.
 * @param {import("./expression-tokenizer.js").ExpressionToken} token Token that stopped the parse.
 * @param {Map<string, string>} rejections Messages by operator text for the current position.
 * @returns {never} Always throws.
 * @throws {Error} Naming the rejected construct or the unexpected token.
 */
function throwUnexpected(reader, token, rejections) {
    throw createExpressionError(
        reader.source,
        rejectionFor(token, rejections) ?? `unexpected ${formatToken(token)}`,
    );
}
