"use client";

import { signIn, signOut, useSession } from "next-auth/react";

/** Sign in with Google, or show who's signed in. */
export default function AccountCard() {
  const { data: session, status } = useSession();

  return (
    <section className="mt-3 rounded-2xl bg-card p-4">
      <h2 className="font-bold">Account</h2>

      {status === "loading" && <p className="mt-1 text-sm text-muted">Checking…</p>}

      {status === "unauthenticated" && (
        <>
          <p className="mt-1 text-sm text-muted">
            Sign in to keep your workouts if you change phone, and to compare with friends.
          </p>
          <button
            onClick={() => signIn("google")}
            className="mt-3 w-full rounded-xl bg-accent p-3.5 font-bold text-accent-ink"
          >
            Sign in with Google
          </button>
        </>
      )}

      {status === "authenticated" && (
        <>
          <p className="mt-1 text-sm text-muted">
            Signed in as {session.user?.name ?? session.user?.email ?? "you"}.
          </p>
          <button
            onClick={() => signOut()}
            className="mt-3 w-full rounded-xl bg-card2 p-3 text-sm font-semibold"
          >
            Sign out
          </button>
        </>
      )}
    </section>
  );
}
