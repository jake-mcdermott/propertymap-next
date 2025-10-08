# save as gtfs_shapes_to_geojson.py
import csv, json, sys
from collections import defaultdict

in_path = sys.argv[1] if len(sys.argv) > 1 else "shapes.txt"
out_path = sys.argv[2] if len(sys.argv) > 2 else "shapes.geojson"

rows = []
with open(in_path, newline="", encoding="utf-8") as f:
    rdr = csv.DictReader(f)
    for r in rdr:
        # required columns in GTFS: shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence
        try:
            r["shape_pt_lat"] = float(r["shape_pt_lat"])
            r["shape_pt_lon"] = float(r["shape_pt_lon"])
            # sequence can be large; parse as int when possible, else float
            r["shape_pt_sequence"] = int(r["shape_pt_sequence"])
        except Exception:
            r["shape_pt_sequence"] = float(r["shape_pt_sequence"])
        rows.append(r)

# group by shape_id
by_shape = defaultdict(list)
for r in rows:
    by_shape[r["shape_id"]].append(r)

features = []
for sid, pts in by_shape.items():
    pts.sort(key=lambda x: x["shape_pt_sequence"])
    coords = [[p["shape_pt_lon"], p["shape_pt_lat"]] for p in pts]
    features.append({
        "type": "Feature",
        "properties": {"shape_id": sid},
        "geometry": {"type": "LineString", "coordinates": coords}
    })

fc = {"type": "FeatureCollection", "features": features}

with open(out_path, "w", encoding="utf-8") as f:
    json.dump(fc, f, ensure_ascii=False, separators=(",", ":" ))

print(f"Wrote {len(features)} shapes to {out_path}")
