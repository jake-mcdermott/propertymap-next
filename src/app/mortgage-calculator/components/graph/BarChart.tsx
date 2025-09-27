import {
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

import { YearlyData } from "../../types/loan";
import { INTEREST_COLOUR, PRINCIPAL_COLOUR, TOTAL_COLOUR } from "./util";
import { GenericCustomTooltip } from "./CustomTooltips";

interface BarChartGraphProps {
  yearlyAmortization: YearlyData[];
}

export default function BarChartGraph({yearlyAmortization} : BarChartGraphProps) {
    return (
<div className="bg-neutral-900 shadow-md rounded-xl p-4">
        <h2 className="text-xl font-semibold mb-4">
          Yearly Principal vs Interest + Cumulative Total
        </h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={yearlyAmortization}>
              {/* X-Axis */}
              <XAxis dataKey="year" />

              {/* Left Axis for yearly amounts */}
              <YAxis
                yAxisId="left"
                orientation="left"
                stroke="#374151"
                tickFormatter={(value) =>
                  value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value
                }
                label={{
                  value: "Yearly Payments",
                  angle: -90,
                  position: "insideLeft",
                  style: { textAnchor: "middle" },
                }}
              />

              {/* Right Axis for cumulative total */}
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke={TOTAL_COLOUR}
                tickFormatter={(value) =>
                  value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value
                }
                label={{
                  value: "Cumulative Total",
                  angle: -90,
                  position: "insideRight",
                  offset: 10,
                  style: { textAnchor: "middle" },
                }}
              />
                <Tooltip
                content={
                    <GenericCustomTooltip
                    order={["principal", "interest", "cumulativeTotal"]}
                    />
                }
                />
              <Legend />

              {/* Stacked Bars (use left axis) */}
              <Bar
                dataKey="principal"
                stackId="a"
                fill={PRINCIPAL_COLOUR}
                name="Principal"
                yAxisId="left"
                activeBar={{
                  fill: PRINCIPAL_COLOUR,
                  stroke: PRINCIPAL_COLOUR, // darker blue border
                  strokeWidth: 1,
                }}
              />
              <Bar
                dataKey="interest"
                stackId="a"
                fill={INTEREST_COLOUR}
                name="Interest"
                yAxisId="left"
                activeBar={{
                  fill: INTEREST_COLOUR,
                  stroke: INTEREST_COLOUR, // darker blue border
                  strokeWidth: 1,
                }}
              />

              {/* Cumulative Line (use right axis) */}
              <Line
                type="monotone"
                dataKey="cumulativeTotal"
                stroke={TOTAL_COLOUR}
                strokeWidth={2}
                dot={false}
                name="Cumulative Total"
                yAxisId="right"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
}