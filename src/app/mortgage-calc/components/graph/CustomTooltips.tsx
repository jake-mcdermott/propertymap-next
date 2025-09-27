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
      <div className="bg-neutral-800 p-2 rounded shadow text-sm">
        <p className="font-medium">Year {label}</p>
        {sorted.map(
          (item) =>
            item && (
              <p key={item.dataKey} style={{ color: item.color }}>
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