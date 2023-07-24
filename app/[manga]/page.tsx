import Card from '@/lib/components/card';
import Header from '@/lib/components/header';
import { getMangaListing } from '@/lib/data';
import db from '@/lib/db';
import { indexChapters, loadMangasFromTcb } from '@/lib/tcb';
import type { Chapter, Manga, Panel } from '@prisma/client';
import { notFound } from 'next/navigation';
import type { Metadata, ResolvingMetadata } from 'next/types';

export const dynamic = 'force-static';
export const dynamicParams = true;
export const revalidate = false;

export async function generateStaticParams() {
  let mangas: Omit<Manga, 'id'>[] = await getMangaListing();
  if (!mangas.length) {
    mangas = await loadMangasFromTcb();
    await db.manga.createMany({ data: mangas });
  }
  return Promise.all(
    mangas.map((manga) => {
      return { manga: manga.key };
    }),
  );
}

interface PageProps {
  params: {
    manga: string;
  };
}

export async function generateMetadata(
  { params: { manga: mangaSlug } }: PageProps,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const manga = await db.manga.findUnique({ where: { key: mangaSlug } });
  const resolvedMetadata = (await parent) as Metadata;
  if (!manga) {
    return resolvedMetadata ?? {};
  }
  return {
    ...resolvedMetadata,
    title: manga?.title,
    openGraph: {
      images: [manga.image],
    },
  };
}

const Chapters = async ({
  chapters: chaptersOrPromise,
  manga,
}: {
  chapters:
    | Promise<(Chapter & { panels: Panel[] })[]>
    | (Chapter & { panels: Panel[] })[];
  manga: Manga;
}) => {
  const chapters = await chaptersOrPromise;
  return (
    <>
      {chapters?.map((chapter) => {
        const frontPage = chapter.panels[0];
        return (
          <Card
            key={chapter.key}
            href={`/${manga.key}/${chapter.key}`}
            title={`Chapter ${chapter.key}`}
            subtitle={chapter.title}
            image={{ ...frontPage, width: 220, height: 320 }}
          ></Card>
        );
      })}
    </>
  );
};

export default async function Page({
  params: { manga: mangaSlug },
}: PageProps) {
  const manga = await indexChapters(mangaSlug);
  if (!manga) {
    notFound();
  }

  return (
    <div>
      <Header title={`${manga.title} Chapters`} back={'/'} />

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
        <Chapters chapters={manga.chapters} manga={manga} />
      </div>
    </div>
  );
}
