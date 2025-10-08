import { useEffect, useState } from "react";
import type { Basemap } from "../constants";

export default function useBasemap() {
  const [basemap, setBasemap] = useState<Basemap>("standard");

  useEffect(() => {
    try {
      const saved = (localStorage.getItem("pm-basemap") as Basemap | null) || null;
      if (saved === "standard" || saved === "satellite" || saved === "dark") setBasemap(saved);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem("pm-basemap", basemap); } catch {}
  }, [basemap]);

  useEffect(() => {
    const onSet = (e: Event) => {
      const detail = (e as CustomEvent).detail as { basemap?: Basemap } | undefined;
      if (detail?.basemap) setBasemap(detail.basemap);
    };
    window.addEventListener("pm:set-basemap", onSet as EventListener);
    return () => window.removeEventListener("pm:set-basemap", onSet as EventListener);
  }, []);

  return { basemap, setBasemap };
}
