import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PropertyMap.ie | Irish Property Search",
  description:
    "Discover homes for sale and rent across Ireland with PropertyMap.ie. A lightning-fast map + list interface for exploring houses, apartments and investment opportunities.",
  keywords: [
    "Irish property search",
    "houses for sale Ireland",
    "apartments to rent Ireland",
    "Irish property data",
    "PropertyMap.ie",
    "Irish property map"
  ],
  openGraph: {
    title: "PropertyMap.ie | Fast Irish Property Search",
    description:
      "Explore Irish homes for sale or rent on a seamless map and list experience. Find your next house or apartment faster with PropertyMap.ie.",
    url: "https://propertymap.ie",
    siteName: "PropertyMap.ie",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PropertyMap.ie | Fast Irish Property Search",
    description:
      "Seamless map + list UI for discovering property in Ireland. Houses, apartments, and sites—faster than anywhere else.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Leaflet CSS */}
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body className="bg-neutral-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}
