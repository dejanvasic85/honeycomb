import { createFileRoute } from "@tanstack/react-router";

import { TokenSwatch } from "#/components/TokenSwatch/TokenSwatch";

import styles from "./tokens.module.css";

export const Route = createFileRoute("/tokens")({ component: TokensDemo });

const inkSwatches = [
  { name: "--paper", value: "--paper" },
  { name: "--paper-shade", value: "--paper-shade" },
  { name: "--ink", value: "--ink" },
  { name: "--ink-muted", value: "--ink-muted" },
];

const honeySwatches = [
  { name: "--honey-1", value: "--honey-1" },
  { name: "--honey-2", value: "--honey-2" },
  { name: "--honey-3", value: "--honey-3" },
  { name: "--honey-4", value: "--honey-4" },
  { name: "--sting", value: "--sting" },
  { name: "--sting-tint", value: "--sting-tint" },
];

const typeScale = [
  { name: "--text-xs", size: "var(--text-xs)" },
  { name: "--text-sm", size: "var(--text-sm)" },
  { name: "--text-base", size: "var(--text-base)" },
  { name: "--text-lg", size: "var(--text-lg)" },
  { name: "--text-xl", size: "var(--text-xl)" },
  { name: "--text-2xl", size: "var(--text-2xl)" },
];

const spaceScale = [
  "--space-1",
  "--space-2",
  "--space-3",
  "--space-4",
  "--space-6",
  "--space-8",
  "--space-12",
  "--space-16",
];

function TokensDemo() {
  return (
    <main className={styles.page}>
      <h1>Design tokens</h1>

      <section className={styles.section}>
        <h2>Ink</h2>
        <div className={styles.row}>
          {inkSwatches.map((token) => (
            <TokenSwatch key={token.name} name={token.name} value={token.value} />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Honey &amp; sting</h2>
        <div className={styles.row}>
          {honeySwatches.map((token) => (
            <TokenSwatch key={token.name} name={token.name} value={token.value} />
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Type scale</h2>
        {typeScale.map((token) => (
          <div key={token.name} className={styles.typeRow}>
            <span className={styles.typeLabel}>{token.name}</span>
            <span style={{ fontSize: token.size, fontFamily: "var(--font-display)" }}>
              Honeycomb
            </span>
          </div>
        ))}
        <div className={styles.roomCode}>HX7K2P</div>
      </section>

      <section className={styles.section}>
        <h2>Space ramp — 4px base</h2>
        {spaceScale.map((token) => (
          <div key={token} className={styles.spaceRow}>
            <span className={styles.typeLabel}>{token}</span>
            <div className={styles.spaceBar} style={{ width: `var(${token})` }} />
          </div>
        ))}
      </section>
    </main>
  );
}
