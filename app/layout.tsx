import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "SignalForge",
  description: "Objective opportunity discovery engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        <nav className="border-b border-neutral-800 px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-emerald-600 flex items-center justify-center text-white text-xs font-bold">
              SF
            </div>
            <span className="font-semibold text-neutral-100 tracking-tight">
              SignalForge
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/watchlist" className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors">
              Watchlist
            </Link>
            <span className="text-xs text-neutral-600">
              Opportunity Discovery Engine
            </span>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
