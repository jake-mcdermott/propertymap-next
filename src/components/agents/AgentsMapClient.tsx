"use client";

import { useMemo, useEffect, useState } from "react";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L, { DivIcon } from "leaflet";
import { ExternalLink, X as XIcon } from "lucide-react";

/** Local Agent type (mirror the client wrapper) */
export type Agent = {
  name: string;
  website: string;
  regions: string[];
  logo?: string;
  lat: number;
  lng: number;
  email?: string;
  address?: string;
  license?: string; // PRSA
};

/* ---------- Helpers ---------- */
function domainOnly(url: string) {
  try {
    const u = new URL(url);
    return u.host.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "");
  }
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

/** Simple circular icon with logo or initials */
function createAgentIcon(a: Agent, active: boolean) {
  const hasLogo = Boolean(a.logo);
  const initials = initialsOf(a.name);
  const size = active ? 30 : 26;
  const ringColor = active ? "border-orange-600" : "border-orange-500/80";
  const inner = hasLogo
    ? `<img src="${a.logo}" alt="" class="h-[70%] w-[70%] object-contain rounded-sm" loading="lazy" decoding="async" />`
    : `<span class="text-[10px] font-semibold text-neutral-800">${initials}</span>`;

  return new DivIcon({
    className: "",
    html: `
      <div class="relative flex items-center justify-center rounded-full bg-white border ${ringColor} shadow-sm"
           style="height:${size}px;width:${size}px;">
        ${inner}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

/** Fit map to agents */
function FitToAgents({
  agents,
  padding = [40, 40] as [number, number],
}: {
  agents: Agent[];
  padding?: [number, number];
}) {
  const map = useMap();
  useEffect(() => {
    if (!agents.length) return;
    if (agents.length === 1) {
      map.setView([agents[0].lat, agents[0].lng], 10, { animate: true });
      return;
    }
    const bounds = L.latLngBounds(
      agents.map((a) => [a.lat, a.lng] as L.LatLngTuple)
    );
    map.fitBounds(bounds, { padding, animate: true });
  }, [agents, map, padding]);
  return null;
}

/* ---------- Sidebar (slides from the RIGHT) ---------- */
function Sidebar({
  agent,
  onClose,
  open,
}: {
  agent: Agent | null;
  onClose: () => void;
  open: boolean;
}) {
  return (
    <aside
      className={[
        "fixed right-0 top-0 z-[10000] h-dvh w-[min(460px,92vw)]",
        "bg-neutral-900/95 backdrop-blur border-l border-white/10",
        "transform transition-transform duration-300 ease-out will-change-transform",
        open ? "translate-x-0" : "translate-x-full",
        open ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
      aria-hidden={!open}
    >
      {/* Close */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 z-[10001] inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/5 hover:bg-white/10"
        aria-label="Close"
      >
        <XIcon className="h-4 w-4" />
      </button>

      {/* Header */}
      <div className="flex flex-col items-center justify-center pt-10 pb-6 px-4 border-b border-white/10">
        {agent?.logo ? (
          <img
            src={agent.logo}
            alt={`${agent.name} logo`}
            className="h-20 w-auto object-contain mb-3"
          />
        ) : (
          <div className="h-20 w-20 flex items-center justify-center rounded-full bg-white/10 text-xl font-semibold text-white mb-3">
            {agent ? initialsOf(agent.name) : ""}
          </div>
        )}
        <h2 className="text-lg font-medium text-white text-center leading-snug">
          {agent?.name ?? ""}
        </h2>
        {agent?.website && (
          <Link
            href={agent.website}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-sky-300 hover:text-sky-200 text-sm underline underline-offset-2"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {domainOnly(agent.website)}
          </Link>
        )}
      </div>

      {/* Content (scrolls independently) */}
      <div className="p-5 space-y-5 overflow-y-auto">
        {/* Contact / PRSA (conditional) */}
        {agent && (agent.email || agent.address || agent.license) && (
          <div className="space-y-2">
            <div className="text-xs text-slate-400 uppercase tracking-wide">
              Contact
            </div>
            {agent.email && (
              <div className="text-sm">
                <span className="text-slate-400 mr-1.5">Email:</span>
                <a
                  className="text-slate-200 underline underline-offset-2"
                  href={`mailto:${agent.email}`}
                >
                  {agent.email}
                </a>
              </div>
            )}
            {agent.address && (
              <div className="text-sm">
                <span className="text-slate-400 mr-1.5">Address:</span>
                <span className="text-slate-200 whitespace-pre-line">
                  {agent.address}
                </span>
              </div>
            )}
            {agent.license && (
              <div className="text-sm">
                <span className="text-slate-400 mr-1.5">
                  Licence Number:
                </span>
                <span className="text-slate-200">{agent.license}</span>
              </div>
            )}
          </div>
        )}

        {/* Regions */}
        {agent && (
          <div>
            <div className="text-xs text-slate-400 mb-1.5 uppercase tracking-wide">
              Service regions
            </div>
            <div className="flex flex-wrap gap-1.5">
              {agent.regions.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[11px] leading-4 text-slate-300 ring-1 ring-white/10"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        {agent?.website && (
          <div>
            <a
              href={agent.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-2xl px-5 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-500 ring-1 ring-white/10 shadow-sm transition-colors"
            >
              Visit website
            </a>
          </div>
        )}

        <p className="text-xs text-slate-400">
          Shown on the PropertyMap agents map. Want edits?{" "}
          <a
            className="underline underline-offset-2 text-slate-300"
            href="mailto:info@propertymap.ie?subject=Agent%20profile%20update"
          >
            Email us
          </a>
        </p>
      </div>
    </aside>
  );
}

/* ---------- Map ---------- */
export default function AgentsMapClient({ agents }: { agents: Agent[] }) {
  const [selected, setSelected] = useState<Agent | null>(null);

  const initial = useMemo(
    () => ({ center: [53.35, -7.7] as [number, number], zoom: 6 }),
    []
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const open = Boolean(selected);

  return (
    // Relative wrapper so overlay is scoped to map area
    <div className="relative h-full w-full">
      <MapContainer
        center={initial.center}
        zoom={initial.zoom}
        className="h-full w-full"
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains={["a", "b", "c", "d"]}
          maxZoom={19}
        />

        <FitToAgents agents={agents} />

        {agents.map((a) => {
          const icon = createAgentIcon(a, selected?.name === a.name);
          return (
            <Marker
              key={`${a.name}-${a.lat}-${a.lng}`}
              position={[a.lat, a.lng]}
              icon={icon}
              eventHandlers={{ click: () => setSelected(a) }}
            />
          );
        })}
      </MapContainer>

      {/* Click-away overlay — absolute, only covers the map area */}
      <button
        aria-label="Close details"
        onClick={() => setSelected(null)}
        className={[
          "absolute inset-0 z-[9999] bg-black/0 transition-opacity",
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        ].join(" ")}
      />

      <Sidebar agent={selected} onClose={() => setSelected(null)} open={open} />
    </div>
  );
}
