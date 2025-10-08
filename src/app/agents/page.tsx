// src/app/agents/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { MapPin, ExternalLink } from "lucide-react";

/** Force Static Rendering (no dynamic / no ISR) */
export const dynamic = "force-static";
export const revalidate = false;

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

/** Smaller, neutral logo (container will size it) */
function AgentLogo({ name, logo }: { name: string; logo?: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
  return logo ? (
    <img
      src={logo}
      alt={`${name} logo`}
      loading="lazy"
      decoding="async"
      className="max-h-10 md:max-h-12 w-auto object-contain select-none"
    />
  ) : (
    <span className="text-[14px] md:text-[15px] font-semibold leading-none text-slate-200">
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
    <div
      className={[
        "rounded-2xl border border-white/10 bg-neutral-900/70 p-4",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/* ---------------- Page (STATIC) ---------------- */

export default function AgentsPage() {
  const email = "info@propertymap.ie";
  const subject = encodeURIComponent("Partner with PropertyMap.ie");

  // Strict layout knobs
  const CARD_MIN_H = "min-h-[110px] sm:min-h-[110px]";
  const MAX_REGIONS = 3;

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
          <p className="text-[11px] tracking-wide text-slate-400/80 mb-2 select-none">
            Find an agent
          </p>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">
            Trusted estate agents on PropertyMap
          </h1>
          <p className="mt-3 max-w-2xl text-slate-300 text-base sm:text-lg">
            Browse agents we partner with. Every profile links directly to the
            agent&rsquo;s website.
          </p>
        </div>
      </section>

      {/* Grid */}
      <section className="flex-1">
        <div className="max-w-6xl mx-auto w-full px-6 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {AGENTS.map((a) => {
              const regions = a.regions.slice(0, MAX_REGIONS);

              return (
                <Card
                  key={a.name}
                  className={[
                    "hover:translate-y-[-1px] transition-transform",
                    CARD_MIN_H,
                  ].join(" ")}
                >
                  {/* Keep image left on all sizes */}
                  <div className="grid grid-cols-[84px_minmax(0,1fr)] md:grid-cols-[110px_minmax(0,1fr)] gap-3 items-center">
                    {/* Left: logo column */}
                    <div className="flex items-center justify-center h-full py-1">
                      <AgentLogo name={a.name} logo={a.logo} />
                    </div>

                    {/* Right: details column (must be shrinkable) */}
                    <div className="space-y-1.5 min-w-0">
                      {/* Earlier truncation on mobile via a smaller max-width; free on desktop */}
                      <h3 className="text-[15px] sm:text-[15.5px] font-medium leading-tight truncate max-w-[22ch] sm:max-w-none sm:truncate sm:whitespace-nowrap">
                        {a.name}
                      </h3>

                      {/* Website row — allow truncation */}
                      <div className="text-sm leading-none min-w-0">
                        <Link
                          href={a.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1 text-sky-300 hover:text-sky-200 underline underline-offset-2 align-middle"
                          title={a.website}
                        >
                          <ExternalLink className="h-[13px] w-[13px] shrink-0" />
                          <span className="truncate min-w-0">
                            {domainOnly(a.website)}
                          </span>
                        </Link>
                      </div>

                      {/* Regions */}
                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <MapPin className="h-[14px] w-[14px] text-slate-400" />
                        {regions.map((r) => (
                          <RegionBadge key={r}>{r}</RegionBadge>
                        ))}
                        {a.regions.length > MAX_REGIONS && (
                          <RegionBadge>
                            +{a.regions.length - MAX_REGIONS} more
                          </RegionBadge>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Partner CTA (static) */}
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
              We&rsquo;ll add a{" "}
              <span className="text-slate-100 font-medium">free preview</span>{" "}
              of your properties so you can see exactly how your branding and
              locations look on the map. I&rsquo;ll reply{" "}
              <span className="text-slate-100 font-medium">personally</span>{" "}
              about compatibility.
            </p>

            <div className="mt-6">
              <Link
                href={`mailto:${email}?subject=${subject}`}
                className={[
                  "inline-flex items-center justify-center rounded-2xl",
                  "px-5 sm:px-7 py-3 text-sm sm:text-base font-medium",
                  "text-white bg-gradient-to-r from-amber-600 via-orange-600 to-orange-600",
                  "hover:from-amber-500 hover:via-orange-500 hover:to-orange-500",
                  "ring-1 ring-white/10 shadow-lg shadow-orange-600/25 transition-colors",
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
