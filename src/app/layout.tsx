import type { Metadata } from "next";
import { COPY } from "@/config/copy";
import "./globals.css";

export const metadata: Metadata = {
  title: COPY.meta.title,
  description: COPY.meta.description,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
