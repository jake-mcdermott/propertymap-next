"use client";

import React, { useState, useEffect } from "react";

function RotatingEmoji() {
  const icons = ["❤️", "💪", "🧙", "✨", "🔥", "🦧", "🤠", "☕"];
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % icons.length), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      aria-hidden
      className="inline-block w-3 text-center align-[-0.15em] opacity-80"
    >
      {icons[i]}
    </span>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="relative text-[10px] text-white/70">
      {/* much thinner fade */}
      <div
        className="h-2 bg-gradient-to-t from-black/50 via-black/25 to-transparent border-t border-white/10"
        aria-hidden
      />
      <div className="bg-black/40 backdrop-blur-[2px]">
        <div className="mx-auto max-w-5xl px-3 sm:px-4">
          <div
            className="py-2" // tighter vertical padding
            style={{
              paddingBottom: "max(env(safe-area-inset-bottom, 0px), 10px)",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              {/* Left */}
              <p className="flex items-center gap-1.5">
                <span className="opacity-80">Made with</span>
                <RotatingEmoji />
                <span className="opacity-80">in Ireland 🇮🇪</span>
              </p>

              {/* Right */}
              <div className="flex items-center gap-1.5">
                <img
                  src="/pmLogoWhite.svg"
                  alt="PropertyMap"
                  className="h-3.5 w-auto opacity-80"
                />
                <span className="opacity-80">© {year}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
