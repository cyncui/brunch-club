import { notFound } from "next/navigation";
import { getBook } from "@/lib/arena";
import Drawer from "@/components/Drawer";

export default async function InterceptedBook({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const book = await getBook(slug);
  if (!book) notFound();
  return <Drawer book={book} />;
}
