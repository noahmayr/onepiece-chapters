import Header from '@/lib/components/header';
import { PanelList } from '@/lib/components/panelList';
import { getChapterDetail, getMangaListing } from '@/lib/data';
import db from '@/lib/db';
import type { Metadata, ResolvingMetadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MdArrowBack, MdArrowForward } from 'react-icons/md';

export const dynamic = 'force-static';
export const dynamicParams = true;
export const revalidate = false;

export async function generateStaticParams() {
  const mangas = await getMangaListing();
  const paramsPerManga = await Promise.all(
    mangas.map(async ({ key: slug }) => {
      // use only chapters that have analyzed panels for static site generation
      const chapters = await db.chapter.findMany({
        where: {
          panels: {
            some: {},
          },
          manga: {
            key: slug,
          },
        },
        orderBy: { sort: 'desc' },
      });
      const uncrawledChapters = await db.chapter.findMany({
        where: { panels: { none: {} }, manga: { key: slug } },
        orderBy: { sort: 'desc' },
        // take: 2,
      });
      // const unanalyzedChapters: Chapter[] = [];

      return [...chapters, ...uncrawledChapters].map((chapter) => ({
        manga: slug,
        chapter: chapter.key,
      }));
    }),
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
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const chapter = await getChapterDetail(mangaSlug, id);
  const resolvedMetadata = (await parent) as Metadata;
  if (!chapter) {
    return resolvedMetadata ?? {};
  }

  return {
    ...resolvedMetadata,
    title: `${chapter.manga.title} Chapter ${chapter.key}: ${chapter?.title}`,
    openGraph: {
      images: [chapter.panels?.[0].src],
    },
  };
}

export default async function Page({
  params: { manga: mangaKey, chapter: chapterKey },
}: PageProps) {
  const chapter = await getChapterDetail(mangaKey, chapterKey);
  if (!chapter) {
    notFound();
  }
  return (
    <div>
      <Header
        title={`${chapter.manga.title} Chapter ${chapter.key}`}
        back={`/${chapter.manga.key}`}
      />

      <div className="flex flex-row-reverse flex-wrap gap-x-4 gap-y-8 justify-center md:gap-y-24 w-full">
        <PanelList panels={chapter.panels} />
      </div>

      <div className="grid grid-cols-3 py-8 items-center">
        {chapter.prev ? (
          <Link
            className="flex gap-2 items-center justify-start"
            href={`/${chapter.manga.key}/${chapter.prev.key}`}
          >
            <MdArrowBack size={'2rem'} />
            <span>
              {chapter.manga.title} Chapter {chapter.prev.key}
            </span>
          </Link>
        ) : (
          <span />
        )}

        <Link className="flex justify-center" href={`/${chapter.manga.key}`}>
          View all Chapters
        </Link>
        {chapter.next ? (
          <Link
            className="flex gap-2 items-center justify-end"
            href={`/${chapter.manga.key}/${chapter.next.key}`}
          >
            <span>
              {chapter.manga.title} Chapter {chapter.next.key}
            </span>
            <div>
              <MdArrowForward size={'2rem'} />
            </div>
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
