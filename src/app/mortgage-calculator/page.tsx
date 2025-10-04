import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import MortgageCalcWrapper from "./components/MortgageCalcWrapper";


export const metadata: Metadata = {
    title: "Mortgage Payment Calculator | PropertyMap.ie",
    description: "Calculate the cost of your mortgage. Graph principal and interest payments, and export data"
};


export default function Page() {

return (
  <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
    <Header />
    <main className="flex-1 flex justify-center py-4">
      <div className="w-full md:w-5/6">
        <MortgageCalcWrapper />
      </div>
    </main>
    <Footer />
  </div>
);
}
