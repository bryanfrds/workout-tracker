import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import RegisterServiceWorker from "@/components/RegisterServiceWorker";
import RestPushSync from "@/components/RestPushSync";
import TabBar from "@/components/TabBar";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Workout",
  description: "Tick off your sets, rest between them, see your history.",
  appleWebApp: { capable: true, title: "Workout", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0d",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <main className="mx-auto max-w-md px-4 pt-[max(env(safe-area-inset-top),24px)] pb-32">
          {children}
        </main>
        <Suspense>
          <TabBar />
        </Suspense>
        <RegisterServiceWorker />
        <RestPushSync />
      </body>
    </html>
  );
}
