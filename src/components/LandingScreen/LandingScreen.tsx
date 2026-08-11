import { useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import type { FormEvent } from "react";

import { Hexagon } from "#/components/Hexagon/Hexagon";
import { HexGrid } from "#/components/Hexagon/HexGrid";
import { CreateRoomResponse } from "#/lib/room-client";

import styles from "./LandingScreen.module.css";

const ROOM_CODE_LENGTH = 6;

interface LandingScreenProps {
  initialJoinCode?: string;
}

export function LandingScreen({ initialJoinCode = "" }: LandingScreenProps) {
  const [joinCode, setJoinCode] = useState(initialJoinCode);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const navigate = useNavigate();
  const joinInputId = useId();

  const handleCreateRoom = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const response = await fetch("/api/room", { method: "POST" });
      const parsed = CreateRoomResponse.safeParse(await response.json());
      if (!response.ok || !parsed.success) {
        setCreateError("Couldn't create a room. Try again.");
        setCreating(false);
        return;
      }
      await navigate({ to: "/room/$code", params: { code: parsed.data.code } });
    } catch {
      setCreateError("Couldn't create a room. Try again.");
      setCreating(false);
    }
  };

  const handleJoinSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (joinCode.length !== ROOM_CODE_LENGTH) return;
    await navigate({ to: "/room/$code", params: { code: joinCode } });
  };

  return (
    <main className={styles.page}>
      <HexGrid columns={3}>
        <Hexagon state="honey" tier={1}>
          1
        </Hexagon>
        <Hexagon state="honey" tier={2}>
          2
        </Hexagon>
        <Hexagon state="honey" tier={3}>
          3
        </Hexagon>
        <Hexagon state="honey" tier={4}>
          4
        </Hexagon>
        <Hexagon state="empty" />
        <Hexagon state="stung">Stung</Hexagon>
      </HexGrid>

      <h1 className={styles.title}>Honeycomb</h1>
      <p className={styles.tagline}>Everyone answers the same question. Matching answers score.</p>

      <div className={styles.actions}>
        <div>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => void handleCreateRoom()}
            disabled={creating}
          >
            {creating ? "Creating…" : "Create room"}
          </button>
          {createError && (
            <p className={styles.error} role="alert">
              {createError}
            </p>
          )}
        </div>

        <form className={styles.joinForm} onSubmit={(event) => void handleJoinSubmit(event)}>
          <label htmlFor={joinInputId} className={styles.joinLabel}>
            Join with code
          </label>
          <div className={styles.joinRow}>
            <input
              id={joinInputId}
              className={styles.joinInput}
              type="text"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={ROOM_CODE_LENGTH}
              placeholder="HX7K2P"
              value={joinCode}
              onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            />
            <button
              type="submit"
              className={styles.secondaryButton}
              disabled={joinCode.length !== ROOM_CODE_LENGTH}
            >
              Join
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
