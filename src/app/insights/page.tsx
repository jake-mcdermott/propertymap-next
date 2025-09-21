import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import InsightsClientWrapper from "@/components/insights/InsightsClientWrapper";

export const metadata: Metadata = {
    title: "Live Ireland Property Prices & Insights | PropertyMap.ie",
    description: "Interactive map, county-level stats, Eircode areas, and the most expensive listings on the market."
};

export default function Page() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <Header />
      <main className="flex-1 w-full px-4 sm:px-6 md:px-8 py-4 md:py-6">
        <InsightsClientWrapper />
      </main>
      <Footer />
    </div>
  );
}
