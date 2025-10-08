#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const inputPath = process.argv[2] || "public/data/stops.txt";
const outputPath = process.argv[3] || "public/data/rail_stations.geojson";

function cleanName(s = "") {
  // Add a space before "(" if missing; collapse whitespace; trim.
  return s.replace(/(\S)\(/g, "$1 (").replace(/\s+/g, " ").trim();
}

function toFeatureCollection(lines) {
  const features = [];
  const seen = new Set(); // de-dupe by id or lon,lat

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    // Simple split (your sample has no quoted commas)
    const cols = line.split(",");
    if (cols.length < 6) continue;

    const id = (cols[0] || "").trim();
    const name = cleanName((cols[2] || "").trim());
    const lat = Number(cols[4]);
    const lon = Number(cols[5]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const key = id || `${lon.toFixed(6)},${lat.toFixed(6)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: { id: id || undefined, name: name || undefined },
    });
  }

  return { type: "FeatureCollection", features };
}

function main() {
  const txt = fs.readFileSync(path.resolve(inputPath), "utf8");
  const lines = txt.split(/\r?\n/);
  const fc = toFeatureCollection(lines);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(path.resolve(outputPath), JSON.stringify(fc, null, 2));
  console.log(`✅ Wrote ${fc.features.length} stations → ${outputPath}`);
}

main();
