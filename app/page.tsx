import { getMangas } from "@/lib/chapters";
import Image from "next/image";

export const revalidate = false;

export async function generateStaticParams() {
  const mangas = await getMangas();
  return mangas.map((manga) => ({ manga: manga.slug }));
}

export const metadata = {
  title: "Manga Chapters",
};

export default async function Page() {
  const mangas = await getMangas();

  return (
    <div>
      <h1 className="mb-4 text-2xl">Mangas</h1>
      <div className="flex flex-col gap-16">
        {mangas.map((manga) => (
          <a
            className="flex flex-row gap-8 items-center"
            key={manga.slug}
            href={manga.slug}
          >
            <Image
              src={manga.image}
              width={300}
              height={300}
              alt={manga.title}
            />{" "}
            <span className="font-bold">{manga.title}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
