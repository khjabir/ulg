import { forwardRef, type CSSProperties } from "react";
import { wildOf } from "./engine";

/** Colour tier by magnitude, so equal numbers always share a colour. */
export function tierOf(v: number): number {
  return Math.floor(Math.log2(Math.max(1, v))) % 4;
}

type Props = { value: number; className?: string; style?: CSSProperties };

export const Tile = forwardRef<HTMLDivElement, Props>(function Tile({ value, className = "", style }, ref) {
  if (value < 0) {
    const w = wildOf(value);
    return (
      <div ref={ref} className={`sb-tile wild ${className}`} style={style} aria-hidden>
        <span>
          <span className="op">{w.op}</span>
          {w.value}
        </span>
      </div>
    );
  }
  const text = String(value);
  return (
    <div
      ref={ref}
      className={`sb-tile ${className}`}
      style={style}
      data-tier={tierOf(value)}
      data-digits={Math.min(4, text.length)}
      aria-hidden
    >
      {text}
    </div>
  );
});
