"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Filters, ListingType, PropertyKind } from "@/lib/filters";
import {
  bedsLabel,
  priceDomain,
  searchParamsToFilters,
  IRELAND_COUNTIES,
  AVAILABLE_SOURCES,
} from "@/lib/filters";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { HeroUIProvider, Slider } from "@heroui/react";
import { Home, KeyRound, Building2, Check, ChevronDown } from "lucide-react";

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

type MapViewport = {
  lat?: number;
  lng?: number;
  zoom?: number;
  bbox?: [number, number, number, number];
};
type FiltersWithViewport = Filters & MapViewport;

export default function FiltersDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);

  // Use centralized shallow URL filters hook
  const { replaceFilters } = useUrlFilters();

  // local draft state
  const [draftType, setDraftType] = useState<ListingType>("sale");
  const [draftKind, setDraftKind] = useState<PropertyKind | undefined>(undefined);
  const [counties, setCounties] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [bedsRange, setBedsRange] = useState<[number, number]>([0, 6]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1_500_000]);

  // remember the type that was live when the dialog opened
  const initialTypeRef = useRef<ListingType>("sale");

  useEffect(() => setMounted(true), []);

  // Prefill from LIVE URL each time the dialog opens
  useEffect(() => {
    if (!open) return;
    const live = searchParamsToFilters(new URLSearchParams(window.location.search));
    const t: ListingType = live.type === "rent" ? "rent" : "sale";
    initialTypeRef.current = t;

    setDraftType(t);
    setDraftKind(live.kind);
    setCounties(live.counties ?? []);
    setSources(live.sources ?? []);

    const dom = priceDomain(t);
    setBedsRange([clamp(live.bedsMin ?? 0, 0, 6), clamp(live.bedsMax ?? 6, 0, 6)]);
    setPriceRange([
      clamp(live.priceMin ?? dom.min, dom.min, dom.max),
      clamp(live.priceMax ?? dom.max, dom.min, dom.max),
    ]);
  }, [open]);

  // Domain for current draft type
  const domain = useMemo(() => priceDomain(draftType), [draftType]);

  const fmtPriceEUR = (n?: number) => (n == null ? "Any" : `€${n.toLocaleString()}`);

  const handleApply = () => {
    const [bm0, bM0] = bedsRange;
    const [pm0, pM0] = priceRange;
    const [bm, bM] = [Math.min(bm0, bM0), Math.max(bm0, bM0)];
    const [pm, pM] = [Math.min(pm0, pM0), Math.max(pm0, pM0)];

    const next: FiltersWithViewport = {
      type: draftType,
      kind: draftKind,
      counties: counties.length ? counties : undefined,
      sources: sources.length ? sources : undefined,
      bedsMin: bm === 0 ? undefined : bm,
      bedsMax: bM === 6 ? undefined : bM,
      priceMin: pm === domain.min ? undefined : pm,
      priceMax: pM === domain.max ? undefined : pM,
    };

    // If type changed, we can choose to reset viewport for a fresh view
    const typeChanged = initialTypeRef.current !== draftType;

    // === Centralized shallow apply (no router nav) ===
    replaceFilters(next, { resetViewportOnTypeChange: typeChanged });

    // 🔔 Immediately ask the map to recompute visibility/clusters
    if (typeChanged) {
      // fresh framing when switching sale ↔ rent
      window.dispatchEvent(new Event("map:resetViewport"));
    }
    // always requery visible to propagate ids even if viewport didn't change
    window.dispatchEvent(new Event("map:requery-visible"));
    requestAnimationFrame(() => window.dispatchEvent(new Event("map:requery-visible")));

    onClose();
  };

  if (!open || !mounted) return null;

  return createPortal(
    <HeroUIProvider>
      <div className="fixed inset-0 z-[10000]" role="dialog" aria-modal="true" aria-label="Filters">
        <div
          className="absolute inset-0 bg-neutral-900/70 backdrop-blur-sm cursor-pointer"
          onClick={onClose}
          aria-hidden
        />
        <div
          className="absolute inset-x-0 top-0 mx-auto mt-4 sm:mt-8 w-[min(980px,92vw)] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950/95 text-slate-100 shadow-[0_20px_60px_-10px_rgba(0,0,0,.6)]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-b from-white/5 to-transparent">
            <div className="text-sm font-semibold select-none tracking-wide">Filters</div>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-md border border-white/15 bg-white/5 px-2 py-1 text-sm hover:bg-white/10"
            >
              Close
            </button>
          </div>

          {/* Body */}
          <div className="grid gap-5 p-4 sm:p-5 md:grid-cols-2">
            {/* Type */}
            <Section title="Listing Type">
              <ToggleGroup
                options={[
                  { k: "sale" as ListingType, label: (<><Home className="h-4 w-4" />&nbsp;Sale</>) },
                  { k: "rent" as ListingType, label: (<><KeyRound className="h-4 w-4" />&nbsp;Rent</>) },
                ]}
                value={draftType}
                onChange={(v) => {
                  const nextType = v as ListingType;
                  setDraftType(nextType);
                  const nd = priceDomain(nextType);
                  setPriceRange(([lo, hi]) => [clamp(lo, nd.min, nd.max), clamp(hi, nd.min, nd.max)]);
                }}
              />
            </Section>

            {/* Kind */}
            <Section title="Property">
              <ToggleGroup
                options={[
                  { k: undefined, label: "Any" },
                  { k: "apartment" as PropertyKind, label: (<><Building2 className="h-4 w-4" />&nbsp;Apartment</>) },
                  { k: "house" as PropertyKind, label: (<><Home className="h-4 w-4" />&nbsp;House</>) },
                ]}
                value={draftKind}
                onChange={(v) => setDraftKind(v as PropertyKind | undefined)}
              />
            </Section>

            {/* Counties */}
            <Section title="Counties">
              <MultiSelect
                options={IRELAND_COUNTIES}
                selected={counties}
                onChange={setCounties}
                placeholder="All counties"
              />
            </Section>

            {/* Sources */}
            <Section title="Sources">
              <MultiSelect
                options={AVAILABLE_SOURCES}
                selected={sources}
                onChange={setSources}
                placeholder="All sources"
              />
            </Section>

            {/* Beds */}
            <div className="md:col-span-2 grid gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-white/70 select-none">Bedrooms</label>
                <div className="text-xs text-white/80 select-none">
                  {bedsLabel(bedsRange[0])} – {bedsLabel(bedsRange[1])}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 touch-none shadow-inner">
                <Slider
                  aria-label="Bedrooms range"
                  minValue={0}
                  maxValue={6}
                  step={1}
                  value={bedsRange}
                  onChange={(v) => {
                    if (Array.isArray(v)) {
                      const [a, b] = v as [number, number];
                      setBedsRange([Math.min(a, b), Math.max(a, b)]);
                    }
                  }}
                  className="w-full"
                  classNames={{
                    base: "pt-1 cursor-pointer select-none",
                    track: "h-1.5 bg-white/15 cursor-pointer",
                    filler: "bg-white",
                    thumb:
                      "w-5 h-5 bg-white border border-white/30 shadow rounded-full cursor-grab active:cursor-grabbing focus-visible:outline-none before:content-[''] before:block before:absolute before:-inset-2 before:rounded-full before:bg-transparent",
                  }}
                />
                <div className="mt-1 flex justify-between text-[11px] text-white/50 select-none">
                  {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                    <span key={n}>{n}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Price */}
            <div className="md:col-span-2 grid gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-white/70 select-none">
                  Price {draftType === "rent" ? "(per month)" : ""}
                </label>
                <div className="text-xs text-white/80 select-none">
                  {fmtPriceEUR(priceRange[0])} – {fmtPriceEUR(priceRange[1])}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 touch-none shadow-inner">
                <Slider
                  aria-label="Price range"
                  minValue={domain.min}
                  maxValue={domain.max}
                  step={domain.step}
                  value={priceRange}
                  onChange={(v) => {
                    if (Array.isArray(v)) {
                      const [a, b] = v as [number, number];
                      const lo = clamp(Math.min(a, b), domain.min, domain.max);
                      const hi = clamp(Math.max(a, b), domain.min, domain.max);
                      setPriceRange([lo, hi]);
                    }
                  }}
                  className="w-full"
                  classNames={{
                    base: "pt-1 cursor-pointer select-none",
                    track: "h-1.5 bg-white/15 cursor-pointer",
                    filler: "bg-white",
                    thumb:
                      "w-5 h-5 bg-white border border-white/30 shadow rounded-full cursor-grab active:cursor-grabbing focus-visible:outline-none before:content-[''] before:block before:absolute before:-inset-2 before:rounded-full before:bg-transparent",
                  }}
                />
                <div className="mt-1 flex justify-between text-[11px] text-white/50 select-none">
                  <span>{fmtPriceEUR(domain.min)}</span>
                  <span>{fmtPriceEUR(domain.max)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-t from-white/5 to-transparent">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-md border border-white/15 bg-white/5 px-3 py-1.5 text-sm hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="cursor-pointer rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-neutral-900 hover:opacity-95 shadow"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </HeroUIProvider>,
    document.body
  );
}

