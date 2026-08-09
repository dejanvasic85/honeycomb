import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/debug-ws")({ component: DebugWsPage });

const ROOM_CODE = "DEBUGX";

function DebugWsPage() {
  const [log, setLog] = useState<string[]>([]);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/api/room/${ROOM_CODE}/ws`);
    socketRef.current = socket;

    socket.addEventListener("open", () => setLog((lines) => [...lines, "open"]));
    socket.addEventListener("message", (event) =>
      setLog((lines) => [...lines, `received: ${event.data}`]),
    );
    socket.addEventListener("close", () => setLog((lines) => [...lines, "close"]));

    return () => socket.close();
  }, []);

  return (
    <main>
      <h1>RoomDO WebSocket debug</h1>
      <button
        type="button"
        onClick={() => {
          socketRef.current?.send(JSON.stringify({ type: "ping" }));
          setLog((lines) => [...lines, "sent: ping"]);
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
