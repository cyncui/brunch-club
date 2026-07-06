"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { Book } from "@/lib/types";
import type { CanvasLayout } from "@/lib/layout";
import Stamp from "./Stamp";

type CanvasProps = {
  books: Book[];
  layout: CanvasLayout;
};

type TileInstance = {
  key: string;
  /** Masthead tiles carry no book. */
  masthead: boolean;
  book?: Book;
  bx: number;
  by: number;
  rotation: number;
  width: number;
  cx: number; // copy column
  cy: number; // copy row
};

const DRAG_THRESHOLD = 5;
const FRICTION = 0.94;
const DEFAULT_ASPECT = 1.46;
// Keep in sync with --focus-scale in globals.css.
const FOCUS_SCALE = 1.52;
// Vertical room the caption tag needs (tag height + gap + margin).
const CAPTION_ROOM = 34;

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export default function Canvas({ books, layout }: CanvasProps) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);

  const bookById = useMemo(() => {
    const m = new Map<number, Book>();
    books.forEach((b) => m.set(b.id, b));
    return m;
  }, [books]);

  // Measured cover aspect ratios (height / width), seeded with a portrait default.
  const [aspects, setAspects] = useState<Record<number, number>>(() =>
    Object.fromEntries(books.map((b) => [b.id, DEFAULT_ASPECT])),
  );

  useEffect(() => {
    let alive = true;
    books.forEach((b) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (!alive || !img.naturalWidth) return;
        setAspects((prev) => ({
          ...prev,
          [b.id]: img.naturalHeight / img.naturalWidth,
        }));
      };
      img.src = b.cover.display;
    });
    return () => {
      alive = false;
    };
  }, [books]);

  // Track the viewport so the layout can scale down on smaller screens.
  const [viewport, setViewport] = useState({ w: 0, h: 0 });
  const userPannedRef = useRef(false);
  useLayoutEffect(() => {
    const measure = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w && h) setViewport({ w, h });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Smaller screens get a smaller layout so more stamps fit; the stamp itself
  // is size-proportional, so its mat and perforation scale with it.
  const scale = useMemo(() => {
    if (!viewport.w) return 1;
    return Math.min(1, Math.max(0.56, viewport.w / 780));
  }, [viewport.w]);

  // On phones, tighten the grid spacing (positions only, not stamp size) so the
  // canvas reads denser without shrinking the covers.
  const gridScale = useMemo(
    () => scale * (viewport.w && viewport.w <= 640 ? 0.72 : 1),
    [scale, viewport.w],
  );

  const slayout = useMemo(
    () => ({
      unitW: layout.unitW * gridScale,
      unitH: layout.unitH * gridScale,
      slots: layout.slots.map((s) => ({
        ...s,
        x: s.x * gridScale,
        y: s.y * gridScale,
        width: s.width * scale,
      })),
      masthead: {
        x: layout.masthead.x * gridScale,
        y: layout.masthead.y * gridScale,
      },
    }),
    [layout, scale, gridScale],
  );

  // How many copies of the base unit we need to blanket the viewport.
  const repeats = useMemo(
    () => ({
      x: viewport.w ? Math.ceil(viewport.w / slayout.unitW) + 2 : 3,
      y: viewport.h ? Math.ceil(viewport.h / slayout.unitH) + 2 : 3,
    }),
    [viewport, slayout.unitW, slayout.unitH],
  );

  // Flat pool of tile instances (book × copy grid). Recycled, never grown.
  const tiles = useMemo<TileInstance[]>(() => {
    const out: TileInstance[] = [];
    slayout.slots.forEach((slot, si) => {
      const book = bookById.get(slot.bookId);
      if (!book) return;
      for (let cx = 0; cx < repeats.x; cx++) {
        for (let cy = 0; cy < repeats.y; cy++) {
          out.push({
            key: `${si}-${cx}-${cy}`,
            masthead: false,
            book,
            bx: slot.x,
            by: slot.y,
            rotation: slot.rotation,
            width: slot.width,
            cx,
            cy,
          });
        }
      }
    });
    // A single masthead — it pans with the canvas but never wraps/repeats.
    out.push({
      key: "mh",
      masthead: true,
      bx: slayout.masthead.x,
      by: slayout.masthead.y,
      rotation: 0,
      width: 0,
      cx: 0,
      cy: 0,
    });
    return out;
  }, [slayout, bookById, repeats]);

  // ---- Pan engine (imperative; transforms written straight to the DOM) ----
  const tileEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const focusedKeyRef = useRef<string | null>(null);
  const offset = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const dirty = useRef(true);
  const inertia = useRef(false);
  const rafId = useRef<number>(0);

  // Keep the masthead centered through (re)size/scale until the user first pans.
  useLayoutEffect(() => {
    if (userPannedRef.current || !viewport.w) return;
    offset.current = {
      x: viewport.w / 2 - slayout.masthead.x,
      y: viewport.h / 2 - slayout.masthead.y,
    };
    dirty.current = true;
  }, [viewport.w, viewport.h, slayout.masthead.x, slayout.masthead.y]);

  const writeTransforms = useCallback(() => {
    const { x: ox, y: oy } = offset.current;
    const uW = slayout.unitW;
    const uH = slayout.unitH;
    const fKey = focusedKeyRef.current;
    for (const t of tiles) {
      const el = tileEls.current.get(t.key);
      if (!el) continue;
      if (t.masthead) {
        // Single instance: pans with the offset, never wraps.
        el.style.transform = `translate3d(${t.bx + ox}px, ${t.by + oy}px, 0)`;
        continue;
      }
      const wx = mod(t.bx + ox, uW) + (t.cx - 1) * uW;
      const wy = mod(t.by + oy, uH) + (t.cy - 1) * uH;
      el.style.transform = `translate3d(${wx}px, ${wy}px, 0)`;
      // Focused stamp hides beneath the overlay but stays interactive so the
      // pointer stays "over" it and the hover doesn't drop.
      el.style.opacity = fKey === t.key ? "0" : "1";
    }
  }, [tiles, slayout.unitW, slayout.unitH]);

  useEffect(() => {
    const loop = () => {
      if (inertia.current) {
        offset.current.x += velocity.current.x;
        offset.current.y += velocity.current.y;
        velocity.current.x *= FRICTION;
        velocity.current.y *= FRICTION;
        dirty.current = true;
        if (
          Math.abs(velocity.current.x) < 0.05 &&
          Math.abs(velocity.current.y) < 0.05
        ) {
          inertia.current = false;
        }
      }
      if (dirty.current) {
        writeTransforms();
        dirty.current = false;
      }
      rafId.current = requestAnimationFrame(loop);
    };
    rafId.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId.current);
  }, [writeTransforms]);

  // Re-flow immediately when the tile set changes.
  useLayoutEffect(() => {
    dirty.current = true;
  }, [tiles]);

  // ---- Pointer / drag handling ----
  const pointer = useRef({
    down: false,
    moved: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
    lastX: 0,
    lastY: 0,
  });
  const [dragging, setDragging] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = pointer.current;
    p.down = true;
    p.moved = false;
    p.startX = p.lastX = e.clientX;
    p.startY = p.lastY = e.clientY;
    p.baseX = offset.current.x;
    p.baseY = offset.current.y;
    inertia.current = false;
    velocity.current = { x: 0, y: 0 };
    // NB: don't capture the pointer here — capturing on press retargets the
    // subsequent click to the canvas root, so a stamp's onClick never fires.
    // We capture only once a drag actually starts (below).
  }, []);

  const clearFocusRef = useRef<() => void>(() => {});

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const p = pointer.current;
    if (!p.down) return;
    const dx = e.clientX - p.startX;
    const dy = e.clientY - p.startY;
    if (!p.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      p.moved = true;
      userPannedRef.current = true; // stop auto-centering once the user pans
      setDragging(true);
      clearFocusRef.current();
      // Capture now (a real drag) so the pan keeps tracking off-target.
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* pointer may already be gone */
      }
    }
    if (p.moved) {
      offset.current.x = p.baseX + dx;
      offset.current.y = p.baseY + dy;
      velocity.current.x = e.clientX - p.lastX;
      velocity.current.y = e.clientY - p.lastY;
      p.lastX = e.clientX;
      p.lastY = e.clientY;
      dirty.current = true;
    }
  }, []);

  const endPointer = useCallback(() => {
    const p = pointer.current;
    if (!p.down) return;
    p.down = false;
    if (p.moved) {
      inertia.current = true;
      setDragging(false);
    }
  }, []);

  // ---- Rack-focus hover state ----
  const [focus, setFocus] = useState<{
    book: Book;
    tileKey: string;
    width: number;
    aspect: number;
    rotation: number;
    px: number;
    py: number;
    captionBelow: boolean;
  } | null>(null);
  const [focusOn, setFocusOn] = useState(false);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFocus = useCallback(() => {
    setFocusOn(false);
    focusedKeyRef.current = null;
    dirty.current = true; // restore the just-unhidden stamp's opacity
    if (exitTimer.current) clearTimeout(exitTimer.current);
    exitTimer.current = setTimeout(() => setFocus(null), 280);
  }, []);

  const clearFocusInstant = useCallback(() => {
    if (exitTimer.current) clearTimeout(exitTimer.current);
    setFocusOn(false);
    focusedKeyRef.current = null;
    dirty.current = true;
    setFocus(null);
  }, []);
  clearFocusRef.current = clearFocusInstant;

  const onTileEnter = useCallback(
    (t: TileInstance, e: React.PointerEvent) => {
      if (!t.book || pointer.current.down || e.pointerType === "touch") return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (exitTimer.current) clearTimeout(exitTimer.current);
      focusedKeyRef.current = t.key;
      dirty.current = true; // hide the hovered stamp beneath the overlay
      const py = rect.top + rect.height / 2;
      // Top of the enlarged stamp; if the tag above it would clip off the top
      // of the viewport, flip the tag below the stamp instead.
      const scaledTop = py - (rect.height * FOCUS_SCALE) / 2;
      const captionBelow = scaledTop < CAPTION_ROOM;
      // Anchor the overlay to the hovered tile's center (rotation-invariant).
      setFocus({
        book: t.book,
        tileKey: t.key,
        width: t.width,
        aspect: aspects[t.book.id] ?? DEFAULT_ASPECT,
        rotation: t.rotation,
        px: rect.left + rect.width / 2,
        py,
        captionBelow,
      });
      requestAnimationFrame(() => setFocusOn(true));
    },
    [aspects],
  );

  const openBook = useCallback(
    (book: Book) => {
      if (pointer.current.moved) return;
      clearFocus();
      router.push(`/book/${book.slug}`, { scroll: false });
    },
    [router, clearFocus],
  );

  return (
    <div
      ref={rootRef}
      className={`canvas-root${dragging ? " dragging" : ""}${
        focus ? " focusing" : ""
      }`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      role="application"
      aria-label="Book club archive canvas. Drag to explore; click a stamp to read."
    >
      <div className="field">
        {tiles.map((t) => {
          if (t.masthead) return null;
          const setRef = (el: HTMLDivElement | null) => {
            if (el) tileEls.current.set(t.key, el);
            else tileEls.current.delete(t.key);
          };
          return (
            <div key={t.key} ref={setRef} className="tile-pos">
              <div
                className="tile"
                style={{
                  transform: `translate(-50%, -50%) rotate(${t.rotation}deg)`,
                }}
                onPointerEnter={(e) => onTileEnter(t, e)}
                onPointerLeave={() => {
                  if (focus && focus.tileKey === t.key) clearFocus();
                }}
                onClick={() => t.book && openBook(t.book)}
              >
                <Stamp
                  book={t.book!}
                  width={t.width}
                  aspect={aspects[t.book!.id] ?? DEFAULT_ASPECT}
                  eager={t.cx === 1 && t.cy === 1}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Masthead lives OUTSIDE .field so the rack-focus blur/dim never touches
          it — its clearing stays bright paper and cleanly covers the stamp
          behind it on hover. */}
      {tiles
        .filter((t) => t.masthead)
        .map((t) => (
          <div
            key={t.key}
            ref={(el) => {
              if (el) tileEls.current.set(t.key, el);
              else tileEls.current.delete(t.key);
            }}
            className="tile-pos masthead-pos"
          >
            <h1 className="masthead-canvas">
              Book Club <br className="mh-break" />Archive
            </h1>
          </div>
        ))}

      {focus && (
        <div
          className={`focus-overlay${focusOn ? " on" : ""}`}
          style={{
            left: focus.px,
            top: focus.py,
            transform: `translate(-50%, -50%) rotate(${
              focusOn ? 0 : focus.rotation
            }deg) scale(${focusOn ? "var(--focus-scale)" : 1})`,
          }}
        >
          <div className={`caption${focus.captionBelow ? " below" : ""}`}>
            {focus.book.title}
          </div>
          <Stamp
            book={focus.book}
            width={focus.width}
            aspect={focus.aspect}
          />
        </div>
      )}
    </div>
  );
}
