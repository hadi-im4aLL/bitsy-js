import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoolith, mount, runRoolith, stubFetch } from "./helpers.js";

describe("r-if", () => {
    beforeEach(() => {
        mount("");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("renders a truthy element and consumes the attribute", async () => {
        stubFetch({ "views/if-element.html": '<p r-if="isOpen">Open</p>' });

        mount('<r-view src="./views/if-element.html"></r-view>');

        await runRoolith(createRoolith({ data: { isOpen: true } }));

        expect(document.querySelector("p")?.textContent).toBe("Open");
        expect(document.querySelector("[r-if]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("removes a falsy element with its whole subtree", async () => {
        stubFetch({
            "views/if-hidden.html": `
                <section r-if="isOpen"><h2>Title</h2><p>Body</p></section>
                <p>Kept</p>
            `,
        });

        mount('<r-view src="./views/if-hidden.html"></r-view>');

        await runRoolith(createRoolith({ data: { isOpen: false } }));

        expect(document.querySelector("section")).toBeNull();
        expect(document.querySelector("h2")).toBeNull();
        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["Kept"]);
    });

    it("does not interpolate text inside a falsy branch", async () => {
        stubFetch({
            "views/if-interpolation.html":
                '<p r-if="isOpen">{missing.path}</p><p>Kept</p>',
        });

        mount('<r-view src="./views/if-interpolation.html"></r-view>');

        await runRoolith(createRoolith({ data: { isOpen: false } }));

        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["Kept"]);
    });

    it("replaces a truthy template with its rendered content", async () => {
        stubFetch({
            "views/if-template.html": `
                <template r-if="isOpen">
                    <h2>{title}</h2>
                    <p>Body</p>
                </template>
            `,
        });

        mount('<r-view src="./views/if-template.html"></r-view>');

        await runRoolith(
            createRoolith({ data: { isOpen: true, title: "Open" } }),
        );

        expect(document.querySelector("template")).toBeNull();
        expect(document.querySelector("h2")?.textContent).toBe("Open");
        expect(document.querySelector("p")?.textContent).toBe("Body");
        expect(document.body?.innerHTML ?? "").not.toContain("r-if");
    });

    it("removes a falsy template with its content", async () => {
        stubFetch({
            "views/if-template-hidden.html":
                '<template r-if="isOpen"><h2>Title</h2><p>Body</p></template><p>Kept</p>',
        });

        mount('<r-view src="./views/if-template-hidden.html"></r-view>');

        await runRoolith(createRoolith({ data: { isOpen: false } }));

        expect(document.querySelector("template")).toBeNull();
        expect(document.querySelector("h2")).toBeNull();
        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["Kept"]);
    });

    it("does not fetch a view inside a falsy branch", async () => {
        const { calls } = stubFetch({
            "views/if-branch.html":
                '<div r-if="isOpen"><r-view src="./if-nested.html"></r-view></div>',
            "views/if-nested.html": "<p>Nested</p>",
        });

        mount('<r-view src="./views/if-branch.html"></r-view>');

        await runRoolith(createRoolith({ data: { isOpen: false } }));

        expect(calls.map((call) => call.url.pathname)).toEqual([
            "/views/if-branch.html",
        ]);
        expect(document.querySelector("p")).toBeNull();
    });

    it("still renders a view inside a truthy branch", async () => {
        const { calls } = stubFetch({
            "views/if-branch-open.html":
                '<div r-if="isOpen"><r-view src="./if-nested-open.html"></r-view></div>',
            "views/if-nested-open.html": "<p>Nested</p>",
        });

        mount('<r-view src="./views/if-branch-open.html"></r-view>');

        await runRoolith(createRoolith({ data: { isOpen: true } }));

        expect(calls.map((call) => call.url.pathname)).toEqual([
            "/views/if-branch-open.html",
            "/views/if-nested-open.html",
        ]);
        expect(document.querySelector("p")?.textContent).toBe("Nested");
        expect(document.querySelector("div")).not.toBeNull();
    });

    it("evaluates the condition in the element's own data scope", async () => {
        stubFetch({
            "views/if-own-data.html": `
                <p r-data="{ open: false }" r-if="open">Hidden</p>
                <span r-data="{ open: true }" r-if="open">{open}</span>
            `,
        });

        mount('<r-view src="./views/if-own-data.html"></r-view>');

        await runRoolith(createRoolith());

        expect(document.querySelector("p")).toBeNull();
        expect(document.querySelector("span")?.textContent).toBe("true");
        expect(document.querySelector("[r-data]")).toBeNull();
    });

    it("evaluates a compound expression", async () => {
        stubFetch({
            "views/if-compound.html": `
                <p r-if="isOpen && user.role === 'admin'">Allowed</p>
                <p r-if="isOpen && user.role === 'guest'">Denied</p>
            `,
        });

        mount('<r-view src="./views/if-compound.html"></r-view>');

        await runRoolith(
            createRoolith({
                data: { isOpen: true, user: { role: "admin" } },
            }),
        );

        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["Allowed"]);
    });

    it("treats a short-circuited missing path as falsy", async () => {
        stubFetch({
            "views/if-short-circuit.html": `
                <p r-if="isOpen && missing.deep">Hidden</p>
                <p r-if="!isOpen && missing.deep">Hidden too</p>
                <p r-if="missing">Hidden as well</p>
                <p>Kept</p>
            `,
        });

        mount('<r-view src="./views/if-short-circuit.html"></r-view>');

        await runRoolith(createRoolith({ data: { isOpen: true } }));

        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["Kept"]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("keeps an invalid expression in place and reports it", async () => {
        stubFetch({
            "views/if-invalid.html": `
                <section r-if="isOpen &&"><p>Kept</p></section>
                <footer>After</footer>
            `,
        });

        mount('<r-view src="./views/if-invalid.html"></r-view>');

        await runRoolith(createRoolith({ data: { isOpen: true } }));

        const section = document.querySelector("section");

        expect(section).not.toBeNull();
        expect(section?.querySelector("p")?.textContent).toBe("Kept");
        expect(section?.getAttribute("data-r-error")).toContain(
            "Invalid expression",
        );
        expect(section?.hasAttribute("r-if")).toBe(false);
        expect(document.querySelector("footer")?.textContent).toBe("After");
        expect(document.querySelector(".r-view-error")).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("keeps a template whose expression is invalid", async () => {
        stubFetch({
            "views/if-invalid-template.html":
                '<template r-if="isOpen &&"><p>Kept</p></template>',
        });

        mount('<r-view src="./views/if-invalid-template.html"></r-view>');

        await runRoolith(createRoolith({ data: { isOpen: true } }));

        const template = document.querySelector("template");

        expect(template).not.toBeNull();
        expect(template?.getAttribute("data-r-error")).toContain(
            "Invalid expression",
        );
        expect(template?.content.querySelector("p")?.textContent).toBe("Kept");
        expect(document.querySelector(".r-view-error")).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("treats an empty condition as a directive error and keeps the element", async () => {
        stubFetch({
            "views/if-empty.html":
                '<p r-if="">Empty</p><p r-if="   ">Blank</p><p>Kept</p>',
        });

        mount('<r-view src="./views/if-empty.html"></r-view>');

        await runRoolith(createRoolith({ data: { isOpen: true } }));

        const paragraphs = [...document.querySelectorAll("p")];

        expect(paragraphs.map((node) => node.textContent)).toEqual([
            "Empty",
            "Blank",
            "Kept",
        ]);
        expect(paragraphs[0].getAttribute("data-r-error")).toContain(
            "Invalid expression: expression is empty",
        );
        expect(paragraphs[1].getAttribute("data-r-error")).toContain(
            "Invalid expression: expression is empty",
        );
        expect(paragraphs[0].hasAttribute("r-if")).toBe(false);
        expect(paragraphs[1].hasAttribute("r-if")).toBe(false);
        expect(document.querySelector(".r-view-error")).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(2);
    });

    it("renders nested conditionals in both outcomes", async () => {
        stubFetch({
            "views/if-nested.html": `
                <section r-if="isOpen">
                    <p r-if="isAdmin">Admin</p>
                    <p r-else>Guest</p>
                </section>
                <section r-if="isClosed">
                    <p r-if="isAdmin">Hidden admin</p>
                    <p r-else>Hidden guest</p>
                </section>
            `,
        });

        mount('<r-view src="./views/if-nested.html"></r-view>');

        await runRoolith(
            createRoolith({
                data: { isOpen: true, isClosed: false, isAdmin: false },
            }),
        );

        const sections = [...document.querySelectorAll("section")];

        expect(sections).toHaveLength(1);
        expect(
            [...sections[0].querySelectorAll("p")].map(
                (node) => node.textContent,
            ),
        ).toEqual(["Guest"]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("decides by truthiness for every kind of value", async () => {
        stubFetch({
            "views/if-truthiness.html": `
                <p r-if="zero">zero</p>
                <p r-if="empty">empty</p>
                <p r-if="emptyList">emptyList</p>
                <p r-if="text">text</p>
                <p r-if="nullValue">nullValue</p>
                <p>Kept</p>
            `,
        });

        mount('<r-view src="./views/if-truthiness.html"></r-view>');

        await runRoolith(
            createRoolith({
                data: {
                    zero: 0,
                    empty: "",
                    emptyList: [],
                    text: "false",
                    nullValue: null,
                },
            }),
        );

        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["emptyList", "text", "Kept"]);
        expect(console.error).not.toHaveBeenCalled();
    });
});

describe("r-else", () => {
    beforeEach(() => {
        mount("");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("renders the else element when the condition was falsy", async () => {
        stubFetch({
            "views/else-falsy.html":
                '<p r-if="isOpen">Open</p><p r-else>Closed</p>',
        });

        mount('<r-view src="./views/else-falsy.html"></r-view>');

        await runRoolith(createRoolith({ data: { isOpen: false } }));

        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["Closed"]);
        expect(document.querySelector("[r-else]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("removes the else element when the condition was truthy", async () => {
        stubFetch({
            "views/else-truthy.html":
                '<p r-if="isOpen">Open</p><p r-else>Closed</p>',
        });

        mount('<r-view src="./views/else-truthy.html"></r-view>');

        await runRoolith(createRoolith({ data: { isOpen: true } }));

        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["Open"]);
        expect(document.querySelector("[r-else]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("pairs across whitespace and comments", async () => {
        stubFetch({
            "views/else-whitespace.html": `
                <p r-if="isOpen">Open</p>

                <!-- fallback -->
                <p r-else>Closed</p>
            `,
        });

        mount('<r-view src="./views/else-whitespace.html"></r-view>');

        await runRoolith(createRoolith({ data: { isOpen: false } }));

        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["Closed"]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("pairs across text that interpolates to whitespace", async () => {
        stubFetch({
            "views/else-interpolated-whitespace.html":
                '<p r-if="isOpen">Open</p>{spacer}<p r-else>Closed</p>',
        });

        mount(
            '<r-view src="./views/else-interpolated-whitespace.html"></r-view>',
        );

        await runRoolith(
            createRoolith({ data: { isOpen: false, spacer: " " } }),
        );

        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["Closed"]);
        expect(document.querySelector("[data-r-error]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("orphans an else separated by text that interpolates to visible text", async () => {
        stubFetch({
            "views/else-interpolated-text.html":
                '<p r-if="isOpen">Open</p>{separator}<p r-else>Closed</p>',
        });

        mount('<r-view src="./views/else-interpolated-text.html"></r-view>');

        await runRoolith(
            createRoolith({ data: { isOpen: false, separator: "Between" } }),
        );

        const paragraphs = [...document.querySelectorAll("p")];

        expect(document.body?.textContent).toContain("Between");
        expect(paragraphs.map((node) => node.textContent)).toEqual(["Closed"]);
        expect(paragraphs[0].getAttribute("data-r-error")).toContain(
            'Attribute "r-else" must follow an element with "r-if"',
        );
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("reports an orphan else and keeps the element", async () => {
        stubFetch({
            "views/else-orphan.html": '<p r-else>Closed</p>',
        });

        mount('<r-view src="./views/else-orphan.html"></r-view>');

        await runRoolith(createRoolith());

        const paragraph = document.querySelector("p");

        expect(paragraph?.textContent).toBe("Closed");
        expect(paragraph?.getAttribute("data-r-error")).toContain(
            'Attribute "r-else" must follow an element with "r-if"',
        );
        expect(paragraph?.hasAttribute("r-else")).toBe(false);
        expect(document.querySelector(".r-view-error")).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("reports every else of a consecutive orphan run", async () => {
        stubFetch({
            "views/else-orphan-run.html":
                '<p r-if="a">A</p><span>sep</span><p r-else>B</p><p r-else r-if="c">C</p>',
        });

        mount('<r-view src="./views/else-orphan-run.html"></r-view>');

        await runRoolith(createRoolith({ data: { a: false, c: true } }));

        const paragraphs = [...document.querySelectorAll("p")];

        expect(document.querySelector("span")?.textContent).toBe("sep");
        expect(paragraphs.map((node) => node.textContent)).toEqual(["B", "C"]);
        expect(paragraphs[0].getAttribute("data-r-error")).toContain(
            'Attribute "r-else" must follow an element with "r-if"',
        );
        expect(paragraphs[1].getAttribute("data-r-error")).toContain(
            'Attribute "r-else" must follow an element with "r-if"',
        );
        expect(paragraphs[1].hasAttribute("r-if")).toBe(false);
        expect(console.error).toHaveBeenCalledTimes(2);
    });

    it("orphans an else separated from its condition by another element", async () => {
        stubFetch({
            "views/else-separated.html": `
                <p r-if="isOpen">Open</p>
                <span>Between</span>
                <p r-else>Closed</p>
            `,
        });

        mount('<r-view src="./views/else-separated.html"></r-view>');

        await runRoolith(createRoolith({ data: { isOpen: false } }));

        const paragraph = document.querySelector("p");
        const span = document.querySelector("span");

        expect(span?.textContent).toBe("Between");
        expect(span?.hasAttribute("data-r-error")).toBe(false);
        expect(paragraph?.textContent).toBe("Closed");
        expect(paragraph?.getAttribute("data-r-error")).toContain(
            'Attribute "r-else" must follow an element with "r-if"',
        );
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("orphans an else separated from its condition by visible text", async () => {
        stubFetch({
            "views/else-text.html":
                '<p r-if="isOpen">Open</p>Between<p r-else>Closed</p>',
        });

        mount('<r-view src="./views/else-text.html"></r-view>');

        await runRoolith(createRoolith({ data: { isOpen: false } }));

        expect(document.querySelector("p")?.getAttribute("data-r-error")).toContain(
            'Attribute "r-else" must follow an element with "r-if"',
        );
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("pairs an else template with a preceding condition element", async () => {
        stubFetch({
            "views/else-template.html": `
                <p r-if="isOpen">Open</p>
                <template r-else><h2>Closed</h2><p>Body</p></template>
            `,
        });

        mount('<r-view src="./views/else-template.html"></r-view>');

        await runRoolith(createRoolith({ data: { isOpen: false } }));

        expect(document.querySelector("template")).toBeNull();
        expect(document.querySelector("h2")?.textContent).toBe("Closed");
        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["Body"]);
    });

    it("keeps an orphan else template in place with its error", async () => {
        stubFetch({
            "views/else-orphan-template.html":
                '<template r-else><p>Fallback</p></template>',
        });

        mount('<r-view src="./views/else-orphan-template.html"></r-view>');

        await runRoolith(createRoolith());

        const template = document.querySelector("template");

        expect(template).not.toBeNull();
        expect(template?.getAttribute("data-r-error")).toContain(
            'Attribute "r-else" must follow an element with "r-if"',
        );
        expect(template?.hasAttribute("r-else")).toBe(false);
        expect(template?.content.querySelector("p")?.textContent).toBe(
            "Fallback",
        );
        expect(document.querySelector("body p")).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("removes a duplicate bare else", async () => {
        stubFetch({
            "views/else-duplicate.html": `
                <p r-if="isOpen">Open</p>
                <p r-else>First fallback</p>
                <p r-else>Second fallback</p>
            `,
        });

        mount('<r-view src="./views/else-duplicate.html"></r-view>');

        await runRoolith(createRoolith({ data: { isOpen: false } }));

        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["First fallback"]);
        expect(document.querySelector("[data-r-error]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("removes an else that follows a failed condition", async () => {
        stubFetch({
            "views/else-after-error.html": `
                <p r-if="isOpen &&">Kept</p>
                <p r-else>Fallback</p>
            `,
        });

        mount('<r-view src="./views/else-after-error.html"></r-view>');

        await runRoolith(createRoolith({ data: { isOpen: true } }));

        const paragraphs = [...document.querySelectorAll("p")];

        expect(paragraphs.map((node) => node.textContent)).toEqual(["Kept"]);
        expect(paragraphs[0].getAttribute("data-r-error")).toContain(
            "Invalid expression",
        );
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("keeps an else-if branch whose own condition is invalid", async () => {
        stubFetch({
            "views/else-chain-invalid.html":
                '<p r-if="a">A</p><p r-else r-if="b &&">B</p><p r-else>C</p>',
        });

        mount('<r-view src="./views/else-chain-invalid.html"></r-view>');

        await runRoolith(createRoolith({ data: { a: false } }));

        const paragraphs = [...document.querySelectorAll("p")];

        expect(paragraphs.map((node) => node.textContent)).toEqual(["B"]);
        expect(paragraphs[0].getAttribute("data-r-error")).toContain(
            "Invalid expression",
        );
        expect(paragraphs[0].hasAttribute("r-else")).toBe(false);
        expect(paragraphs[0].hasAttribute("r-if")).toBe(false);
        expect(document.querySelector(".r-view-error")).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("removes an orphan else whose own condition is falsy", async () => {
        stubFetch({
            "views/else-orphan-own-condition.html":
                '<p r-if="a">A</p><span>sep</span><p r-else r-if="c">C</p>',
        });

        mount('<r-view src="./views/else-orphan-own-condition.html"></r-view>');

        await runRoolith(createRoolith({ data: { a: false, c: false } }));

        expect(console.error).toHaveBeenCalledTimes(1);
        expect(document.querySelector("span")?.textContent).toBe("sep");
        expect(document.querySelectorAll("p")).toHaveLength(0);
        expect(document.querySelector("[data-r-error]")).toBeNull();

        const [reported] = console.error.mock.calls[0];

        expect(reported.message).toContain(
            'Attribute "r-else" must follow an element with "r-if"',
        );
    });

    it("renders only one branch of an else-if chain", async () => {
        const content = `
            <p r-if="a">A</p>
            <p r-else r-if="b">B</p>
            <p r-else>C</p>
        `;
        const cases = [
            { a: true, b: true, expected: ["A"] },
            { a: false, b: true, expected: ["B"] },
            { a: false, b: false, expected: ["C"] },
            { a: true, b: false, expected: ["A"] },
        ];

        for (const scenario of cases) {
            mount("");
            stubFetch({ "views/else-chain.html": content });
            mount('<r-view src="./views/else-chain.html"></r-view>');

            await runRoolith(
                createRoolith({ data: { a: scenario.a, b: scenario.b } }),
            );

            expect(
                [...document.querySelectorAll("p")].map(
                    (node) => node.textContent,
                ),
            ).toEqual(scenario.expected);
        }

        expect(console.error).not.toHaveBeenCalled();
    });
});

describe("custom directive attribute names", () => {
    beforeEach(() => {
        mount("");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("threads custom if and else attribute names through the renderer", async () => {
        const content = `
            <p x-if="isOpen">Open</p>
            <p x-else>Closed</p>
            <p r-if="isOpen">Ignored r-if</p>
        `;
        const cases = [
            { isOpen: false, expected: ["Closed", "Ignored r-if"] },
            { isOpen: true, expected: ["Open", "Ignored r-if"] },
        ];

        for (const scenario of cases) {
            mount("");
            stubFetch({ "views/custom-attributes.html": content });
            mount('<r-view src="./views/custom-attributes.html"></r-view>');

            await runRoolith(
                createRoolith({
                    ifAttribute: "x-if",
                    elseAttribute: "x-else",
                    data: { isOpen: scenario.isOpen },
                }),
            );

            expect(
                [...document.querySelectorAll("p")].map(
                    (node) => node.textContent,
                ),
            ).toEqual(scenario.expected);
            expect(document.querySelector("[x-if]")).toBeNull();
            expect(document.querySelector("[x-else]")).toBeNull();
            expect(document.querySelectorAll("[r-if]")).toHaveLength(1);
        }

        expect(console.error).not.toHaveBeenCalled();
    });

    it("threads custom loop and data attribute names through the renderer", async () => {
        const content = `
            <ul>
                <li x-for="item in items" x-data="{ name: item }" x-if="name !== 'Tea'">{name}</li>
                <li r-for="item in items" r-data="{ broken" r-if="false">Ignored</li>
            </ul>
        `;

        mount("");
        stubFetch({ "views/custom-loop-data.html": content });
        mount('<r-view src="./views/custom-loop-data.html"></r-view>');

        await runRoolith(
            createRoolith({
                loopAttribute: "x-for",
                dataAttribute: "x-data",
                ifAttribute: "x-if",
                data: { items: ["Coffee", "Tea", "Cocoa"] },
            }),
        );

        expect(
            [...document.querySelectorAll("li")].map((node) =>
                node.textContent.trim(),
            ),
        ).toEqual(["Coffee", "Cocoa", "Ignored"]);
        expect(document.querySelector("[x-for]")).toBeNull();
        expect(document.querySelector("[x-data]")).toBeNull();
        expect(document.querySelector("[x-if]")).toBeNull();
        expect(document.querySelectorAll("[r-for]")).toHaveLength(1);
        expect(document.querySelectorAll("[r-data]")).toHaveLength(1);
        expect(document.querySelectorAll("[r-if]")).toHaveLength(1);
        expect(console.error).not.toHaveBeenCalled();
    });
});
