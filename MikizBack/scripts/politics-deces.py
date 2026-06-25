#!/usr/bin/env python3
"""
Add death dates to politicians.json via a single Wikidata SPARQL query.
Uses the query.wikidata.org SPARQL endpoint (bulk query, much less rate-limited
than the wbgetentities REST API called 1300+ times individually).
"""
from __future__ import annotations

import json
import re
import time
import unicodedata
import urllib.request
import urllib.parse
import sys
from pathlib import Path

DATA_FILE = Path(__file__).parent.parent / "src/data/politics.json"
SPARQL_ENDPOINT = "https://query.wikidata.org/sparql"


def normalize(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).lower().strip()


def sparql_query(query: str) -> list[dict] | None:
    """Run a SPARQL query on Wikidata and return results as a list of bindings."""
    params = urllib.parse.urlencode({"query": query, "format": "json"})
    url = f"{SPARQL_ENDPOINT}?{params}"
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "MikizBot/1.0 (education project; contact: mikizgame@example.com)",
            "Accept": "application/sparql-results+json",
        })
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())
            return data.get("results", {}).get("bindings", [])
    except Exception as e:
        print(f"SPARQL ERROR: {e}", file=sys.stderr)
        return None


def fetch_deceased_fr_politicians() -> dict[str, str]:
    """
    Returns a dict: normalized_full_name → "YYYY-MM-DD" death date
    for all deceased French politicians on Wikidata.
    """
    # SPARQL: all humans with French citizenship who have a death date
    # and are known as politicians/ministers/presidents
    query = """
SELECT DISTINCT ?item ?label ?dod WHERE {
  ?item wdt:P31 wd:Q5 .
  ?item wdt:P27 wd:Q142 .
  ?item wdt:P570 ?dod .
  ?item rdfs:label ?label .
  FILTER(LANG(?label) = "fr")
}
LIMIT 50000
"""
    print("Running SPARQL query for deceased French nationals...")
    results = sparql_query(query)
    if results is None:
        return {}

    print(f"Got {len(results)} results from SPARQL")

    deaths: dict[str, str] = {}
    for r in results:
        label = r.get("label", {}).get("value", "")
        dod_raw = r.get("dod", {}).get("value", "")
        if not label or not dod_raw:
            continue
        # dod_raw is e.g. "2019-09-26T00:00:00Z"
        dod = dod_raw[:10]
        key = normalize(label)
        if key not in deaths:
            deaths[key] = dod

    return deaths


def fetch_deceased_fr_politicians_broad() -> dict[str, str]:
    """
    Broader query: all deceased humans from France (no occupation filter).
    Falls back to this if the first query returns too few results.
    """
    # We limit by using FILTER on date range to keep it manageable
    query = """
SELECT DISTINCT ?item ?label ?dod WHERE {
  ?item wdt:P31 wd:Q5 .
  ?item wdt:P27 wd:Q142 .
  ?item wdt:P570 ?dod .
  ?item rdfs:label ?label .
  FILTER(LANG(?label) = "fr")
  FILTER(YEAR(?dod) >= 1900)
}
LIMIT 100000
"""
    print("Running broad SPARQL query for deceased French nationals (1900+)...")
    results = sparql_query(query)
    if results is None:
        return {}

    print(f"Got {len(results)} results from broad SPARQL")

    deaths: dict[str, str] = {}
    for r in results:
        label = r.get("label", {}).get("value", "")
        dod_raw = r.get("dod", {}).get("value", "")
        if not label or not dod_raw:
            continue
        dod = dod_raw[:10]
        key = normalize(label)
        if key not in deaths:
            deaths[key] = dod

    return deaths


def main():
    with open(DATA_FILE, encoding="utf-8") as f:
        data = json.load(f)

    membres = data["membres"]

    # Fetch deaths from Wikidata via SPARQL
    deaths = fetch_deceased_fr_politicians()

    if len(deaths) < 100:
        print(f"WARNING: only {len(deaths)} results, trying broader query...", file=sys.stderr)
        deaths.update(fetch_deceased_fr_politicians_broad())

    if not deaths:
        print("ERROR: SPARQL query returned no results", file=sys.stderr)
        sys.exit(1)

    print(f"\nTotal deceased entries in SPARQL results: {len(deaths)}")
    print("Matching against politicians dataset...\n")

    matched = 0
    confirmed_alive = 0
    not_found = []

    for p in membres:
        prenom = p.get("prenom", "")
        nom = p.get("nom", "")
        full = normalize(f"{prenom} {nom}")
        full_rev = normalize(f"{nom} {prenom}")

        dod = deaths.get(full) or deaths.get(full_rev)

        if dod:
            p["deces"] = dod
            matched += 1
            print(f"  {prenom} {nom}: died {dod}")
        else:
            p["deces"] = None
            # Check if we can infer alive from naissance (born after 1955 → almost certainly alive)
            birth_year = int(p.get("naissance", "0000")[:4]) if p.get("naissance") else 0
            if birth_year < 1940:
                not_found.append(f"{prenom} {nom} (born {birth_year})")
            else:
                confirmed_alive += 1

    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    print(f"\n=== Done ===")
    print(f"Death dates added: {matched}")
    print(f"Confirmed/presumed alive: {confirmed_alive}")

    if not_found:
        print(f"\n=== REVIEW — born before 1940, no death date found ({len(not_found)}) ===")
        for name in not_found:
            print(f"  {name}")


if __name__ == "__main__":
    main()
