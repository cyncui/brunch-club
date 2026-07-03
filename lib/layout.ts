import type { Book } from "./types";

/** One stamp placement (cell) within the repeating base unit. */
export type Slot = {
  bookId: number;
  /** Center x within the base unit (px). */
  x: number;
  /** Center y within the base unit (px). */
  y: number;
  /** Stamp frame width (px). Height follows the cover's real aspect ratio. */
  width: number;
  /** Resting rotation (deg). Always 0 — an upright grid. */
  rotation: number;
};

export type CanvasLayout = {
  /** Width of the repeating tile unit (px). */
  unitW: number;
  /** Height of the repeating tile unit (px). */
  unitH: number;
  /** Every cell of the unit, filled (books cycle to leave no gaps). */
  slots: Slot[];
  /** Canvas position of the masthead (center of the unit). */
  masthead: { x: number; y: number };
};

/** mulberry32 — small, fast, deterministic PRNG. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COLS = 3;
const CELL_W = 288;
const CELL_H = 372;
// Discrete stamp widths for gentle masonry variation.
const WIDTH_BUCKETS = [116, 132, 150];

/**
 * Fill an upright grid — every cell holds a stamp (books cycle so there are no
 * empty cells), and it tiles seamlessly. The masthead sits at the unit center
 * with its own clearing (see Canvas.tsx), so no stamp is visible behind it and
 * there are no holes in the field.
 */
export function computeLayout(books: Book[]): CanvasLayout {
  const n = Math.max(1, books.length);
  const cols = COLS;
  const rows = Math.max(2, Math.ceil(n / cols));

  const unitW = cols * CELL_W;
  const unitH = rows * CELL_H;

  const slots: Slot[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const book = books[i % n];
      const rnd = rng(book.id * 131 + i * 17);
      slots.push({
        bookId: book.id,
        x: (c + 0.5) * CELL_W,
        y: (r + 0.5) * CELL_H,
        width: WIDTH_BUCKETS[Math.floor(rnd() * WIDTH_BUCKETS.length)],
        rotation: 0,
      });
    }
  }

  const masthead = {
    x: unitW / 2,
    y: (Math.floor(rows / 2) + 0.5) * CELL_H,
  };

  return { unitW, unitH, slots, masthead };
}
