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
import CanvasHero from "./CanvasHero";

type CanvasProps = {
  books: Book[];
  layout: CanvasLayout;
};

type TileInstance = {
  key: string;
  book: Book;
  index: number; // 1-based catalog number
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
const PAD = 9;
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
    const m = new Map<number, { book: Book; index: number }>();
    books.forEach((b, i) => m.set(b.id, { book: b, index: i + 1 }));
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

  // How many copies of the base unit we need to blanket the viewport.
  const [repeats, setRepeats] = useState({ x: 3, y: 3 });
  useLayoutEffect(() => {
    const measure = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setRepeats({
        x: Math.ceil(w / layout.unitW) + 2,
        y: Math.ceil(h / layout.unitH) + 2,
      });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [layout.unitW, layout.unitH]);

  // Flat pool of tile instances (book × copy grid). Recycled, never grown.
  const tiles = useMemo<TileInstance[]>(() => {
    const out: TileInstance[] = [];
    for (const id of layout.order) {
      const entry = bookById.get(id);
      const p = layout.placements[id];
      if (!entry || !p) continue;
      for (let cx = 0; cx < repeats.x; cx++) {
        for (let cy = 0; cy < repeats.y; cy++) {
          out.push({
            key: `${id}-${cx}-${cy}`,
            book: entry.book,
            index: entry.index,
            bx: p.x,
            by: p.y,
            rotation: p.rotation,
            width: p.width,
            cx,
            cy,
          });
        }
      }
    }
    return out;
  }, [layout, bookById, repeats]);

  // ---- Pan engine (imperative; transforms written straight to the DOM) ----
  const tileEls = useRef<Map<string, HTMLDivElement>>(new Map());
  const offset = useRef({ x: 0, y: 0 });
  const velocity = useRef({ x: 0, y: 0 });
  const dirty = useRef(true);
  const inertia = useRef(false);
  const rafId = useRef<number>(0);

  const writeTransforms = useCallback(() => {
    const { x: ox, y: oy } = offset.current;
    const uW = layout.unitW;
    const uH = layout.unitH;
    for (const t of tiles) {
      const el = tileEls.current.get(t.key);
      if (!el) continue;
      const wx = mod(t.bx + ox, uW) + (t.cx - 1) * uW;
      const wy = mod(t.by + oy, uH) + (t.cy - 1) * uH;
      el.style.transform = `translate3d(${wx}px, ${wy}px, 0)`;
    }
  }, [tiles, layout.unitW, layout.unitH]);

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
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const clearFocusRef = useRef<() => void>(() => {});

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const p = pointer.current;
    if (!p.down) return;
    const dx = e.clientX - p.startX;
    const dy = e.clientY - p.startY;
    if (!p.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      p.moved = true;
      setDragging(true);
      clearFocusRef.current();
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
    index: number;
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
    if (exitTimer.current) clearTimeout(exitTimer.current);
    exitTimer.current = setTimeout(() => setFocus(null), 280);
  }, []);

  const clearFocusInstant = useCallback(() => {
    if (exitTimer.current) clearTimeout(exitTimer.current);
    setFocusOn(false);
    setFocus(null);
  }, []);
  clearFocusRef.current = clearFocusInstant;

  const onTileEnter = useCallback(
    (t: TileInstance, e: React.PointerEvent) => {
      if (pointer.current.down || e.pointerType === "touch") return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (exitTimer.current) clearTimeout(exitTimer.current);
      const py = rect.top + rect.height / 2;
      // Top of the enlarged stamp; if the tag above it would clip off the top
      // of the viewport, flip the tag below the stamp instead.
      const scaledTop = py - (rect.height * FOCUS_SCALE) / 2;
      const captionBelow = scaledTop < CAPTION_ROOM;
      // Anchor the overlay to the hovered tile's center (rotation-invariant).
      setFocus({
        book: t.book,
        index: t.index,
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
          const hidden = focus && focus.tileKey === t.key; // hide focused copy
          return (
            <div
              key={t.key}
              ref={(el) => {
                if (el) tileEls.current.set(t.key, el);
                else tileEls.current.delete(t.key);
              }}
              className="tile-pos"
            >
              <div
                className={`tile${hidden ? " hidden-focus" : ""}`}
                style={{
                  transform: `translate(-50%, -50%) rotate(${t.rotation}deg)`,
                }}
                onPointerEnter={(e) => onTileEnter(t, e)}
                onPointerLeave={() => {
                  if (focus && focus.tileKey === t.key) clearFocus();
                }}
                onClick={() => openBook(t.book)}
              >
                <Stamp
                  book={t.book}
                  width={t.width}
                  aspect={aspects[t.book.id] ?? DEFAULT_ASPECT}
                  index={t.index}
                  eager={t.cx === 1 && t.cy === 1}
                />
              </div>
            </div>
          );
        })}
        <CanvasHero />
      </div>

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
            index={focus.index}
          />
        </div>
      )}
    </div>
  );
}
