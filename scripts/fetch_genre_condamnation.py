#!/usr/bin/env python3
"""
Add `genre` (M/F) and `condamnation` to each politician in politics.json.

genre:
  - Deputies: derived from mandats[].civ ("M." → "M", "Mme" → "F")
  - Others: Wikipedia REST summary — detect "né" vs "née" in the extract

condamnation:
  - Scraped from casier-politique.fr homepage (single fetch, no browser needed)
  - 204 politicians with convictions; all others get null
"""

import json
import re
import time
import unicodedata
import urllib.request
import urllib.parse
import os
import sys
from html import unescape

sys.stdout.reconfigure(line_buffering=True)

REST_API = "https://fr.wikipedia.org/api/rest_v1/page/summary/{}"
CASIER_URL = "https://casier-politique.fr/"
PROGRESS_FILE = "/tmp/genre_progress.json"


# ---------------------------------------------------------------------------
# Step 1: scrape casier-politique.fr
# ---------------------------------------------------------------------------

def fetch_convictions():
    """Return dict: full_name → list of conviction dicts."""
    req = urllib.request.Request(
        CASIER_URL,
        headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"}
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        html = r.read().decode("utf-8", errors="replace")

    m = re.search(r"parseElements\(String\.raw\`(\{.*?\})\`\)", html, re.DOTALL)
    if not m:
        raise RuntimeError("Could not find JSON in casier-politique.fr HTML")
    data = json.loads(m.group(1))

    # The main data array is in node "57" (may vary — find it dynamically)
    entries = []
    for node in data.values():
        if isinstance(node, dict):
            d = node.get("props", {}).get("data", [])
            if d and isinstance(d[0], dict) and "url" in d[0] and "tooltip" in d[0]:
                entries = d
                break

    convictions = {}
    for e in entries:
        url = e.get("url", "")
        tooltip = unescape(e.get("tooltip", ""))
        date = e.get("date")

        name_m = re.search(r"/p/Q\d+_(.+)", url)
        if not name_m:
            continue
        name = name_m.group(1).strip()

        affaire_m = re.search(r"<strong>[^<]+</strong><br>\n([^<]+)<br>", tooltip)
        affaire = affaire_m.group(1).strip() if affaire_m else None

        prison_m = re.search(r"<b>Prison:</b> ([^<]+)", tooltip)
        prison = prison_m.group(1).strip() if prison_m else None

        amende_m = re.search(r"<b>Amende:</b> ([^<]+)", tooltip)
        amende = amende_m.group(1).strip() if amende_m else None

        inelig_m = re.search(r"<b>Inéligibilité:</b> ([^<]+)", tooltip)
        inelig = inelig_m.group(1).strip() if inelig_m else None

        if name not in convictions:
            convictions[name] = []
        convictions[name].append({
            "affaire": affaire,
            "date": date,
            "prison": prison,
            "amende": amende,
            "ineligibilite": inelig,
        })

    print(f"Convictions scraped: {len(convictions)} politicians, "
          f"{sum(len(v) for v in convictions.values())} total entries", flush=True)
    return convictions


# ---------------------------------------------------------------------------
# Step 2: name matching helpers
# ---------------------------------------------------------------------------

def normalize(s: str) -> str:
    """Lowercase, strip accents, collapse spaces."""
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).strip().lower()


def build_lookup(membres):
    """Return dict: normalized_full_name → membre."""
    lookup = {}
    for m in membres:
        full = f"{m.get('prenom', '')} {m.get('nom', '')}".strip()
        lookup[normalize(full)] = m
    return lookup


def match_conviction_name(conv_name: str, lookup: dict):
    """Try to find a politician in lookup by conviction name."""
    key = normalize(conv_name)
    if key in lookup:
        return lookup[key]
    # Try last-name-only fallback (rare, but handles "Sarközy → Sarkozy")
    parts = key.split()
    if len(parts) >= 2:
        # Try just last word as surname
        for k, v in lookup.items():
            if k.endswith(parts[-1]):
                return v
    return None


