import { parseExpression } from "./expression-parser.js";
import { COMPARISON_OPERATORS } from "./expression-tokenizer.js";
import { readDataPath } from "./interpolate.js";

/**
 * Functions implementing the supported comparison operators.
 *
 * `===` and `!==` compare strictly, while the relational operators follow JavaScript coercion.
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
 * Failing at module load turns a drift into one clear message instead of a `TypeError` when an expression uses the operator.
 *
 * @param {Map<string, (left: unknown, right: unknown) => boolean>} comparisons
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
 * @property {unknown} value
 * @property {string[]} paths
 */

/**
 * Evaluates an expression against a data scope.
 *
 * `&&` and `||` short-circuit and return an operand rather than a boolean, so paths behind a short-circuited operand are never read.
 *
 * @param {string} source
 * @param {object|null} scope
 * @returns {ExpressionResult}
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
 * @param {import("./expression-parser.js").ExpressionNode} node
 * @param {object|null} scope
 * @param {string[]} paths
 * @returns {unknown}
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
 * @param {import("./expression-parser.js").ExpressionComparisonNode} node
 * @param {object|null} scope
 * @param {string[]} paths
 * @returns {boolean}
 */
function evaluateComparison(node, scope, paths) {
    const left = evaluateNode(node.left, scope, paths);
    const right = evaluateNode(node.right, scope, paths);

    return COMPARISONS.get(node.operator)(left, right);
}
