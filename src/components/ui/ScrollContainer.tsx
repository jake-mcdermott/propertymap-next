// src/components/ui/ScrollContainer.tsx
"use client";

import React from "react";

type Props = React.PropsWithChildren<{
  className?: string;
}>;

/** Scoped, premium-looking scrollbar (no global CSS leakage). */
export default function ScrollContainer({ className = "", children }: Props) {
  return (
    <div className={`custom-scrollbar overflow-y-auto ${className}`}>
      {children}
      <style jsx>{`
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.28) rgba(255, 255, 255, 0.06);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.06);
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.28);
          border-radius: 9999px;
          border: 2px solid transparent;
          background-clip: content-box;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(255, 255, 255, 0.42);
        }
      `}</style>
    </div>
  );
}
