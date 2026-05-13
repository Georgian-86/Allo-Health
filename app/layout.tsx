import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Allo – Inventory",
  description: "Real-time inventory reservation across warehouses",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 min-h-screen">
        <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold text-lg tracking-tight">allo</span>
              <span className="text-slate-600 text-sm hidden sm:block">/</span>
              <span className="text-slate-400 text-sm hidden sm:block">inventory</span>
            </div>
            <span className="text-slate-600 text-xs font-mono hidden sm:block">reservation system</span>
          </div>
        </header>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</div>
      </body>
    </html>
  );
}
