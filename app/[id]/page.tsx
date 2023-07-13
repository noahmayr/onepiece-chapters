import type { IndexChapter } from "@/lib/chapters";
import { getChapter, getChapters } from "@/lib/chapters";
import clsx from "clsx";
import type { Metadata, ResolvingMetadata } from "next";
import Image from "next/image";

export const dynamicParams = true;
export const revalidate = false;

export async function generateStaticParams() {
  return (await getChapters()).slice(0, 50);
}

type Params = Pick<IndexChapter, "id">;

export async function generateMetadata(
  { params: { id } }: { params: Params },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const chapter = await getChapter(id);
  if (chapter === undefined) {
    const resolvedMetadata = (await parent) as Metadata;
    return resolvedMetadata ?? {};
  }
  return {
    title: `One Piece Chapter ${chapter.id}: ${chapter?.title}`,
    openGraph: {
      images: chapter.pages.map((page) => page.src),
    },
  };
}

export default async function Page({
  params: { id },
}: {
  params: Pick<IndexChapter, "id">;
}) {
  const chapter = await getChapter(id);
  if (chapter === undefined) {
    return {
      notFound: true,
    };
  }
  return (
    <div className="flex flex-row-reverse flex-wrap gap-y-12 justify-center md:gap-y-24">
      {chapter.pages.map(({ src, alt, width, height }) => {
        const fullWidth = width > height;
        const rowClass = clsx(
          "max-h-screen",
          fullWidth ? "basis-auto" : "md:basis-1/2 basis-auto",
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
