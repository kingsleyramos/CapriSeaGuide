"use client";

import { Moon, Sun } from "lucide-react";
import { COPY } from "@/config/copy";
import { useTheme } from "./use-theme";

/**
 * Sun or moon beside the Capri clock, saying why the page is the colour it is.
 *
 * Deliberately not a control: the theme follows Capri's daylight, so there is
 * nothing here to set. It carries no button affordance -- no hover, no focus
 * ring, no pointer cursor -- and the tooltip explains rather than invites.
 *
 * Renders nothing on the server and on the first client pass: the theme is a
 * function of the clock, and this page's HTML is static, so baking either icon
 * into it would ship the wrong one to half of all readers.
 */
export function SunMoon() {
  const theme = useTheme();
  if (!theme) return null;

  const c = COPY.now.daylight;
  const Icon = theme === "dark" ? Moon : Sun;
  return (
    <span title={theme === "dark" ? c.night : c.day} aria-hidden>
      <Icon className="inline-block size-3.5 shrink-0 align-[-0.15em] text-ink-mute" />
    </span>
  );
}
