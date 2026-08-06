import type { CSSProperties, ReactNode } from "react";

import styles from "./Hexagon.module.css";

export type HexagonState = "empty" | "filled" | "honey" | "stung";

type HexagonCSSProperties = CSSProperties & {
  "--hex-scale"?: number;
};

interface HexagonProps {
  /** Multiplier applied to --cell-w / --cell-h. Both scale together, so the hex ratio never distorts. */
  size?: number;
  state?: HexagonState;
  /** Only used when state is "honey"; clamped to 1-4. */
  tier?: 1 | 2 | 3 | 4;
  children?: ReactNode;
}

export function Hexagon({ size = 1, state = "empty", tier = 1, children }: HexagonProps) {
  const clampedTier = Math.min(Math.max(tier, 1), 4);
  const style: HexagonCSSProperties = { "--hex-scale": size };

  return (
    <div className={styles.hexagon} data-state={state} data-tier={clampedTier} style={style}>
      <div className={styles.fill} />
      <div className={styles.line} />
      <div className={styles.content}>{children}</div>
      {state === "stung" && (
        <span className={styles.stungIcon} aria-hidden="true">
          !
        </span>
      )}
    </div>
  );
}
