import type { MetadataRoute } from "next";
import { COPY } from "@/config/copy";

// Serves /sitemap.xml. A single-page site, and the forecast refreshes hourly.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: COPY.meta.url,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
  ];
}
