import type { Metadata } from 'next';
import { Island_Moments, Schibsted_Grotesk, Inter } from 'next/font/google';
import './globals.scss';

const islandMoments = Island_Moments({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-island-moments',
  display: 'swap',
});

const schibstedGrotesk = Schibsted_Grotesk({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-schibsted-grotesk',
  display: 'swap',
});

const inter = Inter({
  weight: ['400'],
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Jona Ferreira Music',
  description: 'Latest single by Jona Ferreira. Listen now on all streaming platforms.',
  openGraph: {
    title: 'Jona Ferreira Music',
    description: 'Latest single by Jona Ferreira. Listen now on all streaming platforms.',
    type: 'music.song',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${islandMoments.variable} ${schibstedGrotesk.variable} ${inter.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
