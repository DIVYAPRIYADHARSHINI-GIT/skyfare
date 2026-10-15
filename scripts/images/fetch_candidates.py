"""Find free-to-use photo candidates on Openverse (CC0 / Public Domain / CC BY / CC BY-SA).

Used once while building SkyFare to pick destination photos; the chosen photos
are resized into public/images and credited in README.md + src/data/image-credits.json.

    python3 scripts/images/fetch_candidates.py /tmp/sf-candidates.json
"""

import json
import sys
import time
import urllib.parse
import urllib.request

QUERIES = {
    "hero": "airplane wing clouds",
    "DEL": "India Gate Delhi",
    "BOM": "Gateway of India Mumbai",
    "BLR": "Vidhana Soudha Bangalore",
    "MAA": "Chennai Marina beach",
    "HYD": "Charminar Hyderabad",
    "CCU": "Howrah Bridge Kolkata",
    "COK": "Chinese fishing nets Kochi",
    "GOI": "Goa beach",
    "AMD": "Ahmedabad Sabarmati riverfront",
    "PNQ": "Shaniwar Wada Pune",
    "JAI": "Hawa Mahal Jaipur",
    "LKO": "Bara Imambara Lucknow",
    "TRV": "Kovalam beach Kerala",
    "CJB": "Nilgiri hills tea",
    "IXM": "Meenakshi temple Madurai",
    "GAU": "Brahmaputra river Guwahati",
    "VTZ": "Visakhapatnam beach",
    "DXB": "Dubai skyline",
    "AUH": "Sheikh Zayed Grand Mosque",
    "SHJ": "Sharjah city",
    "DOH": "Doha skyline",
    "SIN": "Marina Bay Singapore",
    "KUL": "Petronas Towers",
    "BKK": "Wat Arun Bangkok",
    "CMB": "Colombo Sri Lanka",
    "LHR": "Tower Bridge London",
    "CDG": "Eiffel Tower Paris",
    "JFK": "Manhattan skyline",
}

FIELDS = ["id", "title", "creator", "creator_url", "license", "license_version", "license_url", "foreign_landing_url", "url", "width", "height", "source", "provider"]


def search(q):
    params = urllib.parse.urlencode(
        {"q": q, "license": "cc0,pdm,by,by-sa", "aspect_ratio": "wide", "size": "large", "mature": "false", "page_size": 8}
    )
    req = urllib.request.Request(f"https://api.openverse.org/v1/images/?{params}", headers={"User-Agent": "SkyFareDemo/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = json.load(r)
    return [{k: x.get(k) for k in FIELDS} for x in data.get("results", [])]


def main():
    out_path = sys.argv[1] if len(sys.argv) > 1 else "/tmp/sf-candidates.json"
    only = set(sys.argv[2].split(",")) if len(sys.argv) > 2 else None
    try:
        with open(out_path) as f:
            out = json.load(f)
    except (OSError, ValueError):
        out = {}
    for key, q in QUERIES.items():
        if only and key not in only:
            continue
        if key in out and out[key]:
            continue
        try:
            out[key] = search(q)
        except Exception as e:  # noqa: BLE001
            out[key] = []
            print(key, "ERROR", e)
        print(key, len(out[key]), flush=True)
        with open(out_path, "w") as f:
            json.dump(out, f, indent=1)
        time.sleep(3.2)  # stay under the anonymous 20 requests/minute limit


if __name__ == "__main__":
    main()
