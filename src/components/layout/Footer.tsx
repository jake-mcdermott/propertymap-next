"use client";

import React, { useState, useEffect } from "react";

function RotatingEmoji() {
  const icons = ["❤️", "💪", "🧙", "✨", "🔥", "🦧", "🤠"];
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % icons.length), 2500);
    return () => clearInterval(id);
  }, []);

  return (
    <span aria-hidden className="inline-block w-4 text-center align-[-0.1em]">
      {icons[i]}
    </span>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative ">
      {/* subtle top fade to match sidebar */}
      <div
        className="h-4 bg-gradient-to-t from-black/70 via-black/40 to-transparent border-t border-white/10"
        aria-hidden
      />
      <div className="backdrop-blur-md bg-black/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
          <div
            className="pt-3 sm:py-2.5" // keep top padding as before
            // 👇 ensure mobile has extra bottom space, but don't overpad on desktop
            style={{
              paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)",
            }}
          >
            {/* Mobile: 1 col. ≥sm: 3 cols */}
            <div className="grid grid-cols-1 sm:grid-cols-3 items-center gap-y-2 text-[11px] text-white">
              <div className="hidden sm:block" />

              <p className="flex items-center justify-center gap-2 text-center">
                <span>Made with</span>
                <RotatingEmoji />
                <span>in Ireland 🇮🇪</span>
              </p>

              {/* Right: logo + copyright (center on mobile, right on ≥sm) */}
              <div className="flex items-center justify-center sm:justify-end gap-2">
                <img
                  src="/pmLogoWhite.svg"
                  alt="PropertyMap"
                  className="h-4 w-auto"
                />
                <span className="text-white">© {year}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
