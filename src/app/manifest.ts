import type { MetadataRoute } from "next";
import { COPY } from "@/config/copy";

// Web app manifest (/manifest.webmanifest): lets phones "Add to Home Screen"
// with a proper name and icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: COPY.meta.name,
    short_name: "Capri Sea",
    description: COPY.meta.description,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
