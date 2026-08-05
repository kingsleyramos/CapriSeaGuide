/** An error whose message was authored for visitors. Routes must never echo a
 *  raw error message: an unexpected throw can carry paths, hostnames or
 *  connection strings, and every response here is public. */
export class PublicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublicError";
  }
}

/** Authored messages pass through; anything else is logged and replaced. */
export function publicMessage(error: unknown, fallback: string): string {
  if (error instanceof PublicError) return error.message;
  console.error("[capri] unexpected error:", error);
  return fallback;
}
