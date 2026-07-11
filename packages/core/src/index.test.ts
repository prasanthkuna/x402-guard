import { describe, expect, it } from "vitest";
import { parseResourceUrl, stableStringify } from "./index.js";

describe("parseResourceUrl", () => {
  it("extracts domain and path", () => {
    const ref = parseResourceUrl("https://API.Example.com/v1/data?q=1");
    expect(ref.domain).toBe("api.example.com");
    expect(ref.path).toBe("/v1/data");
    expect(ref.url).toBe("https://API.Example.com/v1/data?q=1");
  });
});

describe("stableStringify", () => {
  it("sorts object keys", () => {
    const a = stableStringify({ b: 1, a: 2 });
    const b = stableStringify({ a: 2, b: 1 });
    expect(a).toBe(b);
  });
});
