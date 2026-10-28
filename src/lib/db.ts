import "server-only";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let client: NeonQueryFunction<false, false> | undefined;

/** Created on first use so builds without a database URL (CI, previews) don't fail. */
export function sql(): NeonQueryFunction<false, false> {
  client ??= neon(process.env.DATABASE_URL ?? "");
  return client;
}
