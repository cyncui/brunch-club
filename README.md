# Book Club Archive

An infinite-canvas micro-site for a personal book club archive, sourced live from
[Are.na](https://www.are.na/cynthia/book-club-archive). Book covers are rendered as
paper-treated **postage stamps** scattered across a warm, pannable canvas. Hover a
stamp for a rack-focus lift (it grows, straightens, and captions itself while the
rest of the canvas blurs); click it to slide open a reading drawer with the synopsis
and personal notes.

Lives at **books.cynthia.land**.

## Stack

- **Next.js 16** (App Router) + **React 19** + TypeScript
- **Tailwind CSS v4**
- Data from the **Are.na v2 API** (public, no auth), fetched at build with hourly
  ISR revalidation; a committed snapshot (`lib/data/snapshot.json`) is the offline
  fallback so the site never renders empty.
- Deployed on **Vercel**

## How it works

| Area | File | Notes |
|---|---|---|
| Data fetch + normalize | `lib/arena.ts` | Parses `"<title> by <author>"` and splits the description on `---` into synopsis + notes. |
| Deterministic layout | `lib/layout.ts` | Seeded scatter/rotation/size per book so the canvas is stable across renders. |
| Infinite canvas | `components/Canvas.tsx` | Recycled tile pool; drag-to-pan with inertia; per-frame `translate3d` written imperatively via rAF; seamless modulo wrapping. |
| Stamp | `components/Stamp.tsx` + `app/globals.css` | Perforated die-cut edge (CSS mask), paper grain, warm/muted print treatment, franking + postmark. |
| Rack-focus hover | `components/Canvas.tsx` | Single blur layer over the field + a sharp overlay clone of the hovered stamp with a caption pill. |
| Reading drawer | `app/@drawer/…` + `components/Drawer.tsx` | Intercepting route (`/book/[slug]`) slides a panel over the still-mounted canvas; hard links hit the full-page fallback at `app/book/[slug]`. |

The full product spec is in [`docs/PRD.md`](docs/PRD.md).

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build (also validates the SSG routes)
npm start          # serve the production build
```

No environment variables are required — the Are.na channel is public.

## Content

The site reads the Are.na channel `book-club-archive`. To add a book, add an image
block (with a `"<title> by <author>"` title and a description) to that channel on
Are.na — it appears on the next revalidation (hourly) or redeploy. To refresh the
offline fallback snapshot:

```bash
curl -s "https://api.are.na/v2/channels/book-club-archive/contents?per=100&page=1" \
  -o lib/data/snapshot.json
```

## Deploy (Vercel + books.cynthia.land)

1. Push this repo to GitHub and import it as a new Vercel project (framework
   auto-detected as Next.js; no env vars needed).
2. In the Vercel project → **Settings → Domains**, add `books.cynthia.land`.
3. At the DNS provider for `cynthia.land`, add the record Vercel shows — typically a
   `CNAME` on the `books` subdomain pointing to `cname.vercel-dns.com`.
4. Vercel provisions TLS automatically once DNS resolves.

Every push to `main` deploys.
