import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { COPY } from "@/config/copy";
import { StructuredData } from "@/components/seo/structured-data";
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
  // Match the page's white surface so mobile browser chrome blends in.
  themeColor: "#ffffff",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        <StructuredData />
        {children}
        <footer className="mx-auto max-w-[960px] px-4 pb-6 pt-1 text-center text-[11px] text-ink-faint">
          {M.credit}{" "}
          <a
            href={M.creatorUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-ink-faint underline decoration-line underline-offset-2 hover:text-ink-mute"
          >
            {M.creator}
          </a>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
