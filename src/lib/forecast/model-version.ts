import { createHash } from "node:crypto";
import { ACTIVITIES } from "@/config/activities";
import { ACTIVITY_CEIL, DIRECTION, GROTTO, GUST } from "@/config/tuning";

/**
 * Fingerprint of every constant that shapes a closure probability. Predictions
 * are only comparable within one model, so without this a tuning change
 * silently mixes two populations into any later accuracy answer.
 */
export const MODEL_VERSION = createHash("sha256")
  .update(JSON.stringify({ GROTTO, DIRECTION, GUST, ACTIVITY_CEIL, ACTIVITIES }))
  .digest("hex")
  .slice(0, 8);
