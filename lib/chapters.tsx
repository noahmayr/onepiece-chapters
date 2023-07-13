import { JSDOM } from "jsdom";
import { cache } from "react";
import probe from "probe-image-size";

export interface IndexChapter {
  id: string;
  title: string;
  path: string;
  slug: string;
}

const TCB_HOST = "https://tcbscans.com/";
const CHAPTER_INDEX_PATH = "/mangas/5/one-piece";

export const getChapters = cache(async (): Promise<IndexChapter[]> => {
  const html = await fetch(new URL(CHAPTER_INDEX_PATH, TCB_HOST));
  const {
    window: { document },
  } = new JSDOM(await html.text());

  const chapterElements = Array.from(
    document.querySelectorAll<HTMLAnchorElement>('a[href^="/chapters"]')
  );
  return chapterElements.map(({ href, children }) => {
    const [chapter, title] = Array.from(children).map((div) => div.innerHTML);
    const path = new URL(href, "https://localhost").pathname;
    return {
      id: chapter.replace(/.*?(\d+)/, "$1"),
      title,
      path,
      slug: href.replace(/.*\/([^\/]+)$/, "$1"),
    };
  });
});

export interface Page {
  src: string;
  alt: string;
  width: number;
  height: number;
}

export interface DetailChapter extends IndexChapter {
  pages: Page[];
}

const getImageSize = cache(
  async (src: string): Promise<{ width: number; height: number }> => {
    const { width, height } = await probe(src);
    return { width, height };
  }
);

export const getChapter = cache(
  async (id: string): Promise<DetailChapter | undefined> => {
    const chapter = (await getChapters()).find((chapter) => chapter.id === id);
    if (chapter === undefined) {
      return undefined;
    }
    const html = await fetch(new URL(chapter.path, TCB_HOST));
    const {
      window: { document },
    } = new JSDOM(await html.text());
    const imageElements = Array.from(
      document.querySelectorAll<HTMLImageElement>("img.fixed-ratio-content")
    );
    const pages = await Promise.all(
      imageElements.map(async ({ src, alt }) => ({
        src,
        alt,
        ...(await getImageSize(src)),
      }))
    );
    return { ...chapter, pages };
  }
);
