import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { z } from "zod";

export const Route = createFileRoute("/debug-ws")({ component: DebugWsPage });

const CreateRoomResponse = z.object({ code: z.string() });

function wsUrl(code: string): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/api/room/${code}/ws`;
}

function DebugWsPage() {
  const [log, setLog] = useState<string[]>([]);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  const appendLog = (line: string) => setLog((lines) => [...lines, line]);

  const connect = (code: string) => {
    socketRef.current?.close();
    const socket = new WebSocket(wsUrl(code));
    socketRef.current = socket;

    socket.addEventListener("open", () => appendLog(`open: ${code}`));
    socket.addEventListener("message", (event) => appendLog(`received: ${event.data}`));
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
      <ul>
        {log.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </main>
  );
}
