import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBook, getBooks } from "@/lib/arena";
import BookDetail from "@/components/BookDetail";

export const revalidate = 3600;

export async function generateStaticParams() {
  const books = await getBooks();
  return books.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const book = await getBook(slug);
  if (!book) return { title: "Book Club Archive" };
  const name = book.author ? `${book.title} by ${book.author}` : book.title;
  return {
    title: `${book.title} · Book Club Archive`,
    description: book.synopsis?.slice(0, 160) || name,
    openGraph: { images: [book.cover.large] },
  };
}

/** Full-page view for direct links / shares (canvas not mounted). */
export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const book = await getBook(slug);
  if (!book) notFound();

  return (
    <main className="book-page">
      <Link href="/" className="book-page-back">
        ← Back to the archive
      </Link>
      <div className="book-page-inner">
        <BookDetail book={book} />
      </div>
    </main>
  );
}
