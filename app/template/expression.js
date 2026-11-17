import { parseExpression } from "./expression-parser.js";
import { COMPARISON_OPERATORS } from "./expression-tokenizer.js";
import { readDataPath } from "./interpolate.js";

/**
 * Functions implementing the supported comparison operators.
 *
 * `===` and `!==` compare strictly, while the relational operators follow
 * JavaScript coercion. Values are compared as-is, so a missing path yields
 * undefined and relational comparisons against it are simply false.
 *
 * @type {Map<string, (left: unknown, right: unknown) => boolean>}
 */
const COMPARISONS = new Map([
    ["===", (left, right) => left === right],
    ["!==", (left, right) => left !== right],
    [">", (left, right) => left > right],
    [">=", (left, right) => left >= right],
    ["<", (left, right) => left < right],
    ["<=", (left, right) => left <= right],
]);

/**
 * Checks that the comparison vocabulary and its implementations match exactly.
 *
 * Running at module load means a drift between the tokenizer vocabulary and this
 * table fails immediately with a clear message instead of a `TypeError` when an
 * expression uses the unimplemented operator. Both directions name the operator
 * at fault, so a missing implementation and a stale implementation are equally
 * easy to place. A duplicated operator is rejected too, because otherwise it
 * would pass the membership check while making another operator unreachable, and
 * that branch names the repeated operator like the other two.
 *
 * @param {Map<string, (left: unknown, right: unknown) => boolean>} comparisons Operator implementations.
 * @returns {void}
 * @throws {Error} When an operator has no implementation, an implementation has no operator, or the operator list repeats one.
 */
function assertComparisonCoverage(comparisons) {
    const seen = new Set();

    for (const operator of COMPARISON_OPERATORS) {
        if (seen.has(operator)) {
            throw new Error(`Duplicate comparison operator "${operator}"`);
        }

        seen.add(operator);

        if (!comparisons.has(operator)) {
            throw new Error(
                `Missing comparison implementation for "${operator}"`,
            );
        }
    }

    for (const operator of comparisons.keys()) {
        if (!COMPARISON_OPERATORS.includes(operator)) {
            throw new Error(
                `Comparison implementation for "${operator}" has no tokenizer operator`,
            );
        }
    }
}

assertComparisonCoverage(COMPARISONS);

/**
 * Result of evaluating an expression.
 *
 * @typedef {object} ExpressionResult
 * @property {unknown} value Value the expression evaluates to.
 * @property {string[]} paths Dotted data paths read during evaluation, in read order. A path read twice appears twice, and paths behind a short-circuited operand do not appear at all.
 */

/**
 * Evaluates an expression against a data scope.
 *
 * Paths are read with {@link readDataPath}, so only own properties are visible
 * and missing paths evaluate to undefined instead of throwing. `&&` and `||`
 * short-circuit like JavaScript: the right operand is only evaluated when the
 * left one does not decide the result, which also means its paths are not read.
 * `&&` and `||` return an operand rather than a boolean, as JavaScript does.
 *
 * @example
 * evaluateExpression("isOpen && user.role === 'admin'", {
 *     isOpen: true,
 *     user: { role: "admin" },
 * });
 * // { value: true, paths: ["isOpen", "user.role"] }
 *
 * @param {string} source Expression text, without surrounding attribute quotes.
 * @param {object|null} scope Data the expression paths are resolved against; a null scope reads as empty, so every path evaluates to undefined.
 * @returns {ExpressionResult} Evaluated value and the paths that were read.
 * @throws {Error} When the source is not a string, is empty, or contains unsupported or malformed syntax.
 */
export function evaluateExpression(source, scope) {
    const paths = [];
    const value = evaluateNode(parseExpression(source), scope, paths);

    return { value, paths };
}

/**
 * Evaluates one node of a parsed expression tree.
 *
 * @param {import("./expression-parser.js").ExpressionNode} node Node to evaluate.
 * @param {object|null} scope Data the path nodes are resolved against; a null scope reads as empty.
 * @param {string[]} paths Collected paths, appended to as path nodes are read.
 * @returns {unknown} Value of the node.
 * @throws {Error} When a node type is not part of the expression grammar.
 */
function evaluateNode(node, scope, paths) {
    switch (node.type) {
        case "literal":
            return node.value;

        case "path":
            paths.push(node.path);

            return readDataPath(scope, node.path);

        case "not":
            return !evaluateNode(node.operand, scope, paths);

        case "and": {
            const left = evaluateNode(node.left, scope, paths);

            return left ? evaluateNode(node.right, scope, paths) : left;
        }

        case "or": {
            const left = evaluateNode(node.left, scope, paths);

            return left ? left : evaluateNode(node.right, scope, paths);
        }

        case "comparison":
            return evaluateComparison(node, scope, paths);

        default:
            // Exhaustiveness guard for the closed node union in the grammar module.
            throw new Error(`Unsupported expression node "${node.type}"`);
    }
}

/**
 * Evaluates both sides of a comparison and applies its operator.
 *
 * @param {import("./expression-parser.js").ExpressionComparisonNode} node Comparison node.
 * @param {object|null} scope Data the path nodes are resolved against; a null scope reads as empty.
 * @param {string[]} paths Collected paths, appended to as path nodes are read.
 * @returns {boolean} Result of the comparison.
 */
function evaluateComparison(node, scope, paths) {
    const left = evaluateNode(node.left, scope, paths);
    const right = evaluateNode(node.right, scope, paths);

    return COMPARISONS.get(node.operator)(left, right);
}
