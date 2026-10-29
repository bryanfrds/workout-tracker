"use client";

import Link from "next/link";
import { SessionProvider } from "next-auth/react";
import { useState, useSyncExternalStore } from "react";
import AccountCard from "@/components/AccountCard";
import { createReminder, deleteReminder, isInstalled, pushSupported, subscribe, unsubscribe } from "@/lib/push-client";
import { setState, useAppState } from "@/lib/store";
import { THEMES, themeOf } from "@/lib/themes";

const REST_OPTIONS = [60, 90, 120, 180];

const noop = () => () => {};
function usePushStatus(): "unsupported" | "install" | "ok" | null {
  return useSyncExternalStore(
    noop,
    () => (!pushSupported() ? (isInstalled() ? "unsupported" : "install") : "ok"),
    () => null,
  );
}

export default function SettingsPage() {
  const app = useAppState();
  const status = usePushStatus();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [time, setTime] = useState("18:30");
  if (!app) return null;

  const notif = app.notifications;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const turnOn = () =>
    run(async () => {
      const subscription = await subscribe();
      setState((s) => ({ ...s, notifications: { subscription } }));
    });

  const turnOff = () =>
    run(async () => {
      if (notif?.reminder) await deleteReminder(notif.reminder.id);
      await unsubscribe();
      setState((s) => ({ ...s, notifications: undefined }));
    });

  const setReminder = (on: boolean) =>
    run(async () => {
      if (!notif) return;
      if (notif.reminder) await deleteReminder(notif.reminder.id);
      const reminder = on ? { time, id: await createReminder(notif.subscription, time) } : undefined;
      setState((s) => (s.notifications ? { ...s, notifications: { ...s.notifications, reminder } } : s));
    });

  const chip = (on: boolean) =>
    `flex-1 rounded-xl py-2.5 text-sm font-semibold ${on ? "bg-accent text-accent-ink" : "bg-card2 text-text"}`;

  return (
    <>
      <Link href="/" className="mt-2 inline-block text-sm text-muted">
        ‹ Home
      </Link>
      <h1 className="mt-2 text-3xl font-extrabold">Settings</h1>

      {/*
       * Only this page reads the session, so the provider lives here rather than in
       * the root layout — otherwise every page would fetch /api/auth/session on load,
       * and again each time the app came back to the foreground.
       */}
      <SessionProvider refetchOnWindowFocus={false}>
        <AccountCard />
      </SessionProvider>

      <section className="mt-3 rounded-2xl bg-card p-4">
        <h2 className="font-bold">Colour theme</h2>
        <div className="mt-3 grid grid-cols-4 gap-2" role="group" aria-label="Colour theme">
          {THEMES.map((t) => {
            const on = themeOf(app.theme).id === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setState((s) => ({ ...s, theme: t.id }))}
                aria-pressed={on}
                className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 text-xs font-semibold ${
                  on ? "border-accent" : "border-transparent bg-card2"
                }`}
              >
                <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: t.card, outline: `1px solid ${t.bg}` }}>
                  <span className="h-3.5 w-3.5 rounded-full" style={{ background: t.accent }} />
                </span>
                {t.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-3 rounded-2xl bg-card p-4">
        <h2 className="font-bold">Rest between sets</h2>
        <div className="mt-3 flex gap-2">
          {REST_OPTIONS.map((sec) => (
            <button
              key={sec}
              onClick={() => setState((s) => ({ ...s, restSeconds: sec }))}
              className={chip(app.restSeconds === sec)}
              aria-pressed={app.restSeconds === sec}
            >
              {sec < 120 ? `${sec}s` : `${sec / 60} min`}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-3 rounded-2xl bg-card p-4">
        <h2 className="font-bold">Notifications</h2>
        <p className="mt-1 text-sm text-muted">Get a ping when rest is over, even with your phone locked.</p>

        {status === "install" && (
          <p className="mt-3 rounded-xl bg-card2 p-3 text-sm">
            Add this app to your home screen first: tap <b>Share</b> in Safari, then <b>Add to Home Screen</b>, and
            open it from there.
          </p>
        )}
        {status === "unsupported" && (
          <p className="mt-3 rounded-xl bg-card2 p-3 text-sm">This browser can&apos;t show notifications.</p>
        )}
        {status === "ok" &&
          (notif ? (
            <button onClick={turnOff} disabled={busy} className="mt-3 w-full rounded-xl bg-card2 p-3 text-sm font-semibold disabled:opacity-50">
              Turn off notifications
            </button>
          ) : (
            <button
              onClick={turnOn}
              disabled={busy}
              className="mt-3 w-full rounded-xl bg-accent p-3.5 font-bold text-accent-ink disabled:opacity-50"
            >
              Turn on notifications
            </button>
          ))}
      </section>

      {notif && (
        <section className="mt-3 rounded-2xl bg-card p-4">
          <h2 className="font-bold">Daily reminder</h2>
          {notif.reminder ? (
            <>
              <p className="mt-1 text-sm text-muted">Every day at {notif.reminder.time}.</p>
              <button
                onClick={() => setReminder(false)}
                disabled={busy}
                className="mt-3 w-full rounded-xl bg-card2 p-3 text-sm font-semibold disabled:opacity-50"
              >
                Turn off reminder
              </button>
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">A &quot;time to train&quot; ping at the same time each day.</p>
              <div className="mt-3 flex gap-2">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  aria-label="Reminder time"
                  className="flex-1 rounded-xl bg-card2 p-3 text-center outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  onClick={() => setReminder(true)}
                  disabled={busy || !time}
                  className="rounded-xl bg-accent px-5 font-bold text-accent-ink disabled:opacity-50"
                >
                  Set
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      {/* Temporary, alongside /debug: the installed app has no address bar, so
          this is the only way to reach that page from the home screen. */}
      <Link href="/debug" className="mt-3 block text-center text-sm text-muted underline">
        Debug
      </Link>
    </>
  );
}
