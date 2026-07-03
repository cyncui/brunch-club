/** A normalized book, derived from an Are.na Image block. */
export type Book = {
  /** Are.na block id. */
  id: number;
  /** URL-safe `${id}-${slug}` used for drawer routing. */
  slug: string;
  /** Display title (title-cased), parsed from the "<title> by <author>" field. */
  title: string;
  /** Author, parsed from the title; null when the " by " pattern is absent. */
  author: string | null;
  /** Markdown synopsis (the part of the description before the `---` divider). */
  synopsis: string;
  /** Markdown personal notes (after the `---`); null when empty or a placeholder. */
  notes: string | null;
  /** False when notes are the "Thoughts to come..." placeholder or absent. */
  hasNotes: boolean;
  /** Cover image variants (Are.na image object). */
  cover: {
    thumb: string;
    square: string;
    display: string;
    large: string;
    original: string;
  };
  /** ISO timestamp the block was connected to the channel (best "date" proxy). */
  addedAt: string;
};

/** Minimal shape of an Are.na content block we rely on. */
export type ArenaBlock = {
  id: number;
  class: string;
  title: string | null;
  description: string | null;
  connected_at: string;
  position: number;
  image: {
    thumb: { url: string };
    square: { url: string };
    display: { url: string };
    large: { url: string };
    original: { url: string };
  } | null;
};
