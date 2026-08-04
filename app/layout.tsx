import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import Navbar from "../components/Navbar";

export const metadata: Metadata = {
  title: {
    default: "Racecourse Fantasy",
    template: "%s | Racecourse Fantasy",
  },
  description:
    "Build your fantasy stable and compete throughout the Spring Carnival.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-950">
        <Navbar />

        {children}

        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-slate-500 md:flex-row">
            <p>© 2026 Racecourse Fantasy. All rights reserved.</p>

            <div className="flex items-center gap-6">
              <Link
                href="/privacy"
                className="transition hover:text-teal-600"
              >
                Privacy Policy
              </Link>

              <Link
                href="/terms"
                className="transition hover:text-teal-600"
              >
                Terms & Conditions
              </Link>

              <Link
                href="/contact"
                className="transition hover:text-teal-600"
              >
                Contact
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}