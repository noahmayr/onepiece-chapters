import { getChapter, getChapters, getMangas, isDefined } from '@/lib/chapters';
import clsx from 'clsx';
import type { Metadata, ResolvingMetadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import styles from './styles.module.css';

export const dynamicParams = true;
export const revalidate = false;

export async function generateStaticParams() {
  const mangas = await getMangas();
  const paramsPerManga = await Promise.all(
    mangas.map(async (manga) => {
      const chapters = await getChapters(manga.slug);
      return chapters
        ?.slice(0, 25)
        .map((chapter) => ({ manga: manga.slug, chapter: chapter.id }));
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
  const manga = (await getMangas()).find((manga) => manga.slug === mangaSlug);
  const chapter = await getChapter(mangaSlug, id);
  if (chapter === undefined || manga === undefined) {
    const resolvedMetadata = (await parent) as Metadata;
    return resolvedMetadata ?? {};
  }
  return {
    title: `${manga.title} Chapter ${chapter.id}: ${chapter?.title}`,
    openGraph: {
      images: chapter.panels
        .map((panel) => (panel.missing ? undefined : panel.src))
        .filter(isDefined),
    },
  };
}

const PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAQCAQAAABqtE31AAAAE0lEQVR42mN8+58BC2AcFaaNMABb8R7RhVqd7QAAAABJRU5ErkJggg==';

export default async function Page({
  params: { manga, chapter: id },
}: PageProps) {
  const chapter = await getChapter(manga, id);
  if (chapter === undefined) {
    notFound();
  }
  return (
    <div className="flex flex-row-reverse flex-wrap gap-x-4 gap-y-8 justify-center md:gap-y-24">
      {chapter.panels.map((panel) => {
        const baseRowClass =
          'max-h-screen flex justify-center basis-auto max-h-full';
        if (panel.missing) {
          return (
            <div key={panel.src} className={clsx(baseRowClass, 'basis-1/2')}>
              <div
                style={{
                  height: '100dvh',
                  backgroundImage: `url(${PLACEHOLDER})`,
                  aspectRatio: 11 / 16,
                  maxWidth: '100vw',
                }}
                className="flex object-contain flex-col gap-4 justify-center items-center w-auto max-w-full h-screen max-h-full text-black sm:text-2xl md:gap-8 md:text-4xl"
              >
                <span>Panel Not Found:</span>
                <span>{panel.alt}</span>
              </div>
            </div>
          );
        }
        const { src, alt, width, height, base64 } = panel;
        const fullWidth = width > height;
        const rowClass = clsx(baseRowClass, {
          'md:basis-1/3 flex-grow': !fullWidth,
        });
        return (
          <div key={src} className={rowClass}>
            <Image
              src={src}
              alt={alt}
              placeholder="blur"
              blurDataURL={base64}
              width={width}
              height={1600}
              style={{
                height: '100dvh',
                aspectRatio: width / height,
                backgroundSize: 'unset',
              }}
              className={clsx(
                'object-contain w-auto max-w-full h-screen max-h-full',
                styles.backgroundContain,
              )}
            />
          </div>
        );
      })}
    </div>
  );
}
