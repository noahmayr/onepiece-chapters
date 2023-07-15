import type { IndexChapter } from "@/lib/chapters";
import { getChapter, getChapters } from "@/lib/chapters";
import type { Metadata, ResolvingMetadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

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
    notFound();
  }
  return (
    <div
      dir="rtl"
      style={{ paddingInline: "10vw", height: "100dvh" }}
      className="flex overflow-x-scroll flex-row justify-start min-w-full max-w-full h-screen bg-white scroll-smooth snap-x snap-mandatory"
    >
      {chapter.pages.map(({ src, alt, width, height }) => {
        const fullWidth = width > height;

        return (
          <div
            key={src}
            className="flex justify-center items-center w-screen max-h-screen snap-center basis-full"
            style={{
              width: "100vw",
              minWidth: "100vw",
              flexBasis: "100vw",
              maxHeight: "100dvh",
            }}
          >
            {/* <span className="text-2xl text-black" style={{ minWidth: "100vw" }}> */}
            {/*   {i} */}
            {/* </span> */}
            <Image
              src={src}
              alt={alt}
              width={fullWidth ? 2200 : 1100}
              height={1600}
              className="object-contain h-full max-h-screen max-w-screen w-fit"
              style={{ maxHeight: "100dvh" }}
            />
          </div>
        );
      })}
    </div>
  );
}
