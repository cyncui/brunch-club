import type { ArenaBlock, Book } from "./types";
import snapshot from "./data/snapshot.json";

const CHANNEL_SLUG = "book-club-archive";
const API_BASE = "https://api.are.na/v2";
const PER = 100;

/** Placeholder text Are.na entries use when notes haven't been written yet. */
const NOTES_PLACEHOLDER = "thoughts to come";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/['’"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Title-case a lowercase string, leaving small joining words lower except first. */
function titleCase(input: string): string {
  const small = new Set([
    "a", "an", "and", "the", "of", "in", "on", "to", "for", "by",
    "at", "its", "we're", "you", "us", "with", "from",
  ]);
  const cap = (w: string) =>
    // Capitalize each hyphen-separated part (e.g. "alain-fournier").
    w
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join("-");
  const words = input.trim().split(/\s+/);
  return words
    .map((w, i) => {
      const lower = w.toLowerCase();
      if (i !== 0 && small.has(lower)) return lower;
      return cap(w);
    })
    .join(" ");
}

/** Split "the city and its uncertain walls by haruki murakami" into title + author. */
function parseTitle(raw: string): { title: string; author: string | null } {
  const idx = raw.toLowerCase().lastIndexOf(" by ");
  if (idx === -1) return { title: titleCase(raw), author: null };
  const title = raw.slice(0, idx);
  const author = raw.slice(idx + 4);
  return { title: titleCase(title), author: titleCase(author) };
}

/** Split a description on the `---` markdown divider into synopsis + notes. */
function parseDescription(desc: string | null): {
  synopsis: string;
  notes: string | null;
  hasNotes: boolean;
} {
  if (!desc || !desc.trim()) return { synopsis: "", notes: null, hasNotes: false };
  // Divider is a markdown horizontal rule on its own line.
  const parts = desc.split(/\n\s*-{3,}\s*\n/);
  const synopsis = parts[0].trim();
  const rest = parts.slice(1).join("\n\n").trim();
  if (!rest) return { synopsis, notes: null, hasNotes: false };
  const isPlaceholder = rest
    .toLowerCase()
    .replace(/[.\s]/g, "")
    .startsWith(NOTES_PLACEHOLDER.replace(/\s/g, ""));
  return {
    synopsis,
    notes: isPlaceholder ? null : rest,
    hasNotes: !isPlaceholder,
  };
}

function normalize(block: ArenaBlock): Book | null {
  if (!block.image || block.class !== "Image" || !block.title) return null;
  const { title, author } = parseTitle(block.title);
  const { synopsis, notes, hasNotes } = parseDescription(block.description);
  return {
    id: block.id,
    slug: `${block.id}-${slugify(block.title)}`,
    title,
    author,
    synopsis,
    notes,
    hasNotes,
    cover: {
      thumb: block.image.thumb.url,
      square: block.image.square.url,
      display: block.image.display.url,
      large: block.image.large.url,
      original: block.image.original.url,
    },
    addedAt: block.connected_at,
  };
}

/** Fetch all blocks from the channel, paginating until a short page. */
async function fetchBlocks(): Promise<ArenaBlock[]> {
  const all: ArenaBlock[] = [];
  for (let page = 1; page <= 50; page++) {
    const res = await fetch(
      `${API_BASE}/channels/${CHANNEL_SLUG}/contents?per=${PER}&page=${page}`,
      {
        headers: { Accept: "application/json" },
        // Revalidate hourly (ISR). New books appear without a redeploy.
        next: { revalidate: 3600 },
      },
    );
    if (!res.ok) throw new Error(`Are.na ${res.status}`);
    const json = (await res.json()) as { contents: ArenaBlock[] };
    all.push(...json.contents);
    if (json.contents.length < PER) break;
  }
  return all;
}

/**
 * Return the normalized book list. Fetches live from Are.na; on any failure
 * falls back to the committed snapshot so the site never renders empty.
 */
export async function getBooks(): Promise<Book[]> {
  let blocks: ArenaBlock[];
  try {
    blocks = await fetchBlocks();
    if (!blocks.length) throw new Error("empty channel response");
  } catch {
    blocks = (snapshot as { contents: ArenaBlock[] }).contents;
  }
  return blocks
    .map(normalize)
    .filter((b): b is Book => b !== null);
}

/** Look up a single book by its routed slug (or bare id prefix). */
export async function getBook(slug: string): Promise<Book | undefined> {
  const books = await getBooks();
  const id = Number.parseInt(slug, 10);
  return books.find((b) => b.slug === slug || b.id === id);
}
