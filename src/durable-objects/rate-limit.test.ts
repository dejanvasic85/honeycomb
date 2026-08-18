import { describe, expect, it } from "vite-plus/test";

import { clientIpFromRequest } from "./rate-limit";

describe("clientIpFromRequest", () => {
  it("returns the CF-Connecting-IP header value", () => {
    const request = new Request("https://example.com", {
      headers: { "CF-Connecting-IP": "203.0.113.7" },
    });

    expect(clientIpFromRequest(request)).toBe("203.0.113.7");
  });

  it("falls back to a constant when the header is absent", () => {
    const request = new Request("https://example.com");

    expect(clientIpFromRequest(request)).toBe("unknown");
  });
});
