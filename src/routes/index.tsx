import { createFileRoute } from "@tanstack/react-router";
import { useId, useState } from "react";

import { Hexagon } from "#/components/Hexagon/Hexagon";
import { HexGrid } from "#/components/Hexagon/HexGrid";

import styles from "./index.module.css";

export const Route = createFileRoute("/")({ component: Home });

const ROOM_CODE_LENGTH = 6;

function Home() {
  const [joinCode, setJoinCode] = useState("");
  const joinInputId = useId();

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
        <button type="button" className={styles.primaryButton}>
          Create room
        </button>

        <form className={styles.joinForm}>
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
