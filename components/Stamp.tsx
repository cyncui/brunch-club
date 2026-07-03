import type { Book } from "@/lib/types";

type StampProps = {
  book: Book;
  /** Outer frame width in px. */
  width: number;
  /** Cover aspect ratio (height / width) of the inner print. */
  aspect: number;
  /** 1-based catalog number for the franking mark. */
  index: number;
  /** Eager-load (used for the few unique preloaded covers). */
  eager?: boolean;
};

const PAD = 9;

/**
 * A book cover rendered as a physical postage stamp: perforated die-cut edge,
 * white mat, paper-treated print, and a subtle franking / postmark overprint.
 */
export default function Stamp({
  book,
  width,
  aspect,
  index,
  eager = false,
}: StampProps) {
  const innerW = width - PAD * 2;
  const innerH = Math.round(innerW * aspect);
  const src = book.cover.display;
  const num = String(index).padStart(2, "0");

  return (
    <div className="stamp" style={{ width }}>
      <div className="stamp-inner" style={{ height: innerH }}>
        <img
          className="stamp-img"
          src={src}
          alt={book.author ? `${book.title} by ${book.author}` : book.title}
          crossOrigin="anonymous"
          draggable={false}
          loading={eager ? "eager" : "lazy"}
        />
        <div className="stamp-frank">
          <span>Book Club</span>
          <span>N&ordm;{num}</span>
        </div>
        <div className="stamp-postmark">
          2026
          <br />
          Read
        </div>
      </div>
    </div>
  );
}
