import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoolith, mount, runRoolith, stubFetch } from "./helpers.js";

describe("conditions on raw-text elements", () => {
    beforeEach(() => {
        mount("");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("consumes a condition on a script without interpolating its text", async () => {
        stubFetch({
            "views/if-script.html": `
                <script r-if="isOpen">window.title = "{title}";</script>
                <script r-if="isClosed">window.hidden = true;</script>
                <p>Kept</p>
            `,
        });

        mount('<r-view src="./views/if-script.html"></r-view>');

        await runRoolith(
            createRoolith({ data: { isOpen: true, isClosed: false, title: "Home" } }),
        );

        const scripts = [...document.querySelectorAll("script")];

        expect(scripts).toHaveLength(1);
        expect(scripts[0].textContent).toBe('window.title = "{title}";');
        expect(document.querySelector("[r-if]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("consumes an else on a style without interpolating its text", async () => {
        stubFetch({
            "views/else-style.html": `
                <p r-if="isOpen">Open</p>
                <style r-else>p { color: red; } /* {title} */</style>
            `,
        });

        mount('<r-view src="./views/else-style.html"></r-view>');

        await runRoolith(
            createRoolith({ data: { isOpen: false, title: "Home" } }),
        );

        const styles = [...document.querySelectorAll("style")];

        expect(styles).toHaveLength(1);
        expect(styles[0].textContent).toBe('p { color: red; } /* {title} */');
        expect(document.querySelector("[r-else]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("renders a repeated script once with its directives consumed", async () => {
        stubFetch({
            "views/loop-script.html":
                '<script r-for="item in items">window.x = "{item}";</script><p>Kept</p>',
        });

        mount('<r-view src="./views/loop-script.html"></r-view>');

        await runRoolith(createRoolith({ data: { items: ["a", "b"] } }));

        const scripts = [...document.querySelectorAll("script")];

        expect(scripts).toHaveLength(1);
        expect(scripts[0].textContent).toBe('window.x = "{item}";');
        expect(scripts[0].hasAttribute("r-for")).toBe(false);
        expect(document.querySelector("p")?.textContent).toBe("Kept");
        expect(document.querySelector("[data-r-error]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("consumes declared data on a script without evaluating it", async () => {
        stubFetch({
            "views/loop-script-data.html":
                '<script r-data="{ broken">window.y = "{value}";</script><p>Kept</p>',
        });

        mount('<r-view src="./views/loop-script-data.html"></r-view>');

        await runRoolith(createRoolith({ data: { value: "Home" } }));

        const scripts = [...document.querySelectorAll("script")];

        expect(scripts).toHaveLength(1);
        expect(scripts[0].hasAttribute("r-data")).toBe(false);
        expect(scripts[0].textContent).toBe('window.y = "{value}";');
        expect(document.querySelector("p")?.textContent).toBe("Kept");
        expect(document.querySelector("[data-r-error]")).toBeNull();
        expect(document.querySelector(".r-view-error")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });
});

describe("conditions with nested views", () => {
    beforeEach(() => {
        mount("");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("replaces the containing view when a placeholder condition is invalid", async () => {
        const { calls } = stubFetch({
            "views/if-placeholder-invalid.html":
                '<r-view src="./if-placeholder-child.html" r-if="isOpen &&"></r-view>',
            "views/if-placeholder-child.html": "<p>Child</p>",
        });

        mount('<r-view src="./views/if-placeholder-invalid.html"></r-view>');

        await runRoolith(createRoolith({ data: { isOpen: true } }));

        const errorElement = document.querySelector(".r-view-error");

        expect(document.querySelector("p")).toBeNull();
        expect(errorElement).not.toBeNull();
        expect(errorElement?.getAttribute("data-view-error")).toContain(
            "Invalid expression",
        );
        expect(document.querySelector("[data-r-error]")).toBeNull();
        expect(calls.map((call) => call.url.pathname)).toEqual([
            "/views/if-placeholder-invalid.html",
        ]);
    });

    it("removes an unreached placeholder without fetching its view", async () => {
        const { calls } = stubFetch({
            "views/if-placeholder-hidden.html":
                '<r-view src="./if-placeholder-unreached.html" r-if="isOpen"></r-view>',
            "views/if-placeholder-unreached.html": "<p>Child</p>",
        });

        mount('<r-view src="./views/if-placeholder-hidden.html"></r-view>');

        await runRoolith(createRoolith({ data: { isOpen: false } }));

        expect(document.querySelector("p")).toBeNull();
        expect(document.querySelector("[data-r-error]")).toBeNull();
        expect(document.querySelector(".r-view-error")).toBeNull();
        expect(calls.map((call) => call.url.pathname)).toEqual([
            "/views/if-placeholder-hidden.html",
        ]);
    });

    it("renders the else fallback of a falsy placeholder that is never fetched", async () => {
        const { calls } = stubFetch({
            "views/if-placeholder-else.html":
                '<r-view src="./if-placeholder-else-child.html" r-if="isOpen"></r-view><p r-else>Fallback</p>',
            "views/if-placeholder-else-child.html": "<p>Child</p>",
        });

        mount('<r-view src="./views/if-placeholder-else.html"></r-view>');

        await runRoolith(createRoolith({ data: { isOpen: false } }));

        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["Fallback"]);
        expect(document.querySelector("r-view")).toBeNull();
        expect(document.querySelector("[data-r-error]")).toBeNull();
        expect(document.querySelector(".r-view-error")).toBeNull();
        expect(calls.map((call) => call.url.pathname)).toEqual([
            "/views/if-placeholder-else.html",
        ]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("renders a selected else placeholder with its view and parent scope", async () => {
        const { calls } = stubFetch({
            "views/else-placeholder-selected.html":
                '<r-view src="./else-placeholder-open.html" r-if="isOpen"></r-view><r-view src="./else-placeholder-closed.html" r-else></r-view>',
            "views/else-placeholder-open.html": "<p>Open</p>",
            "views/else-placeholder-closed.html": "<p>{label}</p>",
        });

        mount('<r-view src="./views/else-placeholder-selected.html"></r-view>');

        await runRoolith(
            createRoolith({ data: { isOpen: false, label: "Closed" } }),
        );

        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["Closed"]);
        expect(document.querySelector("r-view")).toBeNull();
        expect(document.querySelector("[data-r-error]")).toBeNull();
        expect(calls.map((call) => call.url.pathname)).toEqual([
            "/views/else-placeholder-selected.html",
            "/views/else-placeholder-closed.html",
        ]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("removes a deselected else placeholder without fetching its view", async () => {
        const { calls } = stubFetch({
            "views/else-placeholder-deselected.html":
                '<r-view src="./else-placeholder-open.html" r-if="isOpen"></r-view><r-view src="./else-placeholder-suppressed.html" r-else></r-view>',
            "views/else-placeholder-open.html": "<p>Open</p>",
            "views/else-placeholder-suppressed.html": "<p>Suppressed</p>",
        });

        mount('<r-view src="./views/else-placeholder-deselected.html"></r-view>');

        await runRoolith(createRoolith({ data: { isOpen: true } }));

        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["Open"]);
        expect(document.querySelector("r-view")).toBeNull();
        expect(document.querySelector("[data-r-error]")).toBeNull();
        expect(calls.map((call) => call.url.pathname)).toEqual([
            "/views/else-placeholder-deselected.html",
            "/views/else-placeholder-open.html",
        ]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("replaces the containing view when an else placeholder is orphaned", async () => {
        const { calls } = stubFetch({
            "views/else-placeholder-orphan.html":
                '<r-view src="./else-placeholder-child.html" r-else></r-view>',
            "views/else-placeholder-child.html": "<p>Child</p>",
        });

        mount('<r-view src="./views/else-placeholder-orphan.html"></r-view>');

        await runRoolith(createRoolith());

        const errorElement = document.querySelector(".r-view-error");

        expect(document.querySelector("p")).toBeNull();
        expect(errorElement).not.toBeNull();
        expect(errorElement?.getAttribute("data-view-error")).toContain(
            'Attribute "r-else" must follow an element with "r-if"',
        );
        expect(document.querySelector("[data-r-error]")).toBeNull();
        expect(calls.map((call) => call.url.pathname)).toEqual([
            "/views/else-placeholder-orphan.html",
        ]);
    });

    it("renders a nested view inside a selected else template with its scope", async () => {
        const { calls } = stubFetch({
            "views/else-template-nested.html": `
                <p r-if="isOpen">Open</p>
                <template r-else>
                    <r-view src="./else-template-child.html" r-data="{ title: label }"></r-view>
                </template>
            `,
            "views/else-template-child.html": "<p>{title}</p>",
        });

        mount('<r-view src="./views/else-template-nested.html"></r-view>');

        await runRoolith(
            createRoolith({ data: { isOpen: false, label: "Closed" } }),
        );

        expect(
            [...document.querySelectorAll("p")].map((node) => node.textContent),
        ).toEqual(["Closed"]);
        expect(document.querySelector("[r-data]")).toBeNull();
        expect(calls.map((call) => call.url.pathname)).toEqual([
            "/views/else-template-nested.html",
            "/views/else-template-child.html",
        ]);
        expect(console.error).not.toHaveBeenCalled();
    });
});

describe("r-for with conditions", () => {
    beforeEach(() => {
        mount("");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("filters every clone of a repeated element by its item scope", async () => {
        stubFetch({
            "views/loop-if.html":
                '<ul><li r-for="item in items" r-if="item.visible">{item.name}</li></ul>',
        });

        mount('<r-view src="./views/loop-if.html"></r-view>');

        await runRoolith(
            createRoolith({
                data: {
                    items: [
                        { name: "Coffee", visible: true },
                        { name: "Tea", visible: false },
                        { name: "Cocoa", visible: true },
                    ],
                },
            }),
        );

        expect(
            [...document.querySelectorAll("li")].map((node) => node.textContent),
        ).toEqual(["Coffee", "Cocoa"]);
        expect(document.querySelector("[r-for]")).toBeNull();
        expect(document.querySelector("[r-if]")).toBeNull();
    });

    it("applies a repeated template condition once in the surrounding scope", async () => {
        const content =
            '<ul><template r-for="item in items" r-if="isOpen"><li>{item}</li></template></ul>';

        stubFetch({ "views/loop-if-template.html": content });

        mount('<r-view src="./views/loop-if-template.html"></r-view>');

        await runRoolith(
            createRoolith({
                data: { isOpen: true, items: ["Coffee", "Tea"] },
            }),
        );

        expect(
            [...document.querySelectorAll("li")].map((node) => node.textContent),
        ).toEqual(["Coffee", "Tea"]);
        expect(document.querySelector("template")).toBeNull();
    });

    it("removes the whole repeated template group when its condition is falsy", async () => {
        stubFetch({
            "views/loop-if-template-hidden.html":
                '<ul><template r-for="item in items" r-if="isOpen"><li>{item}</li></template></ul>',
        });

        mount('<r-view src="./views/loop-if-template-hidden.html"></r-view>');

        await runRoolith(
            createRoolith({
                data: { isOpen: false, items: ["Coffee", "Tea"] },
            }),
        );

        expect(document.querySelector("li")).toBeNull();
        expect(document.querySelector("template")).toBeNull();
        expect(document.querySelector("ul")).not.toBeNull();
    });

    it("evaluates a repeated template's own data before its condition", async () => {
        const content =
            '<ul><template r-for="item in items" r-data="{ open: true }" r-if="open"><li>{item}</li></template></ul>';

        stubFetch({ "views/loop-if-template-data.html": content });

        mount('<r-view src="./views/loop-if-template-data.html"></r-view>');

        await runRoolith(
            createRoolith({ data: { items: ["Coffee", "Tea"] } }),
        );

        expect(
            [...document.querySelectorAll("li")].map((node) => node.textContent),
        ).toEqual(["Coffee", "Tea"]);
        expect(document.querySelector("[r-data]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("removes a repeated template group when its own declared data is falsy", async () => {
        stubFetch({
            "views/loop-if-template-data-hidden.html":
                '<ul><template r-for="item in items" r-data="{ open: false }" r-if="open"><li>{item}</li></template></ul>',
        });

        mount(
            '<r-view src="./views/loop-if-template-data-hidden.html"></r-view>',
        );

        await runRoolith(
            createRoolith({ data: { items: ["Coffee", "Tea"] } }),
        );

        expect(document.querySelector("li")).toBeNull();
        expect(document.querySelector("template")).toBeNull();
        expect(document.querySelector("ul")).not.toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("resolves element form declared data per item", async () => {
        stubFetch({
            "views/loop-if-data.html": `
                <ul>
                    <li r-for="item in items" r-data="{ name: item }" r-if="name !== 'Tea'">{name}</li>
                </ul>
            `,
        });

        mount('<r-view src="./views/loop-if-data.html"></r-view>');

        await runRoolith(
            createRoolith({ data: { items: ["Coffee", "Tea", "Cocoa"] } }),
        );

        expect(
            [...document.querySelectorAll("li")].map((node) => node.textContent),
        ).toEqual(["Coffee", "Cocoa"]);
        expect(document.querySelector("[r-data]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("evaluates an else inside a repeated template per item", async () => {
        stubFetch({
            "views/loop-else.html": `
                <ul>
                    <template r-for="item in items">
                        <li r-if="item.visible">{item.name}</li>
                        <li r-else>Hidden</li>
                    </template>
                </ul>
            `,
        });

        mount('<r-view src="./views/loop-else.html"></r-view>');

        await runRoolith(
            createRoolith({
                data: {
                    items: [
                        { name: "Coffee", visible: true },
                        { name: "Tea", visible: false },
                    ],
                },
            }),
        );

        expect(
            [...document.querySelectorAll("li")].map((node) => node.textContent),
        ).toEqual(["Coffee", "Hidden"]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("repeats a selected else template group", async () => {
        stubFetch({
            "views/else-loop-selected.html": `
                <ul>
                    <li r-if="isOpen">Open</li>
                    <template r-else r-for="item in items"><li>{item}</li></template>
                </ul>
            `,
        });

        mount('<r-view src="./views/else-loop-selected.html"></r-view>');

        await runRoolith(
            createRoolith({
                data: { isOpen: false, items: ["Coffee", "Tea"] },
            }),
        );

        expect(
            [...document.querySelectorAll("li")].map((node) => node.textContent),
        ).toEqual(["Coffee", "Tea"]);
        expect(document.querySelector("template")).toBeNull();
        expect(document.querySelector("[data-r-error]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("removes a deselected else template group", async () => {
        stubFetch({
            "views/else-loop-deselected.html": `
                <ul>
                    <li r-if="isOpen">Open</li>
                    <template r-else r-for="item in items"><li>{item}</li></template>
                </ul>
            `,
        });

        mount('<r-view src="./views/else-loop-deselected.html"></r-view>');

        await runRoolith(
            createRoolith({
                data: { isOpen: true, items: ["Coffee", "Tea"] },
            }),
        );

        expect(
            [...document.querySelectorAll("li")].map((node) => node.textContent),
        ).toEqual(["Open"]);
        expect(document.querySelector("template")).toBeNull();
        expect(document.querySelector("[data-r-error]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("evaluates a chain inside an element form loop clone per item", async () => {
        stubFetch({
            "views/loop-else-element.html": `
                <ul>
                    <li r-for="item in items">
                        <span r-if="item.visible">{item.name}</span>
                        <span r-else>Hidden</span>
                    </li>
                </ul>
            `,
        });

        mount('<r-view src="./views/loop-else-element.html"></r-view>');

        await runRoolith(
            createRoolith({
                data: {
                    items: [
                        { name: "Coffee", visible: true },
                        { name: "Tea", visible: false },
                    ],
                },
            }),
        );

        expect(
            [...document.querySelectorAll("li")].map((node) =>
                node.textContent.trim(),
            ),
        ).toEqual(["Coffee", "Hidden"]);
        expect(document.querySelector("[r-for]")).toBeNull();
        expect(document.querySelector("[r-if]")).toBeNull();
        expect(document.querySelector("[r-else]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("keeps a repeated template whose own condition is invalid", async () => {
        stubFetch({
            "views/loop-if-template-invalid.html":
                '<ul><template r-for="item in items" r-if="isOpen &&"><li>{item}</li></template></ul>',
        });

        mount('<r-view src="./views/loop-if-template-invalid.html"></r-view>');

        await runRoolith(
            createRoolith({
                data: { isOpen: true, items: ["Coffee", "Tea"] },
            }),
        );

        const template = document.querySelector("template");

        expect(template).not.toBeNull();
        expect(template?.getAttribute("data-r-error")).toContain(
            "Invalid expression",
        );
        expect(template?.hasAttribute("r-for")).toBe(false);
        expect(template?.hasAttribute("r-if")).toBe(false);
        expect(template?.content.querySelector("li")?.textContent).toBe(
            "{item}",
        );
        expect(document.querySelector("li")).toBeNull();
        expect(document.querySelector(".r-view-error")).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("keeps an orphan else template without repeating it", async () => {
        stubFetch({
            "views/else-loop-orphan-template.html":
                '<ul><template r-else r-for="item in items"><li>{item}</li></template></ul>',
        });

        mount('<r-view src="./views/else-loop-orphan-template.html"></r-view>');

        await runRoolith(
            createRoolith({ data: { items: ["Coffee", "Tea"] } }),
        );

        const template = document.querySelector("template");

        expect(template).not.toBeNull();
        expect(template?.getAttribute("data-r-error")).toContain(
            'Attribute "r-else" must follow an element with "r-if"',
        );
        expect(template?.hasAttribute("r-else")).toBe(false);
        expect(template?.hasAttribute("r-for")).toBe(false);
        expect(document.querySelector("li")).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("consumes declared data on an orphan else loop element", async () => {
        stubFetch({
            "views/else-loop-orphan-element.html":
                '<p r-else r-for="x in xs" r-data="{ y: 1 }">{y}</p>',
        });

        mount('<r-view src="./views/else-loop-orphan-element.html"></r-view>');

        await runRoolith(createRoolith({ data: { xs: [1, 2] } }));

        const paragraph = document.querySelector("p");

        expect(paragraph).not.toBeNull();
        expect(paragraph?.getAttribute("data-r-error")).toContain(
            'Attribute "r-else" must follow an element with "r-if"',
        );
        expect(paragraph?.hasAttribute("r-else")).toBe(false);
        expect(paragraph?.hasAttribute("r-for")).toBe(false);
        expect(paragraph?.hasAttribute("r-data")).toBe(false);
        expect(paragraph?.textContent).toBe("{y}");
        expect(document.querySelectorAll("p")).toHaveLength(1);
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("consumes unusable declared data on an orphan else loop element without evaluating it", async () => {
        stubFetch({
            "views/else-loop-orphan-data.html":
                '<p r-else r-for="x in xs" r-data="missing">{y}</p>',
        });

        mount('<r-view src="./views/else-loop-orphan-data.html"></r-view>');

        await runRoolith(createRoolith({ data: { xs: [1, 2] } }));

        const paragraphs = [...document.querySelectorAll("p")];

        expect(paragraphs).toHaveLength(1);
        expect(paragraphs[0].textContent).toBe("{y}");
        expect(paragraphs[0].getAttribute("data-r-error")).toContain(
            'Attribute "r-else" must follow an element with "r-if"',
        );
        expect(paragraphs[0].getAttribute("data-r-error")).not.toContain(
            'Data attribute "missing"',
        );
        expect(paragraphs[0].hasAttribute("r-for")).toBe(false);
        expect(paragraphs[0].hasAttribute("r-data")).toBe(false);
        expect(document.querySelector(".r-view-error")).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("consumes a condition on an orphan else loop element", async () => {
        stubFetch({
            "views/else-loop-orphan-if.html":
                '<p r-else r-for="x in xs" r-if="show">{show}</p>',
        });

        mount('<r-view src="./views/else-loop-orphan-if.html"></r-view>');

        await runRoolith(createRoolith({ data: { xs: [1, 2], show: true } }));

        const paragraphs = [...document.querySelectorAll("p")];

        expect(paragraphs).toHaveLength(1);
        expect(paragraphs[0].textContent).toBe("{show}");
        expect(paragraphs[0].getAttribute("data-r-error")).toBe(
            'Attribute "r-else" must follow an element with "r-if"',
        );
        expect(paragraphs[0].hasAttribute("r-for")).toBe(false);
        expect(paragraphs[0].hasAttribute("r-data")).toBe(false);
        expect(paragraphs[0].hasAttribute("r-if")).toBe(false);
        expect(document.querySelector(".r-view-error")).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("consumes an invalid condition on an orphan else loop element without evaluating it", async () => {
        stubFetch({
            "views/else-loop-orphan-if-invalid.html":
                '<p r-else r-for="x in xs" r-if="show &&">row</p>',
        });

        mount(
            '<r-view src="./views/else-loop-orphan-if-invalid.html"></r-view>',
        );

        await runRoolith(createRoolith({ data: { xs: [1, 2], show: true } }));

        const paragraphs = [...document.querySelectorAll("p")];

        expect(paragraphs).toHaveLength(1);
        expect(paragraphs[0].getAttribute("data-r-error")).toBe(
            'Attribute "r-else" must follow an element with "r-if"',
        );
        expect(paragraphs[0].getAttribute("data-r-error")).not.toContain(
            'Invalid expression "show &&"',
        );
        expect(paragraphs[0].hasAttribute("r-for")).toBe(false);
        expect(paragraphs[0].hasAttribute("r-data")).toBe(false);
        expect(paragraphs[0].hasAttribute("r-if")).toBe(false);
        expect(document.querySelector(".r-view-error")).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
    });
});
