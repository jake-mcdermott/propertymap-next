import { useEffect, useState } from "react";
import L from "leaflet";
import { GeoJSON } from "react-leaflet";
import type { FeatureCollection } from "geojson";
import { useRef } from "react";
import type { Map as LeafletMap } from "leaflet";

interface SchoolsLayerProps {
  map: LeafletMap;
  schools: FeatureCollection;
  zoom: number;
}

export function SchoolsLayer({ map, schools, zoom }: SchoolsLayerProps) {
    const [visibleSchools, setVisibleSchools] = useState<FeatureCollection | null>(null);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Only show features in viewport
  const updateVisibleSchools = () => {
    if (!map || !schools) return;
    const bounds = map.getBounds();

    const minLat = bounds.getSouth();
    const maxLat = bounds.getNorth();
    const minLng = bounds.getWest();
    const maxLng = bounds.getEast();

    const filtered = schools.features.filter((f: any) => {
      const [lon, lat] = f.geometry.coordinates;
      return (
        lat >= minLat && lat <= maxLat &&
        lon >= minLng && lon <= maxLng
      );
    });

    setVisibleSchools({ type: "FeatureCollection", features: filtered });
  };

  // Update visible schools when map moves
  useEffect(() => {
    if (!map || !schools) return;

    const handleMoveEnd = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (map.getZoom() >= zoom) {
            updateVisibleSchools();
        } else {
            setVisibleSchools(null); // hide markers when zoomed out
        }
      }, 200); // wait 200ms after the last move
    };

    if (map.getZoom() >= zoom) {
        updateVisibleSchools();
    } else {
        setVisibleSchools(null);
    }

    map.on("moveend", handleMoveEnd);

    return () => {
      map.off("moveend", handleMoveEnd);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [map, schools]);

  return (
    <>
      {visibleSchools && (
        <GeoJSON
          key={visibleSchools?.features.length ?? 0}
          pane="pmSchoolPane"
          data={visibleSchools}
          pointToLayer={(feature, latlng) => {
            const sz = Math.round(
              Math.max(20, Math.min(28, 10 + (zoom - 9) * 2.0))
            );
            const props = feature.properties;
            const type = props.school_type?.toLowerCase();
            const iconPath = "/icons/white-apple.svg";

            const html = `
              <div
                class="grid place-items-center rounded-full bg-[#ff0800]
                      ring-1 ring-red-300/70 shadow-[0_2px_8px_rgba(0,0,0,0.20)]"
                style="width:${sz}px;height:${sz}px"
                role="img" aria-label="${type ?? "school"}"
              >
                <img
                  src="${iconPath}"
                  width="${Math.round(sz * 0.6)}"
                  height="${Math.round(sz * 0.6)}"
                  alt="${type ?? "school"} icon"
                  draggable="false"
                />
              </div>
            `;

            return L.marker(latlng, {
              icon: L.divIcon({
                className: "pm-school",
                html,
                iconSize: [30, 30],
                iconAnchor: [sz / 2, sz / 2],
              }),
              pane: "pmSchoolPane",
              interactive: true,
              zIndexOffset: 0,
              keyboard: false,
            });
          }}
          onEachFeature={(feature, layer) => {
            const p = feature.properties ?? {};

            // Build school list for popup
            const mergedList = (p.merged_schools ?? [])
              .map((s: any, idx: number) => {
                const name = s.Name || s.name || "Unnamed";
                const level = s.Level || s.level || "—";
                const gender = s.Gender || "—";
                const ethos = s.Ethos || "—";
                const url = s.URL || s.url || "";

                const borderClass = idx === 0 ? "" : "border-t border-gray-200";

                return `
                  <div class="pt-1 mt-1 ${borderClass}">
                    <h4 class="text-[13px] text-gray-900 font-bold">${name}</h4>
                    <p class="text-[11px] text-gray-600">
                      <strong>Type:</strong> ${level}<br>
                      <strong>Gender:</strong> ${gender}<br>
                      <strong>Ethos:</strong> ${ethos}<br>
                      ${
                        url
                          ? `<a href="${url}" target="_blank" class="text-emerald-600 underline">Visit website</a>`
                          : ""
                      }
                    </p>
                  </div>
                `;
              })
              .join("");

            const popupHTML = `
              <div class="w-[240px] max-h-[300px] overflow-y-auto">
                ${mergedList}
              </div>
            `;

            layer.bindPopup(popupHTML, {
              pane: "pmSchoolPopupPane",
              className:
                "rounded-xl shadow-lg ring-1 ring-black/10 bg-white/95 backdrop-blur-sm",
              maxWidth: 280,
              minWidth: 200,
            });
          }}
        />
      )}
    </>
  );
}

export default SchoolsLayer;
