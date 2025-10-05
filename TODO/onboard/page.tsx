// src/app/agents/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { MapPin, ExternalLink, Mail, CheckCircle, MessageSquare, Building2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Agents — PropertyMap.ie",
  description: "Estate agents on PropertyMap.ie and how to get listed",
};

type Agent = { name: string; website: string; regions: string[] };

const AGENTS: Agent[] = [
  {
    name: "James Lyons O'Keefe (West Cork Property)",
    website: "https://westcorkproperty.com",
    regions: ["West Cork", "Schull", "Goleen", "Bantry", "Skibbereen"],
  },
  {
    name: "Michelle Burke Auctioneers",
    website: "https://michelleburke.ie",
    regions: ["Galway City & County"],
  },
];

type Quote = { text: string; author: string; meta?: string };

const REDDIT_THREAD_URL =
  "https://reddit.com/r/ireland/comments/1nnf4r8/i_made_a_tool_to_see_the_live_average_listing/";

const TESTIMONIALS: Quote[] = [
  { text: "This is a fantastic tool - well done!", author: "u/b2thaza", meta: "r/Ireland" },
  { text: "Nice job, very slick. Bookmarked.", author: "u/DeliveranceXXV", meta: "r/Ireland" },
  { text: "Love this tool!", author: "u/delanytime", meta: "r/Ireland" },
  {
    text: "I'm a front-end UX/UI expert with 10 years of experience ... your design and idea seem great to me.",
    author: "u/ImReellySmart",
    meta: "r/DevelEire",
  },
];

/* ---------------- UI primitives ---------------- */

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
        "rounded-2xl border border-white/10 bg-neutral-900/60",
        "p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] hover:border-white/20",
        "transition-colors",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function Pill({
  icon,
  children,
}: {
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 text-emerald-300 text-xs px-2.5 py-1 ring-1 ring-emerald-400/20">
      {icon}
      {children}
    </span>
  );
}

/** Consistent icon wrapper (all the same size) */
function IconWrap({
  tone = "sky",
  children,
}: {
  tone?: "sky" | "emerald" | "fuchsia" | "cyan" | "rose";
  children: React.ReactNode;
}) {
  const map: Record<string, string> = {
    sky: "bg-sky-500/15 ring-sky-400/20 text-sky-300",
    emerald: "bg-emerald-500/15 ring-emerald-400/20 text-emerald-300",
    fuchsia: "bg-fuchsia-500/15 ring-fuchsia-400/20 text-fuchsia-300",
    cyan: "bg-cyan-500/15 ring-cyan-400/20 text-cyan-300",
    rose: "bg-rose-500/15 ring-rose-400/20 text-rose-300",
  };
  return (
    <div
      className={[
        "shrink-0 rounded-xl ring-1",
        "flex items-center justify-center",
        "size-10", // equal height & width
        map[tone],
      ].join(" ")}
    >
      <div className="text-inherit [&_svg]:size-5 [&_svg]:stroke-[1.75]">{children}</div>
    </div>
  );
}

/* ---------------- Page ---------------- */

