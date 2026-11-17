import { describe, expect, it } from "vitest";
import { evaluateExpression } from "../template/expression.js";

const scope = {
    isOpen: true,
    isAdmin: false,
    count: 0,
    user: { name: "Hadi", role: "admin" },
};

describe("operator precedence", () => {
    it("binds && tighter than ||", () => {
        expect(evaluateExpression("true || false && false", {}).value).toBe(true);
        expect(evaluateExpression("false && true || true", {}).value).toBe(true);
        expect(evaluateExpression("false || false && false", {}).value).toBe(
            false,
        );
    });

    it("binds comparisons tighter than && and ||", () => {
        expect(evaluateExpression("1 < 2 && 2 < 3", {}).value).toBe(true);
        expect(evaluateExpression("1 > 2 || 2 < 3", {}).value).toBe(true);
        expect(evaluateExpression("1 > 2 && 2 < 3", {}).value).toBe(false);
    });

    it("binds ! tighter than a comparison, like JavaScript", () => {
        expect(evaluateExpression("!isOpen === user.name", scope).value).toBe(
            false,
        );
        expect(evaluateExpression("!(isOpen === user.name)", scope).value).toBe(
            true,
        );
    });

    it("matches the JavaScript answer for !a === b", () => {
        const localScope = { a: true, b: "Hadi" };
        const { value } = evaluateExpression("!a === b", localScope);

        expect(value).toBe(!localScope.a === localScope.b);
        expect(value).toBe(false);
    });
});

describe("parentheses", () => {
    it("groups operands before the outer operator", () => {
        expect(evaluateExpression("(true || false) && false", {}).value).toBe(
            false,
        );
        expect(evaluateExpression("true || (false && false)", {}).value).toBe(
            true,
        );
    });

    it("groups negated expressions", () => {
        expect(
            evaluateExpression("!(isOpen && isAdmin)", scope).value,
        ).toBe(true);
        expect(
            evaluateExpression("!(isOpen || isAdmin)", scope).value,
        ).toBe(false);
    });
});

describe("negation", () => {
    it("negates a truthy and a falsy path", () => {
        expect(evaluateExpression("!isOpen", scope).value).toBe(false);
        expect(evaluateExpression("!isAdmin", scope).value).toBe(true);
    });

    it("restores the truthiness with double negation", () => {
        expect(evaluateExpression("!!user.name", scope).value).toBe(true);
        expect(evaluateExpression("!!count", scope).value).toBe(false);
    });

    it("negates a negative number literal", () => {
        expect(evaluateExpression("!-1", scope).value).toBe(false);
    });

    it("accepts a negation on the right side of a comparison", () => {
        expect(evaluateExpression("isAdmin === !isOpen", scope).value).toBe(
            true,
        );
    });

    it("treats a missing path as falsy", () => {
        expect(evaluateExpression("!missing", {}).value).toBe(true);
        expect(evaluateExpression("!!missing", {}).value).toBe(false);
    });
});

describe("short-circuit", () => {
    it("skips the right side of && when the left side is falsy", () => {
        const result = evaluateExpression(
            "isAdmin && missing.deep.name",
            scope,
        );

        expect(result.value).toBe(false);
        expect(result.paths).toEqual(["isAdmin"]);
    });

    it("skips the right side of || when the left side is truthy", () => {
        const result = evaluateExpression(
            "user.name || missing.deep.name",
            scope,
        );

        expect(result.value).toBe("Hadi");
        expect(result.paths).toEqual(["user.name"]);
    });

    it("reads the right side when the left side does not decide", () => {
        expect(
            evaluateExpression("isAdmin || user.name", scope).value,
        ).toBe("Hadi");
    });
});

describe("operand results", () => {
    it("returns an operand from && and || instead of a boolean", () => {
        expect(evaluateExpression("'a' && 'b'", {}).value).toBe("b");
        expect(evaluateExpression("0 || null", {}).value).toBeNull();
    });

    it("treats null as falsy so && short-circuits on it", () => {
        expect(evaluateExpression("null && 'x'", {}).value).toBeNull();
        expect(evaluateExpression("!null", {}).value).toBe(true);
    });
});

