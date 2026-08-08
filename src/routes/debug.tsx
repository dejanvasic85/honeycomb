import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";

const getBindingsStatus = createServerFn({ method: "GET" }).handler(async () => {
  const row = await env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();

  const id = env.ROOM_DO.idFromName("debug");
  const stub = env.ROOM_DO.get(id);
  const doResponse = await stub.fetch("https://room-do/ping");

  return {
    d1: row,
    durableObject: await doResponse.text(),
  };
});

export const Route = createFileRoute("/debug")({
  loader: () => getBindingsStatus(),
  component: DebugPage,
});

function DebugPage() {
  const { d1, durableObject } = Route.useLoaderData();

  return (
    <main>
      <h1>Bindings debug</h1>
      <p>D1 query result: {JSON.stringify(d1)}</p>
      <p>RoomDO response: {durableObject}</p>
    </main>
  );
}
