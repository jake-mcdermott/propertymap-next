import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import AgentsPageClient from "@/components/agents/AgentsPageClient";

/** Force Static Rendering (no dynamic / no ISR) */
export const dynamic = "force-static";
export const revalidate = false;

export const metadata: Metadata = {
  title: "Find an Agent — PropertyMap.ie",
  description:
    "Browse estate agents partnered with PropertyMap.ie on an interactive map.",
};

export type Agent = {
  name: string;
  website: string;
  regions: string[];
  logo?: string;
  lat: number;
  lng: number;
  email?: string;
  address?: string;
  license?: string; // PRSA Licence No.
};

const AGENTS: Agent[] = [
  {
    name: "James Lyons O'Keefe Schull",
    website: "https://westcorkproperty.com",
    regions: ["West Cork", "Schull"],
    logo: "/logos/westcorkproperty.png",
    lat: 51.52674060864838,
    lng: -9.545637654943942,
    email: "info@westcorkproperty.com",
    address: "48 Main St, Meenvane, Schull, Co. Cork, P81WY19",
    license: "001144-006634",
  },
  {
    name: "James Lyons O'Keefe Bantry",
    website: "https://westcorkproperty.com",
    regions: ["West Cork", "Bantry"],
    logo: "/logos/westcorkproperty.png",
    lat: 51.6803744324722,
    lng: -9.45365732308962,
    email: "info@westcorkproperty.com",
    address: "Wolfe Tone Square, Town Lots, Bantry, Co. Cork, P75K030",
    license: "001144-006634",
  },
  {
    name: "James Lyons O'Keefe Skibbereene",
    website: "https://westcorkproperty.com",
    regions: ["West Cork", "Skibbereen"],
    logo: "/logos/westcorkproperty.png",
    lat: 51.548907364890304,
    lng: -9.265718337901788,
    email: "info@westcorkproperty.com",
    address: "1A Market St, Gortnaclohy, Skibbereen, Co. Cork, P81ND79",
    license: "",
  },
  {
    name: "Michelle Burke Auctioneers",
    website: "https://michelleburke.ie",
    regions: ["Galway City & County"],
    logo: "/logos/michelleburke.png",
    lat: 53.28025299101456,
    lng: -9.051176826693197,
    email: "info@michelleburke.ie",
    address: "Galway Retail Park, Gray Office Park, Headford Rd, Galway, H91WC1P",
    license: "002182",
  },
  {
    name: "Global Properties Cork City",
    website: "https://globalproperties.ie",
    regions: ["Cork City"],
    logo: "/logos/globalproperties.png",
    lat: 51.89738864907849,
    lng:  -8.471588826672981,
    email: "cork@globalproperties.ie",
    address: "13 Cook St, Centre, Cork, T12W2HE",
    license: "002759",
  },
  {
    name: "Global Properties Ballincollig",
    website: "https://globalproperties.ie",
    regions: ["Ballincollig"],
    logo: "/logos/globalproperties.png",
    lat: 51.88793719049112,
    lng: -8.592991517490743,
    email: "ballincollig@globalproperties.ie",
    address: "St. Martins, 3 Main St, Ballincollig, Cork, P31N276",
    license: "002759",
  },
];

export default function AgentsPage() {
  return (
    // Grid ensures the map row has a real height (1fr)
    <main className="h-dvh overflow-hidden bg-neutral-950 text-slate-100 grid grid-rows-[auto_auto_1fr_auto]">
      <Header />

      {/* Thin hero */}
      <section className="relative isolate">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(80%_100%_at_50%_0%,rgba(251,146,60,0.10),rgba(234,88,12,0.06),transparent_70%)] blur-[14px]"
        />
        <div className="max-w-6xl mx-auto w-full px-6 pt-6 pb-3 sm:pt-4 sm:pb-3">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Trusted estate agents on PropertyMap
          </h1>
          <p className="mt-1.5 max-w-2xl text-slate-300 text-sm sm:text-[15px]">
            Click a pin to view the agent’s profile, regions and links.
          </p>
        </div>
      </section>

      {/* Map row (fills remaining space) */}
      <section className="min-h-0">
        <AgentsPageClient agents={AGENTS} />
      </section>

      {/* Ambient + Footer */}
      <div className="relative isolate">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-16 sm:h-20 bg-[radial-gradient(55%_70%_at_50%_100%,rgba(251,146,60,0.10),rgba(234,88,12,0.05),transparent_70%)] blur-[14px]"
        />
      </div>
      <Footer />
    </main>
  );
}
