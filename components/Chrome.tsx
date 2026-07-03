"use client";

import { useEffect, useState } from "react";

export default function Chrome({ count }: { count: number }) {
  const [introGone, setIntroGone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setIntroGone(true), 2400);
    const dismiss = () => setIntroGone(true);
    window.addEventListener("pointerdown", dismiss, { once: true });
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", dismiss);
    };
  }, []);

  return (
    <>
      {/* Intro hero */}
      <div className={`intro${introGone ? " gone" : ""}`} aria-hidden={introGone}>
        <div className="intro-inner">
          <div className="intro-eyebrow">Are.na · books</div>
          <h1 className="intro-title">Book&nbsp;Club</h1>
          <div className="intro-sub">an archive of what we read</div>
        </div>
      </div>

      {/* Top-left masthead */}
      <div className="chrome" style={{ top: 22, left: 24 }}>
        <div style={{ fontWeight: 700 }}>Book Club Archive</div>
      </div>

      {/* Top-right count + source */}
      <div
        className="chrome"
        style={{ top: 22, right: 24, textAlign: "right" }}
      >
        <div>{count} volumes</div>
        <a
          href="https://www.are.na/cynthia/book-club-archive"
          target="_blank"
          rel="noreferrer"
          style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}
        >
          on are.na ↗
        </a>
      </div>

      {/* Bottom-left year */}
      <div className="chrome" style={{ bottom: 22, left: 24, fontSize: 13 }}>
        2026
      </div>

      {/* Bottom-center hint */}
      <div
        className="chrome"
        style={{
          bottom: 22,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          opacity: 0.7,
        }}
      >
        <span>✦</span>
        <span>Drag to explore · click a stamp to read</span>
        <span>✦</span>
      </div>
    </>
  );
}
