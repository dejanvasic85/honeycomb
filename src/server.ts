import handler from "@tanstack/react-start/server-entry";

export { RoomDO } from "#/durable-objects/room-do";

export default {
  fetch: handler.fetch,
};
