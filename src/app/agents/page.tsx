// src/app/agents/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { MapPin, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "Find an Agent — PropertyMap.ie",
  description: "Browse estate agents partnered with PropertyMap.ie",
};

type Agent = {
  name: string;
  website: string;
  regions: string[];
  logo?: string;
};

const AGENTS: Agent[] = [
  {
    name: "James Lyons O'Keefe (West Cork Property)",
    website: "https://westcorkproperty.com",
    regions: ["West Cork", "Schull", "Goleen", "Bantry", "Skibbereen"],
    logo: "/logos/westcorkproperty.png",
  },
  {
    name: "Michelle Burke Auctioneers",
    website: "https://michelleburke.ie",
    regions: ["Galway City & County"],
    logo: "/logos/michelleburke.png",
  },
];

/* ---------------- Helpers ---------------- */

function domainOnly(url: string) {
  try {
    const u = new URL(url);
    return u.host.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "");
  }
}

function RegionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[11px] leading-4 text-slate-300 ring-1 ring-white/10">
      {children}
    </span>
  );
}

/** Consistent, no-bubble logo (fixed height, auto width) */
function AgentLogo({
  name,
  logo,
  className = "h-7 md:h-8",
}: {
  name: string;
  logo?: string;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  if (logo) {
    return (
      <Image
        src={logo}
        alt={`${name} logo`}
        width={150}
        height={40}
        sizes="(max-width: 768px) 90px, 150px"
        className={["shrink-0 w-auto object-contain", className].join(" ")}
      />
    );
  }
  return (
    <span className="shrink-0 text-[15px] md:text-[16px] font-semibold leading-none text-slate-200">
      {initials}
    </span>
  );
}

/** Solid interior with subtle border; tighter padding */
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={["rounded-2xl border border-white/10 bg-neutral-900/70 p-4", className].join(" ")}>
      {children}
    </div>
  );
}

/* ---------------- Page ---------------- */

