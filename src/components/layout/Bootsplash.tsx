// src/components/BootSplash.tsx
"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "Scanning counties…",
  "Crunching coordinates…",
  "De-duplicating listings…",
  "Spotting houses vs apartments…",
  "Fetching photos…",
];

export default function BootSplash() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % MESSAGES.length), 1200);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative h-full w-full bg-neutral-950 text-zinc-100">
      <div className="absolute inset-0 grid place-items-center px-6">
        <div className="flex flex-col items-center gap-4 text-center">
          {/* Logo */}
          <img
            src="/pmLogoWhite.svg"
            alt="PropertyMap"
            className="w-[220px] sm:w-[260px] md:w-[300px] h-auto"
          />

          {/* Spinner + text (no box) */}
          <div className="mt-2 flex items-center gap-2">
            <span
              className="inline-block h-5 w-5 rounded-full border-2 border-zinc-600 border-t-white animate-spin"
              aria-hidden
            />
            <span className="text-sm font-medium text-zinc-200">
              Loading listings…
            </span>
          </div>

          {/* Rotating sub-message */}
          <div className="h-5 text-xs text-zinc-400">
            <span key={i} className="inline-block animate-fade">{MESSAGES[i]}</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade {
          from { opacity: 0; transform: translateY(2px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade { animation: fade 200ms ease-out; }
      `}</style>
    </div>
  );
}
