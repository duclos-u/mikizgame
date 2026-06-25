#!/usr/bin/env python3
"""
Add top-level `naissance` (YYYY-MM-DD or YYYY) to all politicians.

  - Deputies: copy from mandats[].naissance (already present)
  - Others: fetch from French Wikipedia REST summary and parse the extract
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
PROGRESS_FILE = "/tmp/birthdates_progress.json"

MONTHS = {
    'janvier': '01', 'février': '02', 'mars': '03', 'avril': '04',
    'mai': '05', 'juin': '06', 'juillet': '07', 'août': '08',
    'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12',
}

# Pre-compile birth date patterns
# "né(e) [Nom] le 15 janvier 1912"
_DATE_FULL = re.compile(
    r'née? (?:[^.]{0,60}?)le (\d{1,2})[eʳ]? (' + '|'.join(MONTHS) + r') (\d{4})',
    re.IGNORECASE
)
# fallback: just a 4-digit year near "né"
_DATE_YEAR = re.compile(r'née? (?:[^.]{0,60}?)(\d{4})', re.IGNORECASE)


def parse_birth_date(extract: str):
    if not extract:
        return None
    m = _DATE_FULL.search(extract)
    if m:
        day = m.group(1).zfill(2)
        month = MONTHS[m.group(2).lower()]
        year = m.group(3)
        return f"{year}-{month}-{day}"
    m2 = _DATE_YEAR.search(extract)
    if m2:
        year = int(m2.group(1))
        # Sanity check: politicians are born between 1850 and 2000
        if 1850 <= year <= 2000:
            return str(year)
    return None


def fetch_summary(title: str):
    url = REST_API.format(urllib.parse.quote(title.replace(' ', '_'), safe=''))
    req = urllib.request.Request(
        url,
        headers={'User-Agent': 'BirthdateBot/1.0 (politics.json enrichment)'}
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=12) as resp:
                return json.loads(resp.read()).get('extract', '')
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code == 429:
                wait = int(e.headers.get('Retry-After', 30)) + 2
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


def save_progress(progress):
    with open(PROGRESS_FILE, 'w') as f:
        json.dump(progress, f, ensure_ascii=False)


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

        # --- Check if birth date already exists in mandats (deputies) ---
        existing = None
        for mn in membre.get('mandats', []):
            if mn.get('naissance'):
                existing = mn['naissance']
                break

        if existing:
            # Already has birth date from deputy data — just ensure top-level field
            if key not in progress:
                progress[key] = existing
            continue

        # --- Need to fetch from Wikipedia ---
        if key in progress:
            if i % 100 == 0:
                found = sum(1 for v in progress.values() if v)
                print(f"  [{i}/{total}] cached — {found} found so far", flush=True)
            continue

        extract = fetch_summary(f"{prenom} {nom}")
        birth = parse_birth_date(extract)
        progress[key] = birth

        if (i + 1) % 25 == 0:
            save_progress(progress)
            found = sum(1 for v in progress.values() if v)
            print(f"  [{i+1}/{total}] {prenom} {nom} -> {birth}  (total: {found})", flush=True)
        else:
            print(f"  [{i+1}/{total}] {prenom} {nom} -> {birth}", flush=True)

        time.sleep(0.35)

    save_progress(progress)

    # --- Write top-level naissance to JSON ---
    found = 0
    for membre in membres:
        prenom = membre.get('prenom', '')
        nom = membre.get('nom', '')
        key = f"{prenom}|{nom}"

        # Prefer existing deputy naissance
        birth = None
        for mn in membre.get('mandats', []):
            if mn.get('naissance'):
                birth = mn['naissance']
                break

        if not birth:
            birth = progress.get(key)

        membre['naissance'] = birth
        if birth:
            found += 1

    with open('MikizBack/src/data/politics.json', 'w') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\nDone! naissance set: {found}/{total}", flush=True)


if __name__ == '__main__':
    main()
