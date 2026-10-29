import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";
import RestPushSync from "@/components/RestPushSync";
import SyncSessions from "@/components/SyncSessions";
import ThemeSync from "@/components/ThemeSync";
import TabBar from "@/components/TabBar";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Keep in step with THEME_KEY and statusBarStyle in src/lib/themes.ts.
const THEME_SCRIPT = `try{var t=localStorage.getItem("workout-tracker:theme");if(t){document.documentElement.dataset.theme=t;if(t==="light"){var m=document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');if(m)m.content="default"}}}catch(e){}`;

export const metadata: Metadata = {
  title: "Workout",
  description: "Tick off your sets, rest between them, see your history.",
  appleWebApp: { capable: true, title: "Workout", statusBarStyle: "black" },
};

export const viewport: Viewport = {
  themeColor: "#07111f",
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
