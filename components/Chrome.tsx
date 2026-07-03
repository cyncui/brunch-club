"use client";

import { useEffect, useState } from "react";

export default function Chrome() {
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
    /* Intro hero */
    <div className={`intro${introGone ? " gone" : ""}`} aria-hidden={introGone}>
      <div className="intro-inner">
        <div className="intro-eyebrow">Are.na · books</div>
        <h1 className="intro-title">Book&nbsp;Club</h1>
        <div className="intro-sub">an archive of what we read</div>
      </div>
    </div>
  );
}
