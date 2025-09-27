"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ChartData } from "../../types/loan";

import AmortizationTable from "./AmortizationTable";
import PieChartGraph from "./PieChart";
import BarChartGraph from "./BarChart";
import { BALANCE_COLOUR, INTEREST_COLOUR, PRINCIPAL_COLOUR, TOTAL_COLOUR } from "./util";
import { GenericCustomTooltip } from "./CustomTooltips";

interface LoanGraphsProps {
  data: ChartData | null;
}

const COLORS = ["#2563eb", "#dc2626"]; // blue = principal, red = interest

export default function LoanGraphs({ data }: LoanGraphsProps) {
  if (!data) return null; // don’t render until form submitted

  const pieData = [
    { name: "Principal", value: data.loanAmount },
    { name: "Interest", value: data.totalInterest },
  ];

  return (
    <div className="space-y-8">

    <div className="bg-neutral-900 shadow-md md:rounded-sm rounded-none mt-6 pb-6">
      <h2 className="text-xl font-semibold pt-6 pl-6 text-center md:text-left">
        Payment Breakdown
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2">
        {/* Left column: Overall numbers */}
        <div className="flex flex-col items-center md:items-start md:ml-10">
          {/* Monthly payment box */}
          <div className="text-md p-4 my-10 border rounded-md w-64 text-center md:text-left">
            <span className="block mb-1">Monthly Payment</span>
            <span className="font-semibold">
              {new Intl.NumberFormat("en-IE", {
                style: "currency",
                currency: "EUR",
              }).format(data.monthlyRepayment)}
            </span>
          </div>

          {/* Loan summary grid */}
          <div className="grid grid-cols-2 gap-y-4 text-md w-64 mt-6 md:mt-0">
            <span>Loan Amount</span>
            <span className="text-right">
              {new Intl.NumberFormat("en-IE", {
                style: "currency",
                currency: "EUR",
              }).format(data.loanAmount)}
            </span>

            <span>Total Interest</span>
            <span className="text-right">
              <span className="mr-1">+</span>
              {new Intl.NumberFormat("en-IE", {
                style: "currency",
                currency: "EUR",
              }).format(data.totalInterest)}
            </span>

            <span>Total Repayment</span>
            <span className="text-right font-semibold">
              <span className="mr-1">=</span>
              {new Intl.NumberFormat("en-IE", {
                style: "currency",
                currency: "EUR",
              }).format(data.totalRepayment)}
            </span>
          </div>
        </div>

        {/* Right column: Pie Chart */}
        <div className="h-90 flex justify-center items-center mt-6 md:mt-0">
          <PieChartGraph pieData={pieData} />
        </div>
      </div>
    </div>


      {/* Line Chart */}
      <div className="bg-neutral-900 shadow-md md:rounded-sm rounded-none p-6 mt-6">
        <h2 className="text-xl font-semibold mb-4">Loan Overview</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.yearlyCumulative}>
              <XAxis dataKey="year" />
              <YAxis />
              <Tooltip content={<GenericCustomTooltip order={["currentBalance", "principalPaid", "interestPaid", "cumulativeTotalPaid"]}/>}/>
              <Legend />
              <Line
                type="monotone"
                dataKey="currentBalance"
                stroke={BALANCE_COLOUR}
                name="Remaining Balance"
              />
              <Line
                type="monotone"
                dataKey="principalPaid"
                stroke={PRINCIPAL_COLOUR}
                name="Principal Paid"
              />
              <Line
                type="monotone"
                dataKey="interestPaid"
                stroke={INTEREST_COLOUR}
                name="Interest Paid"
              />
              <Line
                type="monotone"
                dataKey="cumulativeTotalPaid"
                stroke={TOTAL_COLOUR}
                name="Total Paid"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bar Chart with Dual Axis */}
      <BarChartGraph yearlyAmortization={data.yearlyAmortization} />
      

      <AmortizationTable yearlyAmortizationData={data.yearlyAmortization} monthlyAmortizationData={data.monthlyAmortization}/>
    </div>
  );
}
