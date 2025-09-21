// src/components/ShareButton.tsx
"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function ShareButton({
  className = "",
  label = "Copy link",
}: { className?: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      prompt("Copy this URL:", window.location.href);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={
        className ||
        "cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-white/15 " +
        "bg-white/5 px-2.5 py-1.5 text-sm text-slate-100 hover:bg-white/10 transition"
      }
      aria-label="Copy current link"
      title="Copy current link"
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-emerald-400" aria-hidden />
          Copied!
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" aria-hidden />
          {label}
        </>
      )}
    </button>
  );
}
