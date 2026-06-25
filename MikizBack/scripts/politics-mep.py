#!/usr/bin/env python3
"""
Enrich existing MEP entries and add new French MEPs from the European Parliament.
Strategy:
 - List all French MEPs from EP data API (application/ld+json)
 - For existing politicians in dataset: match by name, fetch individual data to get current group
 - For new MEPs (identifier > 200000, i.e., first elected 2024): fetch individual data, add to dataset
 - Participation scores: not available via EP public API (stats pages are SPA)
"""
from __future__ import annotations

import json
import re
import time
import unicodedata
import urllib.request
import urllib.parse
import urllib.error
import sys
from pathlib import Path

DATA_FILE = Path(__file__).parent.parent / "src/data/politics.json"
EP_API = "https://data.europarl.europa.eu/api/v2"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"

# EP political group short label → French party
EP_GROUP_TO_PARTY: dict[str, str | None] = {
    "PfE": "Rassemblement National",       # Patriots for Europe
    "ID": "Rassemblement National",         # Identité et Démocratie (prev)
    "ECR": "Reconquête",
    "PPE": "Les Républicains",
    "EPP": "Les Républicains",
    "Renew": "Renaissance",
    "RE": "Renaissance",
    "S&D": "Parti Socialiste",
    "Verts/ALE": "Les Écologistes",
    "Greens/EFA": "Les Écologistes",
    "GUE/NGL": "La France Insoumise",
    "LEFT": "La France Insoumise",
    "NI": None,
    "ESN": "Rassemblement National",
}

EP_GROUP_POLITISCORE: dict[str, int] = {
    "GUE/NGL": 15, "LEFT": 15,
    "Verts/ALE": 28, "Greens/EFA": 28,
    "S&D": 35,
    "Renew": 52, "RE": 52,
    "PPE": 65, "EPP": 65,
    "ECR": 72,
    "ID": 88,
    "PfE": 88,
    "ESN": 90,
    "NI": 50,
}


def normalize(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).lower().strip()


def ep_get(path: str) -> dict | None:
    url = f"{EP_API}{path}"
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "MikizBot/1.0",
            "Accept": "application/ld+json",
        })
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        print(f"  EP API error {e.code}: {path}", file=sys.stderr)
        return None
    except Exception as e:
        print(f"  EP API error: {e}", file=sys.stderr)
        return None


def get_current_group(mep_id: str) -> tuple[str | None, str | None]:
    """Fetch individual MEP data and return (group_label, org_id) for current active group."""
    d = ep_get(f"/meps/{mep_id}?api-version=v2")
    if not d or "data" not in d or not d["data"]:
        return None, None
    item = d["data"][0]
    current_group_org = None
    for m in item.get("hasMembership", []):
        cls = m.get("membershipClassification", "")
        if "EU_POLITICAL_GROUP" not in cls:
            continue
        end = m.get("memberDuring", {}).get("endDate", "ongoing")
        if end == "ongoing":
            current_group_org = m.get("organization", "")
            break
    if not current_group_org:
        return None, None
    org_id = current_group_org.split("/")[-1]
    group_d = ep_get(f"/corporate-bodies/{org_id}?api-version=v2")
    if group_d and "data" in group_d and group_d["data"]:
        label = group_d["data"][0].get("label")
        return label, org_id
    return None, None


def wikidata_for_name(prenom: str, nom: str) -> dict | None:
    title = f"{prenom}_{nom}".replace(" ", "_")
    params = urllib.parse.urlencode({
        "action": "wbgetentities", "sites": "frwiki", "titles": title,
        "props": "claims", "format": "json",
    })
    try:
        req = urllib.request.Request(
            f"{WIKIDATA_API}?{params}",
            headers={"User-Agent": "MikizBot/1.0 (education project)"},
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read())
    except Exception:
        return None


def extract_dob(entity: dict) -> str | None:
    claims = entity.get("claims", {}).get("P569", [])
    if not claims:
        return None
    val = claims[0].get("mainsnak", {}).get("datavalue", {}).get("value", {})
    t = val.get("time", "") if isinstance(val, dict) else ""
    return t.lstrip("+").split("T")[0][:10] if t else None