describe("literals", () => {
    it("evaluates quoted string literals", () => {
        expect(evaluateExpression("'Coffee'", {}).value).toBe("Coffee");
        expect(evaluateExpression('"Tea"', {}).value).toBe("Tea");
        expect(evaluateExpression('"it\'s"', {}).value).toBe("it's");
    });

    it("keeps directive characters inside string literals", () => {
        expect(evaluateExpression("'a{b'", {}).value).toBe("a{b");
        expect(evaluateExpression("'x=y'", {}).value).toBe("x=y");
        expect(evaluateExpression("'[1]'", {}).value).toBe("[1]");
    });

    it("drops an unknown escape sequence to its character", () => {
        expect(evaluateExpression("'\\q'", {}).value).toBe("q");
        expect(evaluateExpression("'\\u0041'", {}).value).toBe("u0041");
    });

    it("evaluates number literals", () => {
        expect(evaluateExpression("42", {}).value).toBe(42);
        expect(evaluateExpression("3.5", {}).value).toBe(3.5);
        expect(evaluateExpression("-3.5", {}).value).toBe(-3.5);
    });

    it("evaluates a negative number with whitespace after the sign", () => {
        expect(evaluateExpression("- 1", {}).value).toBe(-1);
    });

    it("evaluates boolean and null literals", () => {
        expect(evaluateExpression("true", {}).value).toBe(true);
        expect(evaluateExpression("false", {}).value).toBe(false);
        expect(evaluateExpression("null", {}).value).toBeNull();
    });
});

describe("comparisons", () => {
    it("evaluates every comparison operator", () => {
        expect(evaluateExpression("count === 0", scope).value).toBe(true);
        expect(evaluateExpression("count !== 0", scope).value).toBe(false);
        expect(evaluateExpression("count > 0", scope).value).toBe(false);
        expect(evaluateExpression("count < 1", scope).value).toBe(true);
        expect(evaluateExpression("count >= 0", scope).value).toBe(true);
        expect(evaluateExpression("count <= 0", scope).value).toBe(true);
    });

    it("compares strictly", () => {
        expect(evaluateExpression('count === "0"', scope).value).toBe(false);
        expect(evaluateExpression("user.role === 'admin'", scope).value).toBe(
            true,
        );
    });

    it("coerces relational operands like JavaScript", () => {
        expect(evaluateExpression("'10' > 9", {}).value).toBe(true);
        expect(evaluateExpression("'10' >= 10", {}).value).toBe(true);
    });

    it("compares against a negative number literal", () => {
        expect(evaluateExpression("count > -1", scope).value).toBe(true);
        expect(evaluateExpression("count < -1", scope).value).toBe(false);
    });

    it("compares missing paths without throwing", () => {
        expect(evaluateExpression("missing === null", {}).value).toBe(false);
        expect(evaluateExpression("missing > 1", {}).value).toBe(false);
    });
});

describe("path reads", () => {
    it("resolves a numeric path segment", () => {
        const localScope = { items: [{ name: "Coffee" }] };

        expect(evaluateExpression("items.0.name", localScope).value).toBe(
            "Coffee",
        );
    });

    it("treats a null scope as having no data", () => {
        expect(evaluateExpression("user.name", null).value).toBeUndefined();
    });

    it("reads own properties of an array scope", () => {
        expect(evaluateExpression("length", [1, 2, 3]).value).toBe(3);
    });

    it("reads a scope without a prototype", () => {
        const plainScope = Object.create(null);

        plainScope.isOpen = true;

        expect(evaluateExpression("isOpen", plainScope).value).toBe(true);
    });

    it("reads a key named like a literal through a parent path", () => {
        const localScope = { true: "shadowed", object: { true: "value" } };

        expect(evaluateExpression("object.true", localScope).value).toBe(
            "value",
        );
        expect(evaluateExpression("true", localScope).value).toBe(true);
    });

    it("resolves a $ prefixed path from the scope", () => {
        const result = evaluateExpression("$index === 0", { $index: 0 });

        expect(result.value).toBe(true);
        expect(result.paths).toEqual(["$index"]);
    });
});

