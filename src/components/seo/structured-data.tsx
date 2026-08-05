import { COPY } from "@/config/copy";

/**
 * schema.org JSON-LD for the site. Three linked nodes: the website, the app
 * itself, and the person who made it. The `@id` fields let them reference each
 * other (the site's publisher and the app's author both point at the Person),
 * which is what search engines read to understand who's behind the page.
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
