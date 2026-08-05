/**
 * Error visibility for the API routes.
 *
 * A route may show a visitor an *authored* message ("the forecast service is
 * briefly down"), but never a raw one: an unexpected throw can carry a file
 * path, an internal hostname or a connection string, and every response here is
 * public. So messages are opt-in rather than opt-out.
 */

/** An error whose message was written for a visitor to read. */
export class PublicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicError";
  }
}

/**
 * The message to return for `error`. Authored messages pass through; anything
 * else is logged server-side and replaced with `fallback`, so a dependency's
 * internals can never reach the client.
 */
export function publicMessage(error: unknown, fallback: string): string {
  if (error instanceof PublicError) return error.message;
  console.error("[capri] unexpected error:", error);
  return fallback;
}
