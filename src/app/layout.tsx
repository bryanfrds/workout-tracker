import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";
import RestPushSync from "@/components/RestPushSync";
import SyncSessions from "@/components/SyncSessions";
import ThemeSync from "@/components/ThemeSync";
import { DEFAULT_THEME, THEMES, THEME_KEY, statusBarStyle, themeOf } from "@/lib/themes";
import TabBar from "@/components/TabBar";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/**
 * Runs before first paint, so the saved theme applies without a colour flash.
 * The background colours and the status-bar styles are baked in from THEMES
 * rather than written out by hand, so this can't drift from the real themes.
 * The status bar is opaque now, so its colour comes from theme-color.
 */
const THEME_SCRIPT = `try{var B=${JSON.stringify(
  Object.fromEntries(THEMES.map((t) => [t.id, [t.bg, statusBarStyle(t.id)]])),
)};var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});if(B[t]){document.documentElement.dataset.theme=t;var c=document.querySelector('meta[name="theme-color"]');if(c)c.content=B[t][0];var m=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');if(m)m.content=B[t][1]}}catch(e){}`;

export const metadata: Metadata = {
  title: "Workout",
  description: "Tick off your sets, rest between them, see your history.",
  // iOS reads this one at launch, so it's the copy that matters.
  appleWebApp: { capable: true, title: "Workout", statusBarStyle: statusBarStyle(DEFAULT_THEME) },
};

export const viewport: Viewport = {
  // The default theme's background. THEME_SCRIPT swaps it before first paint if
  // another theme is saved; the status bar is painted with it.
  themeColor: themeOf(DEFAULT_THEME).bg,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint so there's no colour flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full font-sans">
        <main className="mx-auto max-w-md px-4 pt-[max(env(safe-area-inset-top),24px)] pb-32">
          {children}
        </main>
        <Suspense>
          <TabBar />
        </Suspense>
        <RegisterServiceWorker />
        <RestPushSync />
        <SyncSessions />
        <ThemeSync />
      </body>
    </html>
  );
}
