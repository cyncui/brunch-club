import type { Book } from "@/lib/types";

type StampProps = {
  book: Book;
  /** Target outer frame width in px (snapped to the perforation pitch). */
  width: number;
  /** Cover aspect ratio (height / width) of the inner print. */
  aspect: number;
  /** Eager-load (used for the few unique preloaded covers). */
  eager?: boolean;
};

const PAD = 11;
/** Perforation pitch — MUST match `--perf-pitch` in globals.css. */
export const PERF_PITCH = 12;

/** Snap a length to a whole number of perforations so notches land on edges. */
export function snapToPerf(v: number): number {
  return Math.max(PERF_PITCH * 2, Math.round(v / PERF_PITCH) * PERF_PITCH);
}

/**
 * A book cover rendered as a physical postage stamp: perforated die-cut edge,
 * a thin paper mat, paper-treated print, and a subtle postmark.
 *
 * Outer width AND height are snapped to whole perforation units so the edge
 * teeth are even and symmetric on all four sides.
 */
export default function Stamp({ book, width, aspect, eager = false }: StampProps) {
  const outerW = snapToPerf(width);
  const innerW = outerW - PAD * 2;
  const outerH = snapToPerf(innerW * aspect + PAD * 2);
  const innerH = outerH - PAD * 2;

  return (
    <div className="stamp" style={{ width: outerW, height: outerH }}>
      <div className="stamp-inner" style={{ height: innerH }}>
        <img
          className="stamp-img"
          src={book.cover.display}
          alt={book.author ? `${book.title} by ${book.author}` : book.title}
          crossOrigin="anonymous"
          draggable={false}
          loading={eager ? "eager" : "lazy"}
        />
        <div className="stamp-postmark">
          2026
          <br />
          Read
        </div>
        <div className="stamp-paper" aria-hidden="true" />
      </div>
    </div>
  );
}
