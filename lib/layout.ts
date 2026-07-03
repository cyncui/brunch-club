import type { Book } from "./types";

/** Deterministic placement of one stamp within the repeating base unit. */
export type Placement = {
  /** Center x within the base unit (px). */
  x: number;
  /** Center y within the base unit (px). */
  y: number;
  /** Stamp frame width (px). Height follows the cover's real aspect ratio. */
  width: number;
  /** Resting rotation (deg). */
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
const CELL_W = 380;
const CELL_H = 440;
// Discrete stamp widths for masonry rhythm.
const WIDTH_BUCKETS = [176, 208, 244];

/**
 * Lay the books out into a jittered grid inside a repeating unit. Grid-based
 * placement tiles seamlessly; per-book seeded jitter and rotation keep it from
 * reading as a rigid grid. Fully deterministic from the book ids.
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

    const jitterX = (r() - 0.5) * CELL_W * 0.34;
    const jitterY = (r() - 0.5) * CELL_H * 0.34;
    const x = (col + 0.5) * CELL_W + jitterX;
    const y = (row + 0.5) * CELL_H + jitterY;

    const width = WIDTH_BUCKETS[Math.floor(r() * WIDTH_BUCKETS.length)];
    const rotation = (r() - 0.5) * 26; // ±13°

    placements[book.id] = { x, y, width, rotation, seed: book.id };
    order.push(book.id);
  });

  return { unitW, unitH, placements, order };
}
