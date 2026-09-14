import { getBooks } from "@/lib/arena";
import { computeLayout } from "@/lib/layout";
import Canvas from "@/components/Canvas";

export const revalidate = 3600;

export default async function Home() {
  const books = await getBooks();
  const layout = computeLayout(books);

  return (
    <>
      <Canvas books={books} layout={layout} />
    </>
  );
}
