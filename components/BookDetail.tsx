import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Book } from "@/lib/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BookDetail({ book }: { book: Book }) {
  return (
    <article className="detail">
      <div className="detail-cover">
        <img
          src={book.cover.large}
          alt={book.author ? `${book.title} by ${book.author}` : book.title}
          crossOrigin="anonymous"
        />
      </div>

      <header className="detail-head">
        <h2 className="detail-title">{book.title}</h2>
        {book.author && <p className="detail-author">by {book.author}</p>}
      </header>

      {book.synopsis && (
        <section className="detail-section">
          <div className="detail-label">Synopsis</div>
          <div className="prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {book.synopsis}
            </ReactMarkdown>
          </div>
        </section>
      )}

      <section className="detail-section">
        <div className="detail-label">Notes</div>
        {book.hasNotes && book.notes ? (
          <div className="prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {book.notes}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="detail-empty">Thoughts to come…</p>
        )}
      </section>

      <footer className="detail-foot">
        <span>Added {formatDate(book.addedAt)}</span>
        <a
          href={`https://www.are.na/block/${book.id}`}
          target="_blank"
          rel="noreferrer"
        >
          View on Are.na ↗
        </a>
      </footer>
    </article>
  );
}
