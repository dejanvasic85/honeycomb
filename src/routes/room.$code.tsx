import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent } from "react";

import type { AnswerProgress } from "#/durable-objects/answer";
import { ServerMessage } from "#/durable-objects/messages";
import type { Phase } from "#/durable-objects/phase";
import type { Player } from "#/durable-objects/player";
import { getStartDisabledReason } from "#/lib/lobby";
import { playerIdStorageKey, roomWsUrl } from "#/lib/room-client";

import styles from "./room.$code.module.css";

export const Route = createFileRoute("/room/$code")({ component: RoomPage });

type UiState = "connecting" | "entering-name" | "joining" | "lobby" | "error";

function RoomPage() {
  const { code: rawCode } = Route.useParams();
  const code = rawCode.toUpperCase();

  const [uiState, setUiState] = useState<UiState>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [hostId, setHostId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [round, setRound] = useState(0);
  const [question, setQuestion] = useState<{ text: string; category: string } | null>(null);
  const [myPlayerId, setMyPlayerId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [answerInput, setAnswerInput] = useState("");
  const [hasSubmittedAnswer, setHasSubmittedAnswer] = useState(false);
  const [answerProgress, setAnswerProgress] = useState<AnswerProgress | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const reachedRoomRef = useRef(false);
  const myPlayerIdRef = useRef<string | null>(null);
  const nameInputId = useId();
  const answerInputId = useId();

  useEffect(() => {
    setUiState("connecting");
    setErrorMessage(null);
    setConnectionLost(false);
    reachedRoomRef.current = false;

    const socket = new WebSocket(roomWsUrl(code));
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      const storedPlayerId = localStorage.getItem(playerIdStorageKey(code));
      if (storedPlayerId) {
        setUiState("joining");
        socket.send(JSON.stringify({ type: "rejoin", playerId: storedPlayerId }));
      } else {
        setUiState("entering-name");
      }
    });

    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      let json: unknown;
      try {
        json = JSON.parse(event.data);
      } catch {
        return;
      }
      const parsed = ServerMessage.safeParse(json);
      if (!parsed.success) return;
      const message = parsed.data;

      switch (message.type) {
        case "joined": {
          reachedRoomRef.current = true;
          localStorage.setItem(playerIdStorageKey(code), message.player.id);
          myPlayerIdRef.current = message.player.id;
          setMyPlayerId(message.player.id);
          setUiState("lobby");
          setConnectionLost(false);
          break;
        }
        case "state": {
          setPlayers(message.players);
          setHostId(message.hostId);
          setPhase(message.phase);
          setRound(message.round);
          setQuestion(message.question);
          const myAnswer = myPlayerIdRef.current
            ? message.answers[myPlayerIdRef.current]
            : undefined;
          if (myAnswer) {
            setHasSubmittedAnswer(true);
            // Only hydrate the input if the player hasn't started editing —
            // avoids clobbering an in-progress edit when someone else's
            // submission triggers a fresh state broadcast.
            setAnswerInput((prev) => (prev === "" ? myAnswer.text : prev));
          }
          break;
        }
        case "phase": {
          setPhase(message.phase);
          break;
        }
        case "question": {
          setQuestion({ text: message.text, category: message.category });
          setAnswerInput("");
          setHasSubmittedAnswer(false);
          setAnswerProgress(null);
          break;
        }
        case "answerProgress": {
          setAnswerProgress({ answered: message.answered, total: message.total });
          break;
        }
        case "playerJoined": {
          setAnnouncement(`${message.player.name} joined`);
          break;
        }
        case "playerLeft": {
          setAnnouncement(`${message.player.name} disconnected`);
          break;
        }
        case "error": {
          if (message.code === "unknown_player") {
            localStorage.removeItem(playerIdStorageKey(code));
            setUiState("entering-name");
          } else {
            setErrorMessage(message.message);
            setUiState("error");
          }
          break;
        }
      }
    });

    socket.addEventListener("close", (event) => {
      if (event.code === 1000) return;
      if (reachedRoomRef.current) {
        setConnectionLost(true);
      } else {
        setErrorMessage("Couldn't connect to this room. Check the code and try again.");
        setUiState("error");
      }
    });

    return () => socket.close(1000);
  }, [code]);

  const handleNameSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    setUiState("joining");
    socketRef.current?.send(JSON.stringify({ type: "join", name: trimmed }));
  };

  const handleStart = () => {
    socketRef.current?.send(JSON.stringify({ type: "start" }));
  };

  const handleSubmitAnswer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = answerInput.trim();
    if (!trimmed) return;
    socketRef.current?.send(JSON.stringify({ type: "submitAnswer", text: trimmed }));
  };

  const copyToClipboard = async (text: string, onCopied: (copied: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      onCopied(true);
      setTimeout(() => onCopied(false), 2000);
    } catch {
      // Clipboard access denied or unavailable — nothing further we can do.
    }
  };

  const isHost = myPlayerId !== null && myPlayerId === hostId;
  const startDisabledReason = getStartDisabledReason(players.length);

  return (
    <main className={styles.page}>
      <div aria-live="polite" className={styles.liveRegion}>
        {announcement}
      </div>

      {uiState === "connecting" && <p>Connecting…</p>}

      {uiState === "error" && (
        <>
          <p role="alert" className={styles.error}>
            {errorMessage}
          </p>
          <Link to="/" className={styles.secondaryButton}>
            Back to home
          </Link>
        </>
      )}

      {uiState === "entering-name" && (
        <form className={styles.nameForm} onSubmit={handleNameSubmit}>
          <label htmlFor={nameInputId} className={styles.nameLabel}>
            Your name
          </label>
          <input
            id={nameInputId}
            className={styles.nameInput}
            type="text"
            maxLength={20}
            autoComplete="off"
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
          />
          <button type="submit" className={styles.primaryButton} disabled={nameInput.trim() === ""}>
            Join room
          </button>
        </form>
      )}

      {uiState === "joining" && <p>Joining…</p>}

      {uiState === "lobby" && phase === "lobby" && (
        <>
          <section className={styles.codeSection} aria-label="Room code">
            <p className={styles.code}>{code}</p>
            <div className={styles.codeActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => void copyToClipboard(code, setCopiedCode)}
              >
                {copiedCode ? "Copied!" : "Copy code"}
              </button>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() =>
                  void copyToClipboard(`${window.location.origin}/join/${code}`, setCopiedLink)
                }
              >
                {copiedLink ? "Copied!" : "Copy invite link"}
              </button>
            </div>
          </section>

          {connectionLost && (
            <p role="alert" className={styles.error}>
              Connection lost. Refresh this page to rejoin.
            </p>
          )}

          <ul className={styles.playerList} aria-label="Players in this room">
            {players.map((player) => (
              <li key={player.id} className={styles.playerRow} data-connected={player.connected}>
                <span className={styles.playerName}>
                  {player.name}
                  {player.id === myPlayerId && " (You)"}
                </span>
                {player.id === hostId && <span className={styles.hostBadge}>Host</span>}
                {!player.connected && (
                  <span className={styles.offline}>
                    <svg
                      className={styles.offlineIcon}
                      viewBox="0 0 12 12"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <rect x="2" y="1" width="3" height="10" fill="currentColor" />
                      <rect x="7" y="1" width="3" height="10" fill="currentColor" />
                    </svg>
                    Offline
                  </span>
                )}
              </li>
            ))}
          </ul>

          {isHost ? (
            <div className={styles.hostControls}>
              <button
                type="button"
                className={styles.primaryButton}
                disabled={startDisabledReason !== null}
                onClick={handleStart}
              >
                Start game
              </button>
              {startDisabledReason && <p className={styles.startReason}>{startDisabledReason}</p>}
            </div>
          ) : (
            <p className={styles.waiting}>Waiting for the host to start…</p>
          )}
        </>
      )}

      {uiState === "lobby" && phase === "answering" && (
        <section className={styles.answeringSection} aria-label="Answer the question">
          <p className={styles.phaseHeading}>Round {round}</p>
          {question && <p className={styles.questionText}>{question.text}</p>}

          <form className={styles.nameForm} onSubmit={handleSubmitAnswer}>
            <label htmlFor={answerInputId} className={styles.nameLabel}>
              Your answer
            </label>
            <input
              id={answerInputId}
              className={styles.nameInput}
              type="text"
              maxLength={100}
              autoComplete="off"
              value={answerInput}
              onChange={(event) => setAnswerInput(event.target.value)}
            />
            <button
              type="submit"
              className={styles.primaryButton}
              disabled={answerInput.trim() === ""}
            >
              {hasSubmittedAnswer ? "Update answer" : "Submit answer"}
            </button>
          </form>

          {hasSubmittedAnswer && (
            <p className={styles.waiting}>
              Answer submitted — you can change it until everyone's answered.
            </p>
          )}

          {answerProgress && (
            <p className={styles.startReason} aria-live="polite">
              {answerProgress.answered} of {answerProgress.total} answered
            </p>
          )}
        </section>
      )}

      {uiState === "lobby" && phase !== "lobby" && phase !== "answering" && (
        <>
          <p className={styles.phaseHeading}>
            Round {round} — {phase} phase
          </p>
          {question && <p className={styles.questionText}>{question.text}</p>}
        </>
      )}
    </main>
  );
}
