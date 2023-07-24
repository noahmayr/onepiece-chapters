/* eslint-disable @next/next/no-img-element */
import type { Panel } from '@prisma/client';
import { clsx } from 'clsx';

const PLACEHOLDER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAQCAQAAABqtE31AAAAE0lEQVR42mN8+58BC2AcFaaNMABb8R7RhVqd7QAAAABJRU5ErkJggg==';

const blurUrl = (base64: string, width: number, height: number) =>
  `data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http%3A//www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}'%3E%3Cfilter id='b' color-interpolation-filters='sRGB'%3E%3CfeGaussianBlur stdDeviation='20'/%3E%3C/filter%3E%3Cimage preserveAspectRatio='none' filter='url(%23b)' x='0' y='0' height='100%25' width='100%25' href='${base64}'/%3E%3C/svg%3E`;

export function PanelComponent({
  panel,
}: {
  panel: Omit<Panel, 'id' | 'chapterId'>;
}) {
  const baseRowClass = 'max-h-screen flex justify-center basis-auto max-h-full';
  if (panel.missing || !(panel.height && panel.width && panel.blurDataUrl)) {
    return (
      <div className={clsx(baseRowClass, 'basis-2/5')}>
        <div
          style={{
            height: '100dvh',
            backgroundImage: `url(${PLACEHOLDER})`,
            aspectRatio: 11 / 16,
            maxWidth: '100vw',
          }}
          className="flex object-contain flex-col gap-4 justify-center items-center w-auto max-w-full h-screen max-h-full text-black sm:text-2xl md:gap-8 md:text-4xl"
        >
          <span>Panel Not {panel.missing ? 'Found' : 'Analyzed'}:</span>
          <span>{panel.title}</span>
        </div>
      </div>
    );
  }
  const { src, title: alt, width, height, blurDataUrl } = panel;
  const fullWidth = width > height;
  const rowClass = clsx(baseRowClass, {
    'md:basis-2/5 flex-grow': !fullWidth,
  });
  const placeHolderUrl = blurUrl(blurDataUrl, width, height);
  return (
    <div className={rowClass}>
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        loading="lazy"
        decoding="async"
        style={{
          height: '100dvh',
          aspectRatio: width / height,
          width: 'auto',
          color: 'transparent',
          backgroundSize: 'contain',
          backgroundPosition: '50% 50%',
          backgroundRepeat: 'no-repeat',
          backgroundImage: `url("${placeHolderUrl}")`,
        }}
        className={clsx('object-contain w-auto max-w-full h-screen max-h-full')}
      />
    </div>
  );
}