describe("rejected syntax", () => {
    it("rejects function calls", () => {
        expect(() => evaluateExpression("isOpen()", scope)).toThrow(
            'Invalid expression "isOpen()": function calls are not supported',
        );
    });

    it("rejects a function call with arguments", () => {
        expect(() => evaluateExpression("foo(a, b)", scope)).toThrow(
            'Invalid expression "foo(a, b)": function calls are not supported',
        );
    });

    it("rejects loose equality before a function call is diagnosed", () => {
        expect(() => evaluateExpression("isOpen(x == y)", scope)).toThrow(
            'Invalid expression "isOpen(x == y)": loose equality "==" is not supported, use "===" or "!=="',
        );
    });

    it("rejects assignment", () => {
        expect(() => evaluateExpression("isOpen = true", scope)).toThrow(
            'Invalid expression "isOpen = true": assignment is not supported',
        );
    });

    it("rejects index access", () => {
        expect(() => evaluateExpression("items[0]", scope)).toThrow(
            'Invalid expression "items[0]": index access is not supported',
        );
    });

    it("rejects arithmetic", () => {
        expect(() => evaluateExpression("count + 1", scope)).toThrow(
            'Invalid expression "count + 1": arithmetic is not supported',
        );
        expect(() => evaluateExpression("count - 1", scope)).toThrow(
            "arithmetic is not supported",
        );
        expect(() => evaluateExpression("count * 2", scope)).toThrow(
            "arithmetic is not supported",
        );
        expect(() => evaluateExpression("count / 2", scope)).toThrow(
            "arithmetic is not supported",
        );
        expect(() => evaluateExpression("count % 2", scope)).toThrow(
            "arithmetic is not supported",
        );
        expect(() => evaluateExpression("-1 - 2", scope)).toThrow(
            "arithmetic is not supported",
        );
    });

    it("rejects a sign that is not followed by a number", () => {
        expect(() => evaluateExpression("-heading", scope)).toThrow(
            'expected a number after "-" but found "heading"',
        );
        expect(() => evaluateExpression("--1", scope)).toThrow(
            'expected a number after "-" but found "-"',
        );
        expect(() => evaluateExpression("-", scope)).toThrow(
            'expected a number after "-" but found end of input',
        );
    });

    it("rejects a literal used as the first path segment", () => {
        expect(() => evaluateExpression("true.foo", scope)).toThrow(
            'unexpected "true.foo": "true" is a literal, not a path',
        );
        expect(() => evaluateExpression("null.foo", scope)).toThrow(
            'unexpected "null.foo": "null" is a literal, not a path',
        );
    });

    it("rejects object literals", () => {
        expect(() => evaluateExpression("{ open: true }", scope)).toThrow(
            "object literals are not supported",
        );
    });

    it("rejects array literals", () => {
        expect(() => evaluateExpression("[1, 2]", scope)).toThrow(
            "array literals are not supported",
        );
    });

    it("rejects loose equality", () => {
        expect(() => evaluateExpression("count == 0", scope)).toThrow(
            'loose equality "==" is not supported, use "===" or "!=="',
        );
        expect(() => evaluateExpression("count != 0", scope)).toThrow(
            'loose equality "!=" is not supported, use "===" or "!=="',
        );
    });

    it("rejects chained comparisons", () => {
        expect(() => evaluateExpression("1 < 2 < 3", {})).toThrow(
            "comparison operators cannot be chained",
        );
    });

    it("rejects chained strict equality without re-lexing it", () => {
        expect(() => evaluateExpression("a === b === c", {})).toThrow(
            'comparison operators cannot be chained, found "==="',
        );
    });

    it("rejects a stray colon", () => {
        expect(() => evaluateExpression("isOpen : isAdmin", scope)).toThrow(
            'Invalid expression "isOpen : isAdmin": a colon is only valid inside object literals, which are not supported',
        );
        expect(() => evaluateExpression(": isOpen", scope)).toThrow(
            'Invalid expression ": isOpen": a colon is only valid inside object literals, which are not supported',
        );
    });

    it("rejects a stray comma", () => {
        expect(() => evaluateExpression("isOpen, isAdmin", scope)).toThrow(
            'unexpected ",": expressions take a single value, so a list is not supported',
        );
        expect(() => evaluateExpression("(isOpen, isAdmin)", scope)).toThrow(
            'unexpected ",": expressions take a single value, so a list is not supported',
        );
    });

    it("names a construct rejected inside parentheses", () => {
        expect(() => evaluateExpression("(foo())", scope)).toThrow(
            'Invalid expression "(foo())": function calls are not supported',
        );
        expect(() => evaluateExpression("(items[0])", scope)).toThrow(
            'Invalid expression "(items[0])": index access is not supported',
        );
        expect(() => evaluateExpression("(a { open: true })", scope)).toThrow(
            'Invalid expression "(a { open: true })": object literals are not supported',
        );
        expect(() => evaluateExpression("(a: b)", scope)).toThrow(
            "a colon is only valid inside object literals, which are not supported",
        );
        expect(() => evaluateExpression("(a=1)", scope)).toThrow(
            'Invalid expression "(a=1)": assignment is not supported',
        );
    });

    it("names arithmetic and chained comparison inside parentheses", () => {
        expect(() => evaluateExpression("(a + 1)", scope)).toThrow(
            'Invalid expression "(a + 1)": arithmetic is not supported',
        );
        expect(() => evaluateExpression("(a === b === c)", scope)).toThrow(
            'Invalid expression "(a === b === c)": comparison operators cannot be chained, found "==="',
        );
    });

    it("names an operator where a primary is expected", () => {
        expect(() => evaluateExpression("(* 2)", scope)).toThrow(
            'Invalid expression "(* 2)": arithmetic is not supported',
        );
        expect(() => evaluateExpression("+1", scope)).toThrow(
            'Invalid expression "+1": arithmetic is not supported',
        );
        expect(() => evaluateExpression("/ 2", scope)).toThrow(
            'Invalid expression "/ 2": arithmetic is not supported',
        );
        expect(() => evaluateExpression("a === === b", scope)).toThrow(
            'Invalid expression "a === === b": comparison operators cannot be chained, found "==="',
        );
    });

    it("reports arithmetic on a delegated comparison operand", () => {
        expect(() => evaluateExpression("a === +1", scope)).toThrow(
            'Invalid expression "a === +1": arithmetic is not supported',
        );
    });

    it("reports a comparison operator without a left operand as a missing operand", () => {
        expect(() => evaluateExpression("> 1", scope)).toThrow(
            'Invalid expression "> 1": comparison operator ">" must follow an operand',
        );
        expect(() => evaluateExpression("=== 1", scope)).toThrow(
            'Invalid expression "=== 1": comparison operator "===" must follow an operand',
        );
        expect(() => evaluateExpression("(< 1)", scope)).toThrow(
            'Invalid expression "(< 1)": comparison operator "<" must follow an operand',
        );
    });

    it("reports a missing operand inside a parenthesized comparison operand", () => {
        expect(() => evaluateExpression("a === (> 1)", scope)).toThrow(
            'Invalid expression "a === (> 1)": comparison operator ">" must follow an operand',
        );
    });
});

