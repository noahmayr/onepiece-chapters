import type { LinkProps } from 'next/link';
import Link from 'next/link';
import dynamic from 'next/dynamic';
const ThemeToggle = dynamic(() => import('@/lib/components/themeToggle'), {
  ssr: false,
});
import { MdArrowBack } from 'react-icons/md';

export interface HeaderProps {
  title: string;
  back?:
    | {
        title?: string;
        href: LinkProps['href'];
      }
    | string;
}

export default function Header({ title, back }: HeaderProps) {
  return (
    <div
      className="grid gap-2 sm:gap-4 items-center"
      style={{ gridTemplateColumns: 'min-content auto min-content' }}
    >
      {back ? (
        typeof back === 'string' ? (
          <Link href={back}>
            <MdArrowBack size={'2rem'} />
          </Link>
        ) : (
          <Link href={back.href}>
            {back.title ?? <MdArrowBack size={'2rem'} />}
          </Link>
        )
      ) : (
        <span></span>
      )}
      <h1 className="text-2xl text-center">{title}</h1>
      <span className="text-right">
        <ThemeToggle></ThemeToggle>
      </span>
    </div>
  );
}
