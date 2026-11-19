import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    BASE_URL,
    createRoolith,
    mount,
    runRoolith,
    stubFetch,
} from "./helpers.js";

describe("lifecycle events", () => {
    beforeEach(() => {
        mount("");
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("notifies a relative source subscriber after rendering", async () => {
        stubFetch({
            "views/part.html": "<p>part</p>",
        });

        mount('<r-view src="./views/part.html"></r-view>');

        const roolith = createRoolith();
        const handler = vi.fn();
        const unsubscribe = roolith.onViewRendered("views/part.html", handler);

        await runRoolith(roolith);
        unsubscribe();

        expect(handler).toHaveBeenCalledTimes(1);

        const detail = handler.mock.calls[0][0];

        expect(detail.url.href).toBe(`${BASE_URL}views/part.html`);
        expect(detail.nodes).toHaveLength(1);
        expect(detail.nodes[0].textContent).toBe("part");
    });

    it("notifies an absolute source subscriber after rendering", async () => {
        stubFetch({
            "views/part.html": "<p>part</p>",
        });

        mount('<r-view src="./views/part.html"></r-view>');

        const roolith = createRoolith();
        const handler = vi.fn();
        const unsubscribe = roolith.onViewRendered(
            `${BASE_URL}views/part.html`,
            handler,
        );

        await runRoolith(roolith);
        unsubscribe();

        expect(handler).toHaveBeenCalledTimes(1);
        expect(handler.mock.calls[0][0].url.href).toBe(
            `${BASE_URL}views/part.html`,
        );
    });

    it("does not notify a subscriber for another source", async () => {
        stubFetch({
            "views/part.html": "<p>part</p>",
        });

        mount('<r-view src="./views/part.html"></r-view>');

        const roolith = createRoolith();
        const handler = vi.fn();
        const unsubscribe = roolith.onViewRendered("views/other.html", handler);

        await runRoolith(roolith);
        unsubscribe();

        expect(handler).not.toHaveBeenCalled();
    });

    it("throws when subscribing while events are disabled", () => {
        const roolith = createRoolith({ enableEvents: false });

        expect(() => roolith.onViewRendered("views/part.html", () => {})).toThrow(
            "RoolithJS: Event is disabled",
        );
    });

    it("dispatches ready once after the views are rendered", async () => {
        stubFetch({
            "views/part.html": "<p>part</p>",
        });

        mount('<r-view src="./views/part.html"></r-view>');

        const renderedAtEvent = [];
        const ready = vi.fn(() => {
            renderedAtEvent.push(
                document.querySelector("p")?.textContent ?? null,
            );
        });

        document.addEventListener("r-view:ready", ready);

        await runRoolith(createRoolith());

        document.removeEventListener("r-view:ready", ready);

        expect(ready).toHaveBeenCalledTimes(1);
        expect(renderedAtEvent).toEqual(["part"]);
    });

    it("dispatches an error event for a failed view", async () => {
        stubFetch({
            "views/missing.html": { status: 404 },
        });

        mount('<r-view src="./views/missing.html"></r-view>');

        const errorHandler = vi.fn();

        document.addEventListener("r-view:error", errorHandler);

        await runRoolith(createRoolith());

        document.removeEventListener("r-view:error", errorHandler);

        expect(errorHandler).toHaveBeenCalledTimes(1);
        expect(errorHandler.mock.calls[0][0].detail.src).toBe(
            "./views/missing.html",
        );
    });

    it("dispatches rendered events for nested views", async () => {
        stubFetch({
            "views/parent.html": '<r-view src="./child.html"></r-view>',
            "views/child.html": "<p>child</p>",
        });

        mount('<r-view src="./views/parent.html"></r-view>');

        const sources = [];
        const roolith = createRoolith();
        const unsubscribe = roolith.onViewRendered(
            ["views/parent.html", "views/child.html"],
            ({ url }) => sources.push(url.pathname),
        );

        await runRoolith(roolith);

        unsubscribe();

        expect(sources).toEqual(["/views/child.html", "/views/parent.html"]);
    });
});
