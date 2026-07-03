"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { Book } from "@/lib/types";
import BookDetail from "./BookDetail";

/**
 * Reading panel. Desktop: a right-side drawer that slides in. Mobile: a
 * bottom-up sheet with a grabber and drag-to-dismiss. Closes by navigating
 * back to the canvas (which stays mounted behind it via the intercepting route).
 */
export default function Drawer({ book }: { book: Book }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Bottom-sheet drag-to-dismiss (mobile).
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Blur the canvas behind while the drawer is open (fades with the slide).
  useEffect(() => {
    document.documentElement.classList.toggle("drawer-open", open);
    return () => document.documentElement.classList.remove("drawer-open");
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    // Let the slide-out play before unmounting via navigation.
    setTimeout(() => router.back(), 380);
  }, [router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const onGrabStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    setDragging(true);
  };
  const onGrabMove = (e: React.TouchEvent) => {
    if (startY.current == null) return;
    setDragY(Math.max(0, e.touches[0].clientY - startY.current));
  };
  const onGrabEnd = () => {
    setDragging(false);
    startY.current = null;
    if (dragY > 110) close();
    else setDragY(0);
  };

  const panelStyle =
    dragY > 0
      ? { transform: `translateY(${dragY}px)`, transition: dragging ? "none" : undefined }
      : undefined;

  return (
    <div className="drawer-portal" data-open={open}>
      <div className="drawer-scrim" onClick={close} />
      <aside
        className="drawer-panel"
        style={panelStyle}
        role="dialog"
        aria-modal="true"
        aria-label={`${book.title}${book.author ? ` by ${book.author}` : ""}`}
      >
        <div
          className="drawer-grab"
          onTouchStart={onGrabStart}
          onTouchMove={onGrabMove}
          onTouchEnd={onGrabEnd}
        >
          <span className="drawer-grabber" aria-hidden="true" />
        </div>
        <button className="drawer-close" onClick={close} aria-label="Close">
          <X size={18} strokeWidth={1.75} />
        </button>
        <div className="drawer-scroll">
          <BookDetail book={book} />
        </div>
      </aside>
    </div>
  );
}
