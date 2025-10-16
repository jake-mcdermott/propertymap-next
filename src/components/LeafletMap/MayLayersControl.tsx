"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  MapPinned,
  Globe2,
  Moon,
  X as XIcon,
  Info,
  ShoppingCart,
  TrainFront,
  Baby,
  School
} from "lucide-react";

/** Types */
type Basemap = "standard" | "satellite" | "dark";

export default function MapLayersDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  // draft layer state
  const [draftBasemap, setDraftBasemap] = useState<Basemap>("standard");
  const [supermarkets, setSupermarkets] = useState<boolean>(false);
  const [transport, setTransport] = useState<boolean>(false);
  const [childcare, setChildcare] = useState<boolean>(false);
  const [schools, setSchools] = useState<boolean>(false);

  // NEW: draft min zoom for transport
  const [transportMinZoom, setTransportMinZoom] = useState<number>(10); // default 10

  useEffect(() => setMounted(true), []);

  // Load latest values each open
  useEffect(() => {
    if (!open) return;
    try {
      const saved = (localStorage.getItem("pm-basemap") as Basemap | null) || "standard";
      setDraftBasemap(
        saved === "satellite" ? "satellite" :
        saved === "dark" ? "dark" :
        "standard"
      );
      setSupermarkets(localStorage.getItem("pm-layer-supermarkets") === "1");
      setTransport(localStorage.getItem("pm-layer-transport") === "1");

      const zRaw = localStorage.getItem("pm-layer-transport-minzoom");
      const z = zRaw ? parseInt(zRaw, 10) : 10;
      setTransportMinZoom(Number.isFinite(z) ? z : 10);
    } catch {}
    requestAnimationFrame(() => setAnimateIn(true));
  }, [open]);

  // ESC → close with animation
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

  const handleApply = () => {
    // Persist selections
    try {
      localStorage.setItem("pm-basemap", draftBasemap);
      localStorage.setItem("pm-layer-supermarkets", supermarkets ? "1" : "0");
      localStorage.setItem("pm-layer-transport", transport ? "1" : "0");
      localStorage.setItem("pm-layer-transport-minzoom", String(transportMinZoom));
    } catch {}

    // Tell the map immediately (same-tab custom event)
    window.dispatchEvent(
      new CustomEvent("pm:set-basemap", { detail: { basemap: draftBasemap } })
    );
    window.dispatchEvent(new Event("map:requery-visible"));

    setAnimateIn(false);
    setTimeout(onClose, 160);
  };

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[12000]"
      role="dialog"
      aria-modal="true"
      aria-label="Map Layers"
    >
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
            <div className="text-sm font-semibold tracking-wide">Map layers</div>
            <button
              type="button"
              onClick={() => {
                setAnimateIn(false);
                setTimeout(onClose, 160);
              }}
              title="Close"
              aria-label="Close"
              className="cursor-pointer inline-flex items-center justify-center rounded-md p-2 text-white/85 hover:bg-white/10 hover:text-white active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="h-[calc(100dvh-110px)] overflow-y-auto px-4 sm:px-5 py-4 sm:py-5 pb-10 sm:pb-10 flex flex-col space-y-10">
          {/* 1) Base map */}
          <Section title="Base map">
            <div className="inline-flex overflow-hidden rounded-full border border-white/15 bg-black/40 backdrop-blur-md">
              <button
                type="button"
                onClick={() => setDraftBasemap("standard")}
                className={[
                  "flex items-center gap-2 px-3 py-2 text-sm transition",
                  draftBasemap === "standard"
                    ? "bg-white text-neutral-900"
                    : "text-slate-200 hover:bg-white/10",
                ].join(" ")}
                aria-pressed={draftBasemap === "standard"}
              >
                <MapPinned className="h-4 w-4" />
                Map
                {draftBasemap === "standard" && <Check className="ml-1 h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setDraftBasemap("satellite")}
                className={[
                  "flex items-center gap-2 px-3 py-2 text-sm transition",
                  draftBasemap === "satellite"
                    ? "bg-white text-neutral-900"
                    : "text-slate-200 hover:bg-white/10",
                ].join(" ")}
                aria-pressed={draftBasemap === "satellite"}
              >
                <Globe2 className="h-4 w-4" />
                Satellite
                {draftBasemap === "satellite" && <Check className="ml-1 h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setDraftBasemap("dark")}
                className={[
                  "flex items-center gap-2 px-3 py-2 text-sm transition",
                  draftBasemap === "dark"
                    ? "bg-white text-neutral-900"
                    : "text-slate-200 hover:bg-white/10",
                ].join(" ")}
                aria-pressed={draftBasemap === "dark"}
              >
                <Moon className="h-4 w-4" />
                Dark
                {draftBasemap === "dark" && <Check className="ml-1 h-3.5 w-3.5" />}
              </button>
            </div>
          </Section>

          {/* 2) Overlays */}
          <Section title="Overlays">
            {/* Transport (enabled) */}
            <div className="space-y-2">
              <RowToggle
                icon={<TrainFront className="h-4 w-4" />}
                label="Transport"
                sub="Rail & Luas lines"
                checked={transport}
                onChange={setTransport}
              />
            </div>

            <RowToggle
              icon={<ShoppingCart className="h-4 w-4" />}
              label="Supermarkets"
              sub="Tesco, Aldi & SuperValu stores"
              checked={supermarkets}
              onChange={setSupermarkets}
            />

            {/* Future overlays (disabled for now) */}
            <RowToggle
              icon={<Baby className="h-4 w-4" />}
              label="Childcare (In Progress)"
              sub="Creches and childcare services"
              checked={childcare}
              onChange={setChildcare}
              disabled
            />
            <RowToggle
              icon={<School className="h-4 w-4" />}
              label="Schools (In Progress)"
              sub="Primary and secondary schools"
              checked={schools}
              onChange={setSchools}
              disabled
            />
          </Section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 z-10 bg-neutral-950/98 border-t border-white/10 px-4 sm:px-5 pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setAnimateIn(false);
                setTimeout(onClose, 160);
              }}
              className="w-full cursor-pointer rounded-lg border border-white/15 bg-white/8 px-4 py-3 text-sm sm:text-base text-slate-100 hover:bg-white/12 active:scale-[0.995] transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="w-full cursor-pointer rounded-lg bg-orange-500 px-4 py-3 text-sm sm:text-base font-semibold text-white hover:bg-orange-400 active:scale-[0.995] transition shadow-sm"
            >
              Apply
            </button>
          </div>
        </div>
      </aside>

      <style jsx global>{`
        @media (prefers-reduced-motion: reduce) {
          .motion-reduce\\:transition-none { transition: none !important; }
        }
      `}</style>
    </div>,
    document.body
  );
}

/* ------- UI shells to match FiltersDialog ------- */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="text-xl text-white/70 select-none leading-4 mb-3">{title}</div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-1 flex items-start gap-2 rounded-md border border-white/12 bg-white/[0.04] px-3 py-2 text-[12px] text-white/75">
      <Info className="mt-0.5 h-4 w-4 shrink-0 opacity-80" />
      <div>{children}</div>
    </div>
  );
}

function RowToggle({
  icon,
  label,
  sub,
  checked,
  onChange,
  disabled,
}: {
  icon?: React.ReactNode;
  label: string;
  sub?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
      <div className="min-w-0 text-sm flex items-start gap-2">
        {icon && <span className="mt-0.5 text-white/80">{icon}</span>}
        <div>
          <div className="font-medium text-slate-100">{label}</div>
          {sub && <div className="text-xs text-slate-400">{sub}</div>}
        </div>
      </div>
      <button
        type="button"
        aria-pressed={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={[
          "relative inline-flex h-7 w-12 items-center rounded-full border border-white/20 transition",
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:brightness-110",
          checked ? "bg-emerald-500/70" : "bg-white/10",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-6" : "translate-x-1",
          ].join(" ")}
        />
      </button>
    </label>
  );
}
