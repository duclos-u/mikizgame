#!/usr/bin/env python3
"""
Fetch origin regions for French politicians using the Wikipedia REST API.

Approach (avoids Wikidata / action-API rate limits):
  1. GET https://fr.wikipedia.org/api/rest_v1/page/summary/{Name}
  2. Parse the French extract for birth location patterns
  3. Map department name → French région (static table)
"""

import json
import urllib.request
import urllib.parse
import re
import time
import os
import sys

sys.stdout.reconfigure(line_buffering=True)

REST_API = "https://fr.wikipedia.org/api/rest_v1/page/summary/{}"
PROGRESS_FILE = "/tmp/politics_regions_progress.json"

# ---------------------------------------------------------------------------
# Static: département → région (2016 boundaries)
# ---------------------------------------------------------------------------
DEPT_TO_REGION = {
    'Ain': 'Auvergne-Rhône-Alpes',
    'Aisne': 'Hauts-de-France',
    'Allier': 'Auvergne-Rhône-Alpes',
    'Alpes-de-Haute-Provence': "Provence-Alpes-Côte d'Azur",
    'Hautes-Alpes': "Provence-Alpes-Côte d'Azur",
    'Alpes-Maritimes': "Provence-Alpes-Côte d'Azur",
    'Ardèche': 'Auvergne-Rhône-Alpes',
    'Ardennes': 'Grand Est',
    'Ariège': 'Occitanie',
    'Aube': 'Grand Est',
    'Aude': 'Occitanie',
    'Aveyron': 'Occitanie',
    'Bouches-du-Rhône': "Provence-Alpes-Côte d'Azur",
    'Calvados': 'Normandie',
    'Cantal': 'Auvergne-Rhône-Alpes',
    'Charente': 'Nouvelle-Aquitaine',
    'Charente-Maritime': 'Nouvelle-Aquitaine',
    'Cher': 'Centre-Val de Loire',
    'Corrèze': 'Nouvelle-Aquitaine',
    'Corse-du-Sud': 'Corse',
    'Haute-Corse': 'Corse',
    "Côte-d'Or": 'Bourgogne-Franche-Comté',
    "Côtes-d'Armor": 'Bretagne',
    'Creuse': 'Nouvelle-Aquitaine',
    'Dordogne': 'Nouvelle-Aquitaine',
    'Doubs': 'Bourgogne-Franche-Comté',
    'Drôme': 'Auvergne-Rhône-Alpes',
    'Eure': 'Normandie',
    'Eure-et-Loir': 'Centre-Val de Loire',
    'Finistère': 'Bretagne',
    'Gard': 'Occitanie',
    'Haute-Garonne': 'Occitanie',
    'Gers': 'Occitanie',
    'Gironde': 'Nouvelle-Aquitaine',
    'Hérault': 'Occitanie',
    'Ille-et-Vilaine': 'Bretagne',
    'Indre': 'Centre-Val de Loire',
    'Indre-et-Loire': 'Centre-Val de Loire',
    'Isère': 'Auvergne-Rhône-Alpes',
    'Jura': 'Bourgogne-Franche-Comté',
    'Landes': 'Nouvelle-Aquitaine',
    'Loir-et-Cher': 'Centre-Val de Loire',
    'Loire': 'Auvergne-Rhône-Alpes',
    'Haute-Loire': 'Auvergne-Rhône-Alpes',
    'Loire-Atlantique': 'Pays de la Loire',
    'Loiret': 'Centre-Val de Loire',
    'Lot': 'Occitanie',
    'Lot-et-Garonne': 'Nouvelle-Aquitaine',
    'Lozère': 'Occitanie',
    'Maine-et-Loire': 'Pays de la Loire',
    'Manche': 'Normandie',
    'Marne': 'Grand Est',
    'Haute-Marne': 'Grand Est',
    'Mayenne': 'Pays de la Loire',
    'Meurthe-et-Moselle': 'Grand Est',
    'Meuse': 'Grand Est',
    'Morbihan': 'Bretagne',
    'Moselle': 'Grand Est',
    'Nièvre': 'Bourgogne-Franche-Comté',
    'Nord': 'Hauts-de-France',
    'Oise': 'Hauts-de-France',
    'Orne': 'Normandie',
    'Pas-de-Calais': 'Hauts-de-France',
    'Puy-de-Dôme': 'Auvergne-Rhône-Alpes',
    'Pyrénées-Atlantiques': 'Nouvelle-Aquitaine',
    'Hautes-Pyrénées': 'Occitanie',
    'Pyrénées-Orientales': 'Occitanie',
    'Bas-Rhin': 'Grand Est',
    'Haut-Rhin': 'Grand Est',
    'Rhin': 'Grand Est',  # Collectivité européenne d'Alsace
    'Rhône': 'Auvergne-Rhône-Alpes',
    'Haute-Saône': 'Bourgogne-Franche-Comté',
    'Saône-et-Loire': 'Bourgogne-Franche-Comté',
    'Sarthe': 'Pays de la Loire',
    'Savoie': 'Auvergne-Rhône-Alpes',
    'Haute-Savoie': 'Auvergne-Rhône-Alpes',
    'Paris': 'Île-de-France',
    'Seine-Maritime': 'Normandie',
    'Seine-et-Marne': 'Île-de-France',
    'Yvelines': 'Île-de-France',
    'Deux-Sèvres': 'Nouvelle-Aquitaine',
    'Somme': 'Hauts-de-France',
    'Tarn': 'Occitanie',
    'Tarn-et-Garonne': 'Occitanie',
    'Var': "Provence-Alpes-Côte d'Azur",
    'Vaucluse': "Provence-Alpes-Côte d'Azur",
    'Vendée': 'Pays de la Loire',
    'Vienne': 'Nouvelle-Aquitaine',
    'Haute-Vienne': 'Nouvelle-Aquitaine',
    'Vosges': 'Grand Est',
    'Yonne': 'Bourgogne-Franche-Comté',
    'Territoire de Belfort': 'Bourgogne-Franche-Comté',
    'Essonne': 'Île-de-France',
    'Hauts-de-Seine': 'Île-de-France',
    'Seine-Saint-Denis': 'Île-de-France',
    'Val-de-Marne': 'Île-de-France',
    "Val-d'Oise": 'Île-de-France',
    # DOM-ROM
    'Guadeloupe': 'Guadeloupe',
    'Martinique': 'Martinique',
    'Guyane': 'Guyane',
    'La Réunion': 'La Réunion',
    'Réunion': 'La Réunion',
    'Mayotte': 'Mayotte',
    # Historical / alternate names that still appear in extracts
    'Seine': 'Île-de-France',
    'Seine-et-Oise': 'Île-de-France',
    'Seine-Inférieure': 'Normandie',
    'Basses-Alpes': "Provence-Alpes-Côte d'Azur",
    'Basses-Pyrénées': 'Nouvelle-Aquitaine',
    'Basses-Alpes': "Provence-Alpes-Côte d'Azur",
    'Rhône-et-Loire': 'Auvergne-Rhône-Alpes',
    'Côtes-du-Nord': 'Bretagne',
    'Alsace': 'Grand Est',
}

