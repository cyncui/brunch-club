"use client";

import { useEffect, useState } from "react";
import type { Book } from "@/lib/types";
import WhimsyLoader from "./WhimsyLoader";

// Show the loader at least this long so it never just flashes.
const MIN_MS = 1000;
// ...and never hang past this, even if a cover stalls.
const MAX_MS = 4500;

export default function LoadingScreen({ books }: { books: Book[] }) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const start = performance.now();
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      const wait = Math.max(0, MIN_MS - (performance.now() - start));
      window.setTimeout(() => setDone(true), wait);
    };

    // Dismiss once every cover has loaded (or errored) — the canvas behind is
    // then ready with no pop-in.
    const urls = books.map((b) => b.cover.display);
    let remaining = urls.length;
    if (remaining === 0) finish();
    urls.forEach((src) => {
      const img = new Image();
      const onDone = () => {
        if (--remaining <= 0) finish();
      };
      img.onload = onDone;
      img.onerror = onDone;
      img.src = src;
    });

    const cap = window.setTimeout(finish, MAX_MS);
    return () => window.clearTimeout(cap);
  }, [books]);

  return (
    <div
      className={`loader-screen${done ? " gone" : ""}`}
      aria-hidden={done}
      role="status"
      aria-live="polite"
    >
      <div className="loader-inner">
        <WhimsyLoader />
        <div className="loader-text">books are being organized&hellip;</div>
      </div>
    </div>
  );
}
