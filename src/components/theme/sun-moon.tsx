"use client";

import { Moon, Sun } from "lucide-react";
import { COPY } from "@/config/copy";
import { useTheme } from "./use-theme";

/**
 * Sun or moon beside the Capri clock: says why the page is the colour it is,
 * and lets the reader disagree.
 *
 * The theme follows Capri's daylight by default, which is a surprising rule for
 * someone reading at midday on the other side of the world -- so the icon
 * doubles as the explanation. Pressing it pins the other theme for good.
 *
 * Renders nothing on the server and on the first client pass: the theme is a
 * function of the clock, and this page's HTML is static, so committing either
 * icon to it would ship the wrong one to half of all readers.
 */
export function SunMoon() {
  const { theme, overridden, toggle } = useTheme();
  if (!theme) return null;

  const c = COPY.now.daylight;
  const Icon = theme === "dark" ? Moon : Sun;
  const state = theme === "dark" ? c.night : c.day;

  return (
    <button
      type="button"
      onClick={toggle}
      title={`${overridden ? c.pinned : state}. ${c.action}`}
      aria-label={`${state}. ${c.action}`}
      className="-m-1.5 inline-flex cursor-pointer items-center rounded p-1.5 text-ink-mute transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-link"
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
    </button>
  );
}