# Cities that commonly appear without a department in parentheses
CITY_TO_REGION = {
    'Paris': 'Île-de-France',
    'Boulogne-Billancourt': 'Île-de-France',
    'Saint-Cloud': 'Île-de-France',
    'Vincennes': 'Île-de-France',
    'Neuilly-sur-Seine': 'Île-de-France',
    'Levallois-Perret': 'Île-de-France',
    'Versailles': 'Île-de-France',
    'Meudon': 'Île-de-France',
    'Issy-les-Moulineaux': 'Île-de-France',
    'Boulogne': 'Île-de-France',
    'Suresnes': 'Île-de-France',
    'Courbevoie': 'Île-de-France',
    'Puteaux': 'Île-de-France',
    'Saint-Denis': 'Île-de-France',
    'Montreuil': 'Île-de-France',
    'Créteil': 'Île-de-France',
    'Ivry-sur-Seine': 'Île-de-France',
    'Colombes': 'Île-de-France',
    'Saint-Germain-en-Laye': 'Île-de-France',
    'Lyon': 'Auvergne-Rhône-Alpes',
    'Marseille': "Provence-Alpes-Côte d'Azur",
    'Toulouse': 'Occitanie',
    'Nice': "Provence-Alpes-Côte d'Azur",
    'Nantes': 'Pays de la Loire',
    'Bordeaux': 'Nouvelle-Aquitaine',
    'Lille': 'Hauts-de-France',
    'Roubaix': 'Hauts-de-France',
    'Tourcoing': 'Hauts-de-France',
    'Strasbourg': 'Grand Est',
    'Montpellier': 'Occitanie',
    'Rennes': 'Bretagne',
    'Saint-Étienne': 'Auvergne-Rhône-Alpes',
    'Le Havre': 'Normandie',
    'Reims': 'Grand Est',
    'Grenoble': 'Auvergne-Rhône-Alpes',
    'Dijon': 'Bourgogne-Franche-Comté',
    'Angers': 'Pays de la Loire',
    'Brest': 'Bretagne',
    'Nîmes': 'Occitanie',
    'Le Mans': 'Pays de la Loire',
    'Aix-en-Provence': "Provence-Alpes-Côte d'Azur",
    'Clermont-Ferrand': 'Auvergne-Rhône-Alpes',
    'Amiens': 'Hauts-de-France',
    'Caen': 'Normandie',
    'Limoges': 'Nouvelle-Aquitaine',
    'Tours': 'Centre-Val de Loire',
    'Metz': 'Grand Est',
    'Nancy': 'Grand Est',
    'Perpignan': 'Occitanie',
    'Rouen': 'Normandie',
    'Pau': 'Nouvelle-Aquitaine',
    'Besançon': 'Bourgogne-Franche-Comté',
    'Mulhouse': 'Grand Est',
    'Dunkerque': 'Hauts-de-France',
    'Avignon': "Provence-Alpes-Côte d'Azur",
    'Toulon': "Provence-Alpes-Côte d'Azur",
    'Poitiers': 'Nouvelle-Aquitaine',
    'Orléans': 'Centre-Val de Loire',
    'Béziers': 'Occitanie',
    'Valenciennes': 'Hauts-de-France',
    'Calais': 'Hauts-de-France',
    'Troyes': 'Grand Est',
    'Villeurbanne': 'Auvergne-Rhône-Alpes',
    'Quimper': 'Bretagne',
    'Lorient': 'Bretagne',
    'Vannes': 'Bretagne',
    'Saint-Nazaire': 'Pays de la Loire',
    'La Rochelle': 'Nouvelle-Aquitaine',
    'Colmar': 'Grand Est',
    'Bayonne': 'Nouvelle-Aquitaine',
    'Biarritz': 'Nouvelle-Aquitaine',
    'Angoulême': 'Nouvelle-Aquitaine',
    'Périgueux': 'Nouvelle-Aquitaine',
    'Agen': 'Nouvelle-Aquitaine',
    'Évreux': 'Normandie',
    'Caen': 'Normandie',
    'Cherbourg': 'Normandie',
    'Saint-Malo': 'Bretagne',
    'Auxerre': 'Bourgogne-Franche-Comté',
    'Châlons-en-Champagne': 'Grand Est',
    'Belfort': 'Bourgogne-Franche-Comté',
    'Chartres': 'Centre-Val de Loire',
    'Blois': 'Centre-Val de Loire',
    'Bourges': 'Centre-Val de Loire',
    # Overseas
    'Fort-de-France': 'Martinique',
    'Pointe-à-Pitre': 'Guadeloupe',
    'Cayenne': 'Guyane',
    'Saint-Denis': 'La Réunion',
    'Mamoudzou': 'Mayotte',
}


