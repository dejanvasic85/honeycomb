import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { z } from "zod";

export const Route = createFileRoute("/debug-ws")({ component: DebugWsPage });

const CreateRoomResponse = z.object({ code: z.string() });
const JoinedMessage = z.object({
  type: z.literal("joined"),
  player: z.object({ id: z.string(), name: z.string() }),
});

function wsUrl(code: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/room/${code}/ws`;
}

function playerIdStorageKey(code: string): string {
  return `honeycomb:playerId:${code}`;
}

function DebugWsPage() {
  const [log, setLog] = useState<string[]>([]);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [name, setName] = useState("");
  const socketRef = useRef<WebSocket | null>(null);

  const appendLog = (line: string) => setLog((lines) => [...lines, line]);

  const connect = (code: string) => {
    socketRef.current?.close();
    const socket = new WebSocket(wsUrl(code));
    socketRef.current = socket;

    socket.addEventListener("open", () => appendLog(`open: ${code}`));
    socket.addEventListener("message", (event) => {
      appendLog(`received: ${event.data}`);
      let json: unknown;
      try {
        json = JSON.parse(String(event.data));
      } catch {
        return;
      }
      const parsed = JoinedMessage.safeParse(json);
      if (parsed.success) {
        localStorage.setItem(playerIdStorageKey(code), parsed.data.player.id);
      }
    });
    socket.addEventListener("error", () => appendLog(`error connecting to: ${code}`));
    socket.addEventListener("close", (event) => appendLog(`close: ${code} (code ${event.code})`));
  };

  const createRoom = async () => {
    const response = await fetch("/api/room", { method: "POST" });
    const parsed = CreateRoomResponse.safeParse(await response.json());
    if (!response.ok || !parsed.success) {
      appendLog(`create room failed: ${response.status}`);
      return;
    }
    setRoomCode(parsed.data.code);
    appendLog(`created room: ${parsed.data.code}`);
  };

  return (
    <main>
      <h1>RoomDO WebSocket debug</h1>
      <p>Room code: {roomCode ?? "(none yet)"}</p>
      <button type="button" onClick={createRoom}>
        Create room
      </button>
      <input
        type="text"
        value={roomCode ?? ""}
        placeholder="room code (e.g. after hard refresh)"
        onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
      />
      <button
        type="button"
        disabled={!roomCode}
        onClick={() => {
          if (roomCode) connect(roomCode);
        }}
      >
        Connect
      </button>
      <button type="button" onClick={() => connect("NOPE00")}>
        Connect to nonexistent code
      </button>
      <button
        type="button"
        onClick={() => {
          socketRef.current?.send(JSON.stringify({ type: "ping" }));
          appendLog("sent: ping");
        }}
      >
        Send ping
      </button>
      <hr />
      <input
        type="text"
        value={name}
        placeholder="player name"
        onChange={(event) => setName(event.target.value)}
      />
      <button
        type="button"
        onClick={() => {
          socketRef.current?.send(JSON.stringify({ type: "join", name }));
          appendLog(`sent: join (${name})`);
        }}
      >
        Join
      </button>
      <button
        type="button"
        onClick={() => {
          if (!roomCode) return;
          const playerId = localStorage.getItem(playerIdStorageKey(roomCode));
          if (!playerId) {
            appendLog(`no stored playerId for ${roomCode}`);
            return;
          }
          socketRef.current?.send(JSON.stringify({ type: "rejoin", playerId }));
          appendLog(`sent: rejoin (${playerId})`);
        }}
      >
        Rejoin from storage
      </button>
      <ul>
        {log.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </main>
  );
}
