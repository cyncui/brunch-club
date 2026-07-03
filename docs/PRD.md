# Book Club Archive — Product Requirements Document

**Project:** `books.cynthia.land` — an infinite-canvas micro-site for a personal book club archive
**Owner:** Cynthia (hi@ja.mt)
**Status:** Draft for approval
**Last updated:** 2026-07-03

---

## 1. Overview

A single-page micro-site that renders a personal book club archive (hosted on Are.na) as an **infinite, drag-pannable canvas of postage-stamp book covers**. Hovering a stamp brings it into focus with a rack-focus/lift effect; clicking it opens a **side reading drawer** with the book's synopsis and personal notes.

The site is inspired by [tokyo.floguo.com](https://tokyo.floguo.com/) (infinite canvas + stamp aesthetic + side drawer) and the hover interaction in the attached reference video (`bill guo porto update.mp4`), which is the **authoritative spec for the hover behavior**.

### 1.1 Goals

- Turn the flat Are.na channel [`cynthia/book-club-archive`](https://www.are.na/cynthia/book-club-archive) into a tactile, browsable, personal object.
- Each cover reads as a **physical postage stamp** — perforated edges, paper grain, muted print — satisfying the "make the covers look more paper-like" requirement.
- A signature **rack-focus hover**: the hovered stamp scales up, straightens, lifts, and gets a caption pill; every other stamp blurs and recedes.
- A **side drawer** for reading the synopsis + Cynthia's notes per book.
- Data pulled from Are.na so the site stays in sync as books are added — no manual content duplication.
- Deployed to `books.cynthia.land` (subdomain of the existing site), source in a GitHub repo.

### 1.2 Non-goals (v1)

- No authoring/editing of books in-app (Are.na remains the CMS).
- No user accounts, comments, or social features.
- No search or full-text filtering across notes (nice-to-have, see §16).
- No 3D perspective mode (the reference site has one; deferred as an optional flourish, §16).

---

## 2. Data source — Are.na

All research below was confirmed against the live Are.na v2 API on 2026-07-03.

### 2.1 The channel

- Channel URL: `https://www.are.na/cynthia/book-club-archive`
- **Slug:** `book-club-archive`
- API base: `https://api.are.na/v2/channels/book-club-archive`
- Owner: `cynthia` (display name `cynthia ✴︎`), avatar available via the user object.
- Channel title is literally `« book club archive`; channel `metadata` (description) is `null`.
- **Current length: 8 blocks**, all `class: "Image"` (book covers). `status: "closed"` but `published: true` — it is publicly fetchable without auth.
- Last book added: 2026-06-19.

### 2.2 Endpoints & fetching

- **No authentication required.** CORS is permissive (`Access-Control-Allow-Origin: *`) on `/contents` and on both image hosts, so the browser can fetch directly — **no server proxy needed**.
- Two calls compose the dataset:
  1. `GET /v2/channels/book-club-archive` → channel metadata incl. `length` (total count).
  2. `GET /v2/channels/book-club-archive/contents?per=100&page=1` → the block array. (`per` is hard-capped at 100; loop pages until a short page if `length > 100`. At 8 books, one call suffices.)
- **The `/contents` response has no pagination metadata** — compute pages from `length` on the channel endpoint, or detect the end via a short/empty page.
- Default order is `position` ascending = **newest-connection-first**. Use `direction=desc` if oldest-first is preferred (decide in §6.2).
- Caching: channel endpoint sends `Cache-Control: max-age=604800` + ETag; image variants are `max-age=31536000` immutable.

### 2.3 Block → book data model

Each book is an Image block. There is **no structured metadata** (no author/rating/date fields) — everything is packed into `title` and `description`:

| Book field | Source | Parse rule |
|---|---|---|
| **Title** | `block.title` | Split on `" by "`; take the part before. Titles are lowercase, format `"<title> by <author>"`. |
| **Author** | `block.title` | The part after `" by "`. Not stored anywhere else. |
| **Synopsis** | `block.description` | Markdown before the `\n---\n` divider. |
| **Personal notes** | `block.description` | Markdown after the `\n---\n` divider. Placeholder when empty: literally `"Thoughts to come..."`. |
| **Cover image** | `block.image.*` | See §2.4. |
| **Date added** | `block.connected_at` | Best available "date" proxy (not a read-date). |
| **Stable id / slug** | `block.id` + slugified title | For drawer routing (`/book/<id>-<slug>`). |

**Three description states to handle:**
- (a) synopsis + `---` + real notes (e.g. *A Little Life*, *The City and Its Uncertain Walls*).
- (b) synopsis + `---` + `"Thoughts to come..."` placeholder (e.g. *Dark Matter*, *The Secret of Secrets*).
- (c) synopsis only, no divider, or empty description (e.g. *On Earth We're Briefly Gorgeous*, *The Weight of Things*).

Notes:
- `description` contains **raw markdown** plus occasional HTML entities (`&nbsp;`, `&gt;`). Prefer parsing `description` as markdown, or use the pre-rendered `description_html` field to avoid entity handling. **Decision:** render `description_html` for safety, falling back to a markdown parse of `description` for the synopsis/notes split (split on the `<hr>` in HTML, or on `\n---\n` in the raw markdown).
- `block.content` is OCR garbage from the cover photo — **ignore it**.
- `source` is `null` for all books (covers were uploaded, not linked).

### 2.4 Cover images

The `image` object has 5 variants. **None carry pixel dimensions in JSON** (only `original` has `file_size`); measure client-side via `img.naturalWidth/Height` if needed.

| Variant | Max box | Fit | Host | Use |
|---|---|---|---|---|
| `thumb` | 400×400 | inside (aspect kept) | images.are.na | tiny preview |
| `square` | 440×440 | **cover-cropped** | images.are.na | uniform tiles (predictable size) |
| `display` | 1200×1200 | inside | images.are.na | **canvas tiles (default)** |
| `large` | 1800×1800 | inside | images.are.na | drawer / retina / zoom |
| `original` | native | — | cloudfront | download only (up to 4.4 MB PNG — avoid) |

- Covers are **photos of physical books** → **non-uniform aspect ratios**, some rotated/askew. Do **not** assume a fixed book-cover ratio. Render each into a fixed stamp frame with `object-fit: cover` (or use the `square` variant for guaranteed-uniform stamps).
- `images.are.na` is content-negotiated: serves WebP when the browser sends `Accept: image/webp` (automatic for `<img>`). Small originals are **not upscaled** (`display`/`large` may return the same small image).
- Set `crossorigin="anonymous"` before `src` — the hosts send `ACAO: *`, so canvas/WebGL textures won't be tainted if we ever need pixel access (we don't for the CSS approach, but harmless).

---

## 3. Architecture & tech stack

Matches the reference site's proven stack and deploys cleanly to the target subdomain.

- **Framework:** Next.js (App Router) + React 19, TypeScript.
- **Styling:** Tailwind CSS v4 (CSS-variable theme tokens, `oklch()` colors).
- **Fonts** via `next/font` (self-hosted woff2):
  - **Body/UI:** a clean grotesque/sans (e.g. *Funnel Sans* or the site's existing brand font).
  - **Mono/display:** a monospace for stamp franking marks, caption pills, and eyebrow labels (e.g. *Xanh Mono*, *Space Mono*, or *Geist Mono*). The video's caption pill is uppercase, letter-spaced monospace.
- **Icons:** lucide-react (close, copy-link, grid/list toggles).
- **Drawer:** custom `fixed` right panel on desktop; [Vaul](https://vaul.emilkowal.ski/) bottom-sheet on mobile.
- **Markdown:** `react-markdown` (+ `remark-gfm`) for synopsis/notes, or render `description_html` directly with sanitization.
- **Hosting:** Vercel, custom domain `books.cynthia.land`.
- **Repo:** this `book-club/` folder becomes the GitHub repo.

### 3.1 Data-fetch strategy — SSG + ISR

The archive is tiny (8 books) and changes rarely, so:

- **Fetch at build time (SSG)** in a Server Component / `generateStaticParams`, producing a static page with cover URLs baked in. Fast, resilient, and keeps visitors off the API/rate limits.
- **Add ISR revalidation** (`export const revalidate = 3600`, i.e. hourly) so newly added books appear without a manual redeploy.
- **Optional client refresh:** on mount, re-fetch `/contents` and reconcile, so an open tab picks up changes. Low priority.
- Normalize the raw Are.na blocks into a typed `Book[]` in one module (`lib/arena.ts`) so the rest of the app never touches raw API shapes.

```ts
type Book = {
  id: number;
  slug: string;          // `${id}-${slugify(title)}`
  title: string;         // parsed, title-cased for display
  author: string | null; // parsed from "title by author"
  synopsis: string;      // markdown, before the ---
  notes: string | null;  // markdown, after the ---; null if placeholder/empty
  hasNotes: boolean;     // false when notes are "Thoughts to come..." or empty
  cover: {
    thumb: string; square: string; display: string; large: string; original: string;
    aspect?: number;     // measured client-side; optional
  };
  addedAt: string;       // connected_at ISO
};
```

---

## 4. Visual design — the paper / stamp treatment

This is the heart of the "make covers look more paper-like" requirement and the stamp aesthetic.

### 4.1 Canvas surface

- **Background:** warm cream/ivory paper (approx `#f4f1e8`), with a very subtle vignette and optional faint paper-fiber noise texture. (The reference site uses near-black; the attached video uses light cream — **follow the video: light warm paper**.) Provide a dark-mode variant later if desired (§16).
- Generous negative space; stamps are **scattered**, not gridded, at the visible zoom (see §5 for how scatter + infinite tiling coexist).

### 4.2 The stamp component

Each book cover is composed into a stamp:

1. **Perforated die-cut edge** — the classic scalloped/notched white stamp border. Implement with an SVG mask or a repeating radial-gradient border technique so the notches are crisp at any scale. White (paper) perforations.
2. **White inner mat** — a thin white frame between the perforation and the cover image.
3. **Cover image treatment ("paper-like"):**
   - Slight **desaturation** (`saturate(~0.85)`) and a **warm cast** to unify the mismatched cover photos.
   - **Paper grain / halftone noise overlay** (`mix-blend-mode: multiply` or `overlay`, low opacity) to give a printed, risograph feel.
   - Very subtle **inner shadow / letterpress** edge so the print sits in the paper.
   - `object-fit: cover` into the fixed stamp aperture so non-uniform covers fill cleanly.
4. **Franking / cancellation overprint (optional, tasteful):** a faint monospace serial + a circular postmark, e.g. `BOOK CLUB · 2026 · Nº0X`, using the book's `position` or `addedAt`. Low opacity, positioned like a real cancel mark. This sells the metaphor (as in the video). Keep it subtle and legible.
5. **Rest elevation:** each stamp sits at a **random slight rotation** (±8–20°) and a soft drop shadow (lifted off the paper).
6. **Varied stamp dimensions** for masonry rhythm — a few discrete sizes/orientations (portrait, square, landscape), assigned deterministically per book so layout is stable across renders.

All randomness (rotation, size bucket, scatter jitter) must be **seeded from the book id** so the canvas is deterministic and stable between reloads and between SSG build and hydration (avoids hydration mismatch).

### 4.3 Typography & chrome

- Caption pill (hover): **uppercase, letter-spaced monospace**, light text on near-black rounded-full pill (see §7).
- Corner chrome (from the reference, adapt to light theme): small `2026` mark, a `DRAG TO EXPLORE` hint with a drag glyph, and view controls. Use `mix-blend-mode` so chrome stays legible over stamps.

---

## 5. Infinite canvas

### 5.1 Technique (from reference-site teardown)

Use the **recycled/virtualized tile-pool** pattern (the public.work / Cosmos approach that the reference site uses) — **not** one giant transformed container, and **not** WebGL:

- One root: `div` with `w-screen h-screen overflow-hidden`, `touch-action: none`, `cursor: grab`, `user-select: none`.
- A **fixed pool** of absolutely-positioned stamp tiles. The 8 books are laid out in a **base tile unit** (a scattered arrangement occupying, say, a ~3–4 screen-wide × ~3 screen-tall region). That unit is **repeated/wrapped** to fill infinity.
- On pointer drag, update a single `{offsetX, offsetY}`; in a `requestAnimationFrame` loop set each tile's `transform: translate3d(x, y, 0)` where position = `(baseX + offset) mod gridW`, `(baseY + offset) mod gridH`. Tiles that leave one edge wrap to the opposite edge — **seamless infinite pan**, constant DOM node count.
- **Momentum/inertia** on release (decay the velocity) for a polished feel.
- **Drag-vs-click disambiguation:** movement beyond a small threshold (e.g. 5px) = pan; below threshold on pointer-up = click (open drawer).

### 5.2 Interaction model

- **Pan:** mouse drag / touch drag (primary). Optionally two-finger trackpad and arrow-key nudge for a11y.
- **Zoom:** not required for v1 (reference uses a 3D mode instead of zoom). Optional pinch-zoom deferred.
- **Cursor:** `grab` on empty canvas, `grabbing` while dragging, `pointer` over a stamp.

### 5.3 Performance

- **Preload all 8 `display` covers** (`<link rel="preload" as="image">`) — the whole visual vocabulary is cached before first paint, no pop-in during pan.
- Keep DOM node count constant (recycle, never append).
- Transforms stay on the compositor (`translate3d`); animate via rAF; `touch-action: none` so the browser doesn't fight the gesture handler.
- With only 8 unique images the field will visibly repeat — acceptable and on-brand (the reference repeats ~9). As the archive grows, the base unit holds more unique stamps before repeating.

---

## 6. Hover interaction — the signature effect

**Authoritative source: the attached video, analyzed frame-by-frame** (33 frames @ 4fps of an 8.2s clip). This differs from the reference site's simpler hover and **takes precedence**.

### 6.1 Resting state

- All stamps crisp/in-focus, at their seeded random rotation, soft drop shadow, scattered across the cream canvas.

### 6.2 On pointer-enter a stamp (the "rack-focus lift")

All of the following happen **together**, smoothly, over **~200–300ms with an ease-out curve**:

1. **Hovered stamp lifts & grows:** `scale` → ~**1.4–1.6×** and **rotation eases to ~0°** (straightens from its resting tilt). Stays perfectly sharp. Transform-origin roughly center.
2. **Shadow deepens:** its drop shadow grows **larger and softer** (rises in Z toward the viewer) — layered soft box-shadow that expands on hover.
3. **Everything else blurs (depth-of-field):** ALL non-hovered stamps get a **Gaussian blur ~4–8px** and a slight **opacity dip** — the rest of the canvas recedes. The background paper is unaffected.
4. **Caption pill appears:** a **dark, fully-rounded pill** fades + rises in **just above** the stamp (small gap), containing the **book title** in **uppercase, letter-spaced monospace**, light text on near-black. Generous horizontal padding.
5. **Cursor:** `pointer`.

### 6.3 On pointer-leave

- Reverses cleanly over a similar duration: blur clears, stamp scales/rotates back to its resting angle, shadow shrinks, caption fades out.

### 6.4 Implementation notes (critical for perf)

Blurring "every other tile" via a per-node `filter: blur()` across a ~hundreds-node recycled pool is **expensive**. Preferred approaches, in order:

- **A — Two-layer promotion (recommended):** keep the whole canvas in one layer. On hover, apply `filter: blur()` + dim to that **single canvas layer**, and render a **sharp clone of the hovered stamp** (scaled/straightened, with caption) in an **overlay layer above the blur**, positioned to match the hovered tile. One blur, not N. Clean and cheap.
- **B — Sibling blur:** apply blur to a wrapper containing all tiles and exclude the hovered one via a CSS approach (`.canvas:hover .stamp:not(:hover)`). Simpler but blurs on every node — test perf with the real node count; may jank.
- Respect `prefers-reduced-motion`: drop the scale/blur transition to a simple opacity/scale with no rack-focus, or make it instant.
- Debounce hover so fast pointer sweeps across the field don't thrash the blur layer; add a tiny hover-intent delay (~40–60ms) before engaging focus.
- Suppress hover-focus **while dragging/panning**.

See **Appendix A** for the full frame-by-frame breakdown.

---

## 7. Side drawer (reading view)

### 7.1 Trigger & routing

- Clicking a stamp opens a **right-side drawer** and navigates to a shareable route: **`/book/<id>-<slug>`** (App Router intercepting route so the canvas stays mounted behind it). Back / Esc / × closes and returns to `/`.
- This makes each book **linkable and back-navigable**.

### 7.2 Panel

- **Desktop:** `position: fixed; right: 0;` full-height, **~390px wide**, `z-index` above canvas. Slides in via `transform .38s cubic-bezier(.32,.72,0,1)` (translateX off-screen → 0).
- **Frosted / paper panel:** either a warm frosted glass (`backdrop-filter: blur()`) or an opaque **aged-paper** panel to match the stamp theme (decide during design; paper likely reads better on the cream site). 1px left border, layered left shadow.
- **Canvas scrim:** dim + slight blur the canvas behind the open drawer (`backdrop-filter: blur(3px)` + low-opacity warm overlay), desktop only.
- **Mobile:** Vaul **bottom-sheet** (drag-to-dismiss) instead of a right panel.

### 7.3 Content

- **Enlarged stamp / cover** (use `large` variant) at top — could keep the stamp framing or show the clean cover; likely the treated cover, larger.
- **Title** (title-cased) and **author** (`by <author>`).
- **Synopsis** (markdown from `description` before `---`).
- **Personal notes** section (markdown after `---`). When notes are the `"Thoughts to come..."` placeholder or empty, show a gentle empty state (e.g. italic "Thoughts to come…") rather than a broken section.
- **Meta:** date added (`connected_at`), and a link to the block on Are.na (`https://www.are.na/block/<id>`).
- **Actions (top-right):** copy-link and close (lucide icons).

---

## 8. Other UI

- **Intro state:** a brief centered hero on first load — e.g. `BOOK CLUB` / `an archive` / a one-line subtitle — over the field fading in behind it, then it clears to the canvas. Optional but sets tone (reference does this).
- **Corner chrome:** `2026` / `DRAG TO EXPLORE` hint + drag glyph / small credit. `mix-blend` for legibility.
- **View toggle (optional, v1.1):** `Canvas` vs `List` — a simple text index of all books at `/list` for accessibility and quick scanning. Recommended for a11y even if secondary.
- **Filters (future):** none needed at 8 books; revisit if the archive grows or gets tags.

---

## 9. Responsive & mobile

- Same drag/touch-pan canvas (`touch-action: none`) on mobile; identical tile engine.
- Drawer → **Vaul bottom-sheet**; the desktop right panel and canvas scrim are desktop-only (`md:` breakpoint).
- Ensure stamps are large enough to tap; increase base stamp size on small viewports and reduce scatter spread.
- Hover effects are pointer-only; on touch, tap = open drawer (no rack-focus needed, but a brief press/scale feedback is nice).

---

## 10. Accessibility

- **Keyboard:** stamps are focusable (`tabindex`), Enter/Space opens the drawer; the rack-focus applies on `:focus-visible` too. Arrow keys pan the canvas. A visible **List view** (`/list`) provides a non-canvas path to every book.
- **Reduced motion:** honor `prefers-reduced-motion` — no blur rack-focus, minimal transitions, no auto-drift.
- **Semantics:** each stamp is a `<button>`/link with an accessible name (`"<Title> by <Author>"`); drawer is a labelled dialog with focus trap + Esc; caption pill is decorative (`aria-hidden`) since the name is on the control.
- **Contrast:** caption pill and chrome meet contrast over their backgrounds; `mix-blend` chrome verified against both light and stamp backgrounds.
- **Images:** `alt` = title + author.

---

## 11. Deployment

- **Repo:** initialize git in `book-club/`, push to a new GitHub repo (name TBD, e.g. `book-club` or `books-cynthia-land`).
- **Host:** Vercel project linked to the repo; every push to `main` deploys.
- **Domain:** add `books.cynthia.land` as a custom domain in Vercel; create a CNAME (or Vercel nameserver record) at the `cynthia.land` DNS provider pointing the `books` subdomain to Vercel. (User action / documented in README.)
- **Env:** none required (public API, no keys). If a personal access token is later used for private data, store as a Vercel env var — never in client code.
- **ISR:** `revalidate = 3600` keeps covers/notes fresh without redeploys.

---

## 12. Project structure (proposed)

```
book-club/
├─ docs/
│  ├─ PRD.md                  ← this document
│  └─ appendix-frames/        ← optional exported reference frames
├─ app/
│  ├─ layout.tsx
│  ├─ page.tsx                ← canvas (Server Component: fetch + normalize)
│  ├─ globals.css             ← Tailwind v4 + theme tokens + paper textures
│  ├─ @drawer/(.)book/[slug]/page.tsx   ← intercepting drawer route
│  └─ book/[slug]/page.tsx    ← full-page fallback for direct links
├─ components/
│  ├─ Canvas.tsx              ← pan engine, rAF loop, tile recycling
│  ├─ Stamp.tsx               ← perforation + paper treatment + franking
│  ├─ HoverFocusLayer.tsx     ← two-layer rack-focus overlay
│  ├─ CaptionPill.tsx
│  ├─ Drawer.tsx / MobileSheet.tsx
│  ├─ Chrome.tsx              ← corner UI, intro
│  └─ ListView.tsx
├─ lib/
│  ├─ arena.ts                ← fetch + normalize Book[]; parse title/desc
│  ├─ layout.ts               ← seeded scatter/rotation/size per book
│  └─ types.ts
├─ public/
│  └─ textures/               ← paper grain, perforation assets
├─ next.config.ts
├─ tailwind / postcss config
├─ package.json
└─ README.md                  ← setup, deploy, DNS steps
```

---

## 13. Milestones

1. **Scaffold** — Next.js + Tailwind v4 + fonts; `lib/arena.ts` fetch + normalize; render a plain grid of covers to prove data flow.
2. **Stamp component** — perforation, paper/grain treatment, franking, seeded rotation/size. This delivers the "paper-like" requirement.
3. **Infinite canvas** — recycled tile pool, drag-pan + momentum, drag-vs-click.
4. **Rack-focus hover** — two-layer blur/lift/caption per the video; reduced-motion fallback.
5. **Drawer** — intercepting route, slide-in, markdown synopsis/notes, mobile bottom-sheet.
6. **Chrome & polish** — intro, corner UI, list view, a11y pass, responsive.
7. **Deploy** — Vercel + `books.cynthia.land` + README with DNS steps.

---

## 14. Decisions (confirmed 2026-07-03)

1. **Theme:** ✅ **Light warm-paper** (matches the attached video) as the primary theme. Dark mode deferred.
2. **Franking overprint:** ✅ **Yes — subtle** faux postmark/serial on stamps.
3. **Stamp aperture:** ✅ **Varied, real aspect ratio** — preserve each cover's true proportions in differently-sized/oriented stamps.
4. **Order:** newest-added first (API default). *(Can revisit.)*
5. **Intro hero:** include a brief fade-in intro. *(Can revisit during polish.)*

### Still to confirm (non-blocking, needed at deploy time)
- **Repo/domain naming:** GitHub repo name; ability to add the `books` CNAME at the `cynthia.land` DNS provider.
- **Fonts:** any brand fonts from `cynthia.land` to reuse, or use fresh (grotesque + mono). Building with sensible defaults (Funnel Sans + a mono) until told otherwise.

---

## Appendix A — Hover interaction, frame-by-frame

From `bill guo porto update.mp4` (3266×1492, 51fps, 8.19s; sampled at 4fps).

- **Tiles are postage stamps:** perforated white edge, white mat, desaturated print-textured cover, some with a monospace franking overprint (e.g. `KENSHO TECHNOLOGIES 05 2026`) and a circular cancel mark. Subtle paper grain throughout.
- **Resting (frames 1–3, 15–16):** warm cream paper (~`#f4f1e8`), stamps scattered at ±8–20° rotations, soft drop shadows, all crisp.
- **Hover (frames 4–14):** simultaneously, ~200–300ms ease-out —
  1. hovered stamp scales ~1.4–1.6× and de-rotates toward upright, stays sharp;
  2. its drop shadow enlarges/softens (rises in Z);
  3. every other stamp gets ~4–8px Gaussian blur + slight opacity dip (rack focus);
  4. a dark, fully-rounded caption pill fades/rises in just above the stamp with the title in uppercase letter-spaced monospace light-on-dark (e.g. `NEW CRAFT SOCIETY`);
  5. cursor becomes pointer.
- **Exit (frames 15–16):** reverses cleanly to the resting state.
- The hovered stamp is **promoted to a sharp foreground focus layer** while the rest of the canvas **recedes** — replicate via single-layer blur + sharp overlay clone (§6.4 approach A).

## Appendix B — Real archive data (verified 2026-07-03)

8 books, all Image blocks, `title` = `"<title> by <author>"` (lowercase):

| # | Title | Author | Notes state |
|---|---|---|---|
| 1 | the secret of secrets | dan brown | placeholder ("Thoughts to come…") |
| 2 | i never promised you a rose garden | joanne greenberg | full review |
| 3 | the city and its uncertain walls | haruki murakami | full review |
| 4 | a little life | hanya yanagihara | full review (has `&nbsp;`) |
| 5 | the lost estate | henri alain-fournier | placeholder |
| 6 | dark matter | blake crouch | placeholder |
| 7 | on earth we're briefly gorgeous | ocean vuong | synopsis only, no divider |
| 8 | the weight of things | marianne fritz | empty description |

Data notes: covers are photos of physical books (non-uniform aspect); `description` splits on `\n---\n` into synopsis / notes; `content` is OCR junk; no ratings or read-dates exist.

## Appendix C — Key references

- Reference site: [tokyo.floguo.com](https://tokyo.floguo.com/) — Next.js 16 (App Router) + Tailwind v4 + Vaul + lucide on Vercel; recycled-tile infinite canvas; right drawer via routes.
- Canvas engine inspiration: [public.work](https://public.work/) (Cosmos infinite canvas); canvas perf writeups by Maxime Heckel.
- Are.na API v2: unauthenticated public reads, permissive CORS, `per` capped at 100, images on `images.are.na` (WebP-negotiated) — see §2.
