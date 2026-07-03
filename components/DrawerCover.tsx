"use client";

import { useState } from "react";
import type { Book } from "@/lib/types";
import Stamp from "./Stamp";

/**
 * The drawer/detail cover, rendered as a stamp (perforated edge + paper
 * treatment) like the canvas. Measures the cover's aspect ratio so the stamp
 * fits it without cropping.
 */
export default function DrawerCover({ book }: { book: Book }) {
  const [aspect, setAspect] = useState(1.45);

  return (
    <div className="detail-cover">
      <Stamp book={book} width={280} aspect={aspect} eager />
      <img
        src={book.cover.display}
        alt=""
        aria-hidden="true"
        style={{ display: "none" }}
        onLoad={(e) => {
          const el = e.currentTarget;
          if (el.naturalWidth) setAspect(el.naturalHeight / el.naturalWidth);
        }}
      />
    </div>
  );
}
