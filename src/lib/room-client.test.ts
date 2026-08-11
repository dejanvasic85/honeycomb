import { describe, expect, it } from "vite-plus/test";

import { CreateRoomResponse, playerIdStorageKey } from "./room-client";

describe("playerIdStorageKey", () => {
  it("namespaces the key by room code", () => {
    expect(playerIdStorageKey("HX7K2P")).toBe("honeycomb:playerId:HX7K2P");
  });
});

describe("CreateRoomResponse", () => {
  it("accepts a code", () => {
    expect(CreateRoomResponse.safeParse({ code: "HX7K2P" }).success).toBe(true);
  });

  it("rejects a missing code", () => {
    expect(CreateRoomResponse.safeParse({}).success).toBe(false);
  });
});
