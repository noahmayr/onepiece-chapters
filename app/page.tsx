import Card from '@/lib/components/card';
import Header from '@/lib/components/header';
import { getMangaListing } from '@/lib/data';

export const revalidate = false;

export async function generateStaticParams() {
  const mangas = await getMangaListing();
  return mangas.map((manga) => ({ manga: manga.key }));
}

export const metadata = {
  title: 'Manga Chapters',
};

export default async function Page() {
  const mangas = await getMangaListing();

  return (
    <div>
      <Header title={`Mangas`} />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
        {mangas.map((manga) => (
          <Card
            key={manga.key}
            href={`/${manga.key}`}
            title={manga.title}
            image={{ src: manga.image, width: 300, height: 200 }}
          ></Card>
        ))}
      </div>
    </div>
  );
}
