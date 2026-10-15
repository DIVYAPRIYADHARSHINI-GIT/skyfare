"""Download, crop and optimise SkyFare's destination + hero photos.

    python3 scripts/images/build_images.py /tmp/sf-candidates.json [preview]

* Every photo is CC0 / Public Domain / CC BY / CC BY-SA (via Openverse /
  Wikimedia Commons) or the Unsplash License. Credits are written to
  src/data/image-credits.json and listed in README.md.
* Images are centre-cropped to 3:2 and saved as progressive JPEGs in
  public/images/destinations (Next.js <Image> then serves AVIF/WebP sizes).
* Wikimedia only serves standard thumbnail widths (e.g. 960/1280 px) and
  asks bots to throttle, so the script waits between downloads and resumes.
"""

import io
import json
import sys
import time
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DEST = ROOT / "public" / "images" / "destinations"
HERO = ROOT / "public" / "images" / "hero"
CREDITS = ROOT / "src" / "data" / "image-credits.json"
UA = "SkyFareDemoBot/1.0 (open-source demo app; images are credited in README) python-urllib"

# airport code -> candidate index in the Openverse result list
CHOICE = {
    "DEL": 1, "BOM": 0, "BLR": 0, "MAA": 0, "HYD": 4, "CCU": 0, "COK": 2, "GOI": 2,
    "JAI": 0, "DXB": 6, "DOH": 0, "SIN": 1, "KUL": 6, "BKK": 0, "LHR": 10, "CDG": 3, "JFK": 3,
}

# Unsplash-licensed hero photo (verified photographer + page).
UNSPLASH = {
    "hero": {
        "url": "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=2000&q=80&fm=jpg&fit=crop",
        "title": "Aerial photography of airliner wing above clouds",
        "creator": "Ross Parmly",
        "creator_url": "https://unsplash.com/@rparmly",
        "license": "Unsplash License",
        "license_url": "https://unsplash.com/license",
        "page": "https://unsplash.com/photos/rf6ywHVkrlY",
    }
}


def wm_thumb(url: str, width: int) -> str:
    if "upload.wikimedia.org/wikipedia/commons/" in url and "/thumb/" not in url:
        name = url.rsplit("/", 1)[1]
        return url.replace("/wikipedia/commons/", "/wikipedia/commons/thumb/") + f"/{width}px-{name}"
    return url


def fetch(url: str, tries: int = 4) -> bytes:
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:  # type: ignore[attr-defined]
            if e.code == 429 and attempt < tries - 1:
                time.sleep(20 * (attempt + 1))
                continue
            raise
    raise RuntimeError("unreachable")


def crop_3x2(im: Image.Image) -> Image.Image:
    w, h = im.size
    target = 3 / 2
    if w / h > target:
        nw = int(h * target)
        x = (w - nw) // 2
        return im.crop((x, 0, x + nw, h))
    nh = int(w / target)
    y = max(0, (h - nh) // 2)
    return im.crop((0, y, w, y + nh))


def license_label(lic: str, ver: str | None) -> str:
    lic = (lic or "").lower()
    if lic == "cc0":
        return "CC0 1.0"
    if lic == "pdm":
        return "Public Domain Mark"
    return f"CC {lic.upper()} {ver or ''}".strip()


def main():
    cand = json.load(open(sys.argv[1]))
    preview = len(sys.argv) > 2 and sys.argv[2] == "preview"
    DEST.mkdir(parents=True, exist_ok=True)
    HERO.mkdir(parents=True, exist_ok=True)
    credits = json.loads(CREDITS.read_text()) if CREDITS.exists() else {}

    for key, idx in CHOICE.items():
        out = DEST / f"{key.lower()}.jpg"
        if out.exists() and key in credits and not preview:
            continue
        r = cand[key][idx]
        url = wm_thumb(r["url"], 500 if preview else 1280)
        try:
            data = fetch(url)
        except Exception as e:  # noqa: BLE001
            print("FAIL", key, e, flush=True)
            time.sleep(10)
            continue
        im = crop_3x2(Image.open(io.BytesIO(data)).convert("RGB"))
        if not preview:
            im.thumbnail((1200, 800), Image.LANCZOS)
        im.save(out if not preview else Path("/tmp/sfprev") / f"{key}.jpg", "JPEG", quality=80, optimize=True, progressive=True)
        credits[key] = {
            "file": f"/images/destinations/{key.lower()}.jpg",
            "title": r["title"],
            "creator": (r["creator"] or "Unknown").strip(),
            "creator_url": r.get("creator_url"),
            "license": license_label(r["license"], r.get("license_version")),
            "license_url": r.get("license_url"),
            "page": r["foreign_landing_url"],
            "source": "Wikimedia Commons" if r["source"] == "wikimedia" else r["source"],
        }
        print("ok", key, im.size, flush=True)
        time.sleep(6)

    if not preview:
        for key, u in UNSPLASH.items():
            out = HERO / "sky-wing.jpg"
            if not out.exists():
                im = Image.open(io.BytesIO(fetch(u["url"]))).convert("RGB")
                im.thumbnail((2000, 1400), Image.LANCZOS)
                im.save(out, "JPEG", quality=78, optimize=True, progressive=True)
            credits[key] = {
                "file": "/images/hero/sky-wing.jpg",
                "title": u["title"],
                "creator": u["creator"],
                "creator_url": u["creator_url"],
                "license": u["license"],
                "license_url": u["license_url"],
                "page": u["page"],
                "source": "Unsplash",
            }
        CREDITS.parent.mkdir(parents=True, exist_ok=True)
        CREDITS.write_text(json.dumps(credits, indent=2, ensure_ascii=False) + "\n")
        print("credits written", len(credits))


if __name__ == "__main__":
    main()
