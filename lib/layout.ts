import type { Book } from "./types";

/** Deterministic placement of one stamp within the repeating base unit. */
export type Placement = {
  /** Center x within the base unit (px). */
  x: number;
  /** Center y within the base unit (px). */
  y: number;
  /** Stamp frame width (px). Height follows the cover's real aspect ratio. */
  width: number;
  /** Resting rotation (deg). Always 0 — an upright grid. */
  rotation: number;
  /** Stable per-book seed, reused for texture/franking variation. */
  seed: number;
};

export type CanvasLayout = {
  /** Width of the repeating tile unit (px). */
  unitW: number;
  /** Height of the repeating tile unit (px). */
  unitH: number;
  /** Placement keyed by book id. */
  placements: Record<number, Placement>;
  /** Book ids in placement order. */
  order: number[];
  /** Canvas position of the masthead (center of the reserved gap). */
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

const COLS = 4;
const CELL_W = 272;
const CELL_H = 356;
// Discrete stamp widths for gentle masonry variation.
const WIDTH_BUCKETS = [160, 184, 208];

/**
 * Lay the books out in an upright grid that reserves a two-cell gap at the
 * center of the repeating unit for the masthead — so the masthead is part of
 * the canvas (it pans with the stamps) and no stamp ever sits behind it.
 * Deterministic from the book ids; tiles seamlessly.
 */
export function computeLayout(books: Book[]): CanvasLayout {
  const cols = COLS;
  const reserved = 2; // the two middle cells of the center row
  const rows = Math.max(3, Math.ceil((books.length + reserved) / cols));
  const centerRow = Math.floor(rows / 2);
  const resA = cols / 2 - 1; // 1
  const resB = cols / 2; // 2
  const isReserved = (r: number, c: number) =>
    r === centerRow && (c === resA || c === resB);

  const unitW = cols * CELL_W;
  const unitH = rows * CELL_H;

  // Cells available for stamps, in reading order, skipping the reserved gap.
  const cells: { r: number; c: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isReserved(r, c)) cells.push({ r, c });
    }
  }

  const placements: Record<number, Placement> = {};
  const order: number[] = [];

  books.forEach((book, i) => {
    const cell = cells[i % cells.length];
    const r = rng(book.id);
    const x = (cell.c + 0.5) * CELL_W;
    const y = (cell.r + 0.5) * CELL_H;
    const width = WIDTH_BUCKETS[Math.floor(r() * WIDTH_BUCKETS.length)];
    placements[book.id] = { x, y, width, rotation: 0, seed: book.id };
    order.push(book.id);
  });

  const masthead = {
    x: ((resA + resB + 1) / 2) * CELL_W, // center of the two reserved cells
    y: (centerRow + 0.5) * CELL_H,
  };

  return { unitW, unitH, placements, order, masthead };
}
