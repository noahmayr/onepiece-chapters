/* eslint-disable @next/next/no-before-interactive-script-outside-document */
import clsx from 'clsx';
import './globals.css';
import type { Metadata } from 'next';
import Script from 'next/script';
import { Inter } from 'next/font/google';
import Provider from '@/lib/provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'One Piece Chapters',
  description: 'Sourced from tcbscans.com',
  metadataBase: new URL(
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:${process.env.PORT ?? 3000}`,
  ),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script strategy="beforeInteractive" src="/theme.js"></Script>
      </head>
      <body
        className={clsx(
          inter.className,
          'mt-8',
          'dark:bg-neutral-900 dark:text-white',
        )}
      >
        <Provider>
          <div className="max-w-screen-xl 2xl:max-w-screen-2xl mx-auto px-4">
            {children}
          </div>
        </Provider>
      </body>
    </html>
  );
}
