import { describe, expect, it } from "vite-plus/test";

import { hasOtherConnection } from "./socket";

describe("hasOtherConnection", () => {
  it("is false with no other sockets", () => {
    expect(hasOtherConnection([], "p1")).toBe(false);
  });

  it("is false when no other socket belongs to this player", () => {
    expect(hasOtherConnection([{ playerId: "p2" }, { playerId: "p3" }], "p1")).toBe(false);
  });

  it("is true when another socket already carries this player's id", () => {
    expect(hasOtherConnection([{ playerId: "p2" }, { playerId: "p1" }], "p1")).toBe(true);
  });

  it("ignores unattached sockets (null attachment)", () => {
    expect(hasOtherConnection([null, { playerId: "p1" }], "p1")).toBe(true);
  });

  it("is false when every other socket is unattached", () => {
    expect(hasOtherConnection([null, null], "p1")).toBe(false);
  });
});
