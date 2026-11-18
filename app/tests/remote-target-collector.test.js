import { describe, expect, it } from "vitest";
import { RemoteTargetCollector } from "../utils/remote-target-collector.js";

describe("remote target collector", () => {
    it("drains targets in discovery order without repeating them", () => {
        const collector = new RemoteTargetCollector();
        const first = {
            element: document.createElement("div"),
            source: "./first.html",
            data: {},
        };
        const second = {
            element: document.createElement("section"),
            source: "./second.html",
            data: { note: "kept" },
        };
        const third = {
            element: document.createElement("p"),
            source: "./third.html",
            data: {},
        };

        collector.record(first);
        collector.record(second);

        const drained = collector.drain();

        expect(drained).toEqual([first, second]);

        drained.push(third);

        expect(collector.drain()).toEqual([]);

        collector.record(third);

        expect(collector.drain()).toEqual([third]);
    });
});
