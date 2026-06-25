#!/usr/bin/env python3
"""
Enrich politics.json with senator data from senat.fr ODSEN dataset.
- Step 1: For existing politicians, add SEN mandat if they have/had a senate mandate.
          Also fills deces from ODSEN Date_de_deces when Wikidata didn't catch it.
- Step 2: Add active senators not yet in the JSON (requires enough Wikidata data).
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
ODSEN_URL = "https://data.senat.fr/data/senateurs/ODSEN_GENERAL.json"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"

# ODSEN Groupe_politique code → French party name
ODSEN_GROUPE_TO_PARTY = {
    "Les Républicains": "Les Républicains",
    "LR": "Les Républicains",
    "UC": "Union Centriste",  # centre-droit
    "RDPI": "Renaissance",   # Rassemblement des démocrates progressistes et indépendants
    "INDEP": "Divers droite",
    "RDSE": "Divers gauche",  # Rassemblement Démocratique et Social Européen
    "SER": "Parti Socialiste",  # Socialiste et Républicain
    "PS": "Parti Socialiste",
    "GEST": "Les Écologistes",  # Gest = Écologistes, solidarité et territoires
    "CRCE": "Parti Communiste Français",  # Communiste, Républicain, Citoyen et Écologiste
    "RN": "Rassemblement National",
    "NI": None,
}

# Circonscription (département) → Region mapping
DEPT_TO_REGION: dict[str, str] = {
    # Île-de-France
    "Paris": "Île-de-France", "Seine-et-Marne": "Île-de-France", "Yvelines": "Île-de-France",
    "Essonne": "Île-de-France", "Hauts-de-Seine": "Île-de-France", "Seine-Saint-Denis": "Île-de-France",
    "Val-de-Marne": "Île-de-France", "Val-d'Oise": "Île-de-France",
    # Auvergne-Rhône-Alpes
    "Ain": "Auvergne-Rhône-Alpes", "Allier": "Auvergne-Rhône-Alpes", "Ardèche": "Auvergne-Rhône-Alpes",
    "Cantal": "Auvergne-Rhône-Alpes", "Drôme": "Auvergne-Rhône-Alpes", "Isère": "Auvergne-Rhône-Alpes",
    "Loire": "Auvergne-Rhône-Alpes", "Haute-Loire": "Auvergne-Rhône-Alpes", "Puy-de-Dôme": "Auvergne-Rhône-Alpes",
    "Rhône": "Auvergne-Rhône-Alpes", "Savoie": "Auvergne-Rhône-Alpes", "Haute-Savoie": "Auvergne-Rhône-Alpes",
    "Métropole de Lyon": "Auvergne-Rhône-Alpes",
    # Bourgogne-Franche-Comté
    "Côte-d'Or": "Bourgogne-Franche-Comté", "Doubs": "Bourgogne-Franche-Comté",
    "Jura": "Bourgogne-Franche-Comté", "Nièvre": "Bourgogne-Franche-Comté",
    "Haute-Saône": "Bourgogne-Franche-Comté", "Saône-et-Loire": "Bourgogne-Franche-Comté",
    "Yonne": "Bourgogne-Franche-Comté", "Territoire de Belfort": "Bourgogne-Franche-Comté",
    # Bretagne
    "Côtes-d'Armor": "Bretagne", "Finistère": "Bretagne", "Ille-et-Vilaine": "Bretagne", "Morbihan": "Bretagne",
    # Centre-Val de Loire
    "Cher": "Centre-Val de Loire", "Eure-et-Loir": "Centre-Val de Loire", "Indre": "Centre-Val de Loire",
    "Indre-et-Loire": "Centre-Val de Loire", "Loir-et-Cher": "Centre-Val de Loire", "Loiret": "Centre-Val de Loire",
    # Corse
    "Corse-du-Sud": "Corse", "Haute-Corse": "Corse",
    # Grand Est
    "Ardennes": "Grand Est", "Aube": "Grand Est", "Marne": "Grand Est", "Haute-Marne": "Grand Est",
    "Meurthe-et-Moselle": "Grand Est", "Meuse": "Grand Est", "Moselle": "Grand Est",
    "Bas-Rhin": "Grand Est", "Haut-Rhin": "Grand Est", "Vosges": "Grand Est",
    # Hauts-de-France
    "Aisne": "Hauts-de-France", "Nord": "Hauts-de-France", "Oise": "Hauts-de-France",
    "Pas-de-Calais": "Hauts-de-France", "Somme": "Hauts-de-France",
    # Normandie
    "Calvados": "Normandie", "Eure": "Normandie", "Manche": "Normandie",
    "Orne": "Normandie", "Seine-Maritime": "Normandie",
    # Nouvelle-Aquitaine
    "Charente": "Nouvelle-Aquitaine", "Charente-Maritime": "Nouvelle-Aquitaine",
    "Corrèze": "Nouvelle-Aquitaine", "Creuse": "Nouvelle-Aquitaine",
    "Dordogne": "Nouvelle-Aquitaine", "Gironde": "Nouvelle-Aquitaine",
    "Landes": "Nouvelle-Aquitaine", "Lot-et-Garonne": "Nouvelle-Aquitaine",
    "Pyrénées-Atlantiques": "Nouvelle-Aquitaine", "Deux-Sèvres": "Nouvelle-Aquitaine",
    "Vienne": "Nouvelle-Aquitaine", "Haute-Vienne": "Nouvelle-Aquitaine",
    # Occitanie
    "Ariège": "Occitanie", "Aude": "Occitanie", "Aveyron": "Occitanie", "Gard": "Occitanie",
    "Haute-Garonne": "Occitanie", "Gers": "Occitanie", "Hérault": "Occitanie",
    "Lot": "Occitanie", "Lozère": "Occitanie", "Hautes-Pyrénées": "Occitanie",
    "Pyrénées-Orientales": "Occitanie", "Tarn": "Occitanie", "Tarn-et-Garonne": "Occitanie",
    # Pays de la Loire
    "Loire-Atlantique": "Pays de la Loire", "Maine-et-Loire": "Pays de la Loire",
    "Mayenne": "Pays de la Loire", "Sarthe": "Pays de la Loire", "Vendée": "Pays de la Loire",
    # Provence-Alpes-Côte d'Azur
    "Alpes-de-Haute-Provence": "Provence-Alpes-Côte d'Azur",
    "Hautes-Alpes": "Provence-Alpes-Côte d'Azur",
    "Alpes-Maritimes": "Provence-Alpes-Côte d'Azur",
    "Bouches-du-Rhône": "Provence-Alpes-Côte d'Azur",
    "Var": "Provence-Alpes-Côte d'Azur", "Vaucluse": "Provence-Alpes-Côte d'Azur",
    # Overseas
    "Guadeloupe": "Guadeloupe", "Martinique": "Martinique",
    "Guyane": "Guyane", "La Réunion": "La Réunion", "Mayotte": "Mayotte",
    # Direct names
    "Corse": "Corse",
}


def normalize(s: str) -> str:
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s).lower().strip()


def parse_odsen_date(ds: str | None) -> str | None:
    """Convert '1930/06/19 00:00:00' → '1930-06-19'."""
    if not ds:
        return None
    try:
        return ds[:10].replace("/", "-")
    except Exception:
        return None


def wikidata_for_name(prenom: str, nom: str) -> dict | None:
    title = f"{prenom}_{nom}".replace(" ", "_")
    params = urllib.parse.urlencode({
        "action": "wbgetentities",
        "sites": "frwiki",
        "titles": title,
        "props": "claims",
        "format": "json",
    })
    url = f"{WIKIDATA_API}?{params}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "MikizBot/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception:
        return None


def wikidata_dob(entity: dict) -> str | None:
    claims = entity.get("claims", {}).get("P569", [])
    if not claims:
        return None
    tv = claims[0].get("mainsnak", {}).get("datavalue", {}).get("value", {})
    t = tv.get("time", "") if isinstance(tv, dict) else ""
    return t.lstrip("+").split("T")[0][:10] if t else None


def wikidata_gender(entity: dict) -> str | None:
    claims = entity.get("claims", {}).get("P21", [])
    if not claims:
        return None
    gval = claims[0].get("mainsnak", {}).get("datavalue", {}).get("value", {})
    gid = gval.get("id", "") if isinstance(gval, dict) else ""
    return "M" if gid == "Q6581097" else "F" if gid == "Q6581072" else None


def main():
    # Fetch ODSEN data
    print("Fetching ODSEN senator data from senat.fr...")
    try:
        req = urllib.request.Request(ODSEN_URL, headers={"User-Agent": "MikizBot/1.0"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            odsen = json.loads(resp.read())
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    senators = odsen.get("results", [])
    print(f"Loaded {len(senators)} senator records")

    actifs = [s for s in senators if s.get("Etat") == "ACTIF"]
    anciens = [s for s in senators if s.get("Etat") == "ANCIEN"]
    print(f"  Active: {len(actifs)}, Former: {len(anciens)}")

    with open(DATA_FILE, encoding="utf-8") as f:
        data = json.load(f)

    membres = data["membres"]

    # Build normalized name index
    name_index: dict[str, int] = {}
    for i, p in enumerate(membres):
        key = normalize(f"{p['prenom']} {p['nom']}")
        name_index[key] = i
        # Also index by nom only + prenom first char for fuzzy
        alt = normalize(f"{p['nom']} {p['prenom']}")
        name_index.setdefault(alt, i)

    enriched_existing = 0
    added_new = 0
    skipped = 0

    # --- Step 1: enrich existing politicians with SEN mandats ---
    print("\n--- Step 1: Adding SEN mandats to existing politicians ---")
    for s in senators:
        prenom = (s.get("Prenom_usuel") or "").strip()
        nom = (s.get("Nom_usuel") or "").strip()
        if not prenom or not nom:
            continue

        key1 = normalize(f"{prenom} {nom}")
        key2 = normalize(f"{nom} {prenom}")
        idx = name_index.get(key1) or name_index.get(key2)

        if idx is None:
            continue  # not in our dataset — handle in step 2

        p = membres[idx]
        name_display = f"{p['prenom']} {p['nom']}"

        # Check if SEN mandat already exists
        has_sen = any(m.get("code_fonction") == "SEN" for m in p.get("mandats", []))
        if has_sen:
            continue

        etat = s.get("Etat", "")
        circ = s.get("Circonscription") or ""
        groupe = s.get("Groupe_politique") or ""
        deces_odsen = parse_odsen_date(s.get("Date_de_deces"))

        sen_mandat = {
            "code_fonction": "SEN",
            "fonction": "Sénateur(trice)",
            "circonscription": circ,
            "groupe": groupe,
            "date_fin_fonction": None if etat == "ACTIF" else "unknown",
        }

        p.setdefault("mandats", []).append(sen_mandat)

        # Fill deces if ODSEN knows it and we don't
        if deces_odsen and not p.get("deces"):
            p["deces"] = deces_odsen

        print(f"  + SEN → {name_display} ({etat}, {circ})")
        enriched_existing += 1

    # --- Step 2: add active senators not in our dataset ---
    print("\n--- Step 2: Adding new active senators ---")
    for s in actifs:
        prenom = (s.get("Prenom_usuel") or "").strip()
        nom = (s.get("Nom_usuel") or "").strip()
        if not prenom or not nom:
            continue

        key1 = normalize(f"{prenom} {nom}")
        key2 = normalize(f"{nom} {prenom}")
        if key1 in name_index or key2 in name_index:
            continue  # already handled in step 1

        circ = s.get("Circonscription") or ""
        groupe = s.get("Groupe_politique") or ""
        naissance_odsen = parse_odsen_date(s.get("Date_naissance"))

        print(f"  New senator: {prenom} {nom} ({circ}, {groupe}) ...", end=" ", flush=True)

        # Try Wikidata for dob, gender
        wd = wikidata_for_name(prenom, nom)
        time.sleep(0.2)

        qualite = s.get("Qualite", "")
        genre_odsen = "F" if qualite in ("Mme", "Mlle") else "M" if qualite == "M." else None

        naissance = naissance_odsen
        genre = genre_odsen  # start with ODSEN; Wikidata may override with more precision

        if wd:
            entities = wd.get("entities", {})
            entity_list = [e for e in entities.values() if not e.get("missing")]
            if entity_list:
                entity = entity_list[0]
                dob = wikidata_dob(entity)
                if dob:
                    naissance = dob[:10]
                wd_genre = wikidata_gender(entity)
                if wd_genre:
                    genre = wd_genre

        if not naissance or not genre:
            print(f"SKIP (naissance={naissance}, genre={genre})")
            skipped += 1
            continue

        # Determine party
        parti = None
        for k, v in ODSEN_GROUPE_TO_PARTY.items():
            if k.lower() in groupe.lower():
                parti = v
                break

        # Politiscore from group
        politiscore_map = {
            "CRCE": 18, "RDSE": 32, "SER": 36, "PS": 36, "GEST": 30,
            "RDPI": 52, "UC": 58, "INDEP": 62, "LR": 65, "RN": 85,
        }
        politiscore = 50
        for k, v in politiscore_map.items():
            if k.lower() in groupe.lower():
                politiscore = v
                break

        if not parti:
            # Fallback: use group name directly
            parti = groupe if groupe else None

        if not parti:
            print(f"SKIP (no party)")
            skipped += 1
            continue

        origin_region = DEPT_TO_REGION.get(circ)

        new_entry = {
            "prenom": prenom,
            "nom": nom,
            "politiscore": politiscore,
            "mandats": [{
                "code_fonction": "SEN",
                "fonction": "Sénateur(trice)",
                "circonscription": circ,
                "groupe": groupe,
                "date_fin_fonction": None,
            }],
            "partis": [parti] if parti else [],
            "currentOrLastParti": parti,
            "originRegion": origin_region,
            "naissance": naissance,
            "genre": genre,
            "condamnation": None,
            "popularityScore": 0,
            "deces": None,
        }

        membres.append(new_entry)
        name_index[key1] = len(membres) - 1
        print(f"OK (naissance={naissance}, region={origin_region}, parti={parti})")
        added_new += 1

    # Save
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

    print(f"\n=== Done ===")
    print(f"Enriched existing (SEN added): {enriched_existing}")
    print(f"New senators added:            {added_new}")
    print(f"Skipped (insufficient data):   {skipped}")


if __name__ == "__main__":
    main()
