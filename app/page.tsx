import { getChapters } from "@/lib/chapters";

export default async function Home() {
  const chapters = await getChapters();

  return (
    <div>
      <h1 className="mb-4 text-2xl">One Piece Chapters</h1>
      <div className="flex flex-col gap-4">
        {chapters.map((chapter) => (
          <a className="flex flex-col gap-1" key={chapter.id} href={chapter.id}>
            <span className="font-bold">{chapter.id}</span>
            <span>{chapter.title}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