/* ---------- Small UI bits ---------- */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label className="text-xs text-white/70 select-none">{title}</label>
      {children}
    </div>
  );
}

function ToggleGroup<T extends string | undefined>({
  options,
  value,
  onChange,
}: {
  options: { k: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex w-fit items-center gap-1 rounded-xl border border-white/12 bg-black/40 p-1 shadow-inner">
      {options.map((o) => {
        const active = o.k === value || (!o.k && !value);
        return (
          <button
            key={String(o.k)}
            type="button"
            onClick={() => onChange(o.k)}
            className={[
              "cursor-pointer inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition",
              active ? "bg-white text-neutral-900 shadow" : "text-slate-200 hover:bg-white/10",
            ].join(" ")}
            aria-pressed={active}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select…",
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  // Close on outside click / Esc
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | PointerEvent | TouchEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("pointerdown", onDown as any);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("pointerdown", onDown as any);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? options.filter((o) => o.toLowerCase().includes(f)) : options;
  }, [options, filter]);

  const toggle = (opt: string) =>
    onChange(
      selected.includes(opt)
        ? selected.filter((x) => x !== opt)
        : [...selected, opt]
    );

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full cursor-pointer inline-flex items-center justify-between gap-2 rounded-md border border-white/15 bg-black/70 px-3 py-2 text-left text-sm hover:bg-white/5"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="truncate">
          {selected.length ? `${selected.length} selected` : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-white/12 bg-neutral-900/95 backdrop-blur-sm shadow-2xl">
          <div className="p-2 border-b border-white/10">
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-md border border-white/15 bg-black/60 px-2 py-1 text-sm outline-none"
            />
          </div>
          <div className="max-h-60 overflow-auto p-1" role="listbox">
            {filtered.map((opt) => {
              const checked = selected.includes(opt);
              return (
                <label
                  key={opt}
                  className="flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded-md hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    className="accent-white"
                    checked={checked}
                    onChange={() => toggle(opt)}
                  />
                  <span className="text-sm">{opt}</span>
                  {checked && <Check className="h-3.5 w-3.5 text-white/90 ml-auto" />}
                </label>
              );
            })}
            {!filtered.length && (
              <div className="px-3 py-2 text-xs text-white/60">No matches</div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-white/10 p-2">
            <button
              type="button"
              className="text-xs text-white/70 hover:text-white"
              onClick={() => onChange([])}
            >
              Clear
            </button>
            <button
              type="button"
              className="text-xs text-white/70 hover:text-white"
              onClick={() => setOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
