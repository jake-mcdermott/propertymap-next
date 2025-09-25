// components/insights/Sidebar.tsx
"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Check, X } from "lucide-react";

export type ListingType = "sale" | "rent";

type Props = {
  counties: string[];
  selectedCounties: string[];
  setSelectedCounties: React.Dispatch<React.SetStateAction<string[]>>;
  type: ListingType;
  setType: React.Dispatch<React.SetStateAction<ListingType>>;
  isOpen?: boolean;
  setIsOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  isLoading?: boolean;
  error?: string;

  // trimming control
  trimEnabled?: boolean;
  setTrimEnabled?: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function InsightsSidebar({
  counties,
  selectedCounties,
  setSelectedCounties,
  type,
  setType,
  isOpen = true,
  setIsOpen,
  isLoading,
  error,
  trimEnabled = false,
  setTrimEnabled,
}: Props) {
  const [countyQuery, setCountyQuery] = useState("");
  const [copied, setCopied] = useState(false);

  const visibleCounties = useMemo(() => {
    const q = countyQuery.trim().toLowerCase();
    return q ? counties.filter((c) => c.toLowerCase().includes(q)) : counties;
  }, [countyQuery, counties]);

  const toggleCounty = (c: string) =>
    setSelectedCounties((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const selectAllVisible = () =>
    setSelectedCounties((prev) => Array.from(new Set([...prev, ...visibleCounties])));

  const clearAllVisible = () =>
    setSelectedCounties((prev) => prev.filter((c) => !visibleCounties.includes(c)));

  return (
    <aside className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-neutral-800">
        <div>
          <h2 className="text-sm font-semibold">Filters</h2>
          <p className="text-xs text-neutral-400">
            {selectedCounties.length ? `${selectedCounties.length} counties` : "No counties selected"}
          </p>
        </div>
      </div>

      {/* Listing type */}
      <div className="px-4 py-3 border-b border-neutral-800">
        <div className="text-xs font-medium text-neutral-300 mb-2">Listing type</div>
        <div className="inline-flex rounded-lg overflow-hidden border border-neutral-700">
          <button
            type="button"
            onClick={() => setType("sale")}
            className={`px-3 py-2 text-xs font-medium ${
              type === "sale"
                ? "bg-neutral-100 text-neutral-900"
                : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
            }`}
          >
            Sale
          </button>
          <button
            type="button"
            aria-disabled="true"
            tabIndex={-1}
            title="Coming soon"
            className="px-3 py-2 text-xs font-medium border-l border-neutral-700
                       bg-neutral-900 text-neutral-500 cursor-not-allowed pointer-events-none"
          >
            Rent <span className="ml-1 text-[10px] uppercase tracking-wide">(Coming soon)</span>
          </button>
        </div>
      </div>

      {/* Normalization / Trimming (inline checkbox + label) */}
      <div className="px-4 py-3 border-b border-neutral-800">
        <label className="w-full flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={!!trimEnabled}
            onChange={() => setTrimEnabled && setTrimEnabled((v) => !v)}
            className="h-4 w-4 rounded border-neutral-600 accent-[#01677c] focus:ring-neutral-500"
          />
          <span className="text-sm text-neutral-100">Trim top & bottom 5%</span>
        </label>
      </div>

      {/* Counties accordion */}
      <button
        type="button"
        onClick={() => setIsOpen && setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-neutral-800/50"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Counties</span>
          {selectedCounties.length > 0 && (
            <span className="text-xs text-neutral-400">({selectedCounties.length})</span>
          )}
        </div>
        {isOpen ? (
          <ChevronUp className="text-neutral-500" size={18} strokeWidth={2} />
        ) : (
          <ChevronDown className="text-neutral-500" size={18} strokeWidth={2} />
        )}
      </button>

      {isOpen && (
        <>
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={countyQuery}
                onChange={(e) => setCountyQuery(e.target.value)}
                placeholder="Search counties…"
                className="flex-1 h-10 rounded border border-neutral-700 bg-neutral-800 pl-3 pr-3 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-neutral-500"
              />
              <button
                type="button"
                onClick={selectAllVisible}
                className="text-xs px-2.5 h-8 rounded-md border border-neutral-700 hover:bg-neutral-800"
              >
                All
              </button>
              <button
                type="button"
                onClick={clearAllVisible}
                className="text-xs px-2.5 h-8 rounded-md border border-neutral-700 hover:bg-neutral-800"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="px-2 pb-4">
            <div className="max-h-72 overflow-y-auto rounded border border-neutral-800">
              <ul className="divide-y divide-neutral-800">
                {visibleCounties.map((c) => {
                  const checked = selectedCounties.includes(c);
                  return (
                    <li key={c}>
                      <label className="flex items-center gap-3 px-3 h-11 cursor-pointer hover:bg-neutral-800/50">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleCounty(c)}
                          className="accent-[#01677c] h-4 w-4 rounded border-neutral-600 text-neutral-100 focus:ring-neutral-500"
                        />
                        <span className="text-sm text-neutral-100">{c}</span>
                      </label>
                    </li>
                  );
                })}
                {visibleCounties.length === 0 && (
                  <li className="px-3 py-6 text-center text-sm text-neutral-500">No matches</li>
                )}
              </ul>
            </div>
          </div>

          {/* Selected chips */}
          {selectedCounties.length > 0 && (
            <div className="px-4 pb-4">
              <div className="flex flex-wrap gap-2">
                {selectedCounties.slice(0, 12).map((c) => (
                  <button
                    key={c}
                    onClick={() => toggleCounty(c)}
                    className="group inline-flex items-center gap-1 rounded-full border border-neutral-700 px-3 h-8 text-xs text-neutral-300 hover:bg-neutral-800"
                    title="Remove"
                  >
                    {c}
                    <X className="text-neutral-500 group-hover:text-neutral-300" size={14} strokeWidth={2} />
                  </button>
                ))}
                {selectedCounties.length > 12 && (
                  <span className="text-xs text-neutral-500 self-center">+{selectedCounties.length - 12} more</span>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Status + copy link */}
      <div className="mt-auto border-t border-neutral-800 px-4 py-3" aria-live="polite">
        {error ? (
          <div className="flex items-center gap-2 text-sm text-red-400 truncate">{error}</div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading latest averages…
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Ready{trimEnabled ? " • Trim 5%" : ""}
              </>
            )}
          </div>
        )}
        <button
          onClick={() => {
            const url = window.location.href;
            navigator.clipboard
              .writeText(url)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              })
              .catch((e) => console.error("Copy failed", e));
          }}
          className="w-full mt-2 inline-flex items-center justify-center rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-200 hover:bg-neutral-700 focus:outline-none focus:ring-2 focus:ring-neutral-500"
        >
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
    </aside>
  );
}
