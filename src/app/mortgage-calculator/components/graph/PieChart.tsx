import {
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  PieLabelRenderProps
} from "recharts";
import { COLORS } from "./util";

interface PieChartGraphProps {
  pieData: {
    name: string,
    value: number
  }[];
}

export default function PieChartGraph({pieData} : PieChartGraphProps) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <PieChart>
                <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    label={({ percent }: PieLabelRenderProps) =>
                    typeof percent === "number" ? `${(percent * 100).toFixed(1)}%` : ""
                    }
                >
                    {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip
                    formatter={(value: number) =>
                    new Intl.NumberFormat("en-IE", {
                        style: "currency",
                        currency: "EUR",
                    }).format(value)
                    }
                />
                <Legend />
            </PieChart>
        </ResponsiveContainer>
    );
}