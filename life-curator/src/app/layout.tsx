import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { AppStoreProvider } from "@/lib/store/AppStore";

export const metadata: Metadata = {
  title: "Your Life Curator",
  description: "A personal concierge for experiences, culture, friends and travel.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f3ec" },
    { media: "(prefers-color-scheme: dark)", color: "#16130f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body className="min-h-dvh antialiased">
        <AppStoreProvider>
          <AppShell>{children}</AppShell>
        </AppStoreProvider>
      </body>
    </html>
  );
}
