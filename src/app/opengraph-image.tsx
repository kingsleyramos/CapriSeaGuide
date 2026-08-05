import { ImageResponse } from "next/og";
import { COPY } from "@/config/copy";

// The social share card (Open Graph + Twitter). Rendered once at build time into
// a 1200x630 PNG, so link previews on iMessage, WhatsApp, Slack, X, etc. show a
// branded image instead of a bare URL.
const M = COPY.meta;

export const alt = M.ogImageAlt;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const chips = ["Blue Grotto", "Boat tours", "Ferries", "Kayak & swims"];

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          color: "#ffffff",
          background: "linear-gradient(135deg, #0b6aa9 0%, #0e7490 55%, #0f766e 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: 999, background: "#ffd66b" }} />
          <div style={{ fontSize: 26, letterSpacing: 3, textTransform: "uppercase", opacity: 0.85 }}>
            {M.url.replace(/^https?:\/\//, "")}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 96, fontWeight: 800, lineHeight: 1.02 }}>{M.name}</div>
          <div style={{ fontSize: 40, opacity: 0.92, marginTop: 24, maxWidth: 940 }}>
            {M.tagline}
          </div>
        </div>

        <div style={{ display: "flex", gap: 16 }}>
          {chips.map((c) => (
            <div
              key={c}
              style={{
                display: "flex",
                fontSize: 26,
                padding: "10px 24px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.16)",
                border: "1px solid rgba(255,255,255,0.28)",
              }}
            >
              {c}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
