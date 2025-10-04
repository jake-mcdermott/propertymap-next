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
import { TOWNS_BY_COUNTY } from "@/data/townsByCounty";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { HeroUIProvider, Slider } from "@heroui/react";
import {
  Home,
  KeyRound,
  Building2,
  X as XIcon,
  Search,
  Info,
} from "lucide-react";

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

type MapViewport = {
  lat?: number;
  lng?: number;
  zoom?: number;
  bbox?: [number, number, number, number];
};
type FiltersWithViewport = Filters & MapViewport;

// Unified location option (county or town)
type LocationOption =
  | { kind: "county"; name: string; county: string; display: string; key: string }
  | { kind: "town"; name: string; county: string; display: string; key: string };

export default function FiltersDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const { replaceFilters } = useUrlFilters();

  // local draft state
  const [draftType, setDraftType] = useState<ListingType>("sale");
  const [draftKind, setDraftKind] = useState<PropertyKind | undefined>(undefined);

  // Selected filters
  const [counties, setCounties] = useState<string[]>([]);
  const [towns, setTowns] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [bedsRange, setBedsRange] = useState<[number, number]>([0, 6]);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1_500_000]);

  const initialTypeRef = useRef<ListingType>("sale");

  useEffect(() => setMounted(true), []);

  // Prefill from LIVE URL each time the dialog opens
  useEffect(() => {
    if (!open) return;
    const live = searchParamsToFilters(new URLSearchParams(window.location.search));
    const t: ListingType = live.type === "rent" ? "rent" : "sale";
    initialTypeRef.current = t;

    // Rent disabled for now → force sale in UI while preserving other filters
    const effectiveType: ListingType = "sale";

    setDraftType(effectiveType);
    setDraftKind(live.kind);
    setCounties(live.counties ?? []);
    setTowns(live.towns ?? []);
    setSources(live.sources ?? []);

    const dom = priceDomain(effectiveType);
    setBedsRange([clamp(live.bedsMin ?? 0, 0, 6), clamp(live.bedsMax ?? 6, 0, 6)]);
    setPriceRange([
      clamp(live.priceMin ?? dom.min, dom.min, dom.max),
      clamp(live.priceMax ?? dom.max, dom.min, dom.max),
    ]);

    requestAnimationFrame(() => setAnimateIn(true));
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setAnimateIn(false);
        setTimeout(onClose, 160);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const domain = useMemo(() => priceDomain(draftType), [draftType]);
  const fmtPriceEUR = (n?: number) => (n == null ? "Any" : `€${n.toLocaleString()}`);

  const handleApply = () => {
    const [bm0, bM0] = bedsRange;
    const [pm0, pM0] = priceRange;
    const [bm, bM] = [Math.min(bm0, bM0), Math.max(bm0, bM0)];
    const [pm, pM] = [Math.min(pm0, pM0), Math.max(pm0, pM0)];

    const next: FiltersWithViewport = {
      type: "sale", // rent disabled for now
      kind: draftKind,
      counties: counties.length ? counties : undefined,
      towns: towns.length ? towns : undefined,
      sources: sources.length ? sources : undefined,
      bedsMin: bm === 0 ? undefined : bm,
      bedsMax: bM === 6 ? undefined : bM,
      priceMin: pm === domain.min ? undefined : pm,
      priceMax: pM === domain.max ? undefined : pM,
    };

    const typeChanged = initialTypeRef.current !== "sale";
    replaceFilters(next as any, { resetViewportOnTypeChange: typeChanged });

    if (typeChanged) window.dispatchEvent(new Event("map:resetViewport"));
    window.dispatchEvent(new Event("map:requery-visible"));
    requestAnimationFrame(() => window.dispatchEvent(new Event("map:requery-visible")));

    setAnimateIn(false);
    setTimeout(onClose, 160);
  };

  // Build unified location options (counties + towns)
  const locationOptions: LocationOption[] = useMemo(() => {
    const opts: LocationOption[] = [];
    for (const c of IRELAND_COUNTIES) {
      opts.push({
        kind: "county",
        name: c,
        county: c,
        display: `${c} (County)`,
        key: `county::${c.toLowerCase()}`,
      });
    }
    for (const [county, list] of Object.entries(TOWNS_BY_COUNTY)) {
      for (const town of list) {
        opts.push({
          kind: "town",
          name: town,
          county,
          display: `${town} (${county})`,
          key: `town::${town.toLowerCase()}::${county.toLowerCase()}`,
        });
      }
    }
    return opts;
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <HeroUIProvider>
      <div className="fixed inset-0 z-[10000]" role="dialog" aria-modal="true" aria-label="Filters">
        {/* Overlay */}
        <div
          className={[
            "absolute inset-0 bg-black/60 backdrop-blur-sm",
            animateIn ? "opacity-100" : "opacity-0",
            "transition-opacity duration-150 ease-out",
            "motion-reduce:transition-none",
          ].join(" ")}
          onClick={() => {
            setAnimateIn(false);
            setTimeout(onClose, 160);
          }}
          aria-hidden
        />

        {/* RIGHT SIDEBAR PANEL */}
        <aside
          className={[
            "absolute right-0 top-0 h-[100dvh] w-[100vw] md:w-[440px]",
            "bg-neutral-950/98 text-slate-100",
            "md:border-l md:border-white/10 md:shadow-[0_0_80px_-20px_rgba(0,0,0,0.7)]",
            "transition-transform duration-200 ease-out will-change-transform",
            animateIn ? "translate-x-0" : "translate-x-full",
            "motion-reduce:transition-none",
          ].join(" ")}
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-neutral-950/98 border-b border-white/10 px-4 sm:px-5 pt-[max(env(safe-area-inset-top),12px)] pb-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold tracking-wide">Filters</div>
              <button
                type="button"
                onClick={() => {
                  setAnimateIn(false);
                  setTimeout(onClose, 160);
                }}
                className="cursor-pointer rounded-md bg-white/10 px-2.5 py-1.5 text-xs hover:bg-white/15 active:scale-[0.99]"
              >
                Close
              </button>
            </div>
          </div>

          {/* Body — REORDERED */}
          <div className="h-[calc(100dvh-110px)] overflow-y-auto px-4 sm:px-5 py-4 sm:py-5 flex flex-col space-y-10">
            {/* 1) Location */}
            <Section title="Location">
              <LocationAutocomplete
                options={locationOptions}
                selectedCounties={counties}
                selectedTowns={towns}
                onChange={({ counties: c, towns: t }) => {
                  setCounties(c);
                  setTowns(t);
                }}
                placeholder="Type a county or town…"
              />
            </Section>

            {/* 2) Listing Type — Rent disabled with 'Coming soon' */}
            <Section title="Listing Type">
              <div className="inline-flex w-full items-center gap-1 rounded-lg border border-white/12 bg-black/40 p-1">
                {/* SALE */}
                <button
                  type="button"
                  className={[
                    "flex-1 cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition",
                    "bg-white text-neutral-900 shadow-sm",
                  ].join(" ")}
                  aria-pressed={true}
                  onClick={() => setDraftType("sale")}
                >
                  <Home className="h-4 w-4" />
                  <span>Sale</span>
                </button>

                {/* RENT (disabled) */}
                <button
                  type="button"
                  className={[
                    "flex-1 inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm",
                    "cursor-not-allowed text-white/35 bg-white/[0.06] border border-white/10",
                  ].join(" ")}
                  aria-disabled="true"
                  title="Coming soon"
                  onClick={(e) => {
                    e.preventDefault();
                  }}
                >
                  <KeyRound className="h-4 w-4 opacity-60" />
                  <span>Rent</span>
                  <span className="ml-1 text-[10px] uppercase tracking-wide opacity-70">
                    Coming soon
                  </span>
                </button>
              </div>
            </Section>

            {/* 3) Price */}
            <Section title="Price">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-white/70">Range</span>
                <span className="text-xs text-white/85">
                  {fmtPriceEUR(priceRange[0])} – {fmtPriceEUR(priceRange[1])}
                </span>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3">
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
                    base: "pt-0.5 cursor-pointer select-none",
                    track: "h-[6px] rounded-full bg-white/12",
                    filler: "bg-white",
                    thumb:
                      "w-4 h-4 rounded-full bg-white border border-white/40 shadow-[0_2px_10px_rgba(0,0,0,.35)] cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                  }}
                />
                <div className="mt-1 flex justify-between text-[11px] text-white/55">
                  <span>{fmtPriceEUR(domain.min)}</span>
                  <span>{fmtPriceEUR(domain.max)}</span>
                </div>
              </div>
            </Section>

            {/* 4) Bedrooms */}
            <Section title="Bedrooms">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-white/70">Range</span>
                <span className="text-xs text-white/85">
                  {bedsLabel(bedsRange[0])} – {bedsLabel(bedsRange[1])}
                </span>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3">
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
                    base: "pt-0.5 cursor-pointer select-none",
                    track: "h-[6px] rounded-full bg-white/12",
                    filler: "bg-white",
                    thumb:
                      "w-4 h-4 rounded-full bg-white border border-white/40 shadow-[0_2px_10px_rgba(0,0,0,.35)] cursor-grab active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
                  }}
                />
              </div>
            </Section>

            {/* 5) Property */}
            <Section title="Property">
              <ToggleGroup
                options={[
                  { k: undefined, label: <span>Any</span> },
                  {
                    k: "apartment" as PropertyKind,
                    label: (
                      <>
                        <Building2 className="h-4 w-4" />
                        <span>Apartment</span>
                      </>
                    ),
                  },
                  {
                    k: "house" as PropertyKind,
                    label: (
                      <>
                        <Home className="h-4 w-4" />
                        <span>House</span>
                      </>
                    ),
                  },
                ]}
                value={draftKind}
                onChange={(v) => setDraftKind(v as PropertyKind | undefined)}
              />
            </Section>

            {/* 6) Sources — Logo chip grid */}
            <Section title="Sources">
              <SourcesSelector
                options={AVAILABLE_SOURCES}
                selected={sources}
                onChange={setSources}
              />
            </Section>
            <Notice>
                Not all listings include every field (e.g. <em>town</em>) or they may be entered
                inconsistently by agents. We do our best to match location from the full address
                where possible.
            </Notice>
          </div>
          

          {/* Footer */}
          <div className="sticky bottom-0 z-10 bg-neutral-950/98 border-t border-white/10 px-4 sm:px-5 pb-[max(env(safe-area-inset-bottom),12px)] pt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setAnimateIn(false);
                setTimeout(onClose, 160);
              }}
              className="cursor-pointer rounded-md bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15 active:scale-[0.99]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="cursor-pointer rounded-md bg-white px-3 py-1.5 text-sm font-semibold text-neutral-900 hover:opacity-95 active:scale-[0.99]"
            >
              Apply
            </button>
          </div>
        </aside>
      </div>

      <style jsx global>{`
        @media (prefers-reduced-motion: reduce) {
          .motion-reduce\\:transition-none {
            transition: none !important;
          }
        }
      `}</style>
    </HeroUIProvider>,
    document.body
  );
}

