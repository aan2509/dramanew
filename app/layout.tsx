import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/bottom-nav";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "DramaNow",
    template: "%s | DramaNow"
  },
  description: "Streaming drama ringan, cepat, dan mobile-first.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "DramaNow",
    statusBarStyle: "black-translucent"
  }
};

export const viewport: Viewport = {
  themeColor: "#08080a",
  width: "device-width",
  initialScale: 1
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>
        <div className="mx-auto min-h-dvh w-full max-w-6xl pb-safe">
          {children}
        </div>
        <PwaInstallPrompt />
        <BottomNav />
      </body>
    </html>
  );
}
