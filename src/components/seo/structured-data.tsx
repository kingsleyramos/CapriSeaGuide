import { COPY } from "@/config/copy";
import { LOCATION } from "@/config/tuning";

/**
 * schema.org JSON-LD for the site. Four linked nodes: the website, the app
 * itself, the island it is about, and the person who made it. The `@id` fields
 * let them reference each other, which is what search engines read to understand
 * who is behind the page and where it applies.
 *
 * The Place matters more than it looks: "Capri" alone is ambiguous (there are
 * others, and a car), so the country and coordinates are what tie this to the
 * island in the Bay of Naples.
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
