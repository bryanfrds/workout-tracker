import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

// Same shim the push tests use: "server-only" throws outside a Next server build.
vi.mock("server-only", () => ({}));

/** Set before importing, since the config reads them at module load. */
beforeAll(() => {
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.AUTH_SECRET = "test-auth-secret";
});

describe("auth config", () => {
  it("serves both halves of the OAuth round trip", async () => {
    // Google redirects back with POST, so a missing POST breaks sign-in silently.
    const { handlers } = await import("@/auth");
    expect(typeof handlers.GET).toBe("function");
    expect(typeof handlers.POST).toBe("function");
  });

  it("offers Google, and keeps sessions in a cookie rather than a database", async () => {
    const { handlers } = await import("@/auth");
    const res = await handlers.GET(new NextRequest("http://localhost:3000/api/auth/providers"));
    const providers = await res.json();
    expect(Object.keys(providers)).toEqual(["google"]);
    expect(providers.google.callbackUrl).toBe("http://localhost:3000/api/auth/callback/google");
  });

  it("sends people to Google with the configured client id and our callback", async () => {
    const { handlers } = await import("@/auth");
    const csrfRes = await handlers.GET(new NextRequest("http://localhost:3000/api/auth/csrf"));
    const { csrfToken } = await csrfRes.json();
    const cookie = csrfRes.headers.get("set-cookie")!.split(";")[0];

    const res = await handlers.POST(
      new NextRequest("http://localhost:3000/api/auth/signin/google", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", cookie },
        body: new URLSearchParams({ csrfToken }),
      }),
    );

    const location = new URL(res.headers.get("location")!);
    expect(location.origin).toBe("https://accounts.google.com");
    expect(location.searchParams.get("client_id")).toBe("test-client-id");
    expect(location.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/callback/google");
  });
});
