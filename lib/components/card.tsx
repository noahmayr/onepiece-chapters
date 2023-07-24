/* eslint-disable @next/next/no-img-element */
import type { LinkProps } from 'next/link';
import Link from 'next/link';

export const PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAQCAQAAABqtE31AAAAE0lEQVR42mN8+58BC2AcFaaNMABb8R7RhVqd7QAAAABJRU5ErkJggg==';

export const blurUrl = (base64: string, width: number, height: number) =>
  `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http%3A//www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}'%3E%3Cfilter id='b' color-interpolation-filters='sRGB'%3E%3CfeGaussianBlur stdDeviation='20'/%3E%3C/filter%3E%3Cimage preserveAspectRatio='none' filter='url(%23b)' x='0' y='0' height='100%25' width='100%25' href='${base64}'/%3E%3C/svg%3E`;

export interface CardProps {
  href: LinkProps['href'];
  prefetch?: boolean;
  title: string;
  subtitle?: string;
  image: {
    src: string;
    title?: string;
    width: number;
    height: number;
    placeHolder?: string;
  };
}

export default function Card({
  href,
  prefetch = false,
  title,
  subtitle,
  image,
}: CardProps) {
  return (
    <Link
      className="flex flex-col gap-2 dark:bg-black shadow-lg p-4 rounded-md"
      href={href}
      prefetch={prefetch}
    >
      <img
        src={image.src}
        alt={image.title ?? title}
        width={image.width}
        height={image.height}
        className="object-cover w-full"
        style={{
          aspectRatio: image.width / image.height,
          backgroundSize: 'contain',
          backgroundPosition: '50% 50%',
          backgroundRepeat: 'no-repeat',
          backgroundImage: `url("${blurUrl(
            image.placeHolder ?? PLACEHOLDER,
            image.width,
            image.height,
          )}")`,
        }}
        loading="lazy"
      ></img>
      <span className="flex flex-col gap-2">
        <span className="font-bold">{title}</span>
        <span>{subtitle}</span>
      </span>
    </Link>
  );
}
