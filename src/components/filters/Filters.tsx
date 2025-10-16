"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import type { Filters } from "@/lib/filters";
import { bedsLabel, deriveEffective } from "@/lib/filters";
import FiltersDialog from "./FiltersDialog";
import { Layers, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { ShareButton } from "@/components/ShareButton";
// NOTE: if your file is actually MapLayersControl, fix the import path
import MapLayersDialog from "@/components/LeafletMap/MayLayersControl";

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-white/15 bg-black/60 px-2 py-0.5 text-xs text-white/85">
      {children}
    </span>
  );
}

function ClearableChip({
  children,
  onClear,
  title,
}: {
  children: React.ReactNode;
  onClear: () => void;
  title?: string;
}) {
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

export default function FiltersBar() {
  const { filters: urlFilters, replaceFilters } = useUrlFilters();
  const [openFilters, setOpenFilters] = useState(false);
  const [openLayers, setOpenLayers] = useState(false);
  const [chipFilters, setChipFilters] = useState<Filters>(urlFilters);

  useEffect(() => setChipFilters(urlFilters), [urlFilters]);

  // 👇 Listen for the global "open layers" request (from What's New modal)
  useEffect(() => {
    const handler = () => setOpenLayers(true);
    window.addEventListener("pm:open-layers", handler as EventListener);
    return () => window.removeEventListener("pm:open-layers", handler as EventListener);
  }, []);

  // (Optional) allow ?layers=1 to auto-open on load
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get("layers") === "1") {
        setOpenLayers(true);
        // if you don’t want it to persist in the URL:
        // url.searchParams.delete("layers");
        // window.history.replaceState(null, "", url.toString());
      }
    } catch {}
  }, []);

  // 🔧 Reset: clear all query params, keep only type (sale/rent), then hard reload
  const handleReset = () => {
    const { enforcedType } = deriveEffective(chipFilters);

    try {
      const url = new URL(window.location.href);
      url.search = "";
      if (enforcedType) url.searchParams.set("type", enforcedType);
      window.history.replaceState(null, "", url.toString());
    } catch {}

    const reset: Filters = { type: enforcedType };
    replaceFilters(reset);
    setChipFilters(reset);

    window.dispatchEvent(new Event("map:resetViewport"));
    window.dispatchEvent(new Event("map:requery-visible"));
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const chipNodes = useMemo(() => {
    const {
      enforcedType,
      isRent,
      bedsMinEff,
      bedsMaxEff,
      priceMinEff,
      priceMaxEff,
      sqmMinEff,
      sqmMaxEff,
    } = deriveEffective(chipFilters);

    const chips: React.ReactNode[] = [];

    const counties = chipFilters.counties ?? [];
    counties.forEach((c) => {
      chips.push(
        <ClearableChip
          key={`county-${c}`}
          title={`Remove ${c}`}
          onClear={() => {
            const next = counties.filter((x) => x !== c);
            replaceFilters({ ...chipFilters, counties: next.length ? next : undefined });
          }}
        >
          {c}
        </ClearableChip>
      );
    });

    const towns = chipFilters.towns ?? [];
    towns.forEach((t) => {
      chips.push(
        <ClearableChip
          key={`town-${t}`}
          title={`Remove ${t}`}
          onClear={() => {
            const next = towns.filter((x) => x !== t);
            replaceFilters({ ...chipFilters, towns: next.length ? next : undefined });
          }}
        >
          {t}
        </ClearableChip>
      );
    });

    chips.push(<Chip key="type">{enforcedType === "sale" ? "For Sale" : "To Rent"}</Chip>);

    const sources = chipFilters.sources ?? [];
    sources.forEach((s) => {
      chips.push(
        <ClearableChip
          key={`src-${s}`}
          title={`Remove source ${s}`}
          onClear={() => {
            const next = sources.filter((x) => x !== s);
            replaceFilters({ ...chipFilters, sources: next.length ? next : undefined });
          }}
        >
          Source: {s}
        </ClearableChip>
      );
    });

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

    const showBeds = chipFilters.bedsMin != null || chipFilters.bedsMax != null;
    if (showBeds) {
      chips.push(
        <Chip key="beds">
          Beds: {chipFilters.bedsMin != null ? bedsLabel(bedsMinEff) : "Any"}–
          {chipFilters.bedsMax != null ? bedsLabel(bedsMaxEff) : "Any"}
        </Chip>
      );
    }

    const showPrice = chipFilters.priceMin != null || chipFilters.priceMax != null;
    if (showPrice) {
      const fmt = (n?: number) => (n != null ? `€${n.toLocaleString()}` : "Any");
      chips.push(
        <Chip key="price">
          Price{isRent ? " (pm)" : ""}: {chipFilters.priceMin != null ? fmt(priceMinEff) : "Any"}–
          {chipFilters.priceMax != null ? fmt(priceMaxEff) : "Any"}
        </Chip>
      );
    }

    const showSqm = chipFilters.sqmMin != null || chipFilters.sqmMax != null;
    if (showSqm) {
      const fmt = (n?: number) => (n != null ? `${n} m²` : "Any");
      chips.push(
        <Chip key="sqm">
          Size: {chipFilters.sqmMin != null ? fmt(sqmMinEff) : "Any"}–
          {chipFilters.sqmMax != null ? fmt(sqmMaxEff) : "Any"}
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
      <div className="flex items-center gap-2 text-sm text-white flex-nowrap">
        {/* Chips lane (scrollable on mobile) */}
        <div
          className="min-w-0 flex items-center gap-1.5 overflow-x-auto scrollbar-none pr-2"
          aria-label="Active filters"
        >
          {chipNodes.map((c, i) => (
            <span key={i} className="shrink-0">
              {c}
            </span>
          ))}
        </div>

        {/* Buttons */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <ShareButton />
          {/* Reset */}
          <button
            type="button"
            onClick={handleReset}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-sm text-slate-100 hover:bg-white/10 transition active:scale-[0.995] touch-manipulation"
            aria-label="Reset filters"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="xs:inline">Reset</span>
          </button>

          {/* Layers */}
          <button
            type="button"
            onClick={() => setOpenLayers(true)}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-sm text-slate-100 hover:bg-white/10 transition active:scale-[0.995] touch-manipulation"
            aria-label="Open map layers"
          >
            <Layers className="h-4 w-4" />
            <span className="xs:inline">Layers</span>
          </button>

          {/* Filters */}
          <button
            type="button"
            onClick={() => setOpenFilters(true)}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-sm text-slate-100 hover:bg-white/10 transition active:scale-[0.995] touch-manipulation"
            aria-label="Open filters"
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span className="xs:inline">Filters</span>
          </button>
        </div>
      </div>

      <style jsx global>{`
        .scrollbar-none { scrollbar-width: none; }
        .scrollbar-none::-webkit-scrollbar { display: none; }
        @media (max-width: 480px) {
          .touch-manipulation { padding-top: 10px; padding-bottom: 10px; }
        }
      `}</style>

      <FiltersDialog open={openFilters} onClose={() => setOpenFilters(false)} />
      <MapLayersDialog open={openLayers} onClose={() => setOpenLayers(false)} />
    </>
  );
}