def extract_gender(entity: dict) -> str | None:
    claims = entity.get("claims", {}).get("P21", [])
    if not claims:
        return None
    gval = claims[0].get("mainsnak", {}).get("datavalue", {}).get("value", {})
    gid = gval.get("id", "") if isinstance(gval, dict) else ""
    return "M" if gid == "Q6581097" else "F" if gid == "Q6581072" else None


def main():
    with open(DATA_FILE, encoding="utf-8") as f:
        data = json.load(f)
    membres = data["membres"]

    name_index = {normalize(f"{p['prenom']} {p['nom']}"): i for i, p in enumerate(membres)}

    print("Fetching French MEP list from EP data API...")
    d = ep_get("/meps?europarl-term=10&country-of-representation=FR&api-version=v2")
    if not d or "data" not in d:
        print("ERROR: Could not fetch MEP list", file=sys.stderr)
        sys.exit(1)

    all_meps = d["data"]
    print(f"Got {len(all_meps)} French MEPs from EP API")

    enriched = 0
    added = 0
    skipped = 0

    for mep in all_meps:
        ep_id = mep.get("identifier", "")
        prenom = mep.get("givenName", "")
        nom = mep.get("familyName", "")
        if not ep_id or not prenom or not nom:
            continue

        is_new = int(ep_id) > 200000  # new MEPs first elected 2024+
        key = normalize(f"{prenom} {nom}")
        in_dataset = key in name_index

        if not in_dataset and not is_new:
            continue  # re-elected MEP not in our dataset — skip for now

        print(f"\nMEP: {prenom} {nom} (EP ID: {ep_id}, new={is_new}, in_dataset={in_dataset})")

        # Get current political group
        group_label, _ = get_current_group(ep_id)
        time.sleep(0.3)

        ed_mandat: dict = {
            "code_fonction": "ED",
            "fonction": "Eurodéputé(e)",
            "ep_id": ep_id,
            "date_fin_fonction": None,
            "groupe": group_label,
            "scoreParticipation": None,
            "scoreLoyaute": None,
        }

        if in_dataset:
            idx = name_index[key]
            p = membres[idx]
            ed_existing = next((m for m in p.get("mandats", []) if m.get("code_fonction") == "ED"), None)
            if ed_existing:
                if group_label:
                    ed_existing["groupe"] = group_label
                if "ep_id" not in ed_existing:
                    ed_existing["ep_id"] = ep_id
                ed_existing["date_fin_fonction"] = None
                print(f"  → enriched existing entry (group: {group_label})")
            else:
                p.setdefault("mandats", []).append(ed_mandat)
                print(f"  → added ED mandat to existing entry (group: {group_label})")
            enriched += 1
            continue

        # New MEP not in dataset — get birth + gender from Wikidata
        print(f"  Fetching Wikidata for new MEP...")
        wd = wikidata_for_name(prenom, nom)
        time.sleep(0.5)

        naissance = None
        genre = None
        if wd:
            entities = wd.get("entities", {})
            entity_list = [e for e in entities.values() if not e.get("missing")]
            if entity_list:
                naissance = extract_dob(entity_list[0])
                genre = extract_gender(entity_list[0])

        if not naissance or not genre:
            print(f"  SKIP: missing naissance={naissance} or genre={genre}")
            skipped += 1
            continue

        parti = None
        politiscore = 50
        if group_label:
            for gk, party in EP_GROUP_TO_PARTY.items():
                if gk.lower() in group_label.lower():
                    parti = party
                    politiscore = EP_GROUP_POLITISCORE.get(gk, 50)
                    break

        if not parti:
            print(f"  SKIP: could not determine party from group '{group_label}'")
            skipped += 1
            continue

        new_entry = {
            "prenom": prenom,
            "nom": nom,
            "politiscore": politiscore,
            "mandats": [ed_mandat],
            "partis": [parti],
            "currentOrLastParti": parti,
            "originRegion": None,
            "naissance": naissance,
            "deces": None,
            "genre": genre,
            "condamnation": None,
            "popularityScore": 0,
        }
        membres.append(new_entry)
        name_index[key] = len(membres) - 1
        print(f"  → added new entry (group: {group_label}, parti: {parti})")
        added += 1

    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    print(f"\n=== Done ===")
    print(f"Enriched existing: {enriched}")
    print(f"Added new:         {added}")
    print(f"Skipped:           {skipped}")


if __name__ == "__main__":
    main()
