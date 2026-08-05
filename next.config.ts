import type { NextConfig } from "next";

/**
 * Security headers. Everything the app loads is same-origin (Vercel Analytics
 * serves from /_vercel/*), so the CSP is 'self' throughout.
 *
 * 'unsafe-inline' is required: Next inlines its hydration payload, and nonces
 * would need per-request middleware, costing the page its static rendering.
 * 'unsafe-eval' is dev-only, for React Refresh. HSTS is omitted because Vercel
 * already sends it.
 */
const isDev = process.env.NODE_ENV === "development";
// Vercel injects its toolbar (vercel.live) into preview deployments only;
// without this allowance the CSP blocks it. Production stays 'self'.
const isPreview = process.env.VERCEL_ENV === "preview";
const live = isPreview ? " https://vercel.live" : "";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}${live}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${live}`,
  ...(isPreview ? ["frame-src https://vercel.live"] : []),
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'none'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          // The pre-CSP2 twin of frame-ancestors; harmless alongside it.
          { key: "X-Frame-Options", value: "DENY" },
          // Safe: nothing here uses window.opener.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
