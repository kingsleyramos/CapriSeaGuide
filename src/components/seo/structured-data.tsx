import { COPY } from "@/config/copy";
import { LOCATION } from "@/config/tuning";

/**
 * schema.org JSON-LD: website, app, the island it is about, and the author.
 * The `@id` fields cross-reference them, which is how search engines read who
 * is behind the page and where it applies. The Place carries the country and
 * coordinates because "Capri" alone is ambiguous.
 */
export function StructuredData() {
  const { name, url, description, creator, creatorUrl } = COPY.meta;
  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${url}/#website`,
        name,
        url,
        description,
        inLanguage: "en",
        publisher: { "@id": `${url}/#person` },
        about: { "@id": `${url}/#place` },
      },
      {
        "@type": "WebApplication",
        "@id": `${url}/#app`,
        name,
        url,
        description,
        applicationCategory: "TravelApplication",
        operatingSystem: "Web",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        author: { "@id": `${url}/#person` },
        about: { "@id": `${url}/#place` },
      },
      {
        "@type": "Place",
        "@id": `${url}/#place`,
        name: "Capri",
        address: {
          "@type": "PostalAddress",
          addressLocality: "Capri",
          addressRegion: "Campania",
          addressCountry: "IT",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: LOCATION.island.lat,
          longitude: LOCATION.island.lon,
        },
      },
      {
        "@type": "Person",
        "@id": `${url}/#person`,
        name: creator,
        url: creatorUrl,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      // JSON.stringify output is safe to inline; there is no user input here.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
