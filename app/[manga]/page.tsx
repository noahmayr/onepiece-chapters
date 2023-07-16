import { getMangaDetail as getManga, getMangas } from '@/lib/chapters';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata, ResolvingMetadata } from 'next/types';

export const dynamic = 'force-static';
export const dynamicParams = true;
export const revalidate = false;

export async function generateStaticParams() {
  const mangas = await getMangas();
  return mangas.map((manga) => ({ manga: manga.slug }));
}

interface PageProps {
  params: {
    manga: string;
  };
}

export async function generateMetadata(
  { params: { manga: mangaSlug } }: PageProps,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const manga = (await getMangas()).find((manga) => manga.slug === mangaSlug);
  if (manga === undefined) {
    const resolvedMetadata = (await parent) as Metadata;
    return resolvedMetadata ?? {};
  }
  console.log(`getting metadata for /${mangaSlug}`);
  return {
    title: manga?.title,
    openGraph: {
      images: [manga.image],
    },
  };
}

export default async function Page({
  params: { manga: mangaSlug },
}: PageProps) {
  const manga = await getManga(mangaSlug);
  if (manga === undefined) {
    notFound();
  }

  console.log(`rendering /${mangaSlug}`);
  return (
    <div className="max-w-screen-xl mx-auto">
      <div className="flex gap-4 mb-12 items-end">
        <h1 className="text-2xl">{manga.title} Chapters</h1>
        <Link href="/">Back</Link>
      </div>
      <div className="flex flex-col gap-6">
        {manga.chapters.map((chapter) => (
          <Link
            className="flex flex-row gap-2"
            key={chapter.id}
            href={`${mangaSlug}/${chapter.id}`}
          >
            <span className="font-bold">{chapter.id}</span>
            <span>{chapter.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
