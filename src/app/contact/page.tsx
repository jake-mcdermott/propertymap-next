// src/app/feedback/page.tsx
import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact — PropertyMap.ie",
  description: "Contact PropertyMap.ie",
};

export default function ContactPage() {
  return (
    <main className="min-h-dvh bg-neutral-950 text-slate-100 flex flex-col">
      <Header />

      {/* Centered content */}
      <section className="flex-1 flex items-center justify-center px-6">
        <div className="text-center">
          <div className="text-[11px] tracking-wide text-slate-400/80 mb-2 select-none">
            For all enquiries
          </div>
          <p className="text-3xl sm:text-7xl font-semibold tracking-tight text-slate-100">
            <Link
              href="mailto:info@propertymap.ie"
              className="underline decoration-white/30 underline-offset-4 hover:decoration-white"
            >
              info@propertymap.ie
            </Link>
          </p>
        </div>
      </section>

      {/* Subtle footer */}
      <footer className="border-t border-white/10 ">
        <div className="mx-auto max-w-6xl px-6 py-3 text-[12.5px] text-slate-400/85 text-center">
          © {new Date().getFullYear()} PropertyMap.ie
        </div>
      </footer>
    </main>
  );
}
