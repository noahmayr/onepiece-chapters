import type { IndexChapter } from "@/lib/chapters";
import { getChapter, getChapters } from "@/lib/chapters";
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
  parent: ResolvingMetadata
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
    <div className="flex flex-row-reverse flex-wrap gap-y-24 justify-center">
      {chapter.pages.map(({ src, alt, width, height }) => {
        const fullWidth = width > height;
        return (
          <div key={src} style={{ flexBasis: fullWidth ? "100%" : "50%" }}>
            <Image
              src={src}
              alt={alt}
              width={width}
              height={height}
            // sizes="100vw"
            // className="w-full h-auto"
            />
          </div>
        );
      })}
    </div>
  );
}
