import handler from "@tanstack/react-start/server-entry";
import { env } from "cloudflare:workers";

export { RoomDO } from "#/durable-objects/room-do";

const ROOM_WS_PATH = /^\/api\/room\/([^/]+)\/ws$/;

export default {
  fetch(request: Request) {
    const url = new URL(request.url);
    const match = url.pathname.match(ROOM_WS_PATH);

    if (match) {
      const code = match[1].toUpperCase();
      const id = env.ROOM_DO.idFromName(code);
      return env.ROOM_DO.get(id).fetch(request);
    }

    return handler.fetch(request);
  },
};
