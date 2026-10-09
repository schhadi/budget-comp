import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Sans } from "next/font/google";
import "./globals.css";

const instrumentSans = Instrument_Sans({ variable: "--font-instrument-sans", subsets: ["latin"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: { default: "Who Can Spend the Less?", template: "%s · Who Can Spend the Less?" },
  description: "A leaderboard for friends competing to spend the least. Upload screenshots, let AI read them, win bragging rights.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F3EE" },
    { media: "(prefers-color-scheme: dark)", color: "#121315" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${instrumentSans.variable} ${plexMono.variable} h-full`}>
      <head>
        {/* Icon font isn't available through next/font; display=block avoids flashing ligature names. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font, @next/next/google-font-display */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,0&display=block"
        />
      </head>
      <body className="min-h-full">
        <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-bg text-ink">{children}</div>
      </body>
    </html>
  );
}
