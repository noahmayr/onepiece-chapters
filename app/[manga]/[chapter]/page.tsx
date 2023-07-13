import { getChapter, getChapters, getMangas } from "@/lib/chapters";
import clsx from "clsx";
import type { Metadata, ResolvingMetadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

export const dynamicParams = true;
export const revalidate = false;

export async function generateStaticParams() {
  const mangas = await getMangas();
  const paramsPerManga = await Promise.all(
    mangas.map(async (manga) => {
      const chapters = await getChapters(manga.slug);
      return chapters
        ?.slice(0, 50)
        .map((chapter) => ({ manga: manga.slug, chapter: chapter.id }));
    })
  );
  return paramsPerManga.flat();
}

interface PageProps {
  params: {
    manga: string;
    chapter: string;
  };
}

export async function generateMetadata(
  { params: { manga: mangaSlug, chapter: id } }: PageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const manga = (await getMangas()).find((manga) => manga.slug === mangaSlug);
  const chapter = await getChapter(mangaSlug, id);
  if (chapter === undefined || manga === undefined) {
    const resolvedMetadata = (await parent) as Metadata;
    return resolvedMetadata ?? {};
  }
  return {
    title: `${manga.title} Chapter ${chapter.id}: ${chapter?.title}`,
    openGraph: {
      images: chapter.pages.map((page) => page.src),
    },
  };
}

export default async function Page({
  params: { manga, chapter: id },
}: PageProps) {
  const chapter = await getChapter(manga, id);
  if (chapter === undefined) {
    notFound();
  }
  return (
    <div className="flex flex-row-reverse flex-wrap gap-y-12 justify-center md:gap-y-24">
      {chapter.pages.map(({ src, alt, width, height }) => {
        const fullWidth = width > height;
        const rowClass = clsx(
          "max-h-screen",
          fullWidth ? "basis-auto" : "md:basis-1/2 basis-auto"
        );

        return (
          <div key={src} className={rowClass}>
            <Image
              src={src}
              alt={alt}
              width={fullWidth ? 2200 : 1100}
              height={1600}
              className="object-contain max-h-full"
            />
          </div>
        );
      })}
    </div>
  );
}
