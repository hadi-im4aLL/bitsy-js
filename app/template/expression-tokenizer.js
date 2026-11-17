import { STRING_LITERAL_PATTERN, quoteText, unquote } from "./string-literal.js";

/**
 * Comparison operators. The list is frozen because it is the single source of
 * truth.
 *
 * The grammar module and the evaluator both read this list, so the accepted
 * vocabulary is declared once. Declaration order carries no meaning, because the
 * lexer sorts the vocabulary by length before building its pattern.
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
 * Remaining operator text: logic, negation, arithmetic, and the punctuation
 * tokens that let the grammar report a rejected construct by name.
 *
 * These are plain operator strings rather than a regex fragment so the lexer can
 * sort the complete vocabulary by length before building its pattern.
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
 * The declared operator vocabulary, sorted longest first.
 *
 * The lexer alternation is first-match-wins, so a longer operator has to be tried
 * before any operator it starts with: `===` before `==`, `!==` before `!=` and
 * `!`, and `>=` before `>`. Sorting by length here is what keeps longest-match
 * correct, so the lists above can be reordered or extended for readability
 * without changing how source is read. Equal lengths keep their declared order,
 * which does not matter because two distinct operators of the same length cannot
 * match at the same position.
 */
const OPERATORS_BY_LENGTH = [
    ...COMPARISON_OPERATORS,
    ...LOOSE_EQUALITY_OPERATORS,
    ...OTHER_OPERATORS,
].sort((left, right) => right.length - left.length);

/**
 * Escapes regex metacharacters in an operator so the alternation matches it
 * literally.
 *
 * @param {string} operator Operator text such as `||` or `>=`.
 * @returns {string} Operator text safe to embed in a regular expression.
 */
function escapeOperator(operator) {
    return operator.replace(/[\\^$.*+?()\[\]{}|]/g, "\\$&");
}

/**
 * Operator alternative of the lexer pattern, built from the sorted vocabulary so
 * a new operator only has to be declared once.
 */
const OPERATOR_PATTERN = OPERATORS_BY_LENGTH.map(escapeOperator).join("|");

/**
 * Lexer pattern matching one token at the current index.
 *
 * The pattern is stateful: it uses the sticky `y` flag, so `lastIndex` both
 * decides where matching starts and advances to the end of the match. A
 * successful match advances `lastIndex` and a failed match resets it to 0, so it
 * must be reseeded before every `exec`.
 *
 * Operators are alternated longest first (see {@link OPERATORS_BY_LENGTH}), so
 * `!==` wins over `!=` and `!`. Punctuation that the grammar rejects, such as
 * `,`, `:`, `{`, `}`, `[`, `]`, and `=`, is tokenized as an operator too, so
 * tokenizing never stops on a character the parser can name. The parser then
 * reports the construct from token order: a leading `{` names an object literal,
 * while a `:` after a complete operand names a stray colon. Grouping parentheses
 * are matched as operators because the grammar consumes them as such.
 *
 * The identifier alternative requires a name in the first segment and accepts
 * numeric segments after it, so `items.0.name` is one path token, matching the
 * `readDataPath` contract. Bracketed index access is not part of the path
 * grammar.
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
 * @property {"string"|"number"|"identifier"|"operator"|"end"} type Token category.
 * @property {string} raw Source text of the token, or `end of input` for the end token.
 * @property {unknown} value Decoded value: unquoted text, number, dotted path, operator text, or undefined for the end token.
 */

/**
 * Splits expression text into tokens, skipping whitespace and appending an end token.
 *
 * Loose equality is rejected here because the operator text alone already
 * diagnoses it. Every other construct-level rejection is reported by the grammar
 * module, which needs the token order to name what the author most likely meant,
 * so this module only reports the lexical errors it detects itself: an
 * unterminated string and an unexpected character.
 *
 * @param {string} source Expression text, without surrounding attribute quotes.
 * @returns {ExpressionToken[]} Tokens in source order, terminated by an end token.
 * @throws {Error} `Invalid expression: expression must be a string` when source is not a string.
 * @throws {Error} `Invalid expression: expression is empty` when source contains only whitespace.
 * @throws {Error} When the source contains syntax the tokenizer rejects.
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
 * Both checks live here so the "Invalid expression: " prefix and the wording for
 * unusable source sit next to {@link createExpressionError}, which reports the
 * problems that quote the source text.
 *
 * @param {unknown} source Candidate expression source.
 * @returns {void}
 * @throws {Error} `Invalid expression: expression must be a string` when source is not a string.
 * @throws {Error} `Invalid expression: expression is empty` when source contains only whitespace.
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
 * The tokenizer and the grammar module both report through it, so every rejected
 * expression that quotes its source carries the same prefix and the same escaped
 * source text. Source that has no usable text to quote is reported by
 * {@link assertExpressionSource} instead.
 *
 * @param {string} source Expression text that failed to tokenize or parse.
 * @param {string} detail What went wrong, phrased to follow the prefix.
 * @returns {Error} Error naming the expression and the problem.
 */
export function createExpressionError(source, detail) {
    return new Error(`Invalid expression ${quoteText(source)}: ${detail}`);
}

/**
 * Builds the error thrown for source that is not usable expression text.
 *
 * @param {string} detail What went wrong, phrased to follow the prefix.
 * @returns {Error} Error naming the problem without quoting a source.
 */
function createSourceError(detail) {
    return new Error(`Invalid expression: ${detail}`);
}

/**
 * Creates a token from the matched lexer groups.
 *
 * @param {object} groups Named capture groups of the lexer pattern.
 * @returns {ExpressionToken|null} Parsed token, or null when only whitespace matched.
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
 * The character is quoted and escaped like the expression source, so a lone
 * backslash reads clearly instead of appearing to escape the closing quote.
 *
 * @param {string} source Expression text.
 * @param {number} index Index of the unmatched character.
 * @returns {never} Always throws.
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
