"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import type { Filters } from "@/lib/filters";
import { bedsLabel, deriveEffective } from "@/lib/filters";
import FiltersDialog from "./FiltersDialog";
import { RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { ShareButton } from "@/components/ShareButton";

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-white/15 bg-black/60 px-2 py-0.5 text-xs text-white/85">
      {children}
    </span>
  );
}
function ClearableChip({ children, onClear, title }: { children: React.ReactNode; onClear: () => void; title?: string; }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-black/60 px-2 py-0.5 text-xs text-white/85 hover:bg-white/10 hover:border-white/25 transition"
      title={title ?? "Remove filter"}
      aria-label={title ?? "Remove filter"}
    >
      {children}
      <X className="h-3.5 w-3.5 opacity-70" />
    </button>
  );
}
const kindLabel = (k?: Filters["kind"]) => (!k ? "Any" : k[0].toUpperCase() + k.slice(1));

export default function FiltersBar() {
  const { filters: urlFilters, replaceFilters } = useUrlFilters();
  const [open, setOpen] = useState(false);
  const [chipFilters, setChipFilters] = useState<Filters>(urlFilters);

  // Sync with URL
  useEffect(() => setChipFilters(urlFilters), [urlFilters]);

  // Reset everything but preserve type and reset viewport
  const handleReset = () => {
    const { enforcedType } = deriveEffective(chipFilters);
    const reset: Filters = { type: enforcedType };
    replaceFilters(reset);
    window.scrollTo({ top: 0, behavior: "auto" });
    window.dispatchEvent(new Event("map:resetViewport"));
  };

  const chipNodes = useMemo(() => {
    const { enforcedType, isRent, bedsMinEff, bedsMaxEff, priceMinEff, priceMaxEff } =
      deriveEffective(chipFilters);
  
    const chips: React.ReactNode[] = [];
  
    // Counties (each county is individually clearable)
    const counties = chipFilters.counties ?? [];
    counties.forEach((c) => {
      chips.push(
        <ClearableChip
          key={`county-${c}`}
          title={`Remove ${c}`}
          onClear={() => {
            const next = counties.filter((x) => x !== c);
            replaceFilters({
              ...chipFilters,
              counties: next.length ? next : undefined,
            });
          }}
        >
          {c}
        </ClearableChip>
      );
    });
  
    // Type (not clearable — toggled via dialog)
    chips.push(
      <Chip key="type">{enforcedType === "sale" ? "For Sale" : "To Rent"}</Chip>
    );
  
    // Sources
    const sources = chipFilters.sources ?? [];
    sources.forEach((s) => {
      chips.push(
        <ClearableChip
          key={`src-${s}`}
          title={`Remove source ${s}`}
          onClear={() => {
            const next = sources.filter((x) => x !== s);
            replaceFilters({
              ...chipFilters,
              sources: next.length ? next : undefined,
            });
          }}
        >
          Source: {s}
        </ClearableChip>
      );
    });
  
    // Kind — ONLY show if set (don’t show “Any”)
    if (chipFilters.kind) {
      const label = chipFilters.kind[0].toUpperCase() + chipFilters.kind.slice(1);
      chips.push(
        <ClearableChip
          key="kind"
          title="Remove property type"
          onClear={() => {
            const { kind: _remove, ...rest } = chipFilters;
            replaceFilters(rest);
          }}
        >
          {label}
        </ClearableChip>
      );
    }
  
    // Beds
    const showBeds = chipFilters.bedsMin != null || chipFilters.bedsMax != null;
    if (showBeds) {
      chips.push(
        <Chip key="beds">
          Beds: {chipFilters.bedsMin != null ? bedsLabel(bedsMinEff) : "Any"}–
          {chipFilters.bedsMax != null ? bedsLabel(bedsMaxEff) : "Any"}
        </Chip>
      );
    }
  
    // Price
    const showPrice = chipFilters.priceMin != null || chipFilters.priceMax != null;
    if (showPrice) {
      const fmt = (n?: number) => (n != null ? `€${n.toLocaleString()}` : "Any");
      chips.push(
        <Chip key="price">
          Price{isRent ? " (pm)" : ""}:{" "}
          {chipFilters.priceMin != null ? fmt(priceMinEff) : "Any"}–
          {chipFilters.priceMax != null ? fmt(priceMaxEff) : "Any"}
        </Chip>
      );
    }
  
    if (!chips.length) {
      chips.push(
        <span key="none" className="text-xs text-white/60">
          No filters applied
        </span>
      );
    }
  
    return chips;
  }, [chipFilters, replaceFilters]);
  
  return (
    <>
      <div className="flex flex-wrap items-center gap-2 text-sm text-white">
        <div className="flex flex-wrap items-center gap-1.5">{chipNodes.map((c, i) => <span key={i}>{c}</span>)}</div>
        <div className="ml-auto" />
        <button type="button" onClick={handleReset} className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-slate-100 hover:bg-white/10 transition">
          <RotateCcw className="h-4 w-4" /> Reset
        </button>
        <button type="button" onClick={() => setOpen(true)} className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-slate-100 hover:bg-white/10 transition">
          <SlidersHorizontal className="h-4 w-4" /> Filters
        </button>
        <ShareButton />
      </div>
      <FiltersDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
