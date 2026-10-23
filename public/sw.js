// Service worker: lets the app be installed and shows push notifications.

const DEFAULT_URL = "/workout";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  // Always show something: Safari drops subscriptions that get silent pushes.
  let data = {};
  try {
    data = (event.data ? event.data.json() : null) ?? {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Workout", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag,
      data: { url: data.url || DEFAULT_URL },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || DEFAULT_URL;
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((list) => {
      const open = list[0];
      if (!open) return self.clients.openWindow(url);
      return open
        .focus()
        .then((c) => (c && "navigate" in c ? c.navigate(url) : null))
        .catch(() => self.clients.openWindow(url));
    }),
  );
});
