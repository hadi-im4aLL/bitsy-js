import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoolith, mount, runRoolith, stubFetch } from "./helpers.js";

describe("remotes with other directives", () => {
    beforeEach(() => {
        mount("");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("does not fetch a remote inside a falsy branch", async () => {
        const { calls } = stubFetch({
            "views/remote-hidden.html":
                '<div r-if="isOpen" r-remote="./hidden-panel.html"></div><p>After</p>',
        });

        mount('<r-view src="./views/remote-hidden.html"></r-view>');

        await runRoolith(createRoolith({ data: { isOpen: false } }));

        expect(calls.map(({ url }) => url.pathname)).toEqual([
            "/views/remote-hidden.html",
        ]);
        expect(document.querySelector("p")?.textContent).toBe("After");
        expect(console.error).not.toHaveBeenCalled();
    });

    it("fetches a remote inside a truthy branch", async () => {
        stubFetch({
            "views/remote-visible.html":
                '<div r-if="isOpen" r-remote="./visible-panel.html"></div>',
            "views/visible-panel.html": "<p>Visible</p>",
        });

        mount('<r-view src="./views/remote-visible.html"></r-view>');

        await runRoolith(createRoolith({ data: { isOpen: true } }));

        expect(document.querySelector("p")?.textContent).toBe("Visible");
        expect(document.querySelector("[r-if]")).toBeNull();
        expect(document.querySelector("[data-r-error]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("renders a remote response once per repeated clone in the item scope", async () => {
        const { calls } = stubFetch({
            "views/remote-loop.html":
                '<ul><li r-for="item in items" r-remote="./loop-panel.html"></li></ul>',
            "views/loop-panel.html": "<span>{item}</span>",
        });

        mount('<r-view src="./views/remote-loop.html"></r-view>');

        await runRoolith(
            createRoolith({ data: { items: ["Coffee", "Tea"] } }),
        );

        expect(
            [...document.querySelectorAll("li span")].map(
                (node) => node.textContent,
            ),
        ).toEqual(["Coffee", "Tea"]);
        expect(
            calls.filter(
                ({ url }) => url.pathname === "/views/loop-panel.html",
            ),
        ).toHaveLength(1);
        expect(document.querySelector("[r-for]")).toBeNull();
        expect(document.querySelector("[r-remote]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("consumes a remote on a script without requesting it", async () => {
        const { calls } = stubFetch({
            "views/remote-script.html":
                '<script r-remote="./script-panel.html">window.x = 1;</script><p>After</p>',
        });

        mount('<r-view src="./views/remote-script.html"></r-view>');

        await runRoolith(createRoolith());

        const script = document.querySelector("script");

        expect(script?.hasAttribute("r-remote")).toBe(false);
        expect(script?.textContent).toBe("window.x = 1;");
        expect(calls.map(({ url }) => url.pathname)).toEqual([
            "/views/remote-script.html",
        ]);
        expect(document.querySelector("p")?.textContent).toBe("After");
        expect(console.error).not.toHaveBeenCalled();
    });

    it("loads a remote inside a nested view against the nested view URL", async () => {
        stubFetch({
            "views/remote-parent.html":
                '<r-view src="./parts/remote-owner.html"></r-view>',
            "views/parts/remote-owner.html":
                '<div r-remote="./owner-panel.html"></div>',
            "views/parts/owner-panel.html": "<p>Owned</p>",
        });

        mount('<r-view src="./views/remote-parent.html"></r-view>');

        await runRoolith(createRoolith());

        expect(document.querySelector("p")?.textContent).toBe("Owned");
        expect(console.error).not.toHaveBeenCalled();
    });

    it("runs conditions and loops inside a remote markup response", async () => {
        stubFetch({
            "views/remote-directives-owner.html":
                '<div r-remote="./directive-panel.html"></div>',
            "views/directive-panel.html": `
                <ul><li r-for="item in items" r-if="item.visible">{item.name}</li></ul>
                <p r-if="isOpen">Open</p>
            `,
        });

        mount('<r-view src="./views/remote-directives-owner.html"></r-view>');

        await runRoolith(
            createRoolith({
                data: {
                    isOpen: true,
                    items: [
                        { name: "Coffee", visible: true },
                        { name: "Tea", visible: false },
                    ],
                },
            }),
        );

        expect(
            [...document.querySelectorAll("li")].map(
                (node) => node.textContent,
            ),
        ).toEqual(["Coffee"]);
        expect(document.querySelector("p")?.textContent).toBe("Open");
        expect(document.querySelector("[r-if]")).toBeNull();
        expect(document.querySelector("[r-for]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("consumes a remote on an orphan else loop element without a request", async () => {
        const { calls } = stubFetch({
            "views/else-loop-orphan-remote.html":
                '<p r-else r-for="x in xs" r-remote="./orphan-panel.html">{y}</p>',
            "views/orphan-panel.html": "<span>Orphan</span>",
        });

        mount('<r-view src="./views/else-loop-orphan-remote.html"></r-view>');

        await runRoolith(createRoolith({ data: { xs: [1, 2] } }));

        const paragraph = document.querySelector("p");

        expect(paragraph).not.toBeNull();
        expect(paragraph?.getAttribute("data-r-error")).toContain(
            'Attribute "r-else" must follow an element with "r-if"',
        );
        expect(paragraph?.hasAttribute("r-remote")).toBe(false);
        expect(paragraph?.hasAttribute("r-for")).toBe(false);
        expect(paragraph?.textContent).toBe("{y}");
        expect(calls.map(({ url }) => url.pathname)).toEqual([
            "/views/else-loop-orphan-remote.html",
        ]);
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("consumes a remote on a failed loop template without a request", async () => {
        const { calls } = stubFetch({
            "views/loop-template-remote.html": `
                <template r-for="x in xs" r-if="show &&" r-remote="./template-panel.html">
                    <span>{x}</span>
                </template>
                <p>After</p>
            `,
            "views/template-panel.html": "<span>Panel</span>",
        });

        mount('<r-view src="./views/loop-template-remote.html"></r-view>');

        await runRoolith(
            createRoolith({ data: { xs: [1, 2], show: true } }),
        );

        const template = document.querySelector("template");

        expect(template).not.toBeNull();
        expect(template?.hasAttribute("r-remote")).toBe(false);
        expect(template?.hasAttribute("r-for")).toBe(false);
        expect(template?.getAttribute("data-r-error")).toContain(
            "Invalid expression",
        );
        expect(document.querySelector("p")?.textContent).toBe("After");
        expect(calls.map(({ url }) => url.pathname)).toEqual([
            "/views/loop-template-remote.html",
        ]);
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("renders a repeated template carrying a remote without requesting it", async () => {
        const { calls } = stubFetch({
            "views/loop-template-remote-success.html": `
                <ul><template r-for="x in xs" r-remote="./template-panel.html"><li>{x}</li></template></ul>
            `,
            "views/template-panel.html": "<span>Panel</span>",
        });

        mount(
            '<r-view src="./views/loop-template-remote-success.html"></r-view>',
        );

        await runRoolith(createRoolith({ data: { xs: ["Coffee", "Tea"] } }));

        expect(
            [...document.querySelectorAll("li")].map(
                (node) => node.textContent,
            ),
        ).toEqual(["Coffee", "Tea"]);
        expect(calls.map(({ url }) => url.pathname)).toEqual([
            "/views/loop-template-remote-success.html",
        ]);
        expect(document.querySelector("[r-remote]")).toBeNull();
        expect(console.error).not.toHaveBeenCalled();
    });

    it("loads a remote on a plain element whose condition failed", async () => {
        const { calls } = stubFetch({
            "views/remote-failed-condition.html": `
                <div r-if="show &&" r-remote="./condition-panel.html">Authored</div>
                <p>After</p>
            `,
            "views/condition-panel.html": "<span>Panel</span>",
        });

        mount(
            '<r-view src="./views/remote-failed-condition.html"></r-view>',
        );

        await runRoolith(createRoolith());

        const element = document.querySelector("div");

        expect(element).not.toBeNull();
        expect(element?.textContent).toBe("Panel");
        expect(element?.querySelector("span")).not.toBeNull();
        expect(element?.getAttribute("data-r-error")).toContain(
            "Invalid expression",
        );
        expect(element?.hasAttribute("r-remote")).toBe(false);
        expect(calls.map(({ url }) => url.pathname)).toEqual([
            "/views/remote-failed-condition.html",
            "/views/condition-panel.html",
        ]);
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("loads a remote on a plain orphan else element", async () => {
        const { calls } = stubFetch({
            "views/else-orphan-remote-panel.html":
                '<p r-else r-remote="./orphan-else-panel.html">Authored</p>',
            "views/orphan-else-panel.html": "<span>Panel</span>",
        });

        mount('<r-view src="./views/else-orphan-remote-panel.html"></r-view>');

        await runRoolith(createRoolith());

        const paragraph = document.querySelector("p");

        expect(paragraph).not.toBeNull();
        expect(paragraph?.getAttribute("data-r-error")).toContain(
            'Attribute "r-else" must follow an element with "r-if"',
        );
        expect(paragraph?.hasAttribute("r-remote")).toBe(false);
        expect(paragraph?.textContent).toBe("Panel");
        expect(calls.map(({ url }) => url.pathname)).toEqual([
            "/views/else-orphan-remote-panel.html",
            "/views/orphan-else-panel.html",
        ]);
        expect(console.error).toHaveBeenCalledTimes(1);
    });
});
