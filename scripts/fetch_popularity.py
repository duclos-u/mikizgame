#!/usr/bin/env python3
"""
Add popularityScore (0-100), sitelinkCount, and monthlyPageViews to each politician.

Phase 1: Wikidata sitelinks count via wbgetentities (batch 50, ~40 seconds)
Phase 2: Wikipedia FR monthly pageviews via Wikimedia API (sequential, ~8 min)
Phase 3: Normalise + write to politics.json
"""

import json, math, time, urllib.request, urllib.parse, sys, os
from datetime import date

sys.stdout.reconfigure(line_buffering=True)

def _pageview_window():
    end = date.today().replace(day=1)
    m = end.month - 6
    y = end.year + (m - 1) // 12
    m = (m - 1) % 12 + 1
    start = date(y, m, 1)
    return start.strftime("%Y%m%d"), end.strftime("%Y%m%d")

_start_ym, _end_ym = _pageview_window()

WD_ACTION      = "https://www.wikidata.org/w/api.php"
PAGEVIEWS_URL  = (
    "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article"
    f"/fr.wikipedia.org/all-access/user/{{title}}/monthly/{_start_ym}/{_end_ym}"
)
POLITICS       = "MikizBack/src/data/politics.json"
QID_CACHE      = "/tmp/qid_cache.json"
SITELINKS_CACHE = "/tmp/sitelinks_cache.json"
PAGEVIEWS_CACHE = "/tmp/pageviews_cache.json"
BATCH          = 50


def load_cache(path):
    if os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return {}


def save_cache(data, path):
    with open(path, "w") as f:
        json.dump(data, f, ensure_ascii=False)


# ---------------------------------------------------------------------------
# Phase 1: Sitelinks
# ---------------------------------------------------------------------------

def fetch_sitelinks_batch(qids):
    params = {
        "action": "wbgetentities",
        "ids": "|".join(qids),
        "props": "sitelinks",
        "format": "json",
    }
    url = WD_ACTION + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "PopBot/1.0 (politics.json enrichment)"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                resp = json.loads(r.read())
            result = {}
            for qid, entity in resp.get("entities", {}).items():
                result[qid] = len(entity.get("sitelinks", {}))
            return result
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = int(e.headers.get("Retry-After", 60)) + 5
                print(f"  [429 wait {wait}s]", flush=True)
                time.sleep(wait)
            elif attempt < 2:
                time.sleep(2 * (attempt + 1))
        except Exception:
            if attempt < 2:
                time.sleep(2)
    return {}


# ---------------------------------------------------------------------------
# Phase 2: Pageviews
# ---------------------------------------------------------------------------

def fetch_pageviews(title):
    url = PAGEVIEWS_URL.format(title=urllib.parse.quote(title.replace(" ", "_"), safe=""))
    req = urllib.request.Request(url, headers={"User-Agent": "PopBot/1.0 (politics.json enrichment)"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=12) as r:
                data = json.loads(r.read())
            items = data.get("items", [])
            if not items:
                return 0
            return sum(i["views"] for i in items) // len(items)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return 0
            if e.code == 429:
                wait = int(e.headers.get("Retry-After", 30)) + 2
                print(f"  [429 wait {wait}s]", flush=True)
                time.sleep(wait)
            elif attempt < 2:
                time.sleep(2)
        except Exception:
            if attempt < 2:
                time.sleep(2)
    return 0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    with open(POLITICS) as f:
        data = json.load(f)
    membres = data["membres"]
    total   = len(membres)

    qid_cache = load_cache(QID_CACHE)

    # ---- Phase 1: Sitelinks ----
    print("Phase 1: Fetching sitelinks from Wikidata…", flush=True)
    sitelinks_cache = load_cache(SITELINKS_CACHE)
    all_qids        = [v for v in qid_cache.values() if v]
    need_sl         = [q for q in all_qids if q not in sitelinks_cache]
    print(f"  Cached: {len(sitelinks_cache)}, need: {len(need_sl)}", flush=True)

    for i in range(0, len(need_sl), BATCH):
        batch  = need_sl[i:i + BATCH]
        result = fetch_sitelinks_batch(batch)
        sitelinks_cache.update(result)
        save_cache(sitelinks_cache, SITELINKS_CACHE)
        print(f"  [{min(i+BATCH, len(need_sl))}/{len(need_sl)}] sitelink batches done", flush=True)
        time.sleep(1.5)

    print(f"  Sitelinks fetched: {len(sitelinks_cache)}", flush=True)

    # ---- Phase 2: Pageviews ----
    print("\nPhase 2: Fetching Wikipedia FR monthly pageviews…", flush=True)
    pv_cache = load_cache(PAGEVIEWS_CACHE)
    need_pv  = [
        m for m in membres
        if f"{m['prenom']}|{m['nom']}" not in pv_cache
    ]
    print(f"  Cached: {len(pv_cache)}, need: {len(need_pv)}", flush=True)

    for i, m in enumerate(need_pv):
        key   = f"{m['prenom']}|{m['nom']}"
        title = f"{m['prenom']} {m['nom']}"
        views = fetch_pageviews(title)
        pv_cache[key] = views

        if (i + 1) % 50 == 0:
            save_cache(pv_cache, PAGEVIEWS_CACHE)
            print(f"  [{i+1}/{len(need_pv)}] {title} → {views:,} views/mo", flush=True)
        else:
            print(f"  [{i+1}/{len(need_pv)}] {title} → {views:,}", flush=True)

        time.sleep(0.35)

    save_cache(pv_cache, PAGEVIEWS_CACHE)

    # ---- Phase 3: Normalise + write ----
    print("\nPhase 3: Normalising + writing…", flush=True)

    # Collect raw values for all politicians
    raw = []
    for m in membres:
        key     = f"{m['prenom']}|{m['nom']}"
        pol_qid = qid_cache.get(f"{m['prenom']} {m['nom']}")
        sl      = sitelinks_cache.get(pol_qid, 0) if pol_qid else 0
        pv      = pv_cache.get(key, 0)
        raw.append((m, sl, pv))

    max_sl = max(r[1] for r in raw) or 1
    max_pv = max(r[2] for r in raw) or 1
    log_max_pv = math.log10(max_pv + 1)

    for m, sl, pv in raw:
        sl_score = (sl / max_sl) * 100
        pv_score = (math.log10(pv + 1) / log_max_pv) * 100
        score    = round(0.7 * pv_score + 0.3 * sl_score)
        m["popularityScore"]  = score
        m["sitelinkCount"]    = sl
        m["monthlyPageViews"] = pv

    with open(POLITICS, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # Show top 10
    scored = sorted(membres, key=lambda x: -x["popularityScore"])
    print("\nTop 10 by popularity:")
    for m in scored[:10]:
        print(f"  {m['prenom']} {m['nom']}: score={m['popularityScore']} "
              f"(views={m['monthlyPageViews']:,}, sitelinks={m['sitelinkCount']})")

    print(f"\nDone! popularityScore set for all {total} politicians.", flush=True)


if __name__ == "__main__":
    main()
