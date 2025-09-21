"use client";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-neutral-800 bg-neutral-900">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-400">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-neutral-300">propertymap.ie</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/contact" className="hover:text-neutral-200">Contact</a>
          <span className="text-neutral-500">© {year}</span>
        </div>
      </div>
    </footer>
  );
}
