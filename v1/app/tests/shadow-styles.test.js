import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoolith, mount, runRoolith, stubFetch } from "./helpers.js";

describe("shadow view style scoping", () => {
    beforeEach(() => {
        mount("");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("keeps the view style inside the shadow root", async () => {
        stubFetch({
            "views/shadow/styled.html": `
                <style>.badge { color: rgb(0, 128, 0); }</style>
                <p class="badge">Styled</p>
            `,
        });

        mount(`
            <r-view src="./views/shadow/styled.html" r-shadow></r-view>
            <p class="badge">Document</p>
        `);

        await runRoolith(createRoolith());

        const host = document.querySelector("r-view");
        const badge = host.shadowRoot.querySelector("p.badge");
        const documentBadge = document.querySelector("p.badge");

        expect(host.shadowRoot.querySelector("style")).not.toBeNull();
        expect([...document.querySelectorAll("style")]).toEqual([]);
        expect(badge).not.toBeNull();
        expect(documentBadge?.textContent).toBe("Document");
        expect(window.getComputedStyle(badge).color).toBe("rgb(0, 128, 0)");
        expect(window.getComputedStyle(documentBadge).color).not.toBe(
            "rgb(0, 128, 0)",
        );
    });

    it("keeps the host document styles out of the shadow content", async () => {
        stubFetch({
            "views/shadow/host-style.html": '<p class="badge">Shadow</p>',
        });

        mount(`
            <style>.badge { color: rgb(255, 0, 0); }</style>
            <r-view src="./views/shadow/host-style.html" r-shadow></r-view>
            <p class="badge">Document</p>
        `);

        await runRoolith(createRoolith());

        const host = document.querySelector("r-view");
        const shadowParagraph = host.shadowRoot.querySelector("p.badge");
        const documentParagraph = document.querySelector("p.badge");

        expect(documentParagraph?.textContent).toBe("Document");
        expect(shadowParagraph).not.toBeNull();
        expect(window.getComputedStyle(documentParagraph).color).toBe(
            "rgb(255, 0, 0)",
        );
        expect(window.getComputedStyle(shadowParagraph).color).not.toBe(
            "rgb(255, 0, 0)",
        );
    });
});
