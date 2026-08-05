import type { MetadataRoute } from "next";
import { COPY } from "@/config/copy";

// Serves /robots.txt: crawlers may index the pages but not the JSON API routes.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/api/" },
    sitemap: `${COPY.meta.url}/sitemap.xml`,
    host: COPY.meta.url,
  };
}
