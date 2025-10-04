import React from "react";

// Define a generic payload type (works across recharts versions)
type CustomPayload = {
  color: string;
  dataKey: string;
  name: string;
  value: number | string | Array<number | string>;
};

type GenericTooltipProps = {
  active?: boolean;
  payload?: CustomPayload[];
  label?: string | number;
  order?: string[]; // optional order prop
};

export const GenericCustomTooltip: React.FC<GenericTooltipProps> = ({
  active,
  payload,
  label,
  order
}) => {
  if (!active || !payload || payload.length === 0) return null;

  // If an order is provided, sort accordingly
  const sorted = order
    ? order.map((key) => payload.find((p) => p.dataKey === key)).filter(Boolean)
    : payload;

 return (
      <div className="bg-black border border-white p-3 rounded-md shadow text-sm">
        <p className="text-md font-bold">Year {label}</p>
        {sorted.map(
          (item) =>
            item && (
              <p className="pt-1" key={item.dataKey} style={{ color: item.color }}>
                {item.name}:{" "}
                {new Intl.NumberFormat("en-IE", {
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 2,
                }).format(item.value as number)}
              </p>
            )
        )}
      </div>
    );
};