# ---------------------------------------------------------------------------
# Parsing
# ---------------------------------------------------------------------------

def find_region_in_extract(extract: str):
    if not extract:
        return None

    # Pattern 1: "né(e) ... à/au/aux/à la City (Department)"
    m = re.search(
        r'née? (?:[^.]{0,80}?) (?:à|au|aux|à la) [^(,\n]+\(([^)]+)\)',
        extract
    )
    if m:
        dept = m.group(1).strip()
        region = DEPT_TO_REGION.get(dept)
        if region:
            return region
        # Try partial match (e.g. "Bouches-du-Rhône" in "Bouches du Rhône")
        for key, val in DEPT_TO_REGION.items():
            if dept.lower() in key.lower() or key.lower() in dept.lower():
                return val

    # Pattern 2: "né(e) ... dans le Xe arrondissement de City"
    m2 = re.search(
        r'née? .{0,80}? dans .{0,30}? arrondissement de ([\wÀ-ÿ\-]+)',
        extract
    )
    if m2:
        city = m2.group(1).strip()
        region = CITY_TO_REGION.get(city) or DEPT_TO_REGION.get(city)
        if region:
            return region

    # Pattern 3: "né(e) ... à/au/à la City" (no department in parens) — try city lookup
    m3 = re.search(
        r'née? (?:[^.]{0,80}?) (?:à|au|aux|à la) ([A-ZÀ-Ÿ][^,()\n]{2,40})(?:\s*[,.]|$)',
        extract
    )
    if m3:
        city = m3.group(1).strip().rstrip(',.')
        region = CITY_TO_REGION.get(city) or DEPT_TO_REGION.get(city)
        if region:
            return region

    return None


