"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { Book } from "@/lib/types";
import BookDetail from "./BookDetail";

/**
 * Sliding reading panel. Mounts open, animates in, and closes by navigating
 * back to the canvas (which stays mounted behind it via the intercepting route).
 */
export default function Drawer({ book }: { book: Book }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

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

  return (
    <div className="drawer-portal" data-open={open}>
      <div className="drawer-scrim" onClick={close} />
      <aside
        className="drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`${book.title}${book.author ? ` by ${book.author}` : ""}`}
      >
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