# ---------------------------------------------------------------------------
# Step 3: Wikipedia genre detection
# ---------------------------------------------------------------------------

def fetch_summary(title: str):
    url = REST_API.format(urllib.parse.quote(title.replace(" ", "_"), safe=""))
    req = urllib.request.Request(
        url, headers={"User-Agent": "GenreBot/1.0 (politics.json enrichment)"}
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=12) as resp:
                return json.loads(resp.read()).get("extract", "")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code == 429:
                wait = int(e.headers.get("Retry-After", 30)) + 2
                print(f"  [429 wait {wait}s]", flush=True)
                time.sleep(wait)
            elif attempt < 2:
                time.sleep(2)
        except Exception:
            if attempt < 2:
                time.sleep(2)
    return None


def genre_from_extract(extract: str):
    if not extract:
        return None
    # "née" (with accent or e) = female; "né " (without) = male
    if re.search(r'\bnée\b', extract[:200]):
        return "F"
    if re.search(r'\bné\b', extract[:200]):
        return "M"
    return None


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE) as f:
            return json.load(f)
    return {}


def save_progress(p):
    with open(PROGRESS_FILE, "w") as f:
        json.dump(p, f, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    with open("MikizBack/src/data/politics.json") as f:
        data = json.load(f)
    membres = data["membres"]
    total = len(membres)

    # --- Convictions ---
    print("Fetching convictions from casier-politique.fr…", flush=True)
    convictions = fetch_convictions()
    lookup = build_lookup(membres)

    # Map convictions onto membres
    matched = 0
    for conv_name, conv_list in convictions.items():
        membre = match_conviction_name(conv_name, lookup)
        if membre:
            membre["_conv_key"] = conv_name  # temp marker
            matched += 1
        else:
            print(f"  [no match] {conv_name}", flush=True)
    print(f"Convictions matched: {matched}/{len(convictions)}", flush=True)

    # --- Genre ---
    progress = load_progress()
    print(f"\nFetching genre. Cached: {len(progress)}/{total}", flush=True)

    for i, membre in enumerate(membres):
        prenom = membre.get("prenom", "")
        nom = membre.get("nom", "")
        key = f"{prenom}|{nom}"

        # Try civ from deputy mandats first
        civ = None
        for mn in membre.get("mandats", []):
            if mn.get("civ"):
                civ = mn["civ"]
                break

        if civ:
            genre = "F" if "mme" in civ.lower() else "M"
            progress[key] = genre
            continue

        if key in progress:
            if i % 100 == 0:
                print(f"  [{i}/{total}] cached", flush=True)
            continue

        extract = fetch_summary(f"{prenom} {nom}")
        genre = genre_from_extract(extract)
        progress[key] = genre

        if (i + 1) % 25 == 0:
            save_progress(progress)
            found = sum(1 for v in progress.values() if v)
            print(f"  [{i+1}/{total}] {prenom} {nom} -> {genre}  (found: {found})", flush=True)
        else:
            print(f"  [{i+1}/{total}] {prenom} {nom} -> {genre}", flush=True)

        time.sleep(0.35)

    save_progress(progress)

    # --- Write results ---
    g_found = 0
    c_found = 0
    for membre in membres:
        prenom = membre.get("prenom", "")
        nom = membre.get("nom", "")
        key = f"{prenom}|{nom}"

        # Genre
        membre["genre"] = progress.get(key)
        if membre["genre"]:
            g_found += 1

        # Condamnation
        conv_key = membre.pop("_conv_key", None)
        if conv_key:
            membre["condamnation"] = convictions[conv_key]
            c_found += 1
        else:
            membre["condamnation"] = None

    with open("MikizBack/src/data/politics.json", "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\nDone!")
    print(f"  genre set:       {g_found}/{total}")
    print(f"  condamnation set: {c_found}/{total} (rest = null)", flush=True)


if __name__ == "__main__":
    main()
