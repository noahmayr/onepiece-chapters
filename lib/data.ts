import { cache } from 'react';
import type { Manga } from '@prisma/client';
import db from './db';
import { analyzePanels, loadPanels } from './tcb';

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

export const getChapterDetail = cache(
  async (mangaKey: string, chapterKey: string) => {
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
    const actualPanels = await loadPanels(chapter);
    if (actualPanels.length > chapter.panels.length) {
      const indexed = new Set(chapter.panels.map((panel) => panel.src));
      const toIndex = actualPanels.filter((panel) => !indexed.has(panel.src));
      const analyzed = (await analyzePanels(toIndex)).map((panel) => ({
        ...panel,
        chapterId: chapter.id,
      }));

      try {
        await db.panel.createMany({ data: analyzed });
      } catch (e) {
        console.error(
          `error during create many for ${mangaKey}/${chapterKey}`,
          analyzed,
        );
        throw new Error(
          `error during create many for ${mangaKey}/${chapterKey}`,
        );
      }
      return {
        ...chapter,
        panels: [...chapter.panels, ...analyzed].sort(
          (a, b) => a.sort - b.sort,
        ),
      };
    }

    return chapter;
  },
);
