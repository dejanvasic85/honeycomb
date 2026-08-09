import handler from "@tanstack/react-start/server-entry";
import { env } from "cloudflare:workers";

import { createRoomWithRetries } from "#/durable-objects/create-room";
import { normaliseRoomCode } from "#/durable-objects/room-code";

export { RoomDO } from "#/durable-objects/room-do";

const ROOM_WS_PATH = /^\/api\/room\/([^/]+)\/ws$/;

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/api/room") {
      return createRoom(request);
    }

    const match = url.pathname.match(ROOM_WS_PATH);
    if (match) {
      const code = normaliseRoomCode(match[1]);
      const id = env.ROOM_DO.idFromName(code);
      return env.ROOM_DO.get(id).fetch(request);
    }

    return handler.fetch(request);
  },
};

async function createRoom(request: Request): Promise<Response> {
  try {
    const code = await createRoomWithRetries(async (candidate) => {
      const id = env.ROOM_DO.idFromName(candidate);
      const stub = env.ROOM_DO.get(id);
      const response = await stub.fetch(new URL("/init", request.url), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: candidate }),
      });
      return response.status === 201 ? "created" : "collision";
    });

    return Response.json({ code }, { status: 201 });
  } catch (error) {
    console.error("Failed to create room", error);
    return Response.json({ error: "room_creation_failed" }, { status: 500 });
  }
}
