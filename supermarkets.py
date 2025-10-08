#!/usr/bin/env python3
import json
import sys
from pathlib import Path
from urllib.request import urlopen, Request
from urllib.error import HTTPError, URLError

PROJECT_ID = "propertymap-ccd4c"
DOC_PATH   = "map_layers/Supermarkets"   # collection/doc
OUTFILE    = "supermarkets.geojson"

URL = f"https://firestore.googleapis.com/v1/projects/{PROJECT_ID}/databases/(default)/documents/{DOC_PATH}"

def from_fs(v):
    """Convert Firestore REST field value objects to plain Python."""
    if not isinstance(v, dict):
        return v
    if "nullValue"    in v: return None
    if "booleanValue" in v: return bool(v["booleanValue"])
    if "integerValue" in v: return int(v["integerValue"])
    if "doubleValue"  in v: return float(v["doubleValue"])
    if "stringValue"  in v: return v["stringValue"]
    if "timestampValue" in v: return v["timestampValue"]
    if "mapValue" in v:
        fields = v["mapValue"].get("fields", {})
        return {k: from_fs(fields[k]) for k in fields}
    if "arrayValue" in v:
        vals = v["arrayValue"].get("values", [])
        return [from_fs(x) for x in vals]
    if "geoPointValue" in v:
        g = v["geoPointValue"]
        return {"latitude": g["latitude"], "longitude": g["longitude"]}
    return v  # bytesValue, referenceValue, etc.

def fetch_json(url: str, timeout: int = 30):
    req = Request(url, headers={"User-Agent": "python-urllib"})
    try:
        with urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode('utf-8', 'ignore')[:300]}", file=sys.stderr)
        sys.exit(1)
    except URLError as e:
        print(f"URL error: {e}", file=sys.stderr)
        sys.exit(1)

def main():
    doc = fetch_json(URL)
    fields = doc.get("fields", {})
    all_supers = from_fs(fields.get("all_supermarkets", {"arrayValue": {}}))

    if not isinstance(all_supers, list):
        print("Unexpected shape: all_supermarkets is not an array", file=sys.stderr)
        sys.exit(2)

    features = []
    for x in all_supers:
        try:
            lat = float(x.get("latitude"))
            lng = float(x.get("longitude"))
        except Exception:
            continue
        props = {k: v for k, v in x.items() if k not in ("latitude", "longitude")}
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lng, lat]},
            "properties": props
        })

    fc = {"type": "FeatureCollection", "features": features}
    Path(OUTFILE).write_text(json.dumps(fc, indent=2), encoding="utf-8")
    print(f"Wrote {len(features)} features to {OUTFILE}")

if __name__ == "__main__":
    main()
