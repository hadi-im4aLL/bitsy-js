import { afterEach, describe, expect, it, vi } from "vitest";
import { BASE_URL, stubFetch } from "./helpers.js";

describe("fetch stub", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("exposes a case-insensitive content type, extra headers, and parsed JSON", async () => {
        stubFetch({
            "api/products.json": {
                body: '[{"name":"Coffee"}]',
                contentType: "application/json",
                headers: { "x-test": "1" },
            },
        });

        const response = await fetch(new URL("api/products.json", BASE_URL));

        expect(response.ok).toBe(true);
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("application/json");
        expect(response.headers.get("Content-Type")).toBe("application/json");
        expect(response.headers.get("X-Test")).toBe("1");
        expect(response.headers.get("x-missing")).toBeNull();
        expect(await response.json()).toEqual([{ name: "Coffee" }]);
    });
});