# ---------------------------------------------------------------------------
# Wikipedia REST API
# ---------------------------------------------------------------------------

def fetch_summary(title: str):
    url = REST_API.format(urllib.parse.quote(title.replace(' ', '_'), safe=''))
    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'PoliticsGameBot/1.0 (politics.json enrichment)'}
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read())
            return data.get('extract', '')
    except urllib.error.HTTPError as e:
        if e.code == 429:
            wait = int(e.headers.get('Retry-After', 30))
            print(f"  [429 Retry-After {wait}s]", flush=True)
            time.sleep(wait + 1)
            # retry once
            try:
                with urllib.request.urlopen(req, timeout=12) as resp:
                    return json.loads(resp.read()).get('extract', '')
            except Exception:
                return None
        return None
    except Exception:
        return None


def find_region(prenom: str, nom: str):
    # Try the most likely Wikipedia title first
    candidates = [
        f"{prenom} {nom}",
    ]
    # Some politicians have disambiguation: try "(homme politique)" / "(femme politique)"
    # Only if the first title returned something ambiguous
    for title in candidates:
        extract = fetch_summary(title)
        if extract:
            region = find_region_in_extract(extract)
            if region:
                return region
            # If extract doesn't have birth info, might be a disambiguation page — skip
    return None


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE) as f:
            return json.load(f)
    return {}


def save_progress(progress):
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(progress, f, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    with open('MikizBack/src/data/politics.json') as f:
        data = json.load(f)

    membres = data['membres']
    total = len(membres)
    progress = load_progress()
    print(f"Starting. Cached: {len(progress)}/{total}", flush=True)

    for i, membre in enumerate(membres):
        prenom = membre.get('prenom', '')
        nom = membre.get('nom', '')
        key = f"{prenom}|{nom}"

        if key in progress:
            if i % 100 == 0:
                found = sum(1 for v in progress.values() if v)
                print(f"  [{i}/{total}] cached — {found} found so far", flush=True)
            continue

        region = find_region(prenom, nom)
        progress[key] = region

        if (i + 1) % 25 == 0:
            save_progress(progress)
            found = sum(1 for v in progress.values() if v)
            print(f"  [{i+1}/{total}] {prenom} {nom} -> {region}  (total found: {found})", flush=True)
        else:
            print(f"  [{i+1}/{total}] {prenom} {nom} -> {region}", flush=True)

        time.sleep(0.3)

    save_progress(progress)

    # Write results
    found = 0
    for membre in membres:
        key = f"{membre.get('prenom','')}|{membre.get('nom','')}"
        region = progress.get(key)
        membre['originRegion'] = region
        if region:
            found += 1

    with open('MikizBack/src/data/politics.json', 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\nDone! originRegion found: {found}/{total}", flush=True)


if __name__ == '__main__':
    main()
