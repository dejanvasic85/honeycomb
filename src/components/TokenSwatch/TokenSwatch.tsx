import styles from "./TokenSwatch.module.css";

interface TokenSwatchProps {
  name: string;
  value: string;
}

export function TokenSwatch({ name, value }: TokenSwatchProps) {
  return (
    <div className={styles.swatch}>
      <div className={styles.chip} style={{ background: `var(${value})` }} />
      <span className={styles.label}>{name}</span>
    </div>
  );
}
