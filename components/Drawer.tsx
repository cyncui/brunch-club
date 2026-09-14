"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import type { Book } from "@/lib/types";
import BookDetail from "./BookDetail";

export default function Drawer({ book, onClose, animateEntry = true }: { book: Book; onClose?: () => void; animateEntry?: boolean }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closingRef = useRef(false);
  const completedRef = useRef(false);
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);
  const dragDistance = useRef(0);

  useLayoutEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);

  const finishClose = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    dialogRef.current?.close();
    if (onClose) onClose();
    else router.back();
  }, [onClose, router]);

  const close = useCallback((instant = false) => {
    if (instant) { finishClose(); return; }
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
  }, [finishClose]);

  useLayoutEffect(() => {
    if (!closing) return;
    let active = true;
    // Wait for the actual transitions, including reduced motion or an interrupted entry.
    const animations = dialogRef.current?.getAnimations() ?? [];
    Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (active) finishClose();
    });
    return () => { active = false; };
  }, [closing, finishClose]);

  return (
    <dialog
      ref={dialogRef}
      className="drawer-panel"
      data-closing={closing}
      data-animate-entry={animateEntry}
      data-dragging={!closing && dragY > 0}
      aria-label={`${book.title}${book.author ? ` by ${book.author}` : ""}`}
      onCancel={(event) => { event.preventDefault(); close(true); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
      }}
      style={!closing && dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined}
    >
      <div
        className="drawer-grab"
        aria-hidden="true"
        onTouchStart={(event) => {
          if (closingRef.current || event.touches.length !== 1) return;
          startY.current = event.touches[0].clientY;
          dragDistance.current = 0;
        }}
        onTouchMove={(event) => {
          if (startY.current === null) return;
          dragDistance.current = Math.max(0, event.touches[0].clientY - startY.current);
          setDragY(dragDistance.current);
        }}
        onTouchEnd={() => {
          startY.current = null;
          if (dragDistance.current > 110) close();
          else setDragY(0);
        }}
        onTouchCancel={() => { startY.current = null; dragDistance.current = 0; setDragY(0); }}
      >
        <span className="drawer-grabber" />
      </div>
      <button className="drawer-close" onClick={(event) => close(event.detail === 0)} aria-label="Close" autoFocus>
        <X size={18} strokeWidth={1.75} />
      </button>
      <div className="drawer-scroll">
        <BookDetail book={book} />
      </div>
    </dialog>
  );
}
