"use client";

export default function ListingPill({
  label,
  highlighted = false,
}: {
  label: string;
  highlighted?: boolean;
}) {
  // The classNames match your global CSS (pm-marker-*)
  return (
    <div className="pm-marker-box" style={{ width: "auto", height: 24 }}>
      <div className={`pm-marker-pill${highlighted ? " is-highlighted" : ""}`}>
        <span className="pm-marker-price">{label}</span>
      </div>
    </div>
  );
}
