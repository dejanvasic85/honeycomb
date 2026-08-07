import { Children, type ReactNode } from "react";

import styles from "./HexGrid.module.css";

interface HexGridProps {
  /** Hexagons per row before wrapping to the next offset row. */
  columns: number;
  children: ReactNode;
}

export function HexGrid({ columns, children }: HexGridProps) {
  const items = Children.toArray(children);
  const rows: ReactNode[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }

  return (
    <div className={styles.grid}>
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className={styles.row} data-offset={rowIndex % 2 === 1}>
          {row}
        </div>
      ))}
    </div>
  );
}