export default function AgentsPage({ searchParams }: { searchParams?: { q?: string } }) {
  const q = (searchParams?.q ?? "").trim().toLowerCase();

  const filtered = q
    ? AGENTS.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.website.toLowerCase().includes(q) ||
          a.regions.some((r) => r.toLowerCase().includes(q)),
      )
    : AGENTS;

  // Strict layout knobs
  const CARD_MIN_H = "min-h-[110px] sm:min-h-[110px]";
  const MAX_REGIONS = 3;

  const email = "info@propertymap.ie";
  const subject = encodeURIComponent("Partner with PropertyMap.ie");

  return (
    <main className="min-h-dvh bg-neutral-950 text-slate-100 flex flex-col">
      <Header />

      {/* Subtle orange ambient */}
      <section className="relative isolate">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(80%_100%_at_50%_0%,rgba(251,146,60,0.10),rgba(234,88,12,0.06),transparent_70%)] blur-[14px]"
        />
        <div className="max-w-6xl mx-auto w-full px-6 pt-14 pb-10 sm:pt-16 sm:pb-12">
          <p className="text-[11px] tracking-wide text-slate-400/80 mb-2 select-none">Find an agent</p>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">Trusted estate agents on PropertyMap</h1>
          <p className="mt-3 max-w-2xl text-slate-300 text-base sm:text-lg">
            Browse agents we partner with. Every profile links directly to the agent’s website.
          </p>

          {/* Server-side search (GET) */}
          <form className="mt-7" action="/agents" method="get">
            <div className="mx-auto max-w-2xl">
              <div className="flex items-center gap-2 rounded-2xl bg-neutral-900/70 border border-white/10 px-3 py-2.5 focus-within:ring-2 focus-within:ring-amber-500/30">
                <input
                  type="text"
                  name="q"
                  defaultValue={q}
                  placeholder="Search by name, county, or area…"
                  className="w-full bg-transparent text-sm sm:text-base placeholder:text-slate-500 focus:outline-none"
                  aria-label="Search agents"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-xl px-4 py-2 text-sm bg-white text-neutral-900 hover:bg-slate-100"
                >
                  Search
                </button>
              </div>
              {q && (
                <div className="mt-2 text-xs text-slate-400">
                  Showing results for <span className="text-slate-200">“{q}”</span>
                </div>
              )}
            </div>
          </form>
        </div>
      </section>

      {/* Grid */}
      <section className="flex-1">
        <div className="max-w-6xl mx-auto w-full px-6 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {filtered.map((a) => {
              const regions = a.regions.slice(0, MAX_REGIONS);
              const extra = a.regions.length - regions.length;

              return (
                <Card key={a.name} className={["hover:translate-y-[-1px] transition-transform", CARD_MIN_H].join(" ")}>
                  {/* Top row: logo + text left, status right */}
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: logo + content */}
                    <div className="flex items-start gap-3">
                      <AgentLogo name={a.name} logo={a.logo} />

                      <div className="space-y-1.5">
                        {/* Name (single line) */}
                        <h3 className="text-[15px] sm:text-[15.5px] font-medium leading-tight truncate max-w-[32ch]">
                          {a.name}
                        </h3>

                        {/* URL (single line, truncated) */}
                        <div className="text-sm leading-none">
                          <Link
                            href={a.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-[220px] items-center gap-1 text-sky-300 hover:text-sky-200 underline underline-offset-2 align-middle"
                            title={a.website}
                          >
                            <ExternalLink className="h-[13px] w-[13px] shrink-0" />
                            <span className="truncate">{domainOnly(a.website)}</span>
                          </Link>
                        </div>

                        {/* Regions (capped + overflow) */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <MapPin className="h-[14px] w-[14px] text-slate-400" />
                          {regions.map((r) => (
                            <RegionBadge key={r}>{r}</RegionBadge>
                          ))}
                          {extra > 0 && <RegionBadge>+{extra} more</RegionBadge>}
                        </div>
                      </div>
                    </div>

                    {/* Right: status pill */}
                    <span className="inline-flex h-6 items-center rounded-full bg-orange-500/10 text-orange-300 text-[11px] px-2 ring-1 ring-orange-400/20">
                      Partner
                    </span>
                  </div>
                </Card>
              );
            })}

            {filtered.length === 0 && (
              <Card className="md:col-span-2">
                <p className="text-sm sm:text-base text-slate-300">
                  No agents matched “<span className="text-slate-100">{q}</span>”. Try a different name or area.
                </p>
              </Card>
            )}
          </div>
        </div>

        {/* --- Discreet Partner CTA --- */}
        <section className="relative px-6 py-10">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-6 h-16 -z-10 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(251,146,60,0.16),rgba(234,88,12,0.08),transparent_70%)] blur-[14px]"
          />
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">
              Are you an estate agent?
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm sm:text-base text-slate-300">
              We'll add a <span className="text-slate-100 font-medium">free preview</span> of your properties so you can see exactly
              how your branding and locations look on the map. I'll reply <span className="text-slate-100 font-medium">personally</span> about compatibility.
            </p>

            <div className="mt-6">
              <Link
                href={`mailto:${email}?subject=${subject}`}
                className={[
                  "inline-flex items-center justify-center rounded-2xl",
                  "px-5 sm:px-7 py-3 text-sm sm:text-base font-medium",
                  "text-white bg-gradient-to-r from-amber-600 via-orange-600 to-orange-600",
                  "hover:from-amber-500 hover:via-orange-500 hover:to-orange-500",
                  "ring-1 ring-white/10 shadow-lg shadow-orange-600/25 transition-colors"
                ].join(" ")}
              >
                Email {email}
              </Link>
            </div>
          </div>
        </section>
      </section>

      {/* Bottom ambient orange glow (subtle) */}
      <div className="relative isolate">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-20 sm:h-24 bg-[radial-gradient(55%_70%_at_50%_100%,rgba(251,146,60,0.10),rgba(234,88,12,0.05),transparent_70%)] blur-[14px]"
        />
      </div>

      <Footer />
    </main>
  );
}
