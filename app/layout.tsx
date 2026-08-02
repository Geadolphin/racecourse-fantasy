import type { Metadata } from "next";
import "./globals.css";
import Navbar from "../components/Navbar";

export const metadata: Metadata = {
  title: {
    default: "Racecourse Fantasy",
    template: "%s | Racecourse Fantasy",
  },
  description:
    "Build your fantasy stable and compete throughout the Spring Carnival.",
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
          <div className="mx-auto max-w-7xl px-6 py-8 text-sm text-slate-500">
            © 2026 Racecourse Fantasy
          </div>
        </footer>
      </body>
    </html>
  );
}