/* ---------- Minimal shells ---------- */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="text-xl text-white/70 select-none leading-4 mb-2">
        {title}
      </div>
      <div className="[&>*]:mt-0">{children}</div>
    </section>
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
    <div className="inline-flex w-full items-center gap-1 rounded-lg border border-white/12 bg-black/40 p-1">
      {options.map((o) => {
        const active = o.k === value || (!o.k && !value);
        return (
          <button
            key={String(o.k)}
            type="button"
            onClick={() => onChange(o.k)}
            className={[
              "flex-1 cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition",
              active ? "bg-white text-neutral-900 shadow-sm" : "text-slate-200 hover:bg-white/10",
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

/* ---------- Small inline notice ---------- */
function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 flex items-start gap-2 rounded-md border border-white/12 bg-white/[0.04] px-3 py-2 text-[12px] text-white/75">
      <Info className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
      <div>{children}</div>
    </div>
  );
}

/* ---------- Location search (counties + towns) ---------- */
function LocationAutocomplete({
  options,
  selectedCounties,
  selectedTowns,
  onChange,
  placeholder = "Type a county or town…",
  maxSuggestions = 12,
}: {
  options: LocationOption[];
  selectedCounties: string[];
  selectedTowns: string[];
  onChange: (v: { counties: string[]; towns: string[] }) => void;
  placeholder?: string;
  maxSuggestions?: number;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Close on outside click / Esc
  useEffect(() => {
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
  }, []);

  const lower = (s: string) => s.normalize("NFKD").toLowerCase();

  const filtered = useMemo(() => {
    const q = lower(query.trim());
    const takenKeys = new Set<string>();
    for (const c of selectedCounties) takenKeys.add(`county::${lower(c)}`);
    for (const t of selectedTowns) takenKeys.add(`town::${lower(t)}::`);

    const pool = q
      ? options.filter(
          (o) =>
            lower(o.name).startsWith(q) ||
            lower(o.county).startsWith(q) ||
            lower(o.name).includes(q) ||
            lower(o.county).includes(q)
        )
      : options;

    const score = (o: LocationOption): number => {
      const n = lower(o.name),
        c = lower(o.county);
      if (q && n === q) return 0;
      if (q && n.startsWith(q)) return 5;
      if (q && c.startsWith(q)) return 8;
      return 10;
    };

    return pool
      .filter(
        (o) =>
          !takenKeys.has(o.key) &&
          !(o.kind === "town" && selectedTowns.includes(o.name))
      )
      .sort((a, b) => score(a) - score(b))
      .slice(0, maxSuggestions);
  }, [options, query, selectedCounties, selectedTowns, maxSuggestions]);

  const add = (opt: LocationOption) => {
    if (opt.kind === "county") {
      if (!selectedCounties.includes(opt.county)) {
        onChange({ counties: [...selectedCounties, opt.county], towns: selectedTowns });
      }
    } else {
      if (!selectedTowns.includes(opt.name)) {
        onChange({ counties: selectedCounties, towns: [...selectedTowns, opt.name] });
      }
    }
    setQuery("");
    setActiveIdx(-1);
    setOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const removeCounty = (name: string) =>
    onChange({
      counties: selectedCounties.filter((c) => c !== name),
      towns: selectedTowns,
    });

  const removeTown = (name: string) =>
    onChange({
      counties: selectedCounties,
      towns: selectedTowns.filter((t) => t !== name),
    });

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && filtered.length) add(activeIdx >= 0 ? filtered[activeIdx] : filtered[0]);
    } else if (e.key === "Backspace" && query.length === 0) {
      if (selectedTowns.length) removeTown(selectedTowns[selectedTowns.length - 1]);
      else if (selectedCounties.length) removeCounty(selectedCounties[selectedCounties.length - 1]);
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      {/* Chips */}
      {(!!selectedCounties.length || !!selectedTowns.length) && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedCounties.map((c) => (
            <SmallChip key={`c-${c}`} label={`${c} (County)`} onRemove={() => removeCounty(c)} />
          ))}
          {selectedTowns.map((t) => {
            // find its county for label (first match)
            let county = "";
            for (const [c, arr] of Object.entries(TOWNS_BY_COUNTY)) {
              if (arr.includes(t)) {
                county = c;
                break;
              }
            }
            return (
              <SmallChip
                key={`t-${t}`}
                label={`${t}${county ? ` (${county})` : ""}`}
                onRemove={() => removeTown(t)}
              />
            );
          })}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-white/50 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setActiveIdx(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-expanded={open}
          aria-controls="location-listbox"
          aria-autocomplete="list"
          className="w-full rounded-md border border-white/12 bg-black/60 pl-8 pr-2 py-2 text-sm outline-none placeholder-white/40 focus:border-white/30"
        />
      </div>

      {/* Suggestions */}
      {open && filtered.length > 0 && (
        <ul
          id="location-listbox"
          role="listbox"
          className="absolute right-0 z-20 mt-1 w-[min(90vw,380px)] rounded-lg border border-white/12 bg-neutral-950/98 backdrop-blur-md shadow-xl max-h-72 overflow-auto"
        >
          {filtered.map((opt, i) => {
            const active = i === activeIdx;
            return (
              <li
                key={opt.key}
                role="option"
                aria-selected={active}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => add(opt)}
                className={[
                  "px-3 py-2 text-sm cursor-pointer",
                  active ? "bg-white/10" : "hover:bg-white/5",
                ].join(" ")}
              >
                {opt.display}
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-1 text-[11px] text-white/55">Add counties or towns.</p>
    </div>
  );
}

/* small chip */
function SmallChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-xs">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="p-0.5 rounded-full hover:bg-white/20 focus-visible:outline-none"
        aria-label={`Remove ${label}`}
      >
        <XIcon className="h-3 w-3" />
      </button>
    </span>
  );
}

/* ---------- Sleek Sources selector (logo chip grid) ---------- */
function SourcesSelector({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  // Convert "MyHome" -> "myhome", "SherryFitz" -> "sherryfitz", etc.
  const logoFile = (name: string) =>
    `/logos/${name.replace(/\s+/g, "").toLowerCase()}.png`;

  const toggle = (opt: string) => {
    onChange(
      selected.includes(opt)
        ? selected.filter((x) => x !== opt)
        : [...selected, opt]
    );
  };

  const allSelected = selected.length === options.length;
  const noneSelected = selected.length === 0;

  return (
    <div className="space-y-2">
      {/* Quick actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange([])}
          className={[
            "rounded-full px-3 py-1 text-xs border transition",
            noneSelected
              ? "bg-white text-neutral-900 border-white/0"
              : "border-white/15 bg-white/[0.06] text-white/80 hover:bg-white/10",
          ].join(" ")}
          aria-pressed={noneSelected}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => onChange(options.slice())}
          className={[
            "rounded-full px-3 py-1 text-xs border transition",
            allSelected
              ? "bg-white text-neutral-900 border-white/0"
              : "border-white/15 bg-white/[0.06] text-white/80 hover:bg-white/10",
          ].join(" ")}
          aria-pressed={allSelected}
        >
          Select all
        </button>
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-[11px] text-white/70 hover:text-white/90 underline underline-offset-2 ml-auto"
          disabled={noneSelected}
        >
          Clear
        </button>
      </div>

      {/* Logo chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {options.map((opt) => {
          const active = selected.includes(opt);
          const src = logoFile(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={[
                "group relative flex items-center gap-2 rounded-lg border px-2.5 py-2 transition",
                active
                  ? "bg-white text-neutral-900 border-white/0 shadow-sm"
                  : "border-white/12 bg-white/[0.04] text-white/90 hover:bg-white/[0.08]",
              ].join(" ")}
              aria-pressed={active}
            >
              <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm overflow-hidden bg-white">
                {/* Logo image with graceful fallback */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={`${opt} logo`}
                  width={20}
                  height={20}
                  loading="lazy"
                  onError={(e) => {
                    // If no logo found, show a subtle dot fallback
                    const el = e.currentTarget;
                    el.style.display = "none";
                    const parent = el.parentElement;
                    if (parent) {
                      parent.innerHTML =
                        '<span class="inline-block h-2 w-2 rounded-full bg-neutral-800" />';
                    }
                  }}
                />
              </span>
              <span className="truncate text-sm">{opt}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
