import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { COPY } from "@/config/copy";
import { StructuredData } from "@/components/seo/structured-data";
import { THEME_SCRIPT } from "@/components/theme/theme-script";
import "./globals.css";

const M = COPY.meta;

export const metadata: Metadata = {
  // metadataBase resolves every relative URL below (canonical, Open Graph image).
  metadataBase: new URL(M.url),
  title: { default: M.title, template: `%s · ${M.name}` },
  description: M.description,
  applicationName: M.name,
  keywords: [...M.keywords],
  authors: [{ name: M.creator, url: M.creatorUrl }],
  creator: M.creator,
  publisher: M.creator,
  category: "weather",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: M.name,
    title: M.title,
    description: M.description,
    url: M.url,
    locale: M.locale,
    // og:image is added automatically from app/opengraph-image.tsx.
  },
  twitter: {
    card: "summary_large_image",
    title: M.title,
    description: M.description,
    // twitter:image falls back to the Open Graph image.
  },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  // themeColor stays light: the browser reads it before our script runs, and
  // dark chrome above a light page is worse than the reverse.
  themeColor: "#ffffff",
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // The head script sets data-theme before React hydrates, which reports as a
  // mismatch. suppressHydrationWarning covers this element's own attributes
  // only, not the tree below.
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        {/* Runs before the first paint. The page is statically prerendered, so
            the server cannot know the time; deciding in React instead would
            flash a light page dark on every night-time load. */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){${THEME_SCRIPT}})()` }} />
      </head>
      <body className="min-h-full">
        <StructuredData />
        <a
          href="#report"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink focus:outline-2 focus:outline-offset-2 focus:outline-link"
        >
          {M.skipToReport}
        </a>
        {/* Clipped, not removed: the design carries no visible title, but
            crawlers and screen-reader heading navigation still need one. */}
        <h1 className="sr-only">{M.name}</h1>
        {children}
        {/* ink-mute, not ink-faint: 11px text needs 4.5:1 contrast for WCAG AA
            (faint is 2.5:1 on white). */}
        <footer className="mx-auto max-w-[960px] px-4 pb-6 pt-1 text-center text-[11px] text-ink-mute">
          {M.credit}{" "}
          <a
            href={M.creatorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-ink-mute underline decoration-line underline-offset-2 hover:text-ink-soft"
          >
            {M.creator}
          </a>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
