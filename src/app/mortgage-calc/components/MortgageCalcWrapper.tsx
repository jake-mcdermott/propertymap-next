'use client'

import { useState } from "react";
import { LoanFormData, ChartData } from "../types/loan";
import { createChartData } from "../lib/loanCalculator";
import LoanForm from "../components/form/LoanForm";
import LoanGraphs from "../components/graph/LoanGraphs";

export default function MortgageCalcWrapper() {
    const [form, setForm] = useState<LoanFormData>({
    loanAmount: null,
    loanType: "fixed",
    fixed: { period: "", interest: "" },
    variable: { period: "", interest: "" },
    overpayments: { monthly: null, irregular: [], mode: "reduceRepayment" },
    startDate: ""
  });

  const [chartData, setChartData] = useState<ChartData | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.loanAmount && form.fixed.period && form.fixed.interest) {
      const data = createChartData(
        form
      );
      setChartData(data);
    }
  };

  return (
    <div>
        <form onSubmit={handleSubmit} className="bg-neutral-900 p-6 rounded">
            <LoanForm form={form} setForm={setForm} />
            <button
            type="submit"
            className="mt-4 w-full bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition"
            >
            Generate Graphs
            </button>
        </form>

        <LoanGraphs data={chartData} />
    </div>
  );
}