import { getMangaDetail as getManga, getMangaListing } from '@/lib/data';
import db from '@/lib/db';
import { indexChapters, loadMangasFromTcb } from '@/lib/tcb';
import type { Chapter, Manga } from '@prisma/client';
import Link from 'next/link';
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
  chapters: Promise<Chapter[]> | Chapter[];
  manga: Manga;
}) => {
  const chapters = await chaptersOrPromise;
  return (
    <>
      {chapters?.map((chapter) => (
        <Link
          className="flex flex-row gap-2"
          key={chapter.key}
          href={`/${manga.key}/${chapter.key}`}
          prefetch={false}
        >
          <span className="font-bold">{chapter.key}</span>
          <span>{chapter.title}</span>
        </Link>
      ))}
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
    <div className="max-w-screen-xl mx-auto">
      <div className="flex gap-4 mb-12 items-end">
        <h1 className="text-2xl">{manga.title} Chapters</h1>
        <Link href="/">Back</Link>
      </div>
      <div className="flex flex-col gap-6">
        <Chapters chapters={manga.chapters} manga={manga} />
      </div>
    </div>
  );
}
