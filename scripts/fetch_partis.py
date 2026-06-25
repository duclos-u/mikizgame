#!/usr/bin/env python3
"""
Update `partis` and add `currentOrLastParti` to all politicians.

  - Deputies (have groupe in mandats): partis = [groupe], currentOrLastParti = groupe
  - Historical with partis already set: currentOrLastParti = partis[-1]
  - Neither (112 historical technocrats): Wikipedia REST API party parsing
"""

import json
import re
import time
import urllib.request
import urllib.parse
import os
import sys

sys.stdout.reconfigure(line_buffering=True)

REST_API = "https://fr.wikipedia.org/api/rest_v1/page/summary/{}"
PROGRESS_FILE = "/tmp/partis_progress.json"

# Party name patterns in French Wikipedia extracts
PARTY_PATTERNS = [
    re.compile(
        r'\bmembre (?:du|de la|de l\'|des) ([A-ZÀ-Ÿ][\wÀ-ÿ\'\- ]{3,50}?)(?=\s*[,.(]|\s+et\b|\s+en\b|\s+depuis\b|$)',
        re.IGNORECASE,
    ),
    re.compile(
        r'\bprésident(?:e)? (?:du|de la|de l\'|des) ([A-ZÀ-Ÿ][\wÀ-ÿ\'\- ]{3,50}?)(?=\s*[,.(]|\s+et\b|\s+en\b|\s+depuis\b|$)',
        re.IGNORECASE,
    ),
    re.compile(
        r'\bsecrétaire général(?:e)? (?:du|de la|de l\'|des) ([A-ZÀ-Ÿ][\wÀ-ÿ\'\- ]{3,50}?)(?=\s*[,.(]|\s+et\b|\s+en\b|\s+depuis\b|$)',
        re.IGNORECASE,
    ),
    re.compile(
        r'\bfondateur (?:du|de la|de l\'|des) ([A-ZÀ-Ÿ][\wÀ-ÿ\'\- ]{3,50}?)(?=\s*[,.(]|\s+et\b|\s+en\b|\s+depuis\b|$)',
        re.IGNORECASE,
    ),
]

# Known political party names that appear in extracts (to help trim regex captures)
KNOWN_PARTY_PREFIXES = [
    "Rassemblement", "Parti", "Union", "Mouvement", "Front", "Alliance",
    "Fédération", "Ligue", "Centre", "Gauche", "Droite", "République",
    "La France", "Les Républicains", "Renaissance", "Horizons",
]


def parse_party(extract: str):
    if not extract:
        return None
    for pat in PARTY_PATTERNS:
        m = pat.search(extract)
        if m:
            candidate = m.group(1).strip().rstrip(",.(")
            # Reject implausibly long or short captures
            if 4 <= len(candidate) <= 60:
                return candidate
    return None


def fetch_summary(title: str):
    url = REST_API.format(urllib.parse.quote(title.replace(" ", "_"), safe=""))
    req = urllib.request.Request(
        url, headers={"User-Agent": "PartisBot/1.0 (politics.json enrichment)"}
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


def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE) as f:
            return json.load(f)
    return {}


def save_progress(p):
    with open(PROGRESS_FILE, "w") as f:
        json.dump(p, f, ensure_ascii=False)


def main():
    with open("MikizBack/src/data/politics.json") as f:
        data = json.load(f)
    membres = data["membres"]
    total = len(membres)

    progress = load_progress()
    print(f"Starting. Cached: {len(progress)}/{total}", flush=True)

    # Identify the three categories
    deputies = []       # have groupe, no partis
    has_partis = []     # have partis already
    neither = []        # neither

    for m in membres:
        groupe = None
        for mn in m.get("mandats", []):
            if mn.get("groupe"):
                groupe = mn["groupe"]
                break
        if groupe:
            deputies.append((m, groupe))
        elif m.get("partis"):
            has_partis.append(m)
        else:
            neither.append(m)

    print(f"Deputies (groupe): {len(deputies)}", flush=True)
    print(f"Has partis:        {len(has_partis)}", flush=True)
    print(f"Neither:           {len(neither)}", flush=True)

    # --- Category 1: Deputies ---
    print("\nProcessing deputies…", flush=True)
    for m, groupe in deputies:
        m["partis"] = [groupe]
        m["currentOrLastParti"] = groupe

    print(f"  Done: {len(deputies)} deputies set.", flush=True)

    # --- Category 2: Historical with partis ---
    print("\nProcessing historical (have partis)…", flush=True)
    for m in has_partis:
        m["currentOrLastParti"] = m["partis"][-1]

    print(f"  Done: {len(has_partis)} set.", flush=True)

    # --- Category 3: Neither — Wikipedia fetch ---
    print(f"\nFetching parties for {len(neither)} historical politicians…", flush=True)
    wiki_found = 0

    for i, m in enumerate(neither):
        prenom = m.get("prenom", "")
        nom = m.get("nom", "")
        key = f"{prenom}|{nom}"

        if key in progress:
            party = progress[key]
        else:
            extract = fetch_summary(f"{prenom} {nom}")
            party = parse_party(extract) if extract else None
            progress[key] = party
            if (i + 1) % 10 == 0:
                save_progress(progress)
            print(f"  [{i+1}/{len(neither)}] {prenom} {nom} -> {party}", flush=True)
            time.sleep(0.35)

        if party:
            m["partis"] = [party]
            m["currentOrLastParti"] = party
            wiki_found += 1
        else:
            m["currentOrLastParti"] = None

    save_progress(progress)
    print(f"  Wikipedia found: {wiki_found}/{len(neither)}", flush=True)

    # --- Write results ---
    with open("MikizBack/src/data/politics.json", "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    total_cp = sum(1 for m in membres if m.get("currentOrLastParti"))
    total_p = sum(1 for m in membres if m.get("partis"))
    print(f"\nDone!")
    print(f"  currentOrLastParti: {total_cp}/{total}")
    print(f"  partis non-empty:   {total_p}/{total}", flush=True)


if __name__ == "__main__":
    main()
