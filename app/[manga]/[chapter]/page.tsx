import { PanelComponent } from '@/lib/components/panel';
import { PanelList } from '@/lib/components/panelList';
import { getChapterDetail, getMangaListing } from '@/lib/data';
import db from '@/lib/db';
import type { Chapter } from '@prisma/client';
import type { Metadata, ResolvingMetadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

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
      // const unanalyzedChapters = await db.chapter.findMany({
      //   where: { panels: { none: {} }, manga: { key: slug } },
      //   orderBy: { sort: 'desc' },
      //   take: 2,
      // });
      const unanalyzedChapters: Chapter[] = [];

      return [...chapters, ...unanalyzedChapters].map((chapter) => ({
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
      <div className="max-w-screen-xl mx-auto flex justify-between pb-8">
        <span>
          {chapter.prev ? (
            <Link href={`/${chapter.manga.key}/${chapter.prev.key}`}>
              Previous Chapter
            </Link>
          ) : (
            <span className="text-gray-400">Previous Chapter</span>
          )}
        </span>

        <Link href={`/${chapter.manga.key}`}>Back to Chapters</Link>
        <span>
          {chapter.next ? (
            <Link href={`/${chapter.manga.key}/${chapter.next.key}`}>
              Next Chapter
            </Link>
          ) : (
            <span className="text-gray-400">Next Chapter</span>
          )}
        </span>
      </div>
      <div className="flex flex-row-reverse flex-wrap gap-x-4 gap-y-8 justify-center md:gap-y-24">
        <PanelList
          panels={chapter.panels}
          mangaKey={mangaKey}
          chapterKey={chapterKey}
        />
      </div>
    </div>
  );
}
