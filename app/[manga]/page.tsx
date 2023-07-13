import { getChapters, getMangas } from "@/lib/chapters";
import { notFound } from "next/navigation";

export const dynamicParams = true;
export const revalidate = false;

export async function generateStaticParams() {
  const mangas = await getMangas();
  return mangas.map((manga) => ({ manga: manga.slug }));
}

interface PageProps {
  params: {
    manga: string;
  };
}

export default async function Page({ params: { manga } }: PageProps) {
  const chapters = await getChapters(manga);
  if (chapters === undefined) {
    notFound();
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl">One Piece Chapters</h1>
      <div className="flex flex-col gap-4">
        {chapters.map((chapter) => (
          <a
            className="flex flex-col gap-1"
            key={chapter.id}
            href={`${manga}/${chapter.id}`}
          >
            <span className="font-bold">{chapter.id}</span>
            <span>{chapter.title}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