describe("malformed expressions", () => {
    it("rejects an empty expression", () => {
        expect(() => evaluateExpression("", scope)).toThrow(
            "Invalid expression: expression is empty",
        );
        expect(() => evaluateExpression("   ", scope)).toThrow(
            "Invalid expression: expression is empty",
        );
    });

    it("rejects source that is not a string", () => {
        expect(() => evaluateExpression(null, scope)).toThrow(
            "Invalid expression: expression must be a string",
        );
        expect(() => evaluateExpression(42, scope)).toThrow(
            "Invalid expression: expression must be a string",
        );
    });

    it("rejects a trailing operator", () => {
        expect(() => evaluateExpression("isOpen &&", scope)).toThrow(
            'Invalid expression "isOpen &&": unexpected end of input',
        );
    });

    it("rejects an unbalanced parenthesis", () => {
        expect(() => evaluateExpression("(isOpen", scope)).toThrow(
            'Invalid expression "(isOpen": expected ")" but found end of input',
        );
        expect(() => evaluateExpression("isOpen)", scope)).toThrow(
            'Invalid expression "isOpen)": unexpected ")"',
        );
        expect(() => evaluateExpression("()", scope)).toThrow(
            'Invalid expression "()": unexpected ")"',
        );
    });

    it("reports a mismatched closer as the expected parenthesis", () => {
        expect(() => evaluateExpression("(a]", scope)).toThrow(
            'Invalid expression "(a]": expected ")" but found "]"',
        );
        expect(() => evaluateExpression("(a}", scope)).toThrow(
            'Invalid expression "(a}": expected ")" but found "}"',
        );
    });

    it("escapes embedded quotes in the source and the token text", () => {
        expect(() => evaluateExpression(`1 'a"b'`, scope)).toThrow(
            `Invalid expression "1 'a\\"b'": unexpected "'a\\"b'"`,
        );
    });

    it("rejects an unterminated string", () => {
        expect(() => evaluateExpression("'Coffee", scope)).toThrow(
            "unterminated string",
        );
        expect(() => evaluateExpression('"Coffee', scope)).toThrow(
            'Invalid expression "\\"Coffee": unterminated string',
        );
    });

    it("rejects an exponent as an unsupported number form", () => {
        expect(() => evaluateExpression("1e3", scope)).toThrow(
            'Invalid expression "1e3": unexpected "e3"',
        );
    });

    it("rejects a leading or trailing dot", () => {
        expect(() => evaluateExpression(".5", scope)).toThrow(
            'Invalid expression ".5": unexpected character "."',
        );
        expect(() => evaluateExpression("5.", scope)).toThrow(
            'Invalid expression "5.": unexpected character "."',
        );
    });

    it("escapes a backslash in the unexpected character message", () => {
        expect(() => evaluateExpression("a \\ b", scope)).toThrow(
            'Invalid expression "a \\\\ b": unexpected character "\\\\"',
        );
        expect(() => evaluateExpression("\\", scope)).toThrow(
            'Invalid expression "\\\\": unexpected character "\\\\"',
        );
    });

    it("rejects a single & or | as an unexpected character", () => {
        expect(() => evaluateExpression("a & b", scope)).toThrow(
            'Invalid expression "a & b": unexpected character "&"',
        );
        expect(() => evaluateExpression("a | b", scope)).toThrow(
            'Invalid expression "a | b": unexpected character "|"',
        );
    });

    it("rejects a non-ASCII identifier as an unexpected character", () => {
        // The identifier token stops at its ASCII prefix; the rest is rejected.
        expect(() => evaluateExpression("na\u00efve", scope)).toThrow(
            'Invalid expression "na\u00efve": unexpected character "\u00ef"',
        );
    });

    it("escapes a backslash inside a string token in the message", () => {
        expect(() => evaluateExpression("1 'a\\qb'", scope)).toThrow(
            String.raw`Invalid expression "1 'a\\qb'": unexpected "'a\\qb'"`,
        );
    });
});

describe("returned paths", () => {
    it("lists the paths read, in read order", () => {
        const result = evaluateExpression(
            "isOpen && user.role === 'admin'",
            scope,
        );

        expect(result.value).toBe(true);
        expect(result.paths).toEqual(["isOpen", "user.role"]);
    });

    it("lists a path once for every read", () => {
        const localScope = { a: true };

        expect(evaluateExpression("a && a", localScope).paths).toEqual([
            "a",
            "a",
        ]);
    });

    it("lists nothing for a literal-only expression", () => {
        expect(evaluateExpression("true && 'yes'", {}).paths).toEqual([]);
    });

    it("lists comparison paths left then right", () => {
        expect(
            evaluateExpression("isAdmin === user.role", scope).paths,
        ).toEqual(["isAdmin", "user.role"]);
    });

    it("keeps inherited members unreadable", () => {
        expect(evaluateExpression("toString", {}).value).toBeUndefined();
        expect(evaluateExpression("constructor", {}).value).toBeUndefined();
        expect(
            evaluateExpression("user.constructor", scope).value,
        ).toBeUndefined();
    });
});
