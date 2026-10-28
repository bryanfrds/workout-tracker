"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { setState } from "@/lib/store";
import { useOnline } from "@/lib/use-online";

/** Sign in with Google, or show who's signed in. */
export default function AccountCard() {
  const { data: session, status } = useSession();
  const online = useOnline();
  const [busy, setBusy] = useState(false);

  // Remembered on the phone so syncing can run on every page without each one
  // having to ask the server who's signed in.
  const id = session?.user?.id;
  const name = session?.user?.name;
  useEffect(() => {
    if (status === "loading") return;
    setState((s) => {
      const next = id ? { id, name } : undefined;
      if (s.account?.id === next?.id && s.account?.name === next?.name) return s;
      return { ...s, account: next };
    });
  }, [status, id, name]);

  // Layout only — each button brings its own padding and weight.
  const button = "mt-3 w-full rounded-xl disabled:opacity-50";

  return (
    <section className="mt-3 rounded-2xl bg-card p-4">
      <h2 className="font-bold">Account</h2>

      {status === "loading" && <p className="mt-1 text-sm text-muted">Checking…</p>}

      {status === "unauthenticated" &&
        (online ? (
          <>
            <p className="mt-1 text-sm text-muted">
              Sign in to keep your workouts if you change phone, and to compare with friends.
            </p>
            <button
              onClick={() => {
                setBusy(true);
                // If the connection drops mid-tap, give the button back.
                signIn("google").catch(() => setBusy(false));
              }}
              disabled={busy}
              className={`${button} bg-accent p-3.5 font-bold text-accent-ink`}
            >
              {busy ? "Opening Google…" : "Sign in with Google"}
            </button>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">
            You&apos;re offline, so signing in will have to wait. Your workouts are saved on this phone either way.
          </p>
        ))}

      {status === "authenticated" && (
        <>
          <p className="mt-1 text-sm text-muted">
            Signed in as {session.user?.name ?? session.user?.email ?? "you"}.
            {!online && " Signing out will have to wait until you're back online."}
          </p>
          <button
            onClick={() => {
              setBusy(true);
              signOut().catch(() => setBusy(false));
            }}
            disabled={busy || !online}
            className={`${button} bg-card2 p-3 text-sm font-semibold`}
          >
            Sign out
          </button>
        </>
      )}
    </section>
  );
}
