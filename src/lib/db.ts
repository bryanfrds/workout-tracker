import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | undefined;

export class NoDatabaseError extends Error {}

/**
 * Created on first use so builds without a database URL (CI, previews) don't
 * fail. Without one, say so plainly here rather than throwing deep in a query.
 */
export function sql(): NeonQueryFunction<false, false> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new NoDatabaseError("DATABASE_URL is not set.");
  client ??= neon(url);
  return client;
}