export default function AgentsPage() {
  const email = "info@propertymap.ie";
  const subject = encodeURIComponent("Get our agency listed on PropertyMap.ie");

  return (
    <main className="min-h-dvh bg-neutral-950 text-slate-100 flex flex-col">
      <Header />

      {/* Top accent */}
      <div className="relative isolate">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-12 h-28 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(56,189,248,0.18),rgba(16,185,129,0.10),transparent_70%)] blur-[18px]"
        />
      </div>

      <section className="relative max-w-5xl mx-auto w-full px-6 py-12">
        {/* Hero */}
        <header className="mb-10">
          <p className="text-[11px] tracking-wide text-slate-400/80 mb-2 select-none">
            Partner with PropertyMap.ie
          </p>

          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Put your listings on the map
          </h1>

          <p className="mt-3 text-slate-300 max-w-2xl">
            Buyers discover your properties by location. We keep everything fresh daily and link
            straight back to your site—no intermediaries.
          </p>

          {/* Compact proof row */}
          <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-400">
            <li className="inline-flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
              Daily sync
            </li>
            <li className="inline-flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400/70" />
              Direct traffic to your website
            </li>
            <li className="inline-flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-400/70" />
              Clean backlinks for local SEO
            </li>
          </ul>

          {/* CTA strip */}
          <div className="mt-7 flex flex-col sm:flex-row sm:items-center">
            <Link
              href={`mailto:${email}?subject=${subject}`}
              aria-label={`Email ${email}`}
              className={[
                "group inline-flex items-center justify-center gap-2",
                "rounded-2xl px-6 sm:px-8 py-3.5 text-base font-medium",
                "text-white bg-gradient-to-r from-amber-600 via-orange-600 to-orange-600",
                "hover:from-amber-500 hover:via-orange-500 hover:to-orange-500",
                "ring-1 ring-white/10 shadow-lg shadow-orange-600/25 transition-colors"
              ].join(" ")}
            >
              <Mail className="h-5 w-5 opacity-95" />
              <span>Email {email}</span>
            </Link>

            {/* Vertical divider (desktop only) */}
            <div
              aria-hidden
              className="hidden sm:block h-9 w-[2px] bg-white/80 mx-5 rounded-full"
            />

            {/* Price + terms */}
            <div className="mt-3 sm:mt-0 text-center sm:text-left">
              <div className="text-white text-xl font-semibold leading-none">€30 / month or €300 / year</div>
              <div className="text-sm text-slate-400 mt-1">Try for free • Cancel anytime</div>
            </div>
          </div>
        </header>


        {/* Why it works */}
        <section className="mt-10">
          <h2 className="text-lg font-medium mb-3">Why it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Direct traffic */}
            <Card className="min-h-[116px]">
              <div className="flex items-start gap-3">
                <IconWrap tone="sky">
                  <ExternalLink />
                </IconWrap>
                <div>
                  <h3 className="text-base font-medium">Direct traffic</h3>
                  <p className="text-sm text-slate-300 mt-1">
                    Every listing links straight to your website — your lead, no intermediaries.
                  </p>
                </div>
              </div>
            </Card>

            {/* Prominent branding */}
            <Card className="min-h-[116px]">
              <div className="flex items-start gap-3">
                <IconWrap tone="emerald">
                  <Building2 />
                </IconWrap>
                <div>
                  <h3 className="text-base font-medium">Prominent branding</h3>
                  <p className="text-sm text-slate-300 mt-1">
                    Your logo, agency name and area coverage are front-and-centre on each property.
                    Buyers recognise you — and potential sellers see your presence in their area.
                  </p>
                </div>
              </div>
            </Card>

            {/* Up to date */}
            <Card className="min-h-[116px]">
              <div className="flex items-start gap-3">
                <IconWrap tone="fuchsia">
                  <MapPin />
                </IconWrap>
                <div>
                  <h3 className="text-base font-medium">Up to date & accurate</h3>
                  <p className="text-sm text-slate-300 mt-1">
                    Daily sync. “Sale Agreed” / “Sold” auto-withdrawn. Eircode-based mapping.
                  </p>
                </div>
              </div>
            </Card>

            {/* SEO */}
            <Card className="min-h-[116px]">
              <div className="flex items-start gap-3">
                <IconWrap tone="cyan">
                  <ExternalLink />
                </IconWrap>
                <div>
                  <h3 className="text-base font-medium">Discoverability & SEO</h3>
                  <p className="text-sm text-slate-300 mt-1">
                    Map-first local discovery plus clean backlinks to your domain — helping Google rank you for your areas.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </section>

        {/* What people are saying */}
        {TESTIMONIALS.length > 0 && (
          <section className="mt-12">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium">What people are saying</h2>
              {REDDIT_THREAD_URL && (
                <Link
                  href={REDDIT_THREAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-slate-300 underline underline-offset-4 decoration-white/30 hover:decoration-white"
                >
                  View the Reddit thread
                </Link>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TESTIMONIALS.map((q, i) => (
                <Card key={i} className="min-h-[120px]">
                  <div className="flex items-start gap-3">
                    <IconWrap tone="rose">
                      <MessageSquare />
                    </IconWrap>
                    <div>
                      <p className="text-sm leading-relaxed text-slate-200">“{q.text}”</p>
                      <div className="mt-2 text-xs text-slate-400">
                        <span className="text-slate-300">{q.author}</span>
                        {q.meta ? <span> • {q.meta}</span> : null}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Agents */}
        <section className="mt-12">
          <h2 className="text-lg font-medium mb-3">Agents currently on the map</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AGENTS.map((a) => (
              <Card key={a.name} className="min-h-[132px]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-medium">{a.name}</h3>
                    <div className="mt-1 text-sm">
                      <Link
                        href={a.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-300 underline underline-offset-2 hover:text-slate-100"
                      >
                        {a.website}
                      </Link>
                    </div>
                    <div className="mt-3 text-sm text-slate-300">
                      <span className="text-slate-400">Coverage:</span> {a.regions.join(", ")}
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-sky-500/15 text-sky-300 text-xs px-2.5 py-1 ring-1 ring-sky-400/20">
                    Live
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="mt-12">
          <h2 className="text-lg font-medium mb-3">How it works</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="min-h-[140px]">
              <div className="text-xs text-slate-400">Step 1</div>
              <h3 className="text-base font-medium mt-1">Email us</h3>
              <p className="text-sm text-slate-300 mt-1">
                Send your website URL and where your sales listings live to{" "}
                <Link href={`mailto:${email}?subject=${subject}`} className="underline underline-offset-2">
                  {email}
                </Link>.
              </p>
            </Card>
            <Card className="min-h-[140px]">
              <div className="text-xs text-slate-400">Step 2</div>
              <h3 className="text-base font-medium mt-1">We check compatibility</h3>
              <p className="text-sm text-slate-300 mt-1">
                We confirm our crawler can interpret your listings. If not, we’ll outline simple options.
              </p>
            </Card>
            <Card className="min-h-[140px]">
              <div className="text-xs text-slate-400">Step 3</div>
              <h3 className="text-base font-medium mt-1">Onboard & go live</h3>
              <p className="text-sm text-slate-300 mt-1">
                Your properties appear on the map and stay up to date automatically.
              </p>
            </Card>
          </div>
        </section>

        {/* Compact pricing */}
        <section className="mt-12">
          <h2 className="text-lg font-medium mb-3">Pricing</h2>
          <Card>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-slate-300">
              <span className="text-2xl font-semibold text-slate-100">€30</span>{" "}
              <span className="text-slate-400">/ month</span>
              <span className="mx-2">·</span>
              Try for free <span className="mx-2">·</span> Cancel anytime
              <div className="mt-1">
                or <span className="text-slate-100 font-medium">€300 / year</span>{" "}
                <span className="text-emerald-300">(2 months free)</span>
              </div>
            </div>
            <Link
              href={`mailto:${email}?subject=${subject}`}
              className="inline-flex items-center gap-2 text-sm underline underline-offset-4 decoration-white/30 hover:decoration-white"
            >
              <Mail className="h-4 w-4" />
              {email}
            </Link>
          </div>
        </Card>
        </section>

        {/* Let's get started — on-page CTA (no card) */}
        <section className="relative mt-14 px-6 py-12 text-center  mb-40">
          {/* subtle background glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -z-10 top-0 h-40
                      bg-[radial-gradient(60%_60%_at_50%_0%,rgba(56,189,248,0.20),rgba(16,185,129,0.12),transparent_70%)]
                      blur-[18px]"
          />

          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Let’s get started
            </h2>

            <p className="mx-auto mt-3 max-w-3xl text-base sm:text-lg leading-relaxed text-slate-300">
              Email <span className="text-slate-100 font-medium">{email}</span> with your website URL and where your listings live.
              I’ll reply <span className="text-slate-100 font-medium">personally</span> about your site’s compatibility and set up a{" "}
              <span className="text-slate-100 font-medium">free preview</span> so you can see exactly how it will look.
              Billing only begins when you approve going live.
            </p>

            {/* big, enticing button */}
            <div className="mt-7">
              <Link
                href={`mailto:${email}?subject=${subject}`}
                aria-label={`Email ${email}`}
                className={[
                  "group inline-flex items-center justify-center gap-2",
                  "rounded-2xl px-6 sm:px-8 py-3.5 sm:py-4 text-base sm:text-lg font-medium",
                  "text-white bg-gradient-to-r from-amber-600 via-orange-600 to-orange-600",
                  "hover:from-amber-500 hover:via-orange-500 hover:to-orange-500",
                  "ring-1 ring-white/10 shadow-lg shadow-orange-600/25 transition-colors"
                ].join(" ")}
              >
                <Mail className="h-5 w-5 opacity-95" />
                <span>Email {email}</span>
              </Link>
            </div>
          </div>
        </section>
      </section>

      {/* Bottom accent */}
      <div className="relative isolate">
        <div
          aria-hidden
          className={[
            "pointer-events-none absolute inset-x-0 bottom-0 -z-10",
            "h-20 sm:h-10",
            // Warm orange radial with a soft fade
            "bg-[radial-gradient(55%_70%_at_50%_100%,rgba(251,146,60,0.22),rgba(234,88,12,0.14),transparent_70%)]",
            "blur-[22px]"
          ].join(" ")}
        />
      </div>
      <Footer />
    </main>
  );
}
