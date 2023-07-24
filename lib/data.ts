import { cache } from 'react';
import type { Chapter, Manga, Panel } from '@prisma/client';
import db from './db';
import { loadPanels } from './tcb';

export const getMangaListing = cache(async (): Promise<Manga[]> => {
  return await db.manga.findMany();
});

export const getMangaDetail = cache(async (mangaSlug: string) => {
  return db.manga.findUnique({
    where: { key: mangaSlug },
    include: {
      chapters: {
        orderBy: { sort: 'desc' },
      },
    },
  });
});

const getNeighbors = async (mangaKey: string, sort: number) => {
  const data = await db.chapter.findMany({
    where: {
      sort: {
        in: [sort - 1, sort + 1],
      },
      manga: { key: mangaKey },
    },
  });
  return data.reduce<{ prev?: Chapter; next?: Chapter }>(
    (neighbors, neighbor) => {
      if (neighbor.sort < sort) {
        neighbors.prev = neighbor;
      }
      if (neighbor.sort > sort) {
        neighbors.next = neighbor;
      }
      return neighbors;
    },
    {},
  );
};

export const getChapterDetail = cache(
  async (
    mangaKey: string,
    chapterKey: string,
  ): Promise<
    | (Chapter & {
        panels: Panel[];
        manga: Manga;
        prev?: Chapter;
        next?: Chapter;
      })
    | null
  > => {
    const chapter = await db.chapter.findFirst({
      where: { key: chapterKey, manga: { key: mangaKey } },
      include: {
        panels: {
          orderBy: {
            sort: 'asc',
          },
        },
        manga: true,
      },
    });

    if (!chapter) {
      return chapter;
    }

    const [{ prev, next }, { panels }] = await Promise.all([
      getNeighbors(mangaKey, chapter.sort),
      loadPanels(chapter),
    ]);

    return { ...chapter, panels, prev, next };
  },
);
