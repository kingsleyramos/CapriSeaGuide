import type { NextConfig } from "next";

/**
 * Security headers, applied to every response.
 *
 * Everything this app loads is same-origin: Tailwind is compiled at build time,
 * and Vercel Analytics serves its script and its beacons from `/_vercel/*`. So
 * the policy is `'self'` throughout, with no third-party allowances to keep in
 * sync as dependencies change.
 *
 * `'unsafe-inline'` stays for scripts and styles. Next.js inlines its hydration
 * payload, and moving to nonces would need middleware on every request, which
 * would cost the page the static rendering it currently gets. The rest of the
 * policy still does real work: no third-party script can load, `connect-src`
 * stops data being beaconed off-origin, `frame-ancestors` blocks clickjacking,
 * and `base-uri` / `object-src` close two common injection paths.
 *
 * React Refresh compiles with `eval`, so `'unsafe-eval'` is dev-only.
 *
 * HSTS is deliberately absent: Vercel already sends it, and setting it here
 * would emit the header twice.
 */
const isDev = process.env.NODE_ENV === "development";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
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
          // Severs this page from any window that opened it, or that it opens.
          // Safe here: nothing uses window.opener, and every outbound link is
          // already rel="noopener".
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
