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
const CELL_W = 268;
const CELL_H = 360;
// Discrete stamp widths for gentle masonry variation.
const WIDTH_BUCKETS = [160, 184, 208];
// Vertical stagger between adjacent columns (brick masonry, like the reference).
const COL_STAGGER = CELL_H * 0.5;

/**
 * Lay the books out in a clean upright grid (no scatter, no rotation), with a
 * per-column vertical stagger so rows read as a light masonry — matching the
 * tokyo.floguo.com reference. Grid placement + a constant per-column offset
 * tile seamlessly. Deterministic from the book ids.
 */
export function computeLayout(books: Book[]): CanvasLayout {
  const rows = Math.max(1, Math.ceil(books.length / COLS));
  const cols = Math.min(COLS, books.length) || 1;
  const unitW = cols * CELL_W;
  const unitH = rows * CELL_H;

  const placements: Record<number, Placement> = {};
  const order: number[] = [];

  books.forEach((book, i) => {
    const r = rng(book.id);
    const col = i % cols;
    const row = Math.floor(i / cols);

    const x = (col + 0.5) * CELL_W;
    // Constant per-column vertical offset → seamless brick stagger.
    const y = (row + 0.5) * CELL_H + col * COL_STAGGER;

    const width = WIDTH_BUCKETS[Math.floor(r() * WIDTH_BUCKETS.length)];

    placements[book.id] = { x, y, width, rotation: 0, seed: book.id };
    order.push(book.id);
  });

  return { unitW, unitH, placements, order };
}
