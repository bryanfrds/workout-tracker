"use client";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** iPhone only allows web push once the app is opened from the home screen. */
export function isInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Asks for permission (must be called from a tap) and returns the subscription. */
export async function subscribe(): Promise<PushSubscriptionJSON> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notifications were not allowed.");
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""),
    }));
  return sub.toJSON();
}

export async function unsubscribe(): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  await (await reg.pushManager.getSubscription())?.unsubscribe();
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export const scheduleRestPush = (subscription: PushSubscriptionJSON, delaySeconds: number, body: string) =>
  call<{ id: string }>("POST", "/api/rest", { subscription, delaySeconds, body }).then((r) => r.id);

export const cancelRestPush = (id: string) => call("DELETE", `/api/rest?id=${encodeURIComponent(id)}`).catch(() => {});

export const createReminder = (subscription: PushSubscriptionJSON, time: string) =>
  call<{ id: string }>("POST", "/api/reminder", {
    subscription,
    time,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  }).then((r) => r.id);

export const deleteReminder = (id: string) => call("DELETE", `/api/reminder?id=${encodeURIComponent(id)}`).catch(() => {});
