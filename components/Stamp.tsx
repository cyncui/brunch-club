import type { CSSProperties } from "react";
import type { Book } from "@/lib/types";

type StampProps = {
  book: Book;
  /** Outer frame width in px. */
  width: number;
  /** Cover aspect ratio (height / width) of the inner print. */
  aspect: number;
  /** Eager-load (used for the few unique preloaded covers). */
  eager?: boolean;
};

// Fixed number of perforations across the width; the mat and hole size are a
// proportion of the width, so a stamp looks identical at any scale.
const TEETH_X = 13;
const PAD_RATIO = 0.072;
const HOLE_RATIO = 0.38; // perforation radius as a fraction of the pitch

/**
 * A book cover rendered as a physical postage stamp: perforated die-cut edge,
 * a thin paper mat, paper-treated print, and a subtle postmark.
 *
 * The pitch is derived from the width so a whole number of teeth always fits,
 * and the outer height is snapped to that pitch — even teeth on all four sides.
 */
export default function Stamp({ book, width, aspect, eager = false }: StampProps) {
  const pitch = width / TEETH_X;
  const pad = Math.max(3, Math.round(width * PAD_RATIO));
  const innerW = width - pad * 2;
  const teethY = Math.max(3, Math.round((innerW * aspect + pad * 2) / pitch));
  const outerH = teethY * pitch;
  const innerH = outerH - pad * 2;

  const style = {
    width,
    height: outerH,
    padding: pad,
    "--perf-pitch": `${pitch}px`,
    "--perf-r": `${pitch * HOLE_RATIO}px`,
  } as CSSProperties;

  return (
    <div className="stamp" style={style}>
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
