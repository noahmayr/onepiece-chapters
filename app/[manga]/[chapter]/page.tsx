/* eslint-disable @next/next/no-img-element */
import { getChapterDetail, getMangaListing } from '@/lib/data';
import db from '@/lib/db';
import type { Panel } from '@prisma/client';
import clsx from 'clsx';
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
      const unanalyzedChapters = await db.chapter.findMany({
        where: { panels: { none: {} }, manga: { key: slug } },
        orderBy: { sort: 'desc' },
        take: 2,
      });
      // const unanalyzedChapters: Chapter[] = [];

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
  const chapter = await getChapterDetail(mangaSlug, id, false);
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

// const PLACEHOLDER =
//   'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAQCAQAAABqtE31AAAAE0lEQVR42mN8+58BC2AcFaaNMABb8R7RhVqd7QAAAABJRU5ErkJggg==';
const blurUrl = (base64: string, width: number, height: number) =>
  `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http%3A//www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}'%3E%3Cfilter id='b' color-interpolation-filters='sRGB'%3E%3CfeGaussianBlur stdDeviation='20'/%3E%3C/filter%3E%3Cimage preserveAspectRatio='none' filter='url(%23b)' x='0' y='0' height='100%25' width='100%25' href='${base64}'/%3E%3C/svg%3E`;

function PanelComponent({
  panels,
}: {
  panels: Omit<Panel, 'id' | 'chapterId'>[];
}) {
  return panels.map((panel) => {
    const baseRowClass =
      'max-h-screen flex justify-center basis-auto max-h-full';
    // if (panel.missing) {
    //   return (
    //     <div key={panel.src} className={clsx(baseRowClass, 'basis-2/5')}>
    //       <div
    //         style={{
    //           height: '100dvh',
    //           backgroundImage: `url(${PLACEHOLDER})`,
    //           aspectRatio: 11 / 16,
    //           maxWidth: '100vw',
    //         }}
    //         className="flex object-contain flex-col gap-4 justify-center items-center w-auto max-w-full h-screen max-h-full text-black sm:text-2xl md:gap-8 md:text-4xl"
    //       >
    //         <span>Panel Not Found:</span>
    //         <span>{panel.title}</span>
    //       </div>
    //     </div>
    //   );
    // }
    const { src, title: alt, width, height, blurDataUrl } = panel;
    const fullWidth = width > height;
    const rowClass = clsx(baseRowClass, {
      'md:basis-2/5 flex-grow': !fullWidth,
    });
    const placeHolderUrl = blurUrl(blurDataUrl, width, height);
    return (
      <div key={src} className={rowClass}>
        <img
          src={src}
          alt={alt}
          width={width}
          height={1600}
          loading="lazy"
          decoding="async"
          style={{
            height: '100dvh',
            aspectRatio: width / height,
            color: 'transparent',
            backgroundSize: 'contain',
            backgroundPosition: '50% 50%',
            backgroundRepeat: 'no-repeat',
            backgroundImage: `url("${placeHolderUrl}")`,
          }}
          className={clsx(
            'object-contain w-auto max-w-full h-screen max-h-full',
          )}
        />
      </div>
    );
  });
}

export default async function Page({
  params: { manga, chapter: id },
}: PageProps) {
  const chapter = await getChapterDetail(manga, id);
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
        <PanelComponent panels={chapter.panels}></PanelComponent>
      </div>
    </div>
  );
